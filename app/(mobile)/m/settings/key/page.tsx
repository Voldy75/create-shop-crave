"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { ArrowLeft, Key, ExternalLink, Check, Trash2 } from "lucide-react";
import { PROVIDERS, type Provider } from "@/lib/providers";
import { getStoredBYOK, saveBYOK, clearBYOK } from "@/lib/byok";
import { BoBowl } from "@/components/mascots";

/**
 * Bring-your-own-key — artboard 7f, in the MOBILE tree.
 *
 * Key entry existed ONLY as `components/UpgradeDialog.tsx` (web). Two live bugs
 * pointed here with nowhere to land:
 *
 *  - `/m/paywall`'s "Use my own key" CTA pushed to `/m/profile`, which has no
 *    key field — a dead end.
 *  - `/m/chat` had no 429 handling at all, so a free user hitting the daily cap
 *    saw nothing happen. It now routes here with `?from=chat`.
 *
 * The key is stored via `lib/byok` — the same localStorage slots web reads — so
 * it is never sent to our servers for storage (`/api/chat` strips `apiKey`
 * before logging) and a key set here is honoured on web too.
 */

const KEY_DOCS: Record<Provider, string> = {
  gemini: "https://aistudio.google.com/app/apikey",
  openai: "https://platform.openai.com/api-keys",
  anthropic: "https://console.anthropic.com/settings/keys",
};

export default function MobileKeyPage() {
  return (
    <Suspense fallback={null}>
      <KeyInner />
    </Suspense>
  );
}

function KeyInner() {
  const router = useRouter();
  const params = useSearchParams();
  const fromChat = params?.get("from") === "chat";

  const [saved, setSaved] = useState<{ provider: Provider; apiKey: string } | null>(null);
  const [provider, setProvider] = useState<Provider>("gemini");
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    const stored = getStoredBYOK();
    if (stored) {
      setSaved(stored);
      setProvider(stored.provider);
    }
  }, []);

  const providerInfo = PROVIDERS.find((p) => p.id === provider)!;

  const save = () => {
    const key = apiKey.trim();
    if (!key) return;
    saveBYOK(provider, key);
    setSaved({ provider, apiKey: key });
    setApiKey("");
    setNote("Key saved. Bo's back — ask away.");
    // Came here from a blocked chat message? Send them back to keep going.
    if (fromChat) {
      setTimeout(() => router.push("/m/chat"), 700);
    }
  };

  const remove = () => {
    clearBYOK();
    setSaved(null);
    setApiKey("");
    setNote("Key removed. You're back on the free daily allowance.");
  };

  const shell: React.CSSProperties = {
    minHeight: "100dvh",
    background: "var(--m-cream)",
    padding: "calc(env(safe-area-inset-top, 12px) + 10px) 20px calc(env(safe-area-inset-bottom, 0px) + 24px)",
    gap: 12,
  };

  return (
    <div className="vstack" style={shell}>
      <div className="hstack">
        <button className="icon-btn" onClick={() => router.back()} aria-label="Back">
          <ArrowLeft width={20} height={20} />
        </button>
        <span className="t-h1 grow" style={{ marginLeft: 10 }}>Your API key</span>
      </div>

      <div className="vstack" style={{ gap: 4 }}>
        <span className="t-d2">
          {fromChat ? <>You&rsquo;ve hit<br />today&rsquo;s free limit</> : <>Bring your<br />own key</>}
        </span>
        <span className="t-body-soft">
          {fromChat
            ? "Add your own key and Bo keeps going — no daily cap, no card."
            : "Use your own Gemini, OpenAI or Anthropic key for unlimited use."}
        </span>
      </div>

      {/* Where the key lives — the same promise the web dialog makes. */}
      <div className="toast tint-green" style={{ boxShadow: "none" }}>
        <BoBowl width={30} height={30} style={{ flex: "none" }} />
        Your key is stored on this device only — never sent to our servers for storage. Resets never; it&rsquo;s yours.
      </div>

      {saved && (
        <div className="card hstack" style={{ padding: "14px 16px", gap: 12 }}>
          <span className="icon-btn tint-green" style={{ boxShadow: "none", color: "var(--m-forest)", flex: "none" }}>
            <Check width={20} height={20} />
          </span>
          <div className="vstack grow" style={{ gap: 1, minWidth: 0 }}>
            <span className="t-h2">{PROVIDERS.find((p) => p.id === saved.provider)?.label ?? saved.provider} key active</span>
            <span className="t-cap">Unlimited use with your own key</span>
          </div>
          <button
            className="icon-btn"
            onClick={remove}
            aria-label="Remove key"
            style={{ flex: "none", color: "var(--m-burnt)" }}
          >
            <Trash2 width={18} height={18} />
          </button>
        </div>
      )}

      {/* Provider */}
      <span className="t-micro" style={{ marginTop: 4 }}>AI provider</span>
      <div className="hstack" style={{ gap: 8 }}>
        {PROVIDERS.map((p) => {
          const on = provider === p.id;
          return (
            <button
              key={p.id}
              onClick={() => { setProvider(p.id); setApiKey(""); }}
              aria-pressed={on}
              className={`card grow ${on ? "offer-selected" : ""}`}
              style={{ padding: "12px 8px", border: "none", textAlign: "center", opacity: on ? 1 : 0.55 }}
            >
              <span className="t-h2" style={{ fontSize: 14 }}>{p.label.split(" ").pop()}</span>
            </button>
          );
        })}
      </div>
      <span className="t-cap">{providerInfo.description}</span>

      {/* Key */}
      <div className="hstack" style={{ justifyContent: "space-between", marginTop: 4 }}>
        <span className="t-micro">{saved ? "Replace key" : "API key"}</span>
        <a
          href={KEY_DOCS[provider]}
          target="_blank"
          rel="noopener noreferrer"
          className="t-cap hstack"
          style={{ gap: 4, color: "var(--m-forest)", fontWeight: 700 }}
        >
          Get a key <ExternalLink width={12} height={12} />
        </a>
      </div>
      <div className="input" style={{ height: 48 }}>
        <Key width={17} height={17} style={{ color: "var(--m-ink-soft)", flex: "none" }} />
        <input
          type={showKey ? "text" : "password"}
          placeholder={providerInfo.keyPlaceholder}
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") save(); }}
          autoFocus={fromChat}
          style={{ flex: 1, minWidth: 0, background: "none", border: "none", padding: 0, font: "inherit", color: "inherit", fontFamily: "var(--m-font-mono, monospace)" }}
        />
        <button
          type="button"
          onClick={() => setShowKey((s) => !s)}
          className="t-cap"
          style={{ background: "none", border: "none", padding: 0, color: "var(--m-ink-soft)", flex: "none" }}
        >
          {showKey ? "Hide" : "Show"}
        </button>
      </div>

      {note && <span className="t-cap" style={{ color: "var(--figure-accent)" }}>{note}</span>}

      <div className="grow" />

      <button className="pill-primary" style={{ width: "100%" }} onClick={save} disabled={!apiKey.trim()}>
        {saved ? "Update key" : "Save & continue"}
      </button>
    </div>
  );
}
