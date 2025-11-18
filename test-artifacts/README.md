## **`test-artifacts/README.md`**

# 📁 Test Artifacts — CECSP Prototype

Folder ini berisi seluruh bukti hasil pengujian fungsional, keamanan, dan performa prototipe **CECSP (Custom Encrypted Client–Server Protocol)**.

Setiap test-case memiliki folder khusus yang berisi:

* **Screenshot**
* **Raw logs**
* **Request/response dump**
* **Catatan tambahan**

Struktur folder mengikuti format:

```
{TEST-ID}/
 ├── bukti screenshot
 ├── log
 ├── data tambahan
 └── notes.md
```

## Daftar Test-Case

| ID | Kategori       | Deskripsi Singkat                                |
| -- | -------------- | ------------------------------------------------ |
| E1 | Environment    | Smoke test — memastikan dev environment berjalan |
| F1 | Functional     | Payload dikirim dalam mode terenkripsi (cipher)  |
| F2 | Functional     | Server menerima plaintext setelah decrypt        |
| F3 | Functional     | Client dapat mendekripsi response                |
| S1 | Security       | Token tersimpan dalam bentuk chunk terenkripsi   |
| S2 | Security       | Server menolak token manipulasi manual           |
| R2 | Replay Defense | Server menolak timestamp kedaluwarsa             |
| P1 | Performance    | Latency test (mean/P95/P99)                      |
| H1 | Hardening      | Bundle build bebas plaintext key                 |

Untuk ringkasan lengkap semua hasil test, lihat:
➡ **`test-result.md`**