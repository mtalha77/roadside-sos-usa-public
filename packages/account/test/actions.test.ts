import type * as Emails from "@rsos/emails";
import { beforeEach, describe, expect, it, vi } from "vitest";

// A fake Supabase client: records every RPC; results are set per test.
const calls: { fn: string; args: unknown }[] = [];
let rpcResult: Record<string, { data?: unknown; error?: { message: string; hint?: string } }> = {};
const supabase = {
  rpc: vi.fn(async (fn: string, args?: unknown) => {
    calls.push({ fn, args });
    return rpcResult[fn] ?? { data: null, error: null };
  }),
  auth: {
    getUser: vi.fn(async () => ({
      data: { user: { email: "dev@example.test", user_metadata: { full_name: "Dev" } } },
    })),
    updateUser: vi.fn(async () => ({ error: null })),
    resetPasswordForEmail: vi.fn(async () => ({ error: null })),
    signOut: vi.fn(async () => ({ error: null })),
  },
};
const jar = new Map<string, string>();
const sent: { subject: string; tags?: Record<string, string> }[] = [];

vi.mock("../src/server/client", () => ({
  getAccountSupabase: async () => supabase,
  requestMeta: async () => ({ ip: "203.0.113.7", userAgent: "Mozilla/5.0 (iPhone) Safari/605" }),
  TRUSTED_DEVICE_COOKIE: "rsos_td",
}));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (n: string) => (jar.has(n) ? { value: jar.get(n) } : undefined),
    set: (n: string, v: string) => jar.set(n, v),
  }),
  headers: async () => new Headers({ host: "pro.example.test", "x-forwarded-proto": "https" }),
}));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw Object.assign(new Error("NEXT_REDIRECT"), { to });
  },
}));
vi.mock("@rsos/emails", async (orig) => ({
  ...(await orig<typeof Emails>()),
  chooseEmailSender: () => ({
    mode: "mock",
    send: async (e: { subject: string; tags?: Record<string, string> }) => {
      sent.push(e);
      return { ok: true, id: "1", mode: "mock" };
    },
  }),
}));

const actions = await import("../src/server/actions");
const form = (o: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) f.set(k, v);
  return f;
};
const redirected = async (p: Promise<unknown>) => {
  try {
    await p;
    return null;
  } catch (e) {
    return (e as { to?: string }).to ?? null;
  }
};

beforeEach(() => {
  calls.length = 0;
  sent.length = 0;
  jar.clear();
  rpcResult = {};
});

describe("second step by email (AC1)", () => {
  it("emails a code; in test mode the code is also shown", async () => {
    rpcResult.issue_email_code = { data: "123456" };
    const r = await actions.sendSecondStepCodeAction();
    expect(r).toEqual({ ok: true, mockCode: "123456" });
    expect(sent[0]?.tags?.category).toBe("sign-in-code");
  });

  it("reports the 15-minute lock when the database refuses a new code", async () => {
    rpcResult.issue_email_code = { error: { message: "locked until ...", hint: "locked" } };
    expect(await actions.sendSecondStepCodeAction()).toEqual({ error: "locked" });
  });

  it("refuses wrong, expired and locked codes without signing in", async () => {
    for (const [db, err] of [
      ["invalid", "code"],
      ["expired", "expired"],
      ["locked", "locked"],
    ] as const) {
      rpcResult.verify_email_code = { data: db };
      expect(await actions.verifySecondStepAction({}, form({ code: "000000" }))).toEqual({
        error: err,
      });
    }
    expect(await actions.verifySecondStepAction({}, form({ code: "12" }))).toEqual({
      error: "code",
    });
  });

  it("a right code continues to the safe next page and can trust the device for 30 days", async () => {
    rpcResult.verify_email_code = { data: "ok" };
    const to = await redirected(
      actions.verifySecondStepAction(
        {},
        form({ code: "123456", trust: "on", next: "//evil.test" }),
      ),
    );
    expect(to).toBe("/");
    expect(jar.get("rsos_td")).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(calls.map((c) => c.fn)).toEqual(
      expect.arrayContaining(["verify_email_code", "trust_this_device", "log_security_event"]),
    );
    expect(sent.at(-1)?.tags?.event).toBe("new_sign_in");
  });

  it("a trusted-device cookie skips the code only if the database accepts it", async () => {
    expect(await actions.tryTrustedDevice()).toBe(false);
    jar.set("rsos_td", "x".repeat(43));
    rpcResult.use_trusted_device = { data: true };
    expect(await actions.tryTrustedDevice()).toBe(true);
  });
});

describe("every security change is audited and emailed (AC3)", () => {
  it("password change: audit row + notice", async () => {
    expect(await actions.changePasswordAction({}, form({ current: "x", next: "short" }))).toEqual({
      error: "required",
    });
    const r = await actions.resetPasswordAction({}, form({ next: "a-long-new-password" }));
    expect(r).toEqual({ ok: true });
    expect(calls.find((c) => c.fn === "log_security_event")?.args).toMatchObject({
      p_action: "auth.password_changed",
      p_ip: "203.0.113.7",
    });
    expect(sent.at(-1)?.tags).toEqual({ category: "security", event: "password_changed" });
    expect(supabase.auth.signOut).toHaveBeenCalledWith({ scope: "others" });
  });

  it("second-step change: the database writes the audit row, the notice is emailed", async () => {
    expect(await actions.setSecondStepMethodAction({}, form({ method: "email" }))).toEqual({
      ok: true,
    });
    expect(calls.map((c) => c.fn)).toEqual(["set_second_step_method"]);
    expect(sent.at(-1)?.tags?.event).toBe("second_step_changed");
    expect(await actions.setSecondStepMethodAction({}, form({ method: "pigeon" }))).toEqual({
      error: "required",
    });
  });

  it("signing out another device revokes it and emails a notice", async () => {
    rpcResult.revoke_my_session = { data: true };
    await actions.revokeSessionAction(form({ session: "00000000-0000-4000-8000-000000000001" }));
    expect(calls[0]).toEqual({
      fn: "revoke_my_session",
      args: { p_session_id: "00000000-0000-4000-8000-000000000001" },
    });
    expect(sent.at(-1)?.tags?.event).toBe("session_revoked");
    calls.length = 0;
    await actions.revokeSessionAction(form({ session: "not-a-uuid" }));
    expect(calls).toEqual([]);
  });

  it("recovery codes, email change, closure and name change are recorded", async () => {
    rpcResult.generate_recovery_codes = { data: ["aaaa-bbbb"] };
    expect(await actions.generateRecoveryCodesAction()).toEqual({ ok: true, codes: ["aaaa-bbbb"] });
    expect(await actions.changeEmailAction({}, form({ email: "new@example.test" }))).toEqual({
      ok: true,
    });
    expect(supabase.auth.updateUser).toHaveBeenCalledWith(
      { email: "new@example.test" },
      { emailRedirectTo: "https://pro.example.test/account" },
    );
    expect(await actions.requestClosureAction({}, form({ reason: "retiring" }))).toEqual({
      ok: true,
    });
    expect(await actions.updateNameAction({}, form({ name: "New Name" }))).toEqual({ ok: true });
    expect(sent.map((s) => s.tags?.event)).toEqual([
      "recovery_codes",
      "email_changed",
      "closure_requested",
    ]);
    expect(
      calls
        .filter((c) => c.fn === "log_security_event")
        .map((c) => (c.args as { p_action: string }).p_action),
    ).toEqual(["auth.email_change_requested", "auth.name_changed"]);
  });

  it("forgot password answers the same whether or not the account exists", async () => {
    expect(await actions.forgotPasswordAction({}, form({ email: "nobody@example.test" }))).toEqual({
      ok: true,
    });
    expect(supabase.auth.resetPasswordForEmail).toHaveBeenCalledWith("nobody@example.test", {
      redirectTo: "https://pro.example.test/auth/callback?next=/reset-password",
    });
    expect(await actions.forgotPasswordAction({}, form({ email: "nope" }))).toEqual({
      error: "required",
    });
  });

  it("recovery code: wrong is refused, right continues", async () => {
    rpcResult.use_recovery_code = { data: false };
    expect(await actions.useRecoveryCodeAction({}, form({ recovery: "aaaa-bbbb" }))).toEqual({
      error: "code",
    });
    rpcResult.use_recovery_code = { data: true };
    expect(
      await redirected(
        actions.useRecoveryCodeAction({}, form({ recovery: "aaaa-bbbb", next: "/jobs" })),
      ),
    ).toBe("/jobs");
  });
});
