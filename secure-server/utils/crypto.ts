// secureHeaders.ts
import CryptoJS from "crypto-js";
import type { IncomingHttpHeaders } from "http";
import type { Request } from "express";

/**
 * ----------------------------
 * Konfigurasi (pindahkan ke ENV)
 * ----------------------------
 * Jangan commit kunci ke repo. Hardcoded di sini hanya contoh.
 */
const KEY = process.env.APP_KEY || "yoursecretkey123";
const IV = process.env.APP_IV || "yoursecretiv1234";
const SECRETCCE = process.env.CCE_SECRET || "secretcce";
const BASECHARSCCE = process.env.CCE_BASE || "abcdefghijklmnopqrstuvwxyz0123456789";

/* ------------------------------
   AES helpers
   ------------------------------ */

/** Encrypt plain string with AES (returns base64 string) */
export const encryptAES = (data: string): string => {
  try {
    return CryptoJS.AES.encrypt(data, CryptoJS.enc.Utf8.parse(KEY), {
      iv: CryptoJS.enc.Utf8.parse(IV),
    }).toString();
  } catch (err) {
    console.error("encryptAES error:", err);
    throw err;
  }
};

/** Decrypt AES (returns plaintext string). Caller decides whether to JSON.parse. */
export const decryptAES = (cipherText: string): string => {
  try {
    const bytes = CryptoJS.AES.decrypt(cipherText, CryptoJS.enc.Utf8.parse(KEY), {
      iv: CryptoJS.enc.Utf8.parse(IV),
    });
    return bytes.toString(CryptoJS.enc.Utf8);
  } catch (err) {
    console.error("decryptAES error:", err);
    throw err;
  }
};

/* ------------------------------
   CCE substitution (client/server must share SECRETCCE & BASECHARSCCE)
   ------------------------------ */

/** Modular exponentiation (BigInt) to avoid huge Math.pow results */
const powMod = (base: number, exp: number, mod: number): number => {
  if (mod === 1) return 0;
  let result = 1n;
  let b = BigInt(base) % BigInt(mod);
  let e = BigInt(exp);
  const m = BigInt(mod);

  while (e > 0) {
    if (e & 1n) result = (result * b) % m;
    b = (b * b) % m;
    e >>= 1n;
  }
  return Number(result);
};

/** Build keyChars array from base + SECRETCCE preserving first occurrence */
const buildKeyChars = (base: string): string[] => {
  const combined = base + SECRETCCE;
  const seen = new Set<string>();
  const chars: string[] = [];
  for (const ch of combined) {
    if (!seen.has(ch)) {
      seen.add(ch);
      chars.push(ch);
    }
  }
  return chars;
};

/** Encrypt CCE */
export const encryptCCE = (text: string, base = BASECHARSCCE): string => {
  const keyChars = buildKeyChars(base);
  const m = keyChars.length;
  const n = text.length;
  return text
    .split("")
    .map((char, i) => {
      const iiMod = powMod(i + 1, i + 1, m);
      const index = keyChars.indexOf(char);
      if (index === -1) return char;
      const shift = (iiMod + n) % m;
      return keyChars[(index + shift) % m];
    })
    .join("");
};

/** Decrypt CCE */
export const decryptCCE = (cipher: string, base = BASECHARSCCE): string => {
  const keyChars = buildKeyChars(base);
  const m = keyChars.length;
  const n = cipher.length;
  return cipher
    .split("")
    .map((char, i) => {
      const iiMod = powMod(i + 1, i + 1, m);
      const index = keyChars.indexOf(char);
      if (index === -1) return char;
      const shift = (iiMod + n) % m;
      return keyChars[(index - shift + m) % m];
    })
    .join("");
};

/* ------------------------------
   Token helpers (zipString)
   ------------------------------ */

/** Interleave two strings (zip) */
const zipString = (str1: string, str2: string): string => {
  let out = "";
  const maxLength = Math.max(str1.length, str2.length);
  for (let i = 0; i < maxLength; i++) {
    if (i < str1.length) out += str1[i];
    if (i < str2.length) out += str2[i];
  }
  return out;
};

/* ------------------------------
   Server-side: reconstruct from headers
   ------------------------------ */

/**
 * getHeadersToken:
 * - headers: IncomingHttpHeaders (Node/Express)
 *
 * Returns: Record<originalKey, originalValue> (both decrypted).
 *
 * Notes:
 * - Expects x-request-timestamp header present (used for salts).
 * - Skips header pairs that fail verification.
 */
export const getHeadersToken = (headers: IncomingHttpHeaders): Record<string, string> => {
  // TTL untuk timestamp (ms). Sesuaikan jika perlu.
  const TIMESTAMP_TTL_MS = 30_000;

  // Ambil header timestamp (bisa string | string[] | undefined)
  const rawTs = headers["x-request-timestamp"];
  if (!rawTs) {
    // Tidak ada timestamp: tidak ada token untuk direkonstruksi
    return {};
  }

  const ts = String(Array.isArray(rawTs) ? rawTs[0] : rawTs).trim();
  const clientTs = Number(ts);
  if (Number.isNaN(clientTs)) {
    console.warn("Invalid x-request-timestamp (not a number)");
    return {};
  }

  const serverTs = Date.now();
  if (Math.abs(serverTs - clientTs) > TIMESTAMP_TTL_MS) {
    console.warn("Timestamp expired or future dated; rejecting header token (anti-replay).");
    return {};
  }

  const saltA = zipString(ts, BASECHARSCCE);
  const saltB = zipString(BASECHARSCCE, ts);

  // Kumpulkan header yang berformat "<seq>-<encKey>" => encVal
  const encPairs: Array<{ seq: number; encKey: string; encVal: string }> = [];
  for (const [rawKey, rawVal] of Object.entries(headers)) {
    if (!rawKey) continue;
    const m = rawKey.match(/^(\d+)-(.+)$/);
    if (!m) continue;
    const seq = parseInt(m[1], 10);
    if (Number.isNaN(seq)) continue;
    /** Convert Hex string -> UTF-8 string */
    const fromHex = (hex: string) => CryptoJS.enc.Hex.parse(hex).toString(CryptoJS.enc.Utf8);
    const encKey = fromHex(m[2]);
    if (!rawVal) continue;
    const encVal = Array.isArray(rawVal) ? rawVal[0] : rawVal;
    encPairs.push({ seq, encKey, encVal });
  }

  const decryptedItems: Array<{ seq: number; key: string; value: string }> = [];

  // Helper: try decrypt with given salt pair and verify suffix `|ts`
  const tryDecryptPair = (encKey: string, encVal: string, saltForKey: string, saltForVal: string) => {
    try {
      const decKey = decryptCCE(encKey, saltForKey);
      if (!decKey.endsWith(`|${ts}`)) return null;
      const decVal = decryptCCE(encVal, saltForVal);
      if (!decVal.endsWith(`|${ts}`)) return null;
      const keyName = decKey.slice(0, decKey.lastIndexOf("|"));
      const valStr = decVal.slice(0, decVal.lastIndexOf("|"));
      return { keyName, valStr };
    } catch {
      return null;
    }
  };

  for (const item of encPairs) {
    const { seq, encKey, encVal } = item;

    // Option A: key <- saltA, val <- saltB
    let ok = tryDecryptPair(encKey, encVal, saltA, saltB);
    if (ok) {
      decryptedItems.push({ seq, key: ok.keyName, value: ok.valStr });
      continue;
    }

    // Option B: key <- saltB, val <- saltA
    ok = tryDecryptPair(encKey, encVal, saltB, saltA);
    if (ok) {
      decryptedItems.push({ seq, key: ok.keyName, value: ok.valStr });
      continue;
    }

    // Kedua opsi gagal: log untuk diagnosa
    console.warn(`Failed to verify/decrypt header pair with sequence ${seq}`);
  }

  // Urutkan berdasarkan sequence dan bangun objek hasil
  decryptedItems.sort((a, b) => a.seq - b.seq);
  const reconstructed: Record<string, string> = {};
  for (const it of decryptedItems) {
    if (Object.prototype.hasOwnProperty.call(reconstructed, it.key)) {
      console.warn(`Duplicate key detected while reconstructing token: ${it.key} — overwriting previous value.`);
    }
    reconstructed[it.key] = it.value;
  }

  return reconstructed;
};

/* ------------------------------
   Helpers to turn reconstructed -> final token
   ------------------------------ */

/**
 * makeToken:
 * - concatenates all values in `reconstructed` (in insertion order) into a single string.
 * - This mirrors old behavior where you built token by appending values.
 */
export const makeToken = (tokenObj: Record<string, string>): string => {
  const fromHex = (hex: string) => CryptoJS.enc.Hex.parse(hex).toString(CryptoJS.enc.Utf8);

  // decode semua pasangan key/value
  const decoded: Record<string, string> = {};
  for (const k of Object.keys(tokenObj)) {
    const key = fromHex(decryptCCE(k)); // ex: "tkn_10"
    const val = fromHex(decryptCCE(tokenObj[k]));
    decoded[key] = val;
  }

  // sort natural: ambil angka setelah "tkn_"
  const sortedKeys = Object.keys(decoded).sort((a, b) => {
    const na = Number(a.replace("tkn_", ""));
    const nb = Number(b.replace("tkn_", ""));
    return na - nb;
  });

  // gabungkan sesuai urutan
  return sortedKeys.map((k) => decoded[k]).join("");
};

/* ------------------------------
   Utilities: clear sensitive headers from request (Express or Node)
   ------------------------------ */

/**
 * clearSensitiveHeadersFromRequest (Express Request)
 * - removes numeric-prefixed headers and x-request-timestamp
 * - optionally removes authorization header
 */
export const clearSensitiveHeadersExpress = (req: Request, opts: { removeAuthorization?: boolean } = {}) => {
  for (const key of Object.keys(req.headers)) {
    if (/^\d+-/.test(key) || key === "x-request-timestamp") {
      // @ts-ignore - delete on headers
      delete req.headers[key];
    }
  }
  if (opts.removeAuthorization && req.headers["authorization"]) {
    delete req.headers["authorization"];
  }
};

/**
 * clearSensitiveHeadersFromIncoming (IncomingMessage)
 */
export const clearSensitiveHeadersFromIncoming = (headers: IncomingHttpHeaders, opts: { removeAuthorization?: boolean } = {}) => {
  for (const key of Object.keys(headers)) {
    if (/^\d+-/.test(key) || key === "x-request-timestamp") {
      delete headers[key];
    }
  }
  if (opts.removeAuthorization && headers["authorization"]) {
    delete headers["authorization"];
  }
};

/* ------------------------------
   Small note:
   - This module assumes SECRETCCE & BASECHARSCCE are identical on client & server.
   - Always validate timestamp freshness and consider adding HMAC for integrity in production.
   ------------------------------ */
