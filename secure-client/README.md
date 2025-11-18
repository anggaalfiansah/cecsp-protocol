## 🔐 Security Architecture

### 1\. The Generator (`generate-secret.ts`)

Before runtime, this script reads your `.env` and generates a TypeScript file (`utils/secret.ts`) containing complex, "spaghetti-code" functions that reconstruct your keys at runtime. This makes reverse-engineering the compiled code significantly harder.

### 2\. Transport Security

  * **Request:** Client sends `{ "cipher": "BASE64..." }`. Middleware decrypts this to `req.body`.
  * **Response:** Middleware intercepts `res.json()`, encrypts the payload, and sends `{ "cipher": "BASE64..." }`.

### 3\. Authentication Flow

1.  **Login:** User posts credentials (Encrypted Body). Server returns JWT (Encrypted Response).
2.  **Access:** Client splits JWT -\> Encrypts parts -\> Sends headers:
    ```http
    x-token-timestamp: 1731835000000
    1-<EncKey>: <EncVal>
    2-<EncKey>: <EncVal>
    ...
    ```
3.  **Verification:** Server validates timestamp -\> Reconstructs JWT -\> Verifies Signature.

## 📂 Project Structure

```
.
├── generate-secret.ts    # The Polymorphic Generator
├── server.ts             # Entry Point
├── middleware/
│   └── httpSecure.ts     # Encryption/Decryption Layer
├── utils/
│   ├── crypto.ts         # Encryption Logic (Imports secret.ts)
│   └── secret.ts         # [AUTO-GENERATED]
└── ...
```
---

### 2. Client README (`secure-client/README.md`)

Simpan ini di root folder frontend (React) Anda.

# Secure React Client (Simulation)

A security-hardened React client designed to interact with the Secure Express API. It implements secure storage strategies and transport layer obfuscation.

## 🛡️ Client-Side Security

### 1. Obfuscated Secrets (`utils/secret.ts`)
This client does **not** use plain environment variables for encryption keys. It relies on a generated `utils/secret.ts` file (shared from the server) to reconstruct keys at runtime, hiding them from basic browser inspection.

### 2. Secure Storage (At Rest)
JWTs are **never** stored as plain text in `localStorage`.
* **Splitting:** Token is split into ~15 random chunks.
* **Encryption:** Each chunk is encrypted using CCE.
* **Metadata:** Uses a hidden counter key to verify integrity.

### 3. Secure Transport (In Transit)
* **Split-Header Auth:** The `Authorization` header is abandoned. Tokens are split, encrypted with a time-based salt, and sent via numeric headers.
* **AES Body Encryption:** All payloads are encrypted before leaving the browser.

## 🚀 Getting Started

### 1. Prerequisites
Ensure the **Secure Server** is running on port 5000.

### 2. Installation
```bash
npm install
````

### 3\. ⚠️ CRITICAL: Secret Synchronization

The client needs generate `utils/secret.ts` file. Run the generator on the root (`bun run secret`).

### 4\. Run Development

```bash
npm run dev
```

## 📂 Key Files

  * **`api/client.ts`**: Axios wrapper. Handles request encryption, response decryption, and header injection.
  * **`utils/crypto.ts`**: Core logic for AES and CCE (imports keys from `secret.ts`).
  * **`utils/storage.ts`**: Manages the encrypted splitting of tokens in LocalStorage.

## ⚠️ Important Notes

1.  **Time Synchronization:** The client device's clock must be within **30 seconds** of the server's clock. If not, the `x-token-timestamp` header will be rejected (Anti-Replay).
2.  **Secret Rotation:** If the server regenerates secrets, you must copy the new `secret.ts` to the client and redeploy. Old tokens in LocalStorage will become invalid (user must re-login).
