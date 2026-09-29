import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import pg from "pg";
import { verifyPassword } from "better-auth/crypto";

const base = process.env.BETTER_AUTH_URL;
assert(base, "Set BETTER_AUTH_URL to the running development server");
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const email = `auth-test-${randomUUID()}@example.com`;
const password = `Test-passphrase-${randomUUID()}`;
const ip = `198.18.${Math.floor(Math.random() * 255)}.${1 + Math.floor(Math.random() * 254)}`;
let cookie = "";
async function request(path, body, options = {}) {
  return fetch(base + path, {
    method: body ? "POST" : "GET",
    redirect: "manual",
    headers: {
      "content-type": "application/json",
      origin: base,
      "x-forwarded-for": ip,
      ...(cookie ? { cookie } : {}),
      ...options.headers,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}
try {
  const protectedPage = await request("/");
  assert.equal(protectedPage.status, 307);
  assert.equal(protectedPage.headers.get("location"), "/login");
  for (const page of ["/login", "/register"]) {
    assert.equal((await request(page)).status, 200);
  }
  const signup = await request("/api/auth/sign-up/email", { name: "Auth test", email, password });
  assert.equal(signup.status, 200, await signup.text());
  cookie = signup.headers.getSetCookie().map((value) => value.split(";")[0]).join("; ");
  assert(cookie.includes("session_token"));
  assert(signup.headers.get("set-cookie").includes("HttpOnly"));
  const { rows } = await pool.query(
    'SELECT a.password FROM "Account" a JOIN "User" u ON u.id = a."userId" WHERE u.email = $1',
    [email],
  );
  assert.equal(rows.length, 1);
  assert.notEqual(rows[0].password, password);
  assert(await verifyPassword({ hash: rows[0].password, password }));
  assert.equal((await request("/")).status, 200);
  const session = await (await request("/api/auth/get-session")).json();
  assert.equal(session.user.email, email);
  assert.equal(session.user.password, undefined);
  const duplicate = await request("/api/auth/sign-up/email", { name: "Duplicate", email, password });
  assert(duplicate.status >= 400);
  assert.equal((await request("/api/auth/sign-out", {})).status, 200);
  assert.equal(await (await request("/api/auth/get-session")).json(), null);
  assert.equal((await request("/")).status, 307);
  cookie = "";
  const wrong = await request("/api/auth/sign-in/email", { email, password: "wrong-password" });
  assert.equal(wrong.status, 401);
  const login = await request("/api/auth/sign-in/email", { email: email.toUpperCase(), password });
  assert.equal(login.status, 200, await login.text());
  cookie = login.headers.getSetCookie().map((value) => value.split(";")[0]).join("; ");
  assert.equal((await request("/login")).status, 307);
  const crossOrigin = await request("/api/auth/sign-out", {}, { headers: { origin: "https://untrusted.example" } });
  assert.equal(crossOrigin.status, 403);
  assert.equal((await request("/api/auth/sign-out", {})).status, 200);
  cookie = "";
  let throttled = false;
  for (let i = 0; i < 6; i++) {
    const response = await request("/api/auth/sign-in/email", { email, password: "incorrect-password" });
    if (response.status === 429) { throttled = true; break; }
    assert.equal(response.status, 401);
  }
  assert(throttled, "Repeated sign-in attempts should be rate limited");
  console.log("PASS: pages, registration, password hash, duplicate email, login, session protection, origin checks, logout, rate limiting");
} finally {
  await pool.query('DELETE FROM "User" WHERE email = $1', [email]);
  await pool.query('DELETE FROM "RateLimit" WHERE key LIKE $1', [`%${ip}%`]);
  await pool.end();
}
