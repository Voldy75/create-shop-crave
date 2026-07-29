"use client";

import { useState } from "react";
import { X, Sparkles, CreditCard, Key, Loader2, AlertCircle, Check } from "lucide-react";
import type { Provider } from "@/lib/providers";
import { PROVIDERS } from "@/lib/providers";

interface UpgradeDialogProps {
  onProActivated: () => void;
  onBYOKSave: (provider: Provider, apiKey: string) => void;
  onClose: () => void;
}

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Razorpay: any;
  }
}

export function UpgradeDialog({ onProActivated, onBYOKSave, onClose }: UpgradeDialogProps) {
  const [tab, setTab] = useState<"upgrade" | "byok">("upgrade");
  const [loading, setLoading] = useState<"razorpay" | "stripe" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [byokProvider, setByokProvider] = useState<Provider>("gemini");
  const [byokKey, setByokKey] = useState("");
  const [byokError, setByokError] = useState<string | null>(null);

  const handleRazorpay = async () => {
    setLoading("razorpay");
    setError(null);
    try {
      const res = await fetch("/api/subscribe/razorpay", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to create order");

      if (!window.Razorpay) {
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement("script");
          script.src = "https://checkout.razorpay.com/v1/checkout.js";
          script.onload = () => resolve();
          script.onerror = () => reject(new Error("Failed to load Razorpay"));
          document.head.appendChild(script);
        });
      }

      const rzp = new window.Razorpay({
        key: data.keyId,
        amount: data.amount,
        currency: data.currency,
        name: "Crave & Create",
        description: "Pro Plan — 1 month",
        order_id: data.orderId,
        prefill: { name: data.userName, email: data.userEmail },
        theme: { color: "#ff6b35" },
        handler: async (response: {
          razorpay_order_id: string;
          razorpay_payment_id: string;
          razorpay_signature: string;
        }) => {
          setLoading("razorpay");
          const verifyRes = await fetch("/api/subscribe/razorpay/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(response),
          });
          const verifyData = await verifyRes.json();
          if (verifyData.success) {
            onProActivated();
          } else {
            setError("Payment verification failed. Contact support.");
            setLoading(null);
          }
        },
        modal: { ondismiss: () => setLoading(null) },
      });
      rzp.open();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(null);
    }
  };

  const handleStripe = async () => {
    setLoading("stripe");
    setError(null);
    try {
      const res = await fetch("/api/subscribe/stripe", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to create session");
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(null);
    }
  };

  const handleBYOKSave = () => {
    if (!byokKey.trim()) {
      setByokError("Please enter your API key.");
      return;
    }
    onBYOKSave(byokProvider, byokKey.trim());
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-md overflow-hidden"
        style={{
          background: "var(--cc-surface)",
          borderRadius: "20px",
          border: "1px solid var(--cc-border)",
          boxShadow: "var(--cc-shadow-lg, 0 25px 50px rgba(0,0,0,0.4))",
        }}
      >
        {/* Header */}
        <div
          style={{
            background: "linear-gradient(135deg, var(--cc-accent) 0%, #ff8c5a 100%)",
            padding: "24px",
            position: "relative",
          }}
        >
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-full transition-colors bg-[rgba(255,255,255,0.2)] hover:bg-[rgba(255,255,255,0.3)]"
          >
            <X className="w-4 h-4 text-white" />
          </button>
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="w-5 h-5 text-white" />
            <span style={{ fontSize: "18px", fontWeight: 700, color: "#fff" }}>
              Upgrade to Pro
            </span>
          </div>
          <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.8)" }}>
            You&apos;ve used your free requests for today.
          </p>
        </div>

        {/* Tabs */}
        <div className="flex" style={{ borderBottom: "1px solid var(--cc-border)" }}>
          <button
            onClick={() => setTab("upgrade")}
            className="flex-1 py-3 text-sm font-medium transition-colors"
            style={{
              color: tab === "upgrade" ? "var(--cc-accent)" : "var(--cc-text-secondary)",
              borderBottom: tab === "upgrade" ? "2px solid var(--cc-accent)" : "2px solid transparent",
            }}
          >
            Upgrade Pro
          </button>
          <button
            onClick={() => setTab("byok")}
            className="flex-1 py-3 text-sm font-medium transition-colors"
            style={{
              color: tab === "byok" ? "var(--cc-accent)" : "var(--cc-text-secondary)",
              borderBottom: tab === "byok" ? "2px solid var(--cc-accent)" : "2px solid transparent",
            }}
          >
            Use Your API Key
          </button>
        </div>

        <div style={{ padding: "24px" }}>
          {tab === "upgrade" ? (
            <div className="space-y-4">
              {/* Pro benefits */}
              <div
                style={{
                  background: "rgba(255,107,53,0.08)",
                  borderRadius: "12px",
                  padding: "16px",
                }}
                className="space-y-2"
              >
                {[
                  "Unlimited AI requests",
                  "All 3 AI models (Gemini, GPT-4, Claude)",
                  "Model Arena — compare side by side",
                  "Priority support",
                ].map((benefit) => (
                  <div
                    key={benefit}
                    className="flex items-center gap-2"
                    style={{ fontSize: "14px", color: "var(--cc-text-primary)" }}
                  >
                    <Check className="w-4 h-4 shrink-0" style={{ color: "var(--cc-accent)" }} />
                    {benefit}
                  </div>
                ))}
              </div>

              {error && (
                <div
                  className="flex items-center gap-2"
                  style={{
                    fontSize: "14px",
                    color: "#ff453a",
                    background: "rgba(255,69,58,0.08)",
                    padding: "12px",
                    borderRadius: "12px",
                  }}
                >
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {error}
                </div>
              )}

              {/* Razorpay */}
              <button
                onClick={handleRazorpay}
                disabled={loading !== null}
                className="w-full flex items-center justify-center gap-2 transition-all disabled:opacity-50 bg-[var(--cc-accent)] enabled:hover:bg-[var(--cc-accent-hover)]"
                style={{
                  color: "#fff",
                  height: "48px",
                  borderRadius: "980px",
                  fontSize: "15px",
                  fontWeight: 600,
                }}
              >
                {loading === "razorpay" ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CreditCard className="w-4 h-4" />
                )}
                Pay ₹749/month via Razorpay
              </button>

              {/* Stripe */}
              <button
                onClick={handleStripe}
                disabled={loading !== null}
                className="w-full flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                style={{
                  background: "transparent",
                  color: "var(--cc-text-primary)",
                  height: "48px",
                  borderRadius: "980px",
                  fontSize: "15px",
                  fontWeight: 600,
                  border: "1px solid var(--cc-border)",
                }}
              >
                {loading === "stripe" ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CreditCard className="w-4 h-4" />
                )}
                Pay $9/month via Stripe
              </button>

              <p style={{ fontSize: "12px", textAlign: "center", color: "var(--cc-text-tertiary)" }}>
                Cancel anytime. No hidden fees.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <p style={{ fontSize: "14px", color: "var(--cc-text-secondary)" }}>
                Already have an API key? Use it for unlimited requests — your key, your quota.
              </p>

              {/* Provider selector */}
              <div className="grid grid-cols-3 gap-2">
                {PROVIDERS.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setByokProvider(p.id)}
                    className="transition-all text-center"
                    style={{
                      padding: "10px",
                      borderRadius: "12px",
                      fontSize: "12px",
                      fontWeight: 600,
                      border: byokProvider === p.id ? "1.5px solid var(--cc-accent)" : "1px solid var(--cc-border)",
                      background: byokProvider === p.id ? "rgba(255,107,53,0.08)" : "transparent",
                      color: byokProvider === p.id ? "var(--cc-accent)" : "var(--cc-text-secondary)",
                    }}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              <div className="space-y-1">
                <div className="relative">
                  <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--cc-text-tertiary)" }} />
                  <input
                    value={byokKey}
                    onChange={(e) => { setByokKey(e.target.value); setByokError(null); }}
                    placeholder={PROVIDERS.find((p) => p.id === byokProvider)?.keyPlaceholder ?? "API Key"}
                    type="password"
                    className="w-full outline-none"
                    style={{
                      paddingLeft: "40px",
                      height: "44px",
                      borderRadius: "12px",
                      border: "1px solid var(--cc-border)",
                      background: "var(--cc-surface-2)",
                      color: "var(--cc-text-primary)",
                      fontSize: "14px",
                    }}
                  />
                </div>
                {byokError && (
                  <p style={{ fontSize: "12px", color: "#ff453a", marginLeft: "4px" }}>{byokError}</p>
                )}
              </div>

              <button
                onClick={handleBYOKSave}
                className="w-full flex items-center justify-center gap-2 transition-all"
                style={{
                  background: "var(--cc-text-primary)",
                  color: "var(--cc-bg)",
                  height: "44px",
                  borderRadius: "980px",
                  fontSize: "15px",
                  fontWeight: 600,
                }}
              >
                Use This Key
              </button>

              <p style={{ fontSize: "12px", color: "var(--cc-text-tertiary)" }}>
                Your key is stored locally and never sent to our servers (except to the AI provider on each request).
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
