import "server-only";
import { createHash, createHmac, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { cookies } from "next/headers";
import { getSql } from "@/lib/db";

const scrypt = promisify(scryptCallback);
const COOKIE_NAME = "lucidinvest_session";
const SESSION_DAYS = 7;
const SCRYPT_KEY_LENGTH = 64;

function authSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) throw new Error("AUTH_SECRET must be configured with at least 32 characters");
  return secret;
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derived = (await scrypt(password, salt, SCRYPT_KEY_LENGTH)) as Buffer;
  return `scrypt:${salt}:${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [scheme, salt, digest] = stored.split(":");
  if (scheme !== "scrypt" || !salt || !digest || !/^[a-f0-9]{128}$/i.test(digest)) return false;
  const actual = (await scrypt(password, salt, SCRYPT_KEY_LENGTH)) as Buffer;
  const expected = Buffer.from(digest, "hex");
  return expected.length === actual.length && timingSafeEqual(actual, expected);
}

function tokenDigest(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function signature(token: string) {
  return createHmac("sha256", authSecret()).update(token).digest("hex");
}

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await getSql()`INSERT INTO auth_sessions (user_id, token_hash, expires_at) VALUES (${userId}, ${tokenDigest(token)}, ${expiresAt.toISOString()})`;
  const jar = await cookies();
  jar.set(COOKIE_NAME, `${token}.${signature(token)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function getCurrentUser() {
  const jar = await cookies();
  const value = jar.get(COOKIE_NAME)?.value;
  if (!value) return null;
  const splitAt = value.lastIndexOf(".");
  if (splitAt < 1) return null;
  const token = value.slice(0, splitAt);
  const suppliedSignature = value.slice(splitAt + 1);
  let expectedSignature: string;
  try { expectedSignature = signature(token); } catch { return null; }
  const supplied = Buffer.from(suppliedSignature, "hex");
  const expected = Buffer.from(expectedSignature, "hex");
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return null;

  const digest = tokenDigest(token);
  const rows = await getSql()`
    SELECT u.id, u.email, u.full_name, u.role, u.status
    FROM auth_sessions s
    JOIN app_users u ON u.id = s.user_id
    WHERE s.token_hash = ${digest} AND s.expires_at > now() AND u.status = 'active'
    LIMIT 1
  `;
  const row = Array.isArray(rows) ? rows[0] : undefined;
  return row && !Array.isArray(row) && typeof row === "object" ? row as {
    id: string; email: string; full_name: string; role: string; status: string;
  } : null;
}

export async function destroySession() {
  const jar = await cookies();
  const value = jar.get(COOKIE_NAME)?.value;
  if (value) {
    const splitAt = value.lastIndexOf(".");
    if (splitAt > 0) {
      const token = value.slice(0, splitAt);
      try {
        const expected = Buffer.from(signature(token), "hex");
        const supplied = Buffer.from(value.slice(splitAt + 1), "hex");
        if (expected.length === supplied.length && timingSafeEqual(expected, supplied)) {
          await getSql()`DELETE FROM auth_sessions WHERE token_hash = ${tokenDigest(token)}`;
        }
      } catch { /* Still clear the browser cookie if server configuration is incomplete. */ }
    }
  }
  jar.set(COOKIE_NAME, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", expires: new Date(0) });
}
