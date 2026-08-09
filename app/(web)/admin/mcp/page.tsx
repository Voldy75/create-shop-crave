"use client";

import { useEffect, useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { CCButton } from "@/components/cc/button";
import { CCCard } from "@/components/cc/card";
import { StatusPill } from "@/components/cc/status-pill";

interface McpServerRow {
  providerId: string;
  serviceKey: string;
  label: string | null;
  url: string;
  toolAllowlist: string[] | null;
  enabled: boolean;
}

interface McpProviderRow {
  id: string;
  name: string;
  enabled: boolean;
  authType: "oauth_pkce" | "api_key" | "none";
  authorizeBase: string | null;
  authorizePath: string;
  tokenPath: string;
  revokePath: string | null;
  scopes: string | null;
  clientIdEnv: string | null;
  icon: string | null;
  notes: string | null;
  servers: McpServerRow[];
  clientIdPresent: boolean;
  connectionCount: number;
}

const inputStyle = {
  background: "var(--m-cream-2)",
  border: "1px solid var(--m-ink-faint)",
  color: "var(--m-ink)",
} as const;

const labelStyle = { color: "var(--m-ink-soft)" } as const;

function TextField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs" style={labelStyle}>
      {label}
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="px-3 py-2 text-sm rounded-lg"
        style={inputStyle}
      />
    </label>
  );
}

function Toggle({
  checked,
  onChange,
  busy,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  busy?: boolean;
  label: string;
}) {
  return (
    <button
      onClick={() => onChange(!checked)}
      disabled={busy}
      aria-label={label}
      type="button"
      className="shrink-0 relative w-10 h-6 rounded-full transition-colors"
      style={{ background: checked ? "#34c759" : "var(--m-cream-2)" }}
    >
      {busy ? (
        <Loader2
          className="w-3.5 h-3.5 absolute animate-spin"
          style={{ top: "5px", left: checked ? "19px" : "3px", color: checked ? "#fff" : "var(--m-ink-soft)" }}
        />
      ) : (
        <span
          className="absolute top-0.5 rounded-full w-5 h-5 bg-white shadow-sm transition-transform"
          style={{ left: checked ? "18px" : "2px" }}
        />
      )}
    </button>
  );
}

export default function McpAdminPage() {
  const [providers, setProviders] = useState<McpProviderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/mcp");
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? "Failed to load MCP providers");
        return;
      }
      setProviders(data.providers ?? []);
    } catch {
      setError("Failed to load MCP providers. Check your connection.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const patchProvider = async (id: string, patch: Record<string, unknown>) => {
    const res = await fetch("/api/admin/mcp", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...patch }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      setError(data?.error ?? "Failed to save provider");
      return false;
    }
    return true;
  };

  const handleToggleEnabled = async (p: McpProviderRow) => {
    setTogglingId(p.id);
    const ok = await patchProvider(p.id, { enabled: !p.enabled });
    if (ok) {
      setProviders((prev) => prev.map((row) => (row.id === p.id ? { ...row, enabled: !p.enabled } : row)));
    }
    setTogglingId(null);
  };

  const handleSaveFields = async (p: McpProviderRow) => {
    setSavingId(p.id);
    setError(null);
    const ok = await patchProvider(p.id, {
      authorize_base: p.authorizeBase,
      authorize_path: p.authorizePath,
      token_path: p.tokenPath,
      revoke_path: p.revokePath,
      scopes: p.scopes,
      client_id_env: p.clientIdEnv,
      notes: p.notes,
    });
    if (ok) await load();
    setSavingId(null);
  };

  const updateField = (id: string, field: keyof McpProviderRow, value: string) => {
    setProviders((prev) =>
      prev.map((row) => (row.id === id ? { ...row, [field]: value === "" ? null : value } : row))
    );
  };

  if (loading) {
    return (
      <main className="max-w-3xl mx-auto p-6">
        <div className="flex justify-center py-12">
          <Loader2 className="w-5 h-5 animate-spin" style={{ color: "var(--m-ink-soft)" }} />
        </div>
      </main>
    );
  }

  return (
    <main className="max-w-3xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="font-bold text-lg" style={{ color: "var(--m-ink)", letterSpacing: "-0.02em" }}>
          MCP Providers
        </h1>
      </div>

      <div
        className="rounded-xl p-4 text-sm leading-relaxed"
        style={{ background: "rgba(255,159,10,0.08)", color: "#ff9f0a", border: "1px solid rgba(255,159,10,0.15)" }}
      >
        Enabling a provider here makes the app offer it. It cannot make the provider accept us — Swiggy&apos;s MCP
        OAuth is gated to an allowlist of AI clients, and Instacart/Uber/Zomato have no known public MCP endpoint.
        These are placeholders until access is confirmed.
      </div>

      {error && (
        <div
          className="rounded-xl p-4 text-sm"
          style={{ background: "rgba(255,69,58,0.08)", color: "#ff453a", border: "1px solid rgba(255,69,58,0.15)" }}
        >
          {error}
        </div>
      )}

      {providers.map((p) => (
        <ProviderCard
          key={p.id}
          provider={p}
          saving={savingId === p.id}
          toggling={togglingId === p.id}
          onToggleEnabled={() => handleToggleEnabled(p)}
          onFieldChange={(field, value) => updateField(p.id, field, value)}
          onSave={() => handleSaveFields(p)}
          onServersChanged={load}
          setError={setError}
        />
      ))}
    </main>
  );
}

function ProviderCard({
  provider: p,
  saving,
  toggling,
  onToggleEnabled,
  onFieldChange,
  onSave,
  onServersChanged,
  setError,
}: {
  provider: McpProviderRow;
  saving: boolean;
  toggling: boolean;
  onToggleEnabled: () => void;
  onFieldChange: (field: keyof McpProviderRow, value: string) => void;
  onSave: () => void;
  onServersChanged: () => void;
  setError: (e: string | null) => void;
}) {
  return (
    <CCCard className="p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-bold" style={{ color: "var(--m-ink)" }}>{p.name}</h2>
            <code className="text-xs" style={labelStyle}>{p.id}</code>
          </div>
          <p className="text-xs mt-0.5" style={labelStyle}>
            {p.authType} · {p.connectionCount} connection{p.connectionCount === 1 ? "" : "s"}
          </p>
        </div>
        <Toggle checked={p.enabled} onChange={onToggleEnabled} busy={toggling} label={`Toggle ${p.id}`} />
      </div>

      {/* Client-id health */}
      <div
        className="flex items-center justify-between p-3 rounded-xl"
        style={{ background: "var(--m-cream-2)", border: "1px solid var(--m-ink-faint)" }}
      >
        <div>
          <p className="text-sm" style={{ color: "var(--m-ink)" }}>Client ID</p>
          <code className="text-xs" style={labelStyle}>{p.clientIdEnv ?? "(no env var configured)"}</code>
        </div>
        <StatusPill tone={p.clientIdPresent ? "active" : "error"}>
          {p.clientIdPresent ? "Present" : "Missing"}
        </StatusPill>
      </div>
      {!p.clientIdPresent && p.clientIdEnv && (
        <p className="text-xs -mt-2" style={labelStyle}>
          Set <code>{p.clientIdEnv}</code> in the Vercel dashboard (Project → Settings → Environment Variables).
        </p>
      )}

      {p.notes && (
        <p className="text-xs italic" style={labelStyle}>{p.notes}</p>
      )}

      {/* Editable endpoint fields */}
      <div className="grid grid-cols-2 gap-3">
        <TextField label="Authorize base" value={p.authorizeBase ?? ""} onChange={(v) => onFieldChange("authorizeBase", v)} />
        <TextField label="Authorize path" value={p.authorizePath ?? ""} onChange={(v) => onFieldChange("authorizePath", v)} />
        <TextField label="Token path" value={p.tokenPath ?? ""} onChange={(v) => onFieldChange("tokenPath", v)} />
        <TextField label="Revoke path" value={p.revokePath ?? ""} onChange={(v) => onFieldChange("revokePath", v)} />
        <TextField label="Scopes" value={p.scopes ?? ""} onChange={(v) => onFieldChange("scopes", v)} />
        <TextField label="Client ID env var" value={p.clientIdEnv ?? ""} onChange={(v) => onFieldChange("clientIdEnv", v)} placeholder="MCP_FOO_CLIENT_ID" />
      </div>
      <label className="flex flex-col gap-1 text-xs" style={labelStyle}>
        Notes
        <textarea
          value={p.notes ?? ""}
          onChange={(e) => onFieldChange("notes", e.target.value)}
          rows={2}
          className="px-3 py-2 text-sm rounded-lg"
          style={inputStyle}
        />
      </label>

      <CCButton size="sm" variant="secondary" onClick={onSave} disabled={saving}>
        {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
        Save
      </CCButton>

      {/* Servers */}
      <div className="pt-2 border-t" style={{ borderColor: "var(--m-ink-faint)" }}>
        <h3 className="text-sm font-semibold mb-2" style={{ color: "var(--m-ink)" }}>Servers</h3>
        <ServerList providerId={p.id} servers={p.servers} onChanged={onServersChanged} setError={setError} />
      </div>
    </CCCard>
  );
}

interface ServerDraft {
  serviceKey: string;
  label: string;
  url: string;
  toolAllowlist: string;
  enabled: boolean;
}

function toDraft(s: McpServerRow): ServerDraft {
  return {
    serviceKey: s.serviceKey,
    label: s.label ?? "",
    url: s.url,
    toolAllowlist: (s.toolAllowlist ?? []).join(", "),
    enabled: s.enabled,
  };
}

const EMPTY_DRAFT: ServerDraft = { serviceKey: "", label: "", url: "", toolAllowlist: "", enabled: true };

function ServerList({
  providerId,
  servers,
  onChanged,
  setError,
}: {
  providerId: string;
  servers: McpServerRow[];
  onChanged: () => void;
  setError: (e: string | null) => void;
}) {
  const [drafts, setDrafts] = useState<Record<string, ServerDraft>>(() =>
    Object.fromEntries(servers.map((s) => [s.serviceKey, toDraft(s)]))
  );
  const [newDraft, setNewDraft] = useState<ServerDraft>(EMPTY_DRAFT);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  useEffect(() => {
    setDrafts(Object.fromEntries(servers.map((s) => [s.serviceKey, toDraft(s)])));
  }, [servers]);

  const parseAllowlist = (raw: string): string[] | null => {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    return trimmed.split(",").map((t) => t.trim()).filter(Boolean);
  };

  const save = async (key: string, draft: ServerDraft, isNew: boolean) => {
    setBusyKey(key || "__new__");
    setError(null);
    try {
      const res = await fetch("/api/admin/mcp/servers", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider_id: providerId,
          service_key: draft.serviceKey,
          label: draft.label || null,
          url: draft.url,
          tool_allowlist: parseAllowlist(draft.toolAllowlist),
          enabled: draft.enabled,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? "Failed to save server");
        return;
      }
      if (isNew) setNewDraft(EMPTY_DRAFT);
      onChanged();
    } finally {
      setBusyKey(null);
    }
  };

  const remove = async (key: string) => {
    setBusyKey(key);
    setError(null);
    try {
      const res = await fetch("/api/admin/mcp/servers", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider_id: providerId, service_key: key }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? "Failed to delete server");
        return;
      }
      onChanged();
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <div className="space-y-2">
      {servers.map((s) => {
        const draft = drafts[s.serviceKey] ?? toDraft(s);
        return (
          <div
            key={s.serviceKey}
            className="p-3 rounded-xl space-y-2"
            style={{ background: "var(--m-cream-2)", border: "1px solid var(--m-ink-faint)" }}
          >
            <div className="flex items-center justify-between">
              <code className="text-xs font-semibold" style={{ color: "var(--m-ink)" }}>{s.serviceKey}</code>
              <div className="flex items-center gap-2">
                <Toggle
                  checked={draft.enabled}
                  onChange={(v) => setDrafts((prev) => ({ ...prev, [s.serviceKey]: { ...draft, enabled: v } }))}
                  label={`Toggle ${s.serviceKey}`}
                />
                <button
                  onClick={() => remove(s.serviceKey)}
                  disabled={busyKey === s.serviceKey}
                  aria-label={`Delete ${s.serviceKey}`}
                  className="p-1.5 rounded-lg transition-colors hover:bg-[rgba(255,69,58,0.1)] hover:text-[#ff453a]"
                  style={{ color: "var(--m-ink-soft)" }}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <TextField label="Label" value={draft.label} onChange={(v) => setDrafts((prev) => ({ ...prev, [s.serviceKey]: { ...draft, label: v } }))} />
              <TextField label="URL" value={draft.url} onChange={(v) => setDrafts((prev) => ({ ...prev, [s.serviceKey]: { ...draft, url: v } }))} />
            </div>
            <TextField
              label="Tool allowlist (comma-separated, empty = all tools)"
              value={draft.toolAllowlist}
              onChange={(v) => setDrafts((prev) => ({ ...prev, [s.serviceKey]: { ...draft, toolAllowlist: v } }))}
            />
            <CCButton size="sm" variant="secondary" onClick={() => save(s.serviceKey, draft, false)} disabled={busyKey === s.serviceKey}>
              {busyKey === s.serviceKey && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Save
            </CCButton>
          </div>
        );
      })}

      {/* New server row */}
      <div
        className="p-3 rounded-xl space-y-2"
        style={{ background: "var(--m-card)", border: "1px dashed var(--m-ink-faint)" }}
      >
        <div className="grid grid-cols-2 gap-2">
          <TextField label="Service key" value={newDraft.serviceKey} onChange={(v) => setNewDraft({ ...newDraft, serviceKey: v })} placeholder="food" />
          <TextField label="Label" value={newDraft.label} onChange={(v) => setNewDraft({ ...newDraft, label: v })} placeholder="Optional" />
        </div>
        <TextField label="URL" value={newDraft.url} onChange={(v) => setNewDraft({ ...newDraft, url: v })} placeholder="https://mcp.example.com/food" />
        <TextField
          label="Tool allowlist (comma-separated, empty = all tools)"
          value={newDraft.toolAllowlist}
          onChange={(v) => setNewDraft({ ...newDraft, toolAllowlist: v })}
        />
        <CCButton
          size="sm"
          onClick={() => save(newDraft.serviceKey, newDraft, true)}
          disabled={busyKey === "__new__" || !newDraft.serviceKey.trim() || !newDraft.url.trim()}
        >
          {busyKey === "__new__" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
          Add server
        </CCButton>
      </div>
    </div>
  );
}
