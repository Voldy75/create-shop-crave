"use client";

/**
 * Admin → Flags, built to w12d (including its failed-save state).
 *
 * A toggle saves immediately. The switch only moves once the server confirms
 * — it is never flipped optimistically — so a failed save leaves it showing
 * the real state, marks the row, and raises a toast with Retry, as drawn.
 * The flags listed are whatever is in feature_flags; the board's example keys
 * are illustrations, not ours.
 */

import { useCallback, useEffect, useState } from "react";
import { Ban, Plus } from "lucide-react";
import { invalidateFlagCache, type FeatureFlag } from "@/lib/feature-flags";
import { AdminError, AdminLoading, AdminTop } from "../admin-shell";

interface Failure {
  id: string;
  wanted: boolean;
  status: number | null;
}

export default function FlagsPage() {
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [failure, setFailure] = useState<Failure | null>(null);

  const [showNew, setShowNew] = useState(false);
  const [newId, setNewId] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/flags")
      .then(async (res) => {
        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error(data?.error);
        setFlags(data.flags ?? []);
      })
      .catch(() => setLoadError("Couldn’t load flags. Check your connection."))
      .finally(() => setLoading(false));
  }, []);

  const toggle = useCallback(async (id: string, enabled: boolean) => {
    setBusy(id);
    setFailure(null);
    try {
      const res = await fetch("/api/admin/flags", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, enabled }),
      });
      if (!res.ok) {
        setFailure({ id, wanted: enabled, status: res.status });
        return;
      }
      const data = await res.json().catch(() => null);
      setFlags((prev) => prev.map((f) => (f.id === id ? { ...f, ...(data?.flag ?? { enabled }) } : f)));
      invalidateFlagCache();
    } catch {
      setFailure({ id, wanted: enabled, status: null });
    } finally {
      setBusy(null);
    }
  }, []);

  const create = async () => {
    const id = newId.trim().toLowerCase().replace(/\s+/g, "_");
    if (!id) return;
    setCreating(true);
    setCreateError(null);
    try {
      const res = await fetch("/api/admin/flags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, enabled: false, description: newDesc.trim() || null }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setCreateError(data?.error ?? "Couldn’t create the flag.");
        return;
      }
      setFlags((prev) => [...prev, data.flag].sort((a, b) => a.id.localeCompare(b.id)));
      setNewId("");
      setNewDesc("");
      setShowNew(false);
      invalidateFlagCache();
    } finally {
      setCreating(false);
    }
  };

  const failedFlag = failure && flags.find((f) => f.id === failure.id);

  return (
    <>
      <AdminTop title="Flags">
        {loading ? <AdminLoading /> : <span className="ad-cap">{flags.length} flags</span>}
        <button type="button" className="ad-btn" onClick={() => setShowNew((v) => !v)} aria-expanded={showNew}>
          <Plus width={14} height={14} aria-hidden />
          New flag
        </button>
      </AdminTop>
      <div className="ad-body">
        {loadError && <AdminError>{loadError}</AdminError>}

        {showNew && (
          <div className="ad-inset">
            <h2 className="ad-h" style={{ fontSize: 12.5 }}>New flag</h2>
            <div style={{ display: "grid", gridTemplateColumns: "minmax(0,220px) minmax(0,1fr)", gap: 10 }}>
              <label className="vstack" style={{ gap: 5 }}>
                <span className="ad-lbl">Key</span>
                <input className="ad-in" value={newId} onChange={(e) => setNewId(e.target.value)} placeholder="snake_case_key" autoFocus />
              </label>
              <label className="vstack" style={{ gap: 5 }}>
                <span className="ad-lbl">What it does</span>
                <input className="ad-in" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="Optional" />
              </label>
            </div>
            <span className="ad-cap">New flags start off. Nothing reads a flag until code checks for its key.</span>
            {createError && <span className="ad-cap" role="alert" style={{ color: "var(--text-red)" }}>{createError}</span>}
            <div className="hstack" style={{ gap: 8 }}>
              <button type="button" className="ad-btn ad-btn-p" onClick={() => void create()} disabled={creating || !newId.trim()}>
                {creating ? "Creating…" : "Create flag"}
              </button>
              <button type="button" className="ad-btn" onClick={() => setShowNew(false)}>
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="ad-card" style={{ overflow: "hidden" }}>
          <div className="ad-scroll">
            <table className="ad-tbl">
              <thead>
                <tr>
                  <th style={{ width: 220 }}>Key</th>
                  <th>What it does</th>
                  <th style={{ width: 110 }}>State</th>
                  <th style={{ width: 190 }}>Last changed</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  [0, 1, 2, 3].map((i) => (
                    <tr key={i}>
                      <td><span className="ad-sk" style={{ width: 130, height: 11 }} /></td>
                      <td><span className="ad-sk" style={{ width: "70%", height: 11 }} /></td>
                      <td><span className="ad-sk" style={{ width: 60, height: 19, borderRadius: 99 }} /></td>
                      <td><span className="ad-sk" style={{ width: 60, height: 11 }} /></td>
                    </tr>
                  ))
                ) : flags.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="ad-cap" style={{ padding: "22px 12px" }}>
                      No flags yet. Run scripts/sql/feature-flags.sql, or add one with New flag.
                    </td>
                  </tr>
                ) : (
                  flags.map((f) => {
                    const failed = failure?.id === f.id;
                    return (
                      <tr key={f.id} className={failed ? "is-fail" : undefined}>
                        <td><span className="ad-mono">{f.id}</span></td>
                        <td>{f.description ?? <span className="ad-cap">—</span>}</td>
                        <td>
                          <button
                            type="button"
                            role="switch"
                            aria-checked={f.enabled}
                            aria-label={f.id}
                            className={`ad-fl${f.enabled ? " is-on" : ""}${failed ? " is-fail" : ""}${busy === f.id ? " is-busy" : ""}`}
                            disabled={busy === f.id}
                            onClick={() => void toggle(f.id, !f.enabled)}
                          >
                            <span className="ad-sw" aria-hidden><i /></span>
                            {busy === f.id ? "Saving…" : f.enabled ? "On" : "Off"}
                          </button>
                        </td>
                        <td>
                          {failed ? (
                            <span className="ad-pill ad-bad">
                              <Ban width={12} height={12} aria-hidden />
                              Save failed · still {f.enabled ? "on" : "off"}
                            </span>
                          ) : (
                            <span className="ad-cap">
                              {f.updated_at ? new Date(f.updated_at).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "—"}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
        <span className="ad-cap">Changes save on toggle. Apps pick them up on their next load.</span>
      </div>

      {failure && failedFlag && (
        <div className="ad-toast" role="alert">
          <Ban width={17} height={17} aria-hidden style={{ flex: "none", marginTop: 1 }} />
          <div className="vstack grow" style={{ gap: 3, minWidth: 0 }}>
            <span style={{ font: "700 13px var(--m-font-body)", overflowWrap: "anywhere" }}>Couldn’t save {failure.id}</span>
            <span className="ad-toast-sub">
              {failure.status ? `Server returned ${failure.status}.` : "The request didn’t reach the server."} The flag was not changed and
              is still {failedFlag.enabled ? "on" : "off"}.
            </span>
          </div>
          <button type="button" className="ad-btn" onClick={() => void toggle(failure.id, failure.wanted)}>
            Retry
          </button>
        </div>
      )}
    </>
  );
}
