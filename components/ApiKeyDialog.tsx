"use client";

import { useState } from "react";
import { X, Key, AlertCircle, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

  const providerInfo = PROVIDERS.find((p) => p.id === selectedProvider)!;

  const handleSave = () => {
    if (!apiKey.trim()) return;
    onSave(selectedProvider, apiKey.trim());
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center">
              <Key className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h2 className="font-bold text-gray-900 text-lg">Daily Limit Reached</h2>
              <p className="text-sm text-gray-500">Add your API key to continue</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-lg hover:bg-gray-100"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Limit explanation */}
        <p className="text-sm text-gray-600 bg-gray-50 rounded-xl p-3">
          You&apos;ve used your <strong>2 free requests</strong> for today. Your key is stored locally
          in your browser only — never sent to our servers for storage. Resets at midnight UTC.
        </p>

        {/* Provider selection */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">
            AI Provider
          </label>
          <div className="grid grid-cols-3 gap-2">
            {PROVIDERS.map((provider) => (
              <button
                key={provider.id}
                onClick={() => {
                  setSelectedProvider(provider.id);
                  setApiKey("");
                }}
                className={`p-3 rounded-xl border text-center transition-all text-xs font-medium ${
                  selectedProvider === provider.id
                    ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                    : "border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50"
                }`}
              >
                {provider.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-1">{providerInfo.description}</p>
        </div>

        {/* API Key input */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">
              API Key
            </label>
            <a
              href={KEY_DOCS[selectedProvider]}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800"
            >
              Get key <ExternalLink className="w-3 h-3" />
            </a>
          </div>
          <div className="relative">
            <Input
              type={showKey ? "text" : "password"}
              placeholder={providerInfo.keyPlaceholder}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
              className="pr-16 font-mono text-sm"
              autoFocus
            />
            <button
              type="button"
              onClick={() => setShowKey(!showKey)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-600"
            >
              {showKey ? "Hide" : "Show"}
            </button>
          </div>
        </div>

        {/* Error state */}
        {error && (
          <div className="flex items-start gap-2 p-3 bg-red-50 rounded-xl text-sm text-red-600">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-1">
          <Button
            variant="ghost"
            onClick={onClose}
            className="flex-1 text-gray-500 hover:text-gray-900"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!apiKey.trim()}
            className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            Save & Continue
          </Button>
        </div>
      </div>
    </div>
  );
}
