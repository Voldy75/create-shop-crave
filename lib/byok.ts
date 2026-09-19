import type { Provider } from "@/lib/providers";

/**
 * Bring-your-own-key storage — the single source of truth for where a user's
 * own AI key lives on the client.
 *
 * The key is stored in localStorage ONLY and is never persisted server-side;
 * `/api/chat` strips `apiKey` from the request body before any logging. These
 * two keys were previously re-declared inline in three places (web chat, web
 * arena, and cleared by hand in UserContext) which is why they live here now —
 * web and mobile must read and write the exact same slots so a key entered on
 * one surface is honoured on the other.
 */

export const BYOK_PROVIDER_KEY = "crave_byok_provider";
export const BYOK_API_KEY = "crave_byok_key";

export interface StoredBYOK {
  provider: Provider;
  apiKey: string;
}

export function getStoredBYOK(): StoredBYOK | null {
  if (typeof window === "undefined") return null;
  try {
    const provider = localStorage.getItem(BYOK_PROVIDER_KEY) as Provider | null;
    const apiKey = localStorage.getItem(BYOK_API_KEY);
    if (provider && apiKey) return { provider, apiKey };
  } catch {
    /* ignore */
  }
  return null;
}

export function saveBYOK(provider: Provider, apiKey: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(BYOK_PROVIDER_KEY, provider);
  localStorage.setItem(BYOK_API_KEY, apiKey);
}

export function clearBYOK() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(BYOK_PROVIDER_KEY);
  localStorage.removeItem(BYOK_API_KEY);
}
