# **📄 TEST RESULTS — CECSP Prototype**

**Tester:** Angga Alfiansah
**Tanggal:** 18 November 2025
**Environment:**

* Browser: Chrome (Desktop)
* Runtime Server: Bun
* Mode: Development (secure-client + secure-server)

---

## **Legenda Status**

* **OK** = Sesuai ekspektasi
* **FAIL** = Tidak sesuai, perlu investigasi
* **N/A** = Tidak diuji

---

## **🧪 Test Summary Table**

| ID     | Test Name                  | Expected Result                              | Actual Result (Singkat) | Status | Bukti (path)          |
| ------ | -------------------------- | -------------------------------------------- | ----------------------- | ------ | --------------------- |
| **E1** | Smoke: dev up              | UI tampil, server listen tanpa error         | SESUAI                  | OK     | `tests-artifacts/E1/` |
| **F1** | Payload sent as cipher     | Body request berbentuk `{ "cipher": "..." }` | SESUAI                  | OK     | `tests-artifacts/F1/` |
| **F2** | Server menerima plaintext  | Handler server mencetak body terdekripsi     | SESUAI                  | OK     | `tests-artifacts/F2/` |
| **F3** | Client decrypt response    | UI menampilkan response plaintext            | SESUAI                  | OK     | `tests-artifacts/F3/` |
| **S1** | Token chunked in IndexedDB | Token tersimpan dalam potongan terenkripsi   | SESUAI                  | OK     | `tests-artifacts/S1/` |
| **S2** | Manual token misuse        | Server menolak Authorization header palsu    | SESUAI                  | OK     | `tests-artifacts/S2/` |
| **R2** | Replay after TTL           | Server menolak timestamp kedaluwarsa (>TTL)  | SESUAI                  | OK     | `tests-artifacts/R2/` |
| **P1** | Latency measurement        | CSV log + summary latency (mean/p95/p99)     | SESUAI                  | OK     | `tests-artifacts/P1/` |
| **H1** | Bundle key check           | Tidak ada plaintext key dalam output build   | SESUAI                  | OK     | `tests-artifacts/H1/` |

---

## **📌 Notes**

* Semua test **lulus (100% PASS)**.
* Test P1 menunjukkan performa sangat stabil:

  * **Mean: 15.3ms**, **P95: 20ms**, **P99: 25.9ms**.
* Tidak ditemukan kebocoran kunci pada hasil build (H1).
* Mekanisme anti-replay bekerja sesuai desain (R2).

---

## **📂 Struktur Direktori Artifacts**

```
tests-artifacts/
 ├── E1/
 ├── F1/
 ├── F2/
 ├── F3/
 ├── S1/
 ├── S2/
 ├── R2/
 ├── P1/
 └── H1/
```

Setiap folder minimal berisi:

* `request.txt` (raw request)
* `response.txt` (raw response)
* `screenshot.png` (jika UI-related)
* `notes.md` (opsional)

---

## **💬 Kesimpulan**

CECSP Prototype dinyatakan **stabil, sesuai ekspektasi**, dan siap melanjutkan ke tahap:

* **P2: Stress Test**
* **P3: Concurrency Test**
* **P4: Network degradation test (packet loss / high latency)**
* **P5: Security robustness test**
