// secureHeaders.ts
import CryptoJS from "crypto-js";
import { getAPP_IV, getAPP_KEY, getCCE_BASE, getCCE_SECRET } from "./secret";

/**
 * ----------------------------
 * Konfigurasi (pindahkan ke ENV)
 * ----------------------------
 * Jangan commit kunci ke repo. Hardcoded di sini hanya contoh.
 */
const KEY = getAPP_KEY() || "yoursecretkey123";
const IV = getAPP_IV() || "yoursecretiv1234";
const SECRETCCE = getCCE_SECRET() || "secretcce";
const BASECHARSCCE = getCCE_BASE() || "abcdefghijklmnopqrstuvwxyz0123456789";

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
   Token helpers (zipString + encryptToken)
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

/**
 * encryptToken:
 * - secureToken: JSON-stringified object
 * - ts: timestamp (number)
 *
 * Returns Record<"sequence-encryptedKey", "encryptedValue">
 */
export const encryptToken = (secureToken: string, ts: number): Record<string, string> => {
  if (!secureToken) return {};
  const tokenObj = JSON.parse(secureToken) as Record<string, string>;
  const keys = Object.keys(tokenObj);
  const totalKeys = keys.length;

  const isTsOdd = ts % 2 !== 0;
  const tsString = ts.toString();
  const saltA = zipString(tsString, BASECHARSCCE);
  const saltB = zipString(BASECHARSCCE, tsString);

  const out: Record<string, string> = {};
  keys.forEach((key, i) => {
    const seq = isTsOdd ? i + 1 : totalKeys - i;
    const combinedKey = `${key}|${ts}`;
    const combinedVal = `${tokenObj[key]}|${ts}`;

    const finalKey = i % 2 === 0 ? encryptCCE(combinedKey, saltA) : encryptCCE(combinedKey, saltB);
    const finalVal = i % 2 === 0 ? encryptCCE(combinedVal, saltB) : encryptCCE(combinedVal, saltA);

    /** Convert UTF-8 string -> Hex (string) */
    const toHex = (str: string) => CryptoJS.enc.Utf8.parse(str).toString(CryptoJS.enc.Hex);
    out[`${seq}-${toHex(finalKey)}`] = finalVal;
  });

  return out;
};

/* ------------------------------
   Small note:
   - This module assumes SECRETCCE & BASECHARSCCE are identical on client & server.
   - Always validate timestamp freshness and consider adding HMAC for integrity in production.
   ------------------------------ */
