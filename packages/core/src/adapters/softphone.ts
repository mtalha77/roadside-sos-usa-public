import { createHmac } from "node:crypto";

/**
 * Browser softphone (RSOS-074b): a Twilio Voice access token (JWT, HS256, signed with the API key
 * secret), 1 hour, identity = the dispatcher. Minted on the server only; no SDK needed.
 */
export function voiceAccessToken(o: {
  accountSid: string;
  apiKeySid: string;
  apiKeySecret: string;
  twimlAppSid: string;
  identity: string;
  ttlSec?: number;
  now?: number;
}): string {
  const now = Math.floor((o.now ?? Date.now()) / 1000);
  const b64 = (v: object) => Buffer.from(JSON.stringify(v)).toString("base64url");
  const header = { typ: "JWT", alg: "HS256", cty: "twilio-fpa;v=1" };
  const payload = {
    jti: `${o.apiKeySid}-${now}`,
    iss: o.apiKeySid,
    sub: o.accountSid,
    iat: now,
    nbf: now,
    exp: now + (o.ttlSec ?? 3600),
    grants: {
      identity: o.identity,
      voice: { incoming: { allow: true }, outgoing: { application_sid: o.twimlAppSid } },
    },
  };
  const body = `${b64(header)}.${b64(payload)}`;
  const sig = createHmac("sha256", o.apiKeySecret).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export type SoftphoneConfig =
  | {
      mode: "real";
      accountSid: string;
      apiKeySid: string;
      apiKeySecret: string;
      twimlAppSid: string;
    }
  | { mode: "fake" };

export function softphoneConfig(
  env: Record<string, string | undefined> = process.env,
): SoftphoneConfig {
  const {
    TWILIO_ACCOUNT_SID: a,
    TWILIO_API_KEY_SID: k,
    TWILIO_API_KEY_SECRET: s,
    TWILIO_TWIML_APP_SID: app,
  } = env;
  return a && k && s && app
    ? { mode: "real", accountSid: a, apiKeySid: k, apiKeySecret: s, twimlAppSid: app }
    : { mode: "fake" };
}

/** Redirects a live call to new TwiML (hold, resume, transfer). Real Twilio only. */
export async function updateLiveCall(
  creds: { accountSid: string; authToken: string },
  callSid: string,
  twiml: string,
  fetchImpl: typeof fetch = fetch,
): Promise<boolean> {
  if (!/^CA[0-9a-fA-F]{32}$/.test(callSid)) return false;
  try {
    const res = await fetchImpl(
      `https://api.twilio.com/2010-04-01/Accounts/${creds.accountSid}/Calls/${callSid}.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${btoa(`${creds.accountSid}:${creds.authToken}`)}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ Twiml: twiml }),
        signal: AbortSignal.timeout(8000),
      },
    );
    return res.ok;
  } catch {
    return false;
  }
}
