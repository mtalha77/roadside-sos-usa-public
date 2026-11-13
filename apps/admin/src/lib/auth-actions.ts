"use server";

import { supabaseConfigured } from "@rsos/db/session";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getServerSupabase } from "@/lib/supabase/server";

export type AuthFormState = {
  error?: "invalid" | "required" | "code" | "notConfigured" | "generic";
};

const SignInSchema = z.object({ email: z.email(), password: z.string().min(1).max(200) });
const CodeSchema = z.object({ factorId: z.string().min(1), code: z.string().regex(/^\d{6}$/) });

/** Step 1: email and password. Always continues to the authenticator step. */
export async function signInAction(_: AuthFormState, form: FormData): Promise<AuthFormState> {
  const parsed = SignInSchema.safeParse({
    email: form.get("email"),
    password: form.get("password"),
  });
  if (!parsed.success) return { error: "required" };
  if (!supabaseConfigured()) return { error: "notConfigured" };
  const supabase = await getServerSupabase();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: "invalid" };
  redirect("/sign-in/verify");
}

/** Starts authenticator-app setup: removes unfinished setups, returns the QR code and key. */
export async function startEnrollAction(): Promise<
  { factorId: string; qr: string; secret: string } | { error: AuthFormState["error"] }
> {
  const supabase = await getServerSupabase();
  const { data: factors } = await supabase.auth.mfa.listFactors();
  for (const f of factors?.all ?? []) {
    if (f.factor_type === "totp" && f.status === "unverified")
      await supabase.auth.mfa.unenroll({ factorId: f.id });
  }
  const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp" });
  if (error || !data) return { error: "generic" };
  return { factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret };
}

/** Step 2: the 6-digit authenticator code. Success upgrades the session to aal2. */
export async function verifyCodeAction(_: AuthFormState, form: FormData): Promise<AuthFormState> {
  const parsed = CodeSchema.safeParse({ factorId: form.get("factorId"), code: form.get("code") });
  if (!parsed.success) return { error: "code" };
  const supabase = await getServerSupabase();
  const { error } = await supabase.auth.mfa.challengeAndVerify({
    factorId: parsed.data.factorId,
    code: parsed.data.code,
  });
  if (error) return { error: "code" };
  redirect("/");
}

export async function signOutAction() {
  const supabase = await getServerSupabase();
  await supabase.auth.signOut();
  redirect("/sign-in");
}
