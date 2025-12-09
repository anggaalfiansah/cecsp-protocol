import type { Request, Response, NextFunction } from "express";
import type { IncomingHttpHeaders } from "http";
import { decryptAES, getHeadersToken, encryptAES, makeToken, decryptCCE, encryptCCE } from "../utils/crypto";

// DAFTAR ROUTE YANG DIKECUALIKAN (Plaintext Access)
const EXCLUDED_ROUTES = ["/health", "/metrics", "/public"];

// Helper: Clear sensitive headers
const clearSensitiveHeaders = (headers: IncomingHttpHeaders) => {
  Object.keys(headers).forEach((key) => {
    // Remove split-token headers (digit-prefix) and timestamp
    if (/^\d+-/.test(key) || key === "x-request-timestamp") {
      delete headers[key];
    }
  });
};

/**
 * Middleware: httpSecure
 * 1. Reconstructs JWT from split headers (Anti-Interception).
 * 2. Decrypts Request Body (AES).
 * 3. Encrypts Response Body (AES).
 * 4. Cleans up sensitive headers.
 */
export async function httpSecure(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();

  // Jika URL ada dalam daftar whitelist, skip seluruh security layer
  if (EXCLUDED_ROUTES.includes(req.path)) {
    const duration = Date.now() - start;
    // PLAIN LOGGING (Metadata only, NO DATA)
    console.log(`[PlainResponse] ${req.method} ${req.originalUrl} - ${res.statusCode} (${duration}ms)`);
    return next();
  }

  try {
    const timestamp = req.headers["x-request-timestamp"] as string;
    // --- 1. Token Reconstruction ---
    const reconstructed = getHeadersToken(req.headers);
    const token = makeToken(reconstructed);

    if (token) {
      req.headers.authorization = `Bearer ${token}`;
    } else {
      // Ensure no stale auth header exists if reconstruction failed
      delete req.headers.authorization;
    }

    // --- 2. Request Body Decryption ---
    if (req.body?.cipher && typeof req.body.cipher === "string") {
      try {
        const decryptedStr = decryptAES(decryptCCE(req.body.cipher, timestamp));
        req.body = JSON.parse(decryptedStr);
      } catch (e) {
        // Fallback if not JSON
        console.warn("[httpSecure] Body was encrypted but not valid JSON.");
      }
    }

    // Clean up headers so next middlewares/logs don't see the parts
    clearSensitiveHeaders(req.headers);

    // --- 3. Response Body Encryption (Override res.json) ---
    const originalJson = res.json; // Capture original function reference

    res.json = function (body: any): Response {
      // Jika status BUKAN 200 (misal 400, 401, 500), kirim plaintext asli.
      // Ini memudahkan debugging error di client tanpa harus decrypt error message.
      if (res.statusCode !== 200) {
        const duration = Date.now() - start;
        // ERROR LOGGING (Metadata only, NO DATA)
        console.log(`[ErrorResponse] ${req.method} ${req.originalUrl} - ${res.statusCode} (${duration}ms)`);
        return originalJson.call(this, body);
      }

      const ts = Date.now();
      res.setHeader("Access-Control-Expose-Headers", "X-Response-Timestamp");
      res.header("x-response-timestamp", ts.toString());

      // Prepare data for encryption
      const plainString = typeof body === "string" ? body : JSON.stringify(body);
      const encryptedBody = encryptCCE(encryptAES(plainString), ts.toString());
      const duration = Date.now() - start;
      // SECURE LOGGING (Metadata only, NO DATA)
      console.log(`[SecureResponse] ${req.method} ${req.originalUrl} - ${res.statusCode} (${duration}ms)`);

      // Return formatted cipher response
      return originalJson.call(this, { cipher: encryptedBody });
    };

    next();
  } catch (err) {
    console.error("[httpSecure] Critical Error:", err);
    return res.status(500).json({ error: "Secure Layer Error" });
  }
}
