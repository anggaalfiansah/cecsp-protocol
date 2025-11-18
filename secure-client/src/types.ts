import type { Method } from "axios";

export type Direction = "request" | "response" | "error";

export interface LogEntry {
  id: number;
  time: string;
  direction: Direction;
  method: Method;
  url: string;
  status?: number;
  encryptedBody?: { cipher: string } | unknown;
  body?: unknown;
  headers?: Record<string, unknown>;
}
