"use client";

/**
 * BYOK key dialog — opened from web chat when the daily limit is hit, and from
 * the model picker.
 *
 * Converted to meshi 2026-09-29. It was the last user-facing pre-meshi screen:
 * a white card, generic grey text and an indigo accent — a palette this project
 * has never used. It survived the whole conversion because `check:hex` only
 * catches hex/rgba LITERALS and this screen was built from Tailwind colour
 * UTILITIES, which the gate cannot see. See app/(web)/error.tsx for the same
 * story and the grep that finds this class of drift.
 *
 * CROSS-TREE TRAP AVOIDED: the mobile twin (app/(mobile)/m/settings/key) marks
 * the chosen provider with `.offer-selected`, which is defined ONLY in
 * m/mobile.css. The web tree never loads that file, so the class would have
 * styled nothing here — silently, exactly like the `chip-solid` and
 * `class="chip active"` bugs before it. The selected state is drawn with an
 * inset ring in --figure-accent instead (theme-aware: forest in light, lime in
 * dark, so the ring clears 3:1 on both grounds).
 *
 * Behaviour is unchanged apart from two additions this modal was missing:
 * Escape closes, and so does a click on the scrim.
 */

import { useEffect, useRef, useState } from "react";
import { X, Key, AlertCircle, ExternalLink } from "lucide-react";
import { PROVIDERS, type Provider } from "@/lib/providers";

interface ApiKeyDialogProps {
  onSave: (provider: Provider, apiKey: string) => void;
  onClose: () => void;
  error?: string | null;
}

const KEY_DOCS: Record<Provider, string> = {
  gemini: "https://aistudio.google.com/app/apikey",
  openai: "https://platform.openai.com/api-keys",
  anthropic: "https://console.anthropic.com/settings/keys",
};

export function ApiKeyDialog({ onSave, onClose, error }: ApiKeyDialogProps) {
  const [selectedProvider, setSelectedProvider] = useState<Provider>("gemini");
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const providerInfo = PROVIDERS.find((p) => p.id === selectedProvider)!;

  useEffect(() => {
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const handleSave = () => {
    if (!apiKey.trim()) return;
    onSave(selectedProvider, apiKey.trim());
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{
        background: "color-mix(in srgb, var(--m-forest-2) 55%, transparent)",
        backdropFilter: "blur(8px)",
      }}
      onClick={onClose}
    >
      <div
        className="card vstack"
        role="dialog"
        aria-modal="true"
        aria-labelledby="byok-title"
        onClick={(e) => e.stopPropagation()}
        style={{ width: "100%", maxWidth: 460, padding: 22, gap: 16 }}
      >
        {/* Header */}
        <div className="hstack" style={{ gap: 12, alignItems: "flex-start" }}>
          <span
            className="icon-btn tint-green"
            style={{ boxShadow: "none", color: "var(--figure-accent)", flex: "none" }}
            aria-hidden
          >
            <Key width={19} height={19} />
          </span>
          <div className="vstack grow" style={{ gap: 1, minWidth: 0 }}>
            <span className="t-h2" id="byok-title">
              Daily limit reached
            </span>
            <span className="t-cap">Add your own API key to keep going</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="icon-btn"
            style={{ flex: "none", boxShadow: "none" }}
            aria-label="Close dialog"
          >
            <X width={18} height={18} />
          </button>
        </div>

        {/* Where the key lives — the same promise the mobile screen makes. */}
        <div className="toast tint-green" style={{ boxShadow: "none" }}>
          You&apos;ve used your 2 free requests for today. Your key is stored in this
          browser only — never sent to our servers for storage. Resets at midnight UTC.
        </div>

        {/* Provider */}
        <div className="vstack" style={{ gap: 8 }}>
          <span className="t-micro">AI provider</span>
          <div className="hstack" style={{ gap: 8 }}>
            {PROVIDERS.map((p) => {
              const on = selectedProvider === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setSelectedProvider(p.id);
                    setApiKey("");
                  }}
                  aria-pressed={on}
                  className="card grow"
                  style={{
                    padding: "12px 8px",
                    border: "none",
                    textAlign: "center",
                    cursor: "pointer",
                    opacity: on ? 1 : 0.55,
                    boxShadow: on ? "inset 0 0 0 2.5px var(--figure-accent)" : "none",
                  }}
                >
                  <span className="t-h2" style={{ fontSize: 14 }}>
                    {p.label.split(" ").pop()}
                  </span>
                </button>
              );
            })}
          </div>
          <span className="t-cap">{providerInfo.description}</span>
        </div>

        {/* Key */}
        <div className="vstack" style={{ gap: 8 }}>
          <div className="hstack" style={{ justifyContent: "space-between" }}>
            <span className="t-micro">API key</span>
            <a
              href={KEY_DOCS[selectedProvider]}
              target="_blank"
              rel="noopener noreferrer"
              className="t-cap hstack"
              style={{ gap: 4, color: "var(--figure-accent)", fontWeight: 700 }}
            >
              Get a key <ExternalLink width={12} height={12} />
            </a>
          </div>
          <div className="input" style={{ height: 48 }}>
            <Key width={17} height={17} style={{ color: "var(--m-ink-soft)", flex: "none" }} aria-hidden />
            <input
              ref={inputRef}
              type={showKey ? "text" : "password"}
              placeholder={providerInfo.keyPlaceholder}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
              /* meshi-b's .input styles only the WRAPPER — it has no rule for a
                 nested <input>, so the element keeps its own background and
                 border and renders a box inside the pill. The mobile twin sets
                 these explicitly for the same reason; do not rely on a reset. */
              style={{
                flex: 1,
                minWidth: 0,
                background: "none",
                border: "none",
                padding: 0,
                font: "inherit",
                color: "inherit",
                fontFamily: "ui-monospace, Menlo, monospace",
                fontSize: 13,
                outline: "none",
              }}
            />
            <button
              type="button"
              onClick={() => setShowKey(!showKey)}
              className="t-cap"
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                flex: "none",
                color: "var(--figure-accent)",
                fontWeight: 700,
              }}
            >
              {showKey ? "Hide" : "Show"}
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div
            className="hstack"
            role="alert"
            style={{
              gap: 8,
              padding: "12px 14px",
              borderRadius: 12,
              background: "color-mix(in srgb, var(--m-red) 12%, transparent)",
              color: "var(--text-red)",
            }}
          >
            <AlertCircle width={16} height={16} style={{ flex: "none" }} aria-hidden />
            <span className="t-cap" style={{ color: "inherit" }}>
              {error}
            </span>
          </div>
        )}

        {/* Actions */}
        <div className="hstack" style={{ gap: 10, marginTop: 2 }}>
          <button type="button" onClick={onClose} className="pill-secondary" style={{ flex: 1 }}>
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!apiKey.trim()}
            className="pill-primary"
            style={{
              flex: 1,
              opacity: apiKey.trim() ? 1 : 0.5,
              cursor: apiKey.trim() ? "pointer" : "not-allowed",
            }}
          >
            Save &amp; continue
          </button>
        </div>
      </div>
    </div>
  );
}
