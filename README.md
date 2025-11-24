# 🛡️ Custom Encrypted Client–Server Protocol (CECSP)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Status: Experimental](https://img.shields.io/badge/Status-Experimental-red)](https://github.com/anggaalfiansah/cecsp-protocol)

> [!NOTE]
> Baca dalam Bahasa Indonesia: [README.id.md](./README.id.md)

## Overview

**CECSP Protocol** is a prototype of a Custom Encrypted Client–Server Protocol that provides full payload encryption, token obfuscation, and anti-replay mechanisms. It is designed to add an extra security layer on top of HTTPS using transparent server and client middleware.

## Problem Solved

This protocol was built to mitigate the risks of **Token Theft** and **Replay Attacks** in modern APIs.

| Threat | Description | CECSP Mitigation |
| :--- | :--- | :--- |
| **Payload Inspection** | JSON data is human-readable, exposing the system to parameter manipulation and *logic flaws*. | **Full Payload Encryption** (AES-128-CBC): Locks down and encrypts the entire data payload. |
| **Token Theft** | Tokens stolen via XSS or storage inspection. | **Token Chunking & Obfuscation**: Tokens are split, randomized, and stored in an encrypted state. |
| **Replay Attack** | Re-use of valid requests by attackers. | **Timestamp Validation**: Every request has a strict, limited validity period. |

## 🚀 Performance

In testing, the protocol demonstrated high efficiency:
![Screenshot of Average Latency Test Results 15.3ms](test-artifacts/P1/P1-UI-latency-test-screenshot-1763454361765.png)
* **Average Additional Latency:** **15.3 ms**

## 💻 Installation and Usage

This project consists of two main components (`secure-server` and `secure-client`) running on the **Bun** runtime.

### Pre-requisites

Ensure that the **Bun Runtime** is installed.

### 1. Clone and Install Dependencies

```bash
git clone [https://github.com/anggaalfiansah/cecsp-protocol.git](https://github.com/anggaalfiansah/cecsp-protocol.git)
cd cecsp-protocol
bun run install
```

*Note: The* `install` *script uses* `concurrently` *to execute installation in both project folders (server and client) simultaneously.*

### 2\. Setup Secret Keys (.env)

Encryption keys (`APP_KEY` and `APP_IV`) are not committed and must be generated locally:

```bash
bun run secret
```

*Note: This command runs* `generate-secret.ts` *which creates the* `.env` *file for secret configuration.*

### 3\. Run Development Mode (Dev)

This command will run the *server* (`bun --watch server.ts`) and *client* (`bun run dev --host`) simultaneously using `concurrently`:

```bash
bun run dev
```

### 4\. Build and Preview (Local Production Mode)

To simulate a production environment:

```bash
# Perform build (includes secret key generation)
bun run build 
# Preview the build
bun run preview
```

*Note: The* `preview` *command runs the server in* `start` *mode and the client in* `preview --host` *mode simultaneously.* \#\# 🛠️ Key Tech Stack

  * **Runtime:** Bun
  * **Server:** Express.js
  * **Client:** React (via Vite)
  * **Cryptography Library:** `crypto-js`

## 📜 License

This project is licensed under the MIT License.

## 🧑‍💻 Author

**Angga Alfiansah** 

  * Mahasiswa PJJ Sistem Informasi, Universitas Siber Asia
  * [https://www.linkedin.com/in/anggaalfiansah/]

