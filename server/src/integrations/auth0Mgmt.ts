import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";

// Auth0 Management API client for admin-created reader accounts.
// Requires M2M credentials with create:users scope (AUTH0_MGMT_CLIENT_ID/SECRET).
// Falls back gracefully when not configured — caller still creates the DB record.

let cachedToken: { token: string; exp: number } | null = null;

async function mgmtToken(): Promise<string | null> {
  if (!env.auth0.domain || !env.auth0.mgmtClientId || !env.auth0.mgmtClientSecret) return null;
  if (cachedToken && cachedToken.exp > Date.now() + 60_000) return cachedToken.token;
  const res = await fetch(`https://${env.auth0.domain}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "client_credentials",
      client_id: env.auth0.mgmtClientId,
      client_secret: env.auth0.mgmtClientSecret,
      audience: `https://${env.auth0.domain}/api/v2/`,
    }),
  });
  if (!res.ok) {
    logger.warn({ status: res.status }, "auth0 mgmt token unavailable (M2M not configured)");
    return null;
  }
  const json = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { token: json.access_token, exp: Date.now() + json.expires_in * 1000 };
  return json.access_token;
}

export function generatePassword(): string {
  // 16-char password with mixed classes (meets Auth0 default policy).
  const sets = ["ABCDEFGHJKLMNPQRSTUVWXYZ", "abcdefghijkmnpqrstuvwxyz", "23456789", "!@#$%^&*-_"];
  let pw = sets.map((s) => s[Math.floor(Math.random() * s.length)]).join("");
  const all = sets.join("");
  for (let i = 0; i < 12; i++) pw += all[Math.floor(Math.random() * all.length)];
  return pw.split("").sort(() => Math.random() - 0.5).join("");
}

// Create an Auth0 user (email/password connection). Returns auth0 sub or null on failure.
export async function createAuth0User(email: string, password: string, fullName: string): Promise<string | null> {
  try {
    const token = await mgmtToken();
    if (!token) return null;
    const res = await fetch(`https://${env.auth0.domain}/api/v2/users`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        password,
        name: fullName,
        connection: "Username-Password-Authentication",
        email_verified: true,
        verify_email: false,
      }),
    });
    if (!res.ok) {
      logger.warn({ status: res.status }, "auth0 user creation failed; admin must create login manually");
      return null;
    }
    const json = (await res.json()) as { user_id: string };
    return json.user_id;
  } catch (e) {
    logger.warn({ err: String(e) }, "auth0 user creation error");
    return null;
  }
}

// Delete an Auth0 user (GDPR account deletion).
export async function deleteAuth0User(sub: string): Promise<boolean> {
  try {
    const token = await mgmtToken();
    if (!token) return false;
    const res = await fetch(`https://${env.auth0.domain}/api/v2/users/${encodeURIComponent(sub)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.ok;
  } catch {
    return false;
  }
}
