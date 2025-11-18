import type { Request, Response, NextFunction } from "express";
import { verifyJwt } from "../utils/jwt";

/**
 * Authentication Middleware
 * Extracts Bearer token (which was reconstructed by httpSecure)
 * and verifies the JWT signature.
 */
export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized: Missing token" });
  }

  const token = authHeader.split(" ")[1];
  const payload = await verifyJwt(token);

  if (!payload) {
    return res.status(401).json({ error: "Unauthorized: Invalid token" });
  }

  // Attach user to request
  req.user = {
    id: payload.sub,
    role: payload.role,
    ...payload,
  };

  next();
}