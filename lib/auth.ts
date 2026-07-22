import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const COOKIE_NAME = "inferno_pilot";
const SESSION_SECONDS = 60 * 60 * 12;

function secretKey(): Uint8Array {
  const value = process.env.PILOT_SESSION_SECRET;
  if (!value || value.length < 24) {
    throw new Error("PILOT_SESSION_SECRET mora imati najmanje 24 znaka.");
  }
  return new TextEncoder().encode(value);
}

export async function verifyPilotPassword(password: string): Promise<boolean> {
  const hash = process.env.PILOT_PASSWORD_HASH;
  if (hash) return bcrypt.compare(password, hash);

  if (process.env.NODE_ENV !== "production" && process.env.PILOT_PASSWORD) {
    return password === process.env.PILOT_PASSWORD;
  }

  return false;
}

export async function createPilotToken(): Promise<string> {
  return new SignJWT({ role: "pilot" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_SECONDS}s`)
    .sign(secretKey());
}

export async function setPilotCookie(token: string): Promise<void> {
  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: SESSION_SECONDS
  });
}

export async function clearPilotCookie(): Promise<void> {
  const store = await cookies();
  store.set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 0
  });
}

export async function isPilotAuthenticated(): Promise<boolean> {
  try {
    const store = await cookies();
    const token = store.get(COOKIE_NAME)?.value;
    if (!token) return false;
    const result = await jwtVerify(token, secretKey());
    return result.payload.role === "pilot";
  } catch {
    return false;
  }
}
