import { createServerFn } from "@tanstack/react-start";
import { useSession } from "@tanstack/react-start/server";
import { createHash, timingSafeEqual } from "node:crypto";

type AuthSession = { username?: string };

function sessionConfig() {
  return {
    password: process.env["SESSION_SECRET"] ?? "dev-only-fallback-session-secret-000000",
    name: "cih-auth",
    maxAge: 60 * 60 * 24 * 7,
    cookie: { httpOnly: true, secure: true, sameSite: "lax" as const, path: "/" },
  };
}

// Extra accounts created through the sign-up form. In-memory only — they live
// as long as the server process does. The .env admin account always works.
const signups = new Map<string, string>();

function hash(v: string) {
  return createHash("sha256").update(v, "utf8").digest();
}

function matches(a: string, b: string) {
  return timingSafeEqual(hash(a), hash(b));
}

export const getAuthSession = createServerFn({ method: "GET" }).handler(async () => {
  const session = await useSession<AuthSession>(sessionConfig());
  return { username: session.data.username ?? null };
});

export const login = createServerFn({ method: "POST" })
  .inputValidator((data: { username: string; password: string }) => data)
  .handler(async ({ data }) => {
    const username = data.username.trim();
    const password = data.password;
    if (!username || !password) return { ok: false as const, error: "Enter username and password" };

    const adminUser = process.env["ADMIN_USERNAME"] ?? "admin";
    const adminPass = process.env["ADMIN_PASSWORD"] ?? "1234";

    const stored = signups.get(username.toLowerCase());
    const valid =
      (matches(username, adminUser) && matches(password, adminPass)) ||
      (stored !== undefined && matches(password, stored));

    if (!valid) return { ok: false as const, error: "Invalid username or password" };

    const session = await useSession<AuthSession>(sessionConfig());
    await session.update({ username });
    return { ok: true as const };
  });

export const signup = createServerFn({ method: "POST" })
  .inputValidator((data: { username: string; password: string }) => data)
  .handler(async ({ data }) => {
    const username = data.username.trim();
    const password = data.password;
    if (username.length < 3) return { ok: false as const, error: "Username must be at least 3 characters" };
    if (password.length < 4) return { ok: false as const, error: "Password must be at least 4 characters" };

    const key = username.toLowerCase();
    const adminUser = (process.env["ADMIN_USERNAME"] ?? "admin").toLowerCase();
    if (key === adminUser || signups.has(key)) {
      return { ok: false as const, error: "That username is already taken" };
    }

    signups.set(key, password);
    const session = await useSession<AuthSession>(sessionConfig());
    await session.update({ username });
    return { ok: true as const };
  });

export const logout = createServerFn({ method: "POST" }).handler(async () => {
  const session = await useSession<AuthSession>(sessionConfig());
  await session.clear();
  return { ok: true as const };
});
