import { Hono } from "hono";

interface AppEnv {
  SURVEY_KV: KVNamespace;
  ADMIN_USER: string;
  ADMIN_PASS: string;
  SESSION_SECRET: string;
}

// ── helpers ──────────────────────────────────────────────────────────────────

async function makeToken(secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode("admin-session"));
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

async function verifyToken(token: string, secret: string): Promise<boolean> {
  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );
    const decoded = Uint8Array.from(atob(token), (c) => c.charCodeAt(0));
    return await crypto.subtle.verify("HMAC", key, decoded, encoder.encode("admin-session"));
  } catch {
    return false;
  }
}

// ── app ───────────────────────────────────────────────────────────────────────

const app = new Hono<{ Bindings: AppEnv }>();

// GET /api/submissions — return all stored submissions
app.get("/api/submissions", async (c) => {
  const data = await c.env.SURVEY_KV.get("submissions");
  const submissions = data ? JSON.parse(data) : [];
  return c.json(submissions);
});

// POST /api/submissions — add a new submission
app.post("/api/submissions", async (c) => {
  const submission = await c.req.json();
  const data = await c.env.SURVEY_KV.get("submissions");
  const submissions: unknown[] = data ? JSON.parse(data) : [];
  submissions.push(submission);
  await c.env.SURVEY_KV.put("submissions", JSON.stringify(submissions));
  return c.json({ ok: true });
});

// POST /api/admin/login — validate credentials, return HMAC session token
app.post("/api/admin/login", async (c) => {
  const { username, password } = await c.req.json<{ username: string; password: string }>();
  if (username !== c.env.ADMIN_USER || password !== c.env.ADMIN_PASS) {
    return c.json({ ok: false }, 401);
  }
  const token = await makeToken(c.env.SESSION_SECRET);
  return c.json({ ok: true, token });
});

// DELETE /api/admin/reset — clear all submissions (requires valid session token)
app.delete("/api/admin/reset", async (c) => {
  const auth = c.req.header("Authorization") ?? "";
  if (!auth.startsWith("Bearer ")) {
    return c.json({ ok: false }, 401);
  }
  const valid = await verifyToken(auth.slice(7), c.env.SESSION_SECRET);
  if (!valid) {
    return c.json({ ok: false }, 401);
  }
  await c.env.SURVEY_KV.delete("submissions");
  return c.json({ ok: true });
});

export default app;
