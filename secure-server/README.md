# 🔐 Secure Express API — Advanced AES + CCE Protection

Dokumentasi ini menjelaskan cara kerja dan konfigurasi **Secure Express API**, yaitu server Express.js yang telah diperkuat dengan:

* **AES-256 full-body encryption**
* **Custom CCE (Cyclic Character Encryption)** untuk obfuscasi token
* **Split-Header Authentication**
* **Anti-replay / anti-tamper validation**
* **Strict TypeScript typing**

Sistem ini dirancang untuk menghindari serangan umum seperti sniffing, header interception, replay attack, dan payload tampering.

---

# 🚀 Fitur Utama

### ✔ Full Body Encryption (AES-256)

Setiap request dan response dikirim dalam bentuk terenkripsi menggunakan AES-256.

### ✔ Split-Header Token Obfuscation

JWT **tidak pernah** dikirim lewat `Authorization: Bearer`.
Token dibagi menjadi beberapa bagian, diacak menggunakan CCE, dan dikirim via numeric headers dinamis.

### ✔ Anti-Replay

Setiap request memerlukan header timestamp valid (TTL: 30 detik).

### ✔ Anti-Tamper Dynamic Salt

Key salt pada CCE berubah berdasarkan timestamp request.

### ✔ TypeScript End-to-End

Seluruh logic terenkripsi, middleware, utilitas, dan tipe ditulis dalam TypeScript.

---

# 🛠 Instalasi & Setup

## 1. Prasyarat

* **Bun (Direkomendasikan)** atau Node.js **18+**
* Package manager: `bun` atau `npm`

## 2. Install Dependencies

```bash
bun install
# atau
npm install
```

## 3. Environment Variables

Buat file `.env` di root:

```ini
PORT=5000

# AES Key - Kunci utama enkripsi
APP_KEY=YourSuperSecretAESKey2024!@#

# IV - Initial Vector AES
APP_IV=YourUniqueIV1234

# CCE secret - Salt untuk token obfuscation
CCE_SECRET=SecretSaltForCCE

# Dictionary karakter untuk CCE
CCE_BASE=abcdefghijklmnopqrstuvwxyz0123456789
```

**Catatan:**
Semua nilai ini harus sama antara **backend** dan **client**.

## 4. Menjalankan Server

```bash
bun run dev
# Production build
bun run build
bun start
```

---

# 🔐 Arsitektur Keamanan

## 1. Body Encryption (AES-256)

### Format Request → Server

Client **tidak** mengirim JSON asli.
Semua payload harus di-encrypt dan dibungkus:

```json
{
  "cipher": "U2FsdGVkX1+..."
}
```

### Format Response ← Server

Server juga hanya merespons dengan ciphertext:

```json
{
  "cipher": "U2FsdGVkX1+..."
}
```

### Proses pemrosesan oleh middleware `httpSecure`:

1. Menerima ciphertext
2. AES decrypt → JSON
3. Jalankan handler route
4. JSON → AES encrypt
5. Kirim kembali ciphertext

---

## 2. Split-Token Authentication (CCE + Dynamic Headers)

JWT tidak dikirim utuh.
Client wajib:

1. **Split** token menjadi N bagian
2. **CCE Encrypt** setiap bagian
3. Set header:

   ```
   x-token-timestamp: <epoch_ms>
   <index>-<encrypted_key>: <encrypted_value>
   ```
4. Server:

   * Validasi timestamp (≤ 30s)
   * Reassemble token
   * CCE decrypt per bagian
   * Verifikasi JWT

### Contoh Header

```http
x-token-timestamp: 1715000000000
1-a8f9e...: b7c2...
2-d3s1...: 99a1...
```

---

# 📚 API Reference

## 1. Login

**POST** `/auth/login`

### Payload (setelah decrypt)

```json
{ "username": "admin" }
```

### Response (setelah decrypt)

```json
{ "token": "eyJh..." }
```

---

## 2. Profile (Protected Route)

**GET** `/api/profile`
**Headers:** Wajib memakai Split-Token

### Response (setelah decrypt)

```json
{
  "ok": true,
  "user": {
    "id": "admin",
    "role": "user"
  }
}
```

---

# 📂 Struktur Proyek

```
.
├── middleware/
│   ├── auth.ts         # Verifikasi JWT (dipanggil setelah httpSecure)
│   └── httpSecure.ts   # AES decrypt/encrypt + token reconstruction
├── utils/
│   ├── crypto.ts       # AES, CCE, token splitting
│   └── jwt.ts          # Wrapper JOSE untuk sign/verify tokens
├── types/              # Tipe TypeScript shared
└── server.ts           # Entry point Express API
```

---

# ⚠️ Catatan untuk Production

1. **Sinkronisasi Waktu Client**
   Request dengan delta waktu > 30 detik **ditolak**.

2. **Jangan Log Plaintext**
   Log hanya metadata. Jangan pernah menyimpan body hasil decrypt.

3. **Rotasi Key**
   Rutin rotasi `APP_KEY` dan `CCE_SECRET`.
   Jika bocor → layer pengamanan CCE hilang fungsinya.

4. **Gunakan HTTPS Wajib**
   Meskipun payload terenkripsi, *transport security* tetap wajib.
