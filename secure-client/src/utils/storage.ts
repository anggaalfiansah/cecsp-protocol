// storage.ts
import localforage from "localforage";
import CryptoJS from "crypto-js";
import { encryptCCE, decryptCCE } from "./crypto"; // Pastikan encryptCCE/decryptCCE sinkron antara client/server

/* -----------------------------
   Konfigurasi & Konstanta
   ----------------------------- */
const TOKEN_KEY_PREFIX = "tkn_";
const TOKEN_META_KEY = "secure_token_meta_count";

// KONFIGURASI DINAMIS BARU
const TARGET_HEADER_COUNT = 25; // Kita ingin token dipecah jadi +/- 25 bagian
const MIN_CHUNK_SIZE = 10; // Tapi jangan dipotong kekecilan (kurang dari 10 char)

/* -----------------------------
   localForage instance
   ----------------------------- */
export const store = localforage.createInstance({
  name: "secure-client-storage",
  driver: [localforage.INDEXEDDB, localforage.LOCALSTORAGE],
});

/* -----------------------------
   Utilities: split / hex encode / decode
   ----------------------------- */

/** * Hitung Chunk Size Dinamis
 */
function calculateDynamicChunkSize(totalLength: number): number {
  // Rumus: Panjang Total dibagi Target Jumlah Header
  const idealSize = Math.ceil(totalLength / TARGET_HEADER_COUNT);

  // Pastikan tidak lebih kecil dari batas minimum
  return Math.max(MIN_CHUNK_SIZE, idealSize);
}

/** * Split string menjadi array berdasarkan ukuran chunk DINAMIS
 */
function splitTokenDynamically(text: string): string[] {
  const chunkSize = calculateDynamicChunkSize(text.length);
  const result: string[] = [];

  for (let i = 0; i < text.length; i += chunkSize) {
    result.push(text.substring(i, i + chunkSize));
  }

  return result;
}

/** Convert UTF-8 string -> Hex (string) */
const toHex = (str: string) => CryptoJS.enc.Utf8.parse(str).toString(CryptoJS.enc.Hex);

/** Convert Hex string -> UTF-8 string */
const fromHex = (hex: string) => CryptoJS.enc.Hex.parse(hex).toString(CryptoJS.enc.Utf8);

/** Generate storage key terenkripsi dari nama key (menggunakan encryptCCE) */
const getStorageKey = (keyName: string): string => encryptCCE(toHex(keyName));

/* -----------------------------
   Main API
   ----------------------------- */

/**
 * storeToken
 * - Memecah token ke beberapa potongan (CHUNK_SIZE)
 * - Mengenkripsi setiap potongan dan menyimpannya ke localForage
 * - Menyimpan metadata jumlah potongan (juga terenkripsi)
 *
 * Behavior: membersihkan token lama terlebih dahulu (memanggil clearToken)
 */
export const storeToken = async (token: string): Promise<void> => {
  try {
    // Hapus token lama
    await clearToken();

    // Pakai fungsi split dinamis
    const parts = splitTokenDynamically(token);
    const totalParts = parts.length;
    const usedChunkSize = calculateDynamicChunkSize(token.length);

    console.log(`Dynamic Splitting: Length=${token.length} -> ChunkSize=${usedChunkSize} -> TotalParts=${totalParts}`);
    // --------------------------

    // Simpan metadata (jumlah pecahan)
    const metaKey = getStorageKey(TOKEN_META_KEY);
    const metaValue = encryptCCE(toHex(totalParts.toString()));
    await store.setItem(metaKey, metaValue);

    // Simpan tiap pecahan
    const savePromises = parts.map((part, idx) => {
      const partKey = getStorageKey(`${TOKEN_KEY_PREFIX}${idx}`);
      const encryptedPart = encryptCCE(toHex(part)); // Encrypt isi
      return store.setItem(partKey, encryptedPart);
    });

    await Promise.all(savePromises);
    console.log("Token stored successfully.");
  } catch (err) {
    console.error("Error storing token:", err);
    throw err;
  }
};

/**
 * retrieveToken
 * - Mengembalikan token original
 * - Jika token ter-JSON, akan otomatis di-parse dan mengembalikan object T
 * - Jika bukan JSON, mengembalikan string
 */
export const retrieveToken = async <T = string>(): Promise<T | null> => {
  try {
    const metaKey = getStorageKey(TOKEN_META_KEY);
    const encryptedCount = await store.getItem<string>(metaKey);
    if (!encryptedCount) return null;

    // decrypt jumlah pecahan
    const countHex = decryptCCE(encryptedCount);
    const totalParts = parseInt(fromHex(countHex), 10);
    if (isNaN(totalParts) || totalParts <= 0) {
      console.warn("Invalid token part count found in storage.");
      return null;
    }

    // ambil & decrypt semua part
    const parts: string[] = [];
    for (let i = 0; i < totalParts; i++) {
      const partKey = getStorageKey(`${TOKEN_KEY_PREFIX}${i}`);
      const encryptedPart = await store.getItem<string>(partKey);
      if (!encryptedPart) {
        console.warn(`Token part ${i} missing! Aborting retrieve.`);
        return null;
      }
      const partHex = decryptCCE(encryptedPart);
      const partStr = fromHex(partHex);
      parts.push(partStr);
    }

    const tokenStr = parts.join("");

    // coba parse JSON, fallback ke string
    try {
      const parsed = JSON.parse(tokenStr);
      return parsed as T;
    } catch {
      return tokenStr as unknown as T;
    }
  } catch (err) {
    console.error("Error retrieving token:", err);
    return null;
  }
};

/**
 * retrieveRawToken
 * - Mengembalikan bentuk *raw* dari storage (map encrypted key -> encrypted value) dalam bentuk stringified JSON
 * - Berguna untuk mengirim header terenkripsi apa adanya ke server
 */
export const retrieveRawToken = async <T = string>(): Promise<T | null> => {
  try {
    const metaKey = getStorageKey(TOKEN_META_KEY);
    const encryptedCount = await store.getItem<string>(metaKey);
    if (!encryptedCount) return null;

    const countHex = decryptCCE(encryptedCount);
    const totalParts = parseInt(fromHex(countHex), 10);
    if (isNaN(totalParts) || totalParts <= 0) {
      console.warn("Invalid token part count found in storage.");
      return null;
    }

    const parts: Record<string, string> = {};
    for (let i = 0; i < totalParts; i++) {
      const partKey = getStorageKey(`${TOKEN_KEY_PREFIX}${i}`);
      const encryptedPart = await store.getItem<string>(partKey);
      if (!encryptedPart) {
        console.warn(`Token part ${i} missing! Aborting retrieve.`);
        return null;
      }
      parts[partKey] = encryptedPart;
    }

    return JSON.stringify(parts) as unknown as T;
  } catch (err) {
    console.error("Error retrieving token:", err);
    return null;
  }
};

/**
 * clearToken
 * - Menghapus semua potongan token dan metadata dari storage
 */
export const clearToken = async (): Promise<void> => {
  try {
    const metaKey = getStorageKey(TOKEN_META_KEY);
    const encryptedCount = await store.getItem<string>(metaKey);

    if (encryptedCount) {
      const countHex = decryptCCE(encryptedCount);
      const totalParts = parseInt(fromHex(countHex), 10);

      if (!isNaN(totalParts) && totalParts > 0) {
        const delPromises: Promise<void>[] = [];
        for (let i = 0; i < totalParts; i++) {
          const partKey = getStorageKey(`${TOKEN_KEY_PREFIX}${i}`);
          delPromises.push(store.removeItem(partKey) as Promise<void>);
        }
        await Promise.all(delPromises);
      }
    }

    // hapus metadata
    await store.clear();
    console.log("Token cleared.");
  } catch (err) {
    console.error("Error clearing token:", err);
    throw err;
  }
};
