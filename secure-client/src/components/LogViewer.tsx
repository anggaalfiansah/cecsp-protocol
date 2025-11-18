import type { FC } from "react";
import type { Direction, LogEntry } from "../types";

interface LogViewerProps {
  logs: LogEntry[];
}

function badgeColor(direction: Direction) {
  switch (direction) {
    case "request":
      return "#3b82f6"; // biru
    case "response":
      return "#22c55e"; // hijau
    case "error":
      return "#ef4444"; // merah
  }
}

function sectionTitle(title: string) {
  return (
    <div
      style={{
        fontSize: 11,
        fontWeight: 600,
        color: "#94a3b8",
        paddingBottom: 3,
        marginTop: 4,
        textTransform: "uppercase",
        letterSpacing: "0.5px",
      }}
    >
      {title}
    </div>
  );
}

export const LogViewer: FC<LogViewerProps> = ({ logs }) => {
  return (
    <div
      style={{
        borderRadius: 8,
        border: "1px solid #1f2937",
        background: "#020617",
        padding: 12,
        height: "60vh",
        overflow: "auto",
      }}
    >
      {logs.length === 0 && <div style={{ color: "#6b7280", fontSize: 14 }}>Belum ada request. Coba klik tombol Login atau Get Profile.</div>}

      {logs.map((log) => (
        <div
          key={log.id}
          style={{
            borderBottom: "1px solid #111827",
            padding: "10px 0",
          }}
        >
          {/* Header log */}
          <div
            style={{
              display: "flex",
              gap: 8,
              alignItems: "center",
              marginBottom: 4,
              fontSize: 12,
            }}
          >
            <span style={{ color: "#9ca3af" }}>{log.time}</span>

            <span
              style={{
                padding: "2px 6px",
                borderRadius: 999,
                background: badgeColor(log.direction),
                color: "white",
                fontSize: 11,
                textTransform: "uppercase",
              }}
            >
              {log.direction}
            </span>

            <span
              style={{
                fontWeight: 600,
                color: "#e5e7eb",
                textTransform: "uppercase",
              }}
            >
              {log.method}
            </span>

            <span style={{ color: "#e5e7eb" }}>{log.url}</span>

            {log.status && (
              <span
                style={{
                  marginLeft: "auto",
                  fontSize: 12,
                  color: Number(log.status) >= 200 && Number(log.status) < 300 ? "#22c55e" : "#f97316",
                }}
              >
                {log.status}
              </span>
            )}
          </div>

          {/* HEADERS */}
          {log.headers && (
            <>
              {sectionTitle("📄 Headers")}
              <pre
                style={{
                  margin: 0,
                  padding: 8,
                  borderRadius: 6,
                  background: "#020617",
                  border: "1px solid #111827",
                  fontSize: 12,
                  color: "#d1d5db",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-all",
                }}
              >
                {JSON.stringify(log.headers, null, 2)}
              </pre>
            </>
          )}

          {/* ENCRYPTED BODY */}
          {log.encryptedBody !== undefined && (
            <>
              {sectionTitle("🔐 Encrypted Body")}
              <pre
                style={{
                  margin: 0,
                  padding: 8,
                  borderRadius: 6,
                  background: "#020617",
                  border: "1px solid #111827",
                  fontSize: 12,
                  color: "#d1d5db",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-all",
                }}
              >
                {JSON.stringify(log.encryptedBody, null, 2)}
              </pre>
            </>
          )}

          {/* BODY */}
          {log.body !== undefined && (
            <>
              {sectionTitle("🔓 Body")}
              <pre
                style={{
                  margin: 0,
                  padding: 8,
                  borderRadius: 6,
                  background: "#020617",
                  border: "1px solid #111827",
                  fontSize: 12,
                  color: "#d1d5db",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-all",
                }}
              >
                {JSON.stringify(log.body, null, 2)}
              </pre>
            </>
          )}
        </div>
      ))}
    </div>
  );
};
