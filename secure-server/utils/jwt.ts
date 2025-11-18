import { SignJWT, jwtVerify, type JWTPayload } from "jose";


export interface JwtPayloadCustom extends JWTPayload {
  sub: string;      // user ID
  role?: string;
}


const SECRET = new TextEncoder().encode("SUPER_SECRET_KEY_123");

// SIGN JWT
export async function signJwt(payload: JwtPayloadCustom): Promise<string> {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("120m")
    .sign(SECRET);
}

// VERIFY JWT
export async function verifyJwt(token: string): Promise<JwtPayloadCustom | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET);
    return payload as JwtPayloadCustom;
  } catch {
    return null;
  }
}