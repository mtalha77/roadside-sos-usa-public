"use server";

import { MOCK_CODE } from "@rsos/core";
import { getSiteUrl } from "@rsos/config/site";
import { supabaseConfigured } from "@rsos/db/session";
import { redirect } from "next/navigation";
import { z } from "zod";
import { phoneVerifier } from "@/lib/phone";
import { getServerSupabase } from "@/lib/supabase/server";

export type AuthFormState = {
  error?: "invalid" | "required" | "code" | "notConfigured" | "generic";
  linkSent?: boolean;
  codeSent?: string;
  mock?: string;
  unavailable?: boolean;
};

const Email = z.email();
const Phone = z.string().regex(/^\+1[2-9]\d{2}[2-9]\d{6}$/);

export async function passwordSignInAction(
  _: AuthFormState,
  form: FormData,
): Promise<AuthFormState> {
  const parsed = z
    .object({ email: Email, password: z.string().min(1).max(200) })
    .safeParse({ email: form.get("email"), password: form.get("password") });
  if (!parsed.success) return { error: "required" };
  if (!supabaseConfigured()) return { error: "notConfigured" };
  const { error } = await (await getServerSupabase()).auth.signInWithPassword(parsed.data);
  if (error) return { error: "invalid" };
  redirect("/");
}

export async function magicLinkAction(_: AuthFormState, form: FormData): Promise<AuthFormState> {
  const parsed = Email.safeParse(form.get("email"));
  if (!parsed.success) return { error: "required" };
  if (!supabaseConfigured()) return { error: "notConfigured" };
  // Same response whether or not the account exists (no account probing).
  await (
    await getServerSupabase()
  ).auth.signInWithOtp({
    email: parsed.data,
    options: {
      shouldCreateUser: false,
      emailRedirectTo: `${getSiteUrl(process.env, 3001)}/auth/callback`,
    },
  });
  return { linkSent: true };
}

export async function sendPhoneCodeAction(
  _: AuthFormState,
  form: FormData,
): Promise<AuthFormState> {
  const parsed = Phone.safeParse(form.get("phone"));
  if (!parsed.success) return { error: "required" };
  const supabase = await getServerSupabase();
  const verifier = phoneVerifier(supabase);
  if (verifier.kind === "unavailable") return { unavailable: true };
  const result = await verifier.start(parsed.data);
  if (!result.ok) return { error: "generic" };
  return { codeSent: parsed.data, ...(verifier.kind === "mock" ? { mock: MOCK_CODE } : {}) };
}

export async function checkPhoneCodeAction(
  prev: AuthFormState,
  form: FormData,
): Promise<AuthFormState> {
  const parsed = z
    .object({ phone: Phone, code: z.string().regex(/^\d{6}$/) })
    .safeParse({ phone: form.get("phone"), code: form.get("code") });
  if (!parsed.success) return { ...prev, error: "code" };
  const supabase = await getServerSupabase();
  const verifier = phoneVerifier(supabase);
  // The mock keeps no server state between requests, so restart it before checking.
  if (verifier.kind === "mock") await verifier.start(parsed.data.phone);
  const result = await verifier.check(parsed.data.phone, parsed.data.code);
  if (!result.ok) return { ...prev, error: "code" };
  if (verifier.kind === "mock")
    await supabase.auth.updateUser({ data: { phone_verified_mock: parsed.data.phone } });
  redirect("/");
}

export async function signOutAction() {
  await (await getServerSupabase()).auth.signOut();
  redirect("/sign-in");
}
