"use client";

import { useState } from "react";
import { X, Sparkles, CreditCard, Key, Loader2, AlertCircle, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

      // Load Razorpay script dynamically
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
        theme: { color: "#4F46E5" },
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
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="bg-indigo-600 px-6 py-5 text-white relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1 rounded-full hover:bg-white/20 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="w-5 h-5" />
            <span className="font-bold text-lg">Upgrade to Pro</span>
          </div>
          <p className="text-indigo-200 text-sm">
            You&apos;ve used your free requests for today.
          </p>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100">
          <button
            onClick={() => setTab("upgrade")}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              tab === "upgrade"
                ? "text-indigo-600 border-b-2 border-indigo-600"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Upgrade Pro
          </button>
          <button
            onClick={() => setTab("byok")}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              tab === "byok"
                ? "text-indigo-600 border-b-2 border-indigo-600"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Use Your API Key
          </button>
        </div>

        <div className="p-6">
          {tab === "upgrade" ? (
            <div className="space-y-4">
              {/* Pro benefits */}
              <div className="bg-indigo-50 rounded-xl p-4 space-y-2">
                {[
                  "Unlimited AI requests",
                  "All 3 AI models (Gemini, GPT-4, Claude)",
                  "Model Arena — compare side by side",
                  "Priority support",
                ].map((benefit) => (
                  <div key={benefit} className="flex items-center gap-2 text-sm text-indigo-800">
                    <Check className="w-4 h-4 text-indigo-600 shrink-0" />
                    {benefit}
                  </div>
                ))}
              </div>

              {error && (
                <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 p-3 rounded-xl">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {error}
                </div>
              )}

              {/* Razorpay — India */}
              <Button
                onClick={handleRazorpay}
                disabled={loading !== null}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white h-12 rounded-xl font-medium"
              >
                {loading === "razorpay" ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <CreditCard className="w-4 h-4 mr-2" />
                )}
                Pay ₹749/month via Razorpay
              </Button>

              {/* Stripe — Global */}
              <Button
                onClick={handleStripe}
                disabled={loading !== null}
                variant="outline"
                className="w-full h-12 rounded-xl font-medium border-gray-200"
              >
                {loading === "stripe" ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <CreditCard className="w-4 h-4 mr-2" />
                )}
                Pay $9/month via Stripe
              </Button>

              <p className="text-xs text-center text-gray-400">
                Cancel anytime. No hidden fees.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-gray-500">
                Already have an API key? Use it for unlimited requests — your key, your quota.
              </p>

              {/* Provider selector */}
              <div className="grid grid-cols-3 gap-2">
                {PROVIDERS.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setByokProvider(p.id)}
                    className={`p-2.5 rounded-xl border text-xs font-medium transition-all text-center ${
                      byokProvider === p.id
                        ? "border-indigo-600 bg-indigo-50 text-indigo-700"
                        : "border-gray-200 text-gray-600 hover:border-gray-300"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              <div className="space-y-1">
                <div className="relative">
                  <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    value={byokKey}
                    onChange={(e) => { setByokKey(e.target.value); setByokError(null); }}
                    placeholder={PROVIDERS.find((p) => p.id === byokProvider)?.keyPlaceholder ?? "API Key"}
                    className="pl-10 rounded-xl border-gray-200"
                    type="password"
                  />
                </div>
                {byokError && (
                  <p className="text-xs text-red-600 ml-1">{byokError}</p>
                )}
              </div>

              <Button
                onClick={handleBYOKSave}
                className="w-full bg-gray-900 hover:bg-gray-800 text-white h-11 rounded-xl"
              >
                Use This Key
              </Button>

              <p className="text-xs text-gray-400">
                Your key is stored locally and never sent to our servers (except to the AI provider on each request).
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
