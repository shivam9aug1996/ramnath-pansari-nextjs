import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { secretKey } from "./keys";

function getSecretKeyBytes() {
  if (!secretKey) return null;
  return new TextEncoder().encode(secretKey);
}

export async function verifyJwt(token: string): Promise<JWTPayload | null> {
  const key = getSecretKeyBytes();
  if (!key) {
    return null;
  }
  try {
    const { payload } = await jwtVerify(token, key);
    return payload;
  } catch {
    return null;
  }
}

export async function signJwt(
  payload: Record<string, unknown>,
  options?: { expiresIn?: string },
): Promise<string> {
  const key = getSecretKeyBytes();
  if (!key) {
    throw new Error("SECRET_KEY is not configured");
  }

  let jwt = new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt();

  if (options?.expiresIn) {
    jwt = jwt.setExpirationTime(options.expiresIn);
  }

  return jwt.sign(key);
}
