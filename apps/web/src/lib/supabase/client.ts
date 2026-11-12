"use client";

import { createBrowserSupabase } from "@rsos/db";

/** Typed Supabase client for Client Components. Publishable key only; RLS applies. */
export const getBrowserSupabase = createBrowserSupabase;
