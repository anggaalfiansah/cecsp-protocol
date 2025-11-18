import type { FC } from "react";

interface ControlsProps {
  username: string;
  onChangeUsername: (value: string) => void;
  hasToken: boolean;
  token: string | null;
  onLogin: () => void;
  onGetProfile: () => void;
  onLogout: () => void;
  onClearLogs: () => void;
  encryptedToken: string | null;
}

export const Controls: FC<ControlsProps> = ({ username, onChangeUsername, hasToken, token, encryptedToken, onLogin, onGetProfile, onLogout, onClearLogs }) => {
  return (
    <>
      <h1 style={{ fontSize: "1.5rem", marginBottom: 8 }}>Simulasi FE – JWT + Log Request/Response</h1>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "12px",
          alignItems: "flex-end",
          marginBottom: "16px",
        }}
      >
        <div>
          <label
            style={{
              display: "block",
              fontSize: 12,
              marginBottom: 4,
              color: "#9ca3af",
            }}
          >
            Username
          </label>
          <input
            value={username}
            onChange={(e) => onChangeUsername(e.target.value)}
            style={{
              padding: "6px 8px",
              borderRadius: 6,
              border: "1px solid #4b5563",
              background: "#020617",
              color: "#e5e7eb",
              minWidth: 160,
            }}
          />
        </div>

        <button
          onClick={onLogin}
          style={{
            padding: "6px 12px",
            borderRadius: 6,
            border: "none",
            background: "#3b82f6",
            color: "white",
            cursor: "pointer",
          }}
        >
          Login (POST /auth/login)
        </button>

        <button
          onClick={onGetProfile}
          disabled={!hasToken}
          style={{
            padding: "6px 12px",
            borderRadius: 6,
            border: "none",
            background: hasToken ? "#22c55e" : "#4b5563",
            color: "white",
            cursor: hasToken ? "pointer" : "not-allowed",
          }}
        >
          Get Profile (GET /api/profile)
        </button>

        <button
          onClick={onLogout}
          disabled={!hasToken}
          style={{
            padding: "6px 12px",
            borderRadius: 6,
            border: "none",
            background: hasToken ? "#f97316" : "#4b5563",
            color: "white",
            cursor: hasToken ? "pointer" : "not-allowed",
          }}
        >
          Logout (clear token)
        </button>

        <button
          onClick={onClearLogs}
          style={{
            padding: "6px 12px",
            borderRadius: 6,
            border: "1px solid #6b7280",
            background: "transparent",
            color: "#e5e7eb",
            cursor: "pointer",
          }}
        >
          Clear Logs
        </button>

        <div style={{ display: "flex", width:"100%", flexDirection: "row", gap: 12, marginLeft: "auto", alignItems: "flex-start", justifyContent: "space-between" }}>
          <div style={{ fontSize: 12, color: "#9ca3af", minWidth: "45vw" }}>
            <div>Token:{""}</div>
            <div style={{ fontSize: 10 }}>{token ? <span style={{ wordBreak: "break-all" }}>{token}</span> : <span style={{ fontStyle: "italic" }}>belum login</span>}</div>
          </div>
          <div style={{ fontSize: 12, color: "#9ca3af", minWidth: "45vw" }}>
            <div>Encrypted Token:{""}</div>
            <div style={{ fontSize: 10 }}>{encryptedToken ? <span style={{ wordBreak: "break-all" }}>{Object.values(JSON.parse(encryptedToken))}</span> : <span style={{ fontStyle: "italic" }}>belum login</span>}</div>
          </div>
        </div>
      </div>
    </>
  );
};
