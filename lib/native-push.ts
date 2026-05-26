/**
 * Native push sender — FCM HTTP v1. Sends to APNs (iOS) and FCM (Android) device
 * tokens captured by the Capacitor shell (lib/native-bridge registerNativePush).
 * iOS works because Firebase proxies APNs once an APNs auth key is uploaded in
 * the Firebase console.
 *
 * Config: set FIREBASE_SERVICE_ACCOUNT to the service-account JSON (as a string)
 * in the server env. When unset, sendNativePush returns { ok:false, notConfigured:true }
 * so the cron can skip cleanly instead of crashing. No external deps — the OAuth2
 * access token is minted by signing a JWT with Node's crypto.
 */

import { createSign } from "crypto";

interface ServiceAccount {
  client_email: string;
  private_key: string;
  project_id: string;
}

export interface NativePushResult {
  ok: boolean;
  status?: number;
  error?: string;
  /** Token is no longer valid (UNREGISTERED/invalid) — caller should clear it. */
  gone?: boolean;
  /** Firebase env not set — caller should skip rather than treat as failure. */
  notConfigured?: boolean;
}

let cachedSA: ServiceAccount | null | undefined;
let cachedToken: { value: string; expiresAt: number } | null = null;

function serviceAccount(): ServiceAccount | null {
  if (cachedSA !== undefined) return cachedSA;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) {
    cachedSA = null;
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as ServiceAccount;
    // Support both literal "\n" and real newlines in the private key.
    parsed.private_key = parsed.private_key.replace(/\\n/g, "\n");
    cachedSA = parsed;
  } catch {
    cachedSA = null;
  }
  return cachedSA;
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Mint (and cache) an OAuth2 access token for FCM via the service-account JWT. */
async function getAccessToken(sa: ServiceAccount): Promise<string | null> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.value;
  }
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = base64url(
    JSON.stringify({
      iss: sa.client_email,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    }),
  );
  const signingInput = `${header}.${claim}`;
  const signature = base64url(createSign("RSA-SHA256").update(signingInput).sign(sa.private_key));
  const jwt = `${signingInput}.${signature}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  if (!res.ok) return null;
  const json = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!json.access_token) return null;
  cachedToken = {
    value: json.access_token,
    expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000,
  };
  return json.access_token;
}

/** Send one notification to a single device token. */
export async function sendNativePush(
  token: string,
  msg: { title: string; body: string; url?: string },
): Promise<NativePushResult> {
  const sa = serviceAccount();
  if (!sa) return { ok: false, notConfigured: true };

  const accessToken = await getAccessToken(sa);
  if (!accessToken) return { ok: false, error: "token_mint_failed" };

  const res = await fetch(`https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({
      message: {
        token,
        notification: { title: msg.title, body: msg.body },
        data: msg.url ? { url: msg.url } : undefined,
      },
    }),
  });

  if (res.ok) return { ok: true, status: res.status };

  const errText = await res.text().catch(() => "");
  // FCM signals a dead token via UNREGISTERED / INVALID_ARGUMENT(404/400).
  const gone = res.status === 404 || /UNREGISTERED|registration-token-not-registered/i.test(errText);
  return { ok: false, status: res.status, error: errText.slice(0, 200), gone };
}
