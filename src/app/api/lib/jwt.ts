import type { JwtPayload, SignOptions } from "jsonwebtoken";
import { secretKey } from "./keys";

type JwtModule = typeof import("jsonwebtoken");

let jwtModule: Promise<JwtModule> | null = null;

function loadJwt(): Promise<JwtModule> {
  if (!jwtModule) {
    jwtModule = import("jsonwebtoken");
  }
  return jwtModule;
}

export async function verifyJwt(
  token: string,
): Promise<string | JwtPayload | null> {
  if (!secretKey) return null;
  try {
    const jwt = await loadJwt();
    return jwt.verify(token, secretKey);
  } catch {
    return null;
  }
}

export async function signJwt(
  payload: string | Buffer | object,
  options?: SignOptions,
): Promise<string> {
  if (!secretKey) {
    throw new Error("SECRET_KEY is not configured");
  }
  const jwt = await loadJwt();
  return jwt.sign(payload, secretKey, options);
}
