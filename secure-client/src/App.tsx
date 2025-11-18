import { useEffect, useState } from "react";
import type { LogEntry } from "./types";
import { sendRequest } from "./api/client";
import { Controls } from "./components/Controls";
import { LogViewer } from "./components/LogViewer";
import { clearToken, retrieveRawToken, retrieveToken, storeToken } from "./utils/storage";

function App() {
  // username default untuk login dummy
  const [username, setUsername] = useState("Gus Milos");

  // token JWT (plaintext)
  const [token, setToken] = useState<string | null>(null);

  // token terenkripsi (hasil generate header encryption → storage)
  const [encryptedToken, setEncryptedToken] = useState<string | null>(null);

  // log request/response yang ditampilkan di UI
  const [logs, setLogs] = useState<LogEntry[]>([]);

  const hasToken = Boolean(token);

  /**
   * Menambahkan log ke LogViewer.
   * Log terbaru muncul di paling atas (prepend).
   */
  function addLog(entry: Omit<LogEntry, "id" | "time"> & { time?: string }) {
    setLogs((prev) => [
      {
        id: prev.length + 1,
        time: entry.time ?? "",
        ...entry,
      },
      ...prev,
    ]);
  }

  /**
   * Melakukan login → memanggil POST /auth/login
   * - Server mengembalikan JWT plaintext
   * - JWT disimpan di local storage (storeToken)
   * - retrieveRawToken() mengambil versi terenkripsi dari storage
   */
  async function handleLogin() {
    if (!username.trim()) return;

    const data: { token?: string } = await sendRequest(addLog, "POST", "/auth/login", null, {
      data: { username },
    });

    if (data && typeof data.token === "string") {
      // pastikan tidak ada fragmen lama
      await clearToken();
      await storeToken(data.token);
      setToken(data.token);

      // ambil token terenkripsi (digunakan sebagai header custom)
      const raw = await retrieveRawToken();
      setEncryptedToken(raw ?? null);
    }
  }

  /**
   * Memanggil protected route GET /api/profile
   * - sendRequest akan otomatis membangun header terenkripsi jika withAuth:true
   */
  async function handleGetProfile() {
    if (!token) return;

    await sendRequest(addLog, "GET", "/api/profile", token, {
      withAuth: true,
    });
  }

  /** Logout lokal: hapus token di state dan storage */
  async function handleLogout() {
    setToken(null);
    setEncryptedToken(null);
    await clearToken();
  }

  /** Menghapus seluruh log pada tampilan */
  function handleClearLogs() {
    setLogs([]);
  }

  // saat komponen mount: baca token yang ada di storage
  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const secureToken = await retrieveRawToken();
        if (!mounted) return;
        setEncryptedToken(secureToken ?? null);

        const plain = await retrieveToken();
        if (!mounted) return;
        setToken((plain as string) ?? null);
      } catch (err) {
        // optional: log error tanpa memblokir render
        console.error("Failed to load token from storage:", err);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        padding: 15,
        color: "#e5e7eb",
        fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
      }}
    >
      {/* Panel kontrol login + request */}
      <Controls
        username={username}
        onChangeUsername={setUsername}
        hasToken={hasToken}
        token={token}
        encryptedToken={encryptedToken}
        onLogin={handleLogin}
        onGetProfile={handleGetProfile}
        onLogout={handleLogout}
        onClearLogs={handleClearLogs}
      />

      {/* Panel log request/response */}
      <LogViewer logs={logs} />
    </div>
  );
}

export default App;
