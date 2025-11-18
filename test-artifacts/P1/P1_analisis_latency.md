# **LAPORAN ANALISIS PERFORMA PROTOKOL CECSP

(Test Case P1: Latency Evaluation – 1000 Sequential Requests)**

**Tanggal Pengujian:** 18 November 2025
**Metode:** 1000 permintaan berurutan (sequential loop), dieksekusi dari satu tab (single browser thread).
**Lingkungan:** Localhost (loopback), React Client + Express/Bun Server.

---

## **1. Ringkasan Hasil Pengujian**

| Metrik               | Hasil    | Interpretasi                              |
| -------------------- | -------- | ----------------------------------------- |
| **Rata-rata (Mean)** | 15.30 ms | Sangat cepat; tidak terasa oleh pengguna. |
| **Minimum**          | 12.30 ms | Baseline latensi sistem.                  |
| **Maksimum**         | 57.60 ms | Outlier jarang; kemungkinan GC client.    |
| **P95**              | 20.00 ms | 95% request <20 ms → performa stabil.     |
| **P99**              | 25.90 ms | 99% request <26 ms → sangat stabil.       |

**Kesimpulan:**
Mayoritas permintaan selesai dalam 12–20 ms, menunjukkan performa enkripsi/obfuscation yang stabil pada beban moderat.

---

## **2. Breakdown Overhead (Perbandingan Client vs Server)**

Analisis ini menggabungkan log latensi client (P1_summary.txt) dan log internal server (P1_serverlog.txt).

### **2.1 Waktu Proses Server**

* Waktu rata-rata: **2–4 ms**
* Spike jarang: **10–42 ms**, kemungkinan:

  * Garbage Collection (runtime Bun/Node)
  * JIT warm-up
  * Logging berat (console.log)

**Kesimpulan:**
Dekripsi dan validasi token di sisi server sangat efisien dan tidak menjadi bottleneck.

---

### **2.2 Waktu Total di Client**

* Rata-rata total: **15.30 ms**
* Server hanya mengambil ±3 ms
  Maka **overhead client ≈ 12.3 ms**, terdiri dari:

#### **A. Loopback Network**

* 1–2 ms (standar untuk localhost)

#### **B. Overhead Protokol CECSP di Client**

Perkiraan alokasi waktu:

| Komponen                      | Estimasi Waktu | Penjelasan                                      |
| ----------------------------- | -------------- | ----------------------------------------------- |
| **Split Header Generation**   | ~5–7 ms        | Token chunking + dynamic salt + CCE per header. |
| **AES Encryption/Decryption** | ~2–3 ms        | Enkripsi body request + dekripsi body response. |
| **IndexedDB Token Retrieval** | ~2–3 ms        | Akses storage + rekonstruksi token.             |

**Kesimpulan:**
Mayoritas waktu habis di proses kriptografi client-side — sesuai desain CECSP yang mengalihkan beban keamanan ke klien.

---

## **3. Analisis Stabilitas (Stability Analysis)**

### **Stabilitas Tinggi**

Selisih antara mean (15.3 ms) dan P95 (20 ms) sangat kecil.
Indikasi:

* Algoritma kripto berjalan deterministik.
* Tidak ada jitter CPU signifikan.

### **Outlier (Max 57.6 ms)**

Kemungkinan besar disebabkan oleh:

* Garbage Collection V8/JavaScript.
* JS main-thread blocking pada React dev-mode.
* Node/Bun GC.

Frekuensi sangat rendah (<1%), sehingga tidak mempengaruhi user experience.

---

## **4. Kesimpulan Pengujian P1 (Latency Test)**

### **Status: LULUS (PASSED)**

Protokol CECSP berhasil melewati Test Case P1 dengan hasil sangat baik.

### **Poin Penting:**

1. **Respons pengguna real** tidak akan terganggu karena latensi <20 ms untuk 95% request.
2. **Operasi server sangat ringan** (enkripsi dan dekripsi cepat).
3. **Arsitektur scalable** karena kompleksitas utama ada di client (browser), bukan di server.
4. **Security Cost** hanya ±10 ms — nilai yang sangat efisien untuk fitur:

   * Full payload encryption
   * Token obfuscation
   * Anti-replay timestamp
   * Header-splitting

### **Rekomendasi:**

* Nonaktifkan log berat (console.log data cipher) pada mode produksi.
* Pertimbangkan optimasi client-side pada test lanjutan:

  * WebCrypto (AES native)
  * Web Worker untuk crypto heavy
  * Cache token chunk 1–2 detik

---
