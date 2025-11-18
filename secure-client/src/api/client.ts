// api/client.ts
import { decryptAES, encryptAES, encryptToken } from "../utils/crypto";
import axios, { type Method } from "axios";
import dayjs from "dayjs";
import type { LogEntry } from "../types";
import { retrieveRawToken } from "../utils/storage";

const API_BASE = "http://localhost:5000";

export const api = axios.create({
  baseURL: API_BASE,
});

export type AddLogFn = (entry: Omit<LogEntry, "id" | "time">) => void;

export interface SendRequestOptions {
  data?: unknown;
  withAuth?: boolean;
}

/**
 * sendRequest
 * - Mengirim request ke server, otomatis mengenkripsi body dan header (jika withAuth)
 * - Mencatat log request/response/error via addLog
 * - Mengembalikan hasil response yang sudah didekripsi (object / primitive sesuai payload)
 */
export async function sendRequest(addLog: AddLogFn, method: Method, path: string, token: string | null, opts?: SendRequestOptions) {
  const url = `${API_BASE}${path}`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  // Jika perlu menyertakan header terenkripsi (custom scheme)
  if (opts?.withAuth && token) {
    const securetoken = await retrieveRawToken(); // stringified map encryptedKey->encryptedVal
    const ts = Date.now();

    // encryptToken expects a JSON-stringified object — pass securetoken or "{}"
    const encryptedTokenPart = encryptToken(securetoken || "{}", ts);

    // transfer ke headers (bisa menghasilkan banyak header seperti "1-<encKey>": "<encVal>")
    for (const key of Object.keys(encryptedTokenPart)) {
      headers[key] = encryptedTokenPart[key];
    }

    headers["x-token-timestamp"] = ts.toString();
    // Note: we intentionally don't set Authorization header here; server reconstructs from numeric headers
  }

  // helper log fn
  function log(entry: Omit<LogEntry, "id" | "time">) {
    const time = dayjs().format("HH:mm:ss");
    addLog({ ...entry, time } as LogEntry);
  }

  // encrypt request body if provided
  const encryptedBody = opts?.data ? encryptAES(JSON.stringify(opts.data)) : undefined;

  // Log request (plaintext + encrypted)
  log({
    direction: "request",
    method,
    url,
    body: opts?.data ?? null,
    encryptedBody: encryptedBody ? { cipher: encryptedBody } : undefined,
    headers,
  });

  try {
    const res = await api.request({
      url: path,
      method,
      data: { cipher: encryptedBody },
      headers,
    });

    // server responds { cipher: "<...>" } — normalize
    const encryptedRaw = res.data && typeof res.data === "object" && "cipher" in res.data ? (res.data.cipher as string) : res.data;

    // try decrypting response body safely
    let decryptedString = "";
    try {
      decryptedString = decryptAES(encryptedRaw as string);
    } catch (err) {
      // log decryption error and rethrow after logging
      log({
        direction: "error",
        method,
        url,
        status: res.status,
        body: "Failed to decrypt response",
        headers: res.headers as Record<string, unknown>,
      });
      throw err;
    }

    // try parse JSON, fallback to raw string
    let parsedBody;
    try {
      parsedBody = JSON.parse(decryptedString);
    } catch {
      parsedBody = decryptedString;
    }

    // Log response
    log({
      direction: "response",
      method,
      url,
      status: res.status,
      encryptedBody: res.data,
      body: parsedBody,
      headers: res.headers as Record<string, unknown>,
    });

    return parsedBody;
  } catch (err: unknown) {
    if (axios.isAxiosError(err)) {
      log({
        direction: "error",
        method,
        url,
        status: err.response?.status,
        body: err.response?.data ?? err.message,
        headers: (err.response?.headers ?? err.config?.headers) as Record<string, unknown> | undefined,
      });
    } else {
      log({
        direction: "error",
        method,
        url,
        body: String(err),
      });
    }
    throw err;
  }
}
