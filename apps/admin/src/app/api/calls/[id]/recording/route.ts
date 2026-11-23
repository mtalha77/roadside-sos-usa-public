import type { NextRequest } from "next/server";
import { z } from "zod";
import { getServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Call recordings stay in Twilio and are never public: staff who may see the call (RLS, by
 * market) stream it through here. Without Twilio keys there is nothing to fetch.
 */
export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) return new Response("Not found", { status: 404 });
  // The staff member's own client: RLS decides whether they may see this call.
  const supabase = await getServerSupabase();
  const { data: call } = await supabase
    .from("calls")
    .select("recording_sid")
    .eq("id", id.data)
    .maybeSingle();
  const sid = call?.recording_sid;
  const account = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !account || !token) return new Response("Not found", { status: 404 });
  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${account}/Recordings/${sid}.mp3`,
    { headers: { Authorization: `Basic ${btoa(`${account}:${token}`)}` } },
  );
  if (!res.ok || !res.body) return new Response("Not found", { status: 404 });
  await supabase.rpc("log_security_event", {
    p_action: "calls.recording_played",
    p_data: { call_id: id.data },
  });
  return new Response(res.body, {
    headers: {
      "Content-Type": "audio/mpeg",
      "Cache-Control": "private, no-store",
      "Content-Disposition": "inline",
    },
  });
}
