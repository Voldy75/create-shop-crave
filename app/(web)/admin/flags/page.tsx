"use client";

import { useState, useEffect } from "react";
import { Flag, Plus, Loader2 } from "lucide-react";
import { invalidateFlagCache, type FeatureFlag } from "@/lib/feature-flags";

export default function FlagsPage() {
  return (
    <main className="max-w-5xl mx-auto p-6 space-y-8">
      <FeatureFlagsPanel />
    </main>
  );
}

function FeatureFlagsPanel() {
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [newId, setNewId] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [creating, setCreating] = useState(false);

  const fetchFlags = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/flags");
      const data = await res.json();
      setFlags(data.flags ?? []);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchFlags(); }, []);

  const handleToggle = async (id: string, enabled: boolean) => {
    setToggling(id);
    try {
      const res = await fetch("/api/admin/flags", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, enabled }),
      });
      if (res.ok) {
        setFlags((prev) => prev.map((f) => (f.id === id ? { ...f, enabled } : f)));
        invalidateFlagCache();
      }
    } finally { setToggling(null); }
  };

  const handleCreate = async () => {
    const trimmed = newId.trim().toLowerCase().replace(/\s+/g, "_");
    if (!trimmed) return;
    setCreating(true);
    try {
      const res = await fetch("/api/admin/flags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: trimmed, enabled: false, description: newDesc || null }),
      });
      if (res.ok) {
        const data = await res.json();
        setFlags((prev) => [...prev, data.flag]);
        setNewId("");
        setNewDesc("");
        setShowNew(false);
        invalidateFlagCache();
      }
    } finally { setCreating(false); }
  };

  return (
    <div className="p-6 rounded-2xl" style={{ background: "var(--m-card)", border: "1px solid var(--m-ink-faint)" }}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-bold flex items-center gap-2" style={{ color: "var(--m-ink)" }}>
          <Flag className="w-4 h-4" style={{ color: "var(--m-forest)" }} />
          Feature Flags
        </h2>
        <button
          onClick={() => setShowNew(!showNew)}
          className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-full transition-colors"
          style={{ background: "var(--m-cream-2)", color: "var(--m-ink-soft)", border: "1px solid var(--m-ink-faint)" }}
        >
          <Plus className="w-3 h-3" />
          New flag
        </button>
      </div>

      {showNew && (
        <div className="mb-4 p-4 rounded-xl space-y-3" style={{ background: "var(--m-cream-2)", border: "1px solid var(--m-ink-faint)" }}>
          <input
            value={newId}
            onChange={(e) => setNewId(e.target.value)}
            placeholder="flag_id (e.g. mcp_doordash)"
            className="w-full px-3 py-2 text-sm rounded-lg"
            style={{ background: "var(--m-card)", border: "1px solid var(--m-ink-faint)", color: "var(--m-ink)" }}
          />
          <input
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
            placeholder="Description (optional)"
            className="w-full px-3 py-2 text-sm rounded-lg"
            style={{ background: "var(--m-card)", border: "1px solid var(--m-ink-faint)", color: "var(--m-ink)" }}
          />
          <div className="flex gap-2">
            <button
              onClick={handleCreate}
              disabled={creating || !newId.trim()}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-full disabled:opacity-50"
              style={{ background: "var(--m-forest)", color: "var(--m-on-deep)" }}
            >
              {creating && <Loader2 className="w-3 h-3 animate-spin" />}
              Create
            </button>
            <button
              onClick={() => { setShowNew(false); setNewId(""); setNewDesc(""); }}
              className="px-4 py-2 text-xs rounded-full"
              style={{ color: "var(--m-ink-soft)" }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin" style={{ color: "var(--m-ink-soft)" }} />
        </div>
      ) : flags.length === 0 ? (
        <p className="text-sm py-4" style={{ color: "var(--m-ink-soft)" }}>
          No feature flags found. Run the migration SQL first.
        </p>
      ) : (
        <div className="space-y-2">
          {flags.map((f) => (
            <div
              key={f.id}
              className="flex items-center justify-between p-3 rounded-xl"
              style={{ background: "var(--m-cream-2)", border: "1px solid var(--m-ink-faint)" }}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <code className="text-sm font-semibold" style={{ color: "var(--m-ink)" }}>{f.id}</code>
                  <span
                    style={{
                      fontSize: "10px",
                      fontWeight: 700,
                      color: f.enabled ? "var(--m-forest)" : "var(--m-ink-soft)",
                      background: f.enabled ? "var(--m-tint-green)" : "var(--m-card)",
                      padding: "1px 6px",
                      borderRadius: "980px",
                      textTransform: "uppercase",
                    }}
                  >
                    {f.enabled ? "ON" : "OFF"}
                  </span>
                </div>
                {f.description && (
                  <p className="text-xs mt-0.5 truncate" style={{ color: "var(--m-ink-soft)" }}>
                    {f.description}
                  </p>
                )}
              </div>
              <button
                onClick={() => handleToggle(f.id, !f.enabled)}
                disabled={toggling === f.id}
                aria-label={`Toggle ${f.id}`}
                className="ml-3 shrink-0 relative w-10 h-6 rounded-full transition-colors"
                style={{ background: f.enabled ? "var(--m-forest)" : "var(--m-card)" }}
              >
                {toggling === f.id ? (
                  <Loader2 className="w-3.5 h-3.5 absolute animate-spin" style={{ top: "5px", left: f.enabled ? "19px" : "3px", color: f.enabled ? "var(--m-on-deep)" : "var(--m-ink-soft)" }} />
                ) : (
                  <span
                    className="absolute top-0.5 rounded-full w-5 h-5 bg-white shadow-sm transition-transform"
                    style={{ left: f.enabled ? "18px" : "2px" }}
                  />
                )}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
