import express, { type Request, type Response } from "express";
import cors from "cors";
import { signJwt } from "./utils/jwt";
import { authMiddleware } from "./middleware/auth";
import { httpSecure } from "./middleware/httpSecure";

const app = express();
const PORT = Number(process.env.PORT ?? 5000);

// --- Middlewares ---
app.use(cors());
app.use(express.json()); // Parses incoming JSON (including { cipher: ... })
app.use(httpSecure);     // Handles decryption/encryption & token reconstruction

// --- Routes ---

/**
 * POST /auth/login
 * Returns a plain JWT inside an encrypted response body.
 */
app.post("/auth/login", async (req: Request, res: Response) => {
  const { username } = req.body;

  if (!username) {
    return res.status(400).json({ error: "Username required" });
  }

  // TODO: Implement real DB check here
  const token = await signJwt({ sub: username, role: "user" });
  console.log(`[Auth] User logged in: ${username}`);
  
  return res.json({ token });
});

/**
 * GET /api/profile
 * Accesses req.user populated by authMiddleware.
 */
app.get("/api/profile", authMiddleware, (req: Request, res: Response) => {
  return res.json({
    ok: true,
    user: req.user,
  });
});

app.get("/health", (_req, res) => res.json({ status: "ok" }));

// --- Start ---
app.listen(PORT, () => {
  console.log(`🚀 Secure Server running at http://localhost:${PORT}`);
});