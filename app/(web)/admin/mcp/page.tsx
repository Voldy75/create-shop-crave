"use client";

/**
 * Admin → MCP providers, built to w12e.
 *
 * Board → build:
 *   - The board's "Client ID env var" column assumes every provider is given a
 *     client id by hand (SWIGGY_MCP_CLIENT_ID). Swiggy no longer works that
 *     way: the client registers itself (Dynamic Client Registration) and the id
 *     is cached on the provider row. So the column is "Client", and says how
 *     the id is obtained: an env var (Set / Missing), Registered via DCR,
 *     Registers on first connect, or Not needed. Values are never shown.
 *   - A provider with no way to get a client id can't be switched on (the
 *     board greys Zomato's switch for the same reason). Switching OFF is
 *     always allowed.
 *   - "Add provider": NOT built — there is no API to create a provider row;
 *     providers are seeded by scripts/sql/mcp-registry.sql.
 *   - Kept from the old screen (not drawn): the endpoint/scopes editor and
 *     the per-provider server list, under "Edit" on each row.
 */

import { useCallback, useEffect, useState } from "react";
import { ChevronDown, ChevronUp, Plug, Plus, Trash2 } from "lucide-react";
import { AdminError, AdminLoading, AdminTop } from "../admin-shell";

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
  registrationPath: string | null;
  clientId: string | null;
  clientIdIssuedAt: string | null;
  notes: string | null;
  servers: McpServerRow[];
  clientIdPresent: boolean;
  connectionCount: number;
}

type ClientState = { cls: string; label: string; usable: boolean };

function clientState(p: McpProviderRow): ClientState {
  if (p.authType === "none") return { cls: "ad-mute", label: "Not needed", usable: true };
  if (p.clientIdEnv && p.clientIdPresent) return { cls: "ad-ok", label: "Set", usable: true };
  if (p.clientId) return { cls: "ad-ok", label: "Registered (DCR)", usable: true };
  if (p.registrationPath) return { cls: "ad-mute", label: "Registers on first connect", usable: true };
  return { cls: "ad-bad", label: "Missing", usable: false };
}

export default function McpAdminPage() {
  const [providers, setProviders] = useState<McpProviderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  const load = useCallback(async (initial = false) => {
    if (initial) setLoading(true);
    try {
      const res = await fetch("/api/admin/mcp");
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? "Couldn’t load MCP providers.");
        return;
      }
      setProviders(data.providers ?? []);
    } catch {
      setError("Couldn’t load MCP providers. Check your connection.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
     
    void load(true);
  }, [load]);

  const patchProvider = async (id: string, patch: Record<string, unknown>) => {
    const res = await fetch("/api/admin/mcp", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...patch }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      setError(data?.error ?? "Couldn’t save the provider.");
      return false;
    }
    return true;
  };

  const toggle = async (p: McpProviderRow) => {
    setToggling(p.id);
    setError(null);
    if (await patchProvider(p.id, { enabled: !p.enabled })) {
      setProviders((prev) => prev.map((row) => (row.id === p.id ? { ...row, enabled: !p.enabled } : row)));
    }
    setToggling(null);
  };

  const blocked = providers.filter((p) => !clientState(p).usable);

  return (
    <>
      <AdminTop title="MCP providers">{loading ? <AdminLoading /> : <span className="ad-cap">{providers.length} providers</span>}</AdminTop>
      <div className="ad-body">
        {error && <AdminError>{error}</AdminError>}

        <div className="ad-card" style={{ overflow: "hidden" }}>
          <div className="ad-scroll">
            <table className="ad-tbl">
              <thead>
                <tr>
                  <th style={{ width: 170 }}>Provider</th>
                  <th>Server endpoints</th>
                  <th>Client</th>
                  <th style={{ width: 96 }}>Enabled</th>
                  <th style={{ width: 80 }} aria-label="Edit" />
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  [0, 1, 2].map((i) => (
                    <tr key={i}>
                      <td><span className="ad-sk" style={{ width: 100, height: 11 }} /></td>
                      <td><span className="ad-sk" style={{ width: "70%", height: 11 }} /></td>
                      <td><span className="ad-sk" style={{ width: 120, height: 11 }} /></td>
                      <td><span className="ad-sk" style={{ width: 50, height: 19, borderRadius: 99 }} /></td>
                      <td />
                    </tr>
                  ))
                ) : providers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="ad-cap" style={{ padding: "22px 12px" }}>
                      No providers. Run scripts/sql/mcp-registry.sql.
                    </td>
                  </tr>
                ) : (
                  providers.flatMap((p) => {
                    const c = clientState(p);
                    const isOpen = open === p.id;
                    const rows = [
                      <tr key={p.id} className={isOpen ? "is-sel" : undefined}>
                        <td>
                          <div className="vstack" style={{ gap: 1 }}>
                            <span style={{ fontWeight: 700 }}>{p.name}</span>
                            <span className="ad-cap">
                              {p.connectionCount} connection{p.connectionCount === 1 ? "" : "s"}
                            </span>
                          </div>
                        </td>
                        <td>
                          {p.servers.length === 0 ? (
                            <span className="ad-cap">No servers</span>
                          ) : (
                            <div className="vstack" style={{ gap: 2 }}>
                              {p.servers.map((s) => (
                                <span key={s.serviceKey} className="ad-mono" style={{ opacity: s.enabled ? 1 : 0.6 }}>
                                  {s.url}
                                  {!s.enabled && " (off)"}
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                        <td>
                          <div className="hstack" style={{ gap: 8, flexWrap: "wrap" }}>
                            {p.clientIdEnv && <span className="ad-mono">{p.clientIdEnv}</span>}
                            <span className={`ad-pill ${c.cls}`}>{c.label}</span>
                          </div>
                        </td>
                        <td>
                          <button
                            type="button"
                            role="switch"
                            aria-checked={p.enabled}
                            aria-label={`${p.name} enabled`}
                            className={`ad-fl${p.enabled ? " is-on" : ""}${toggling === p.id ? " is-busy" : ""}`}
                            disabled={toggling === p.id || (!p.enabled && !c.usable)}
                            onClick={() => void toggle(p)}
                          >
                            <span className="ad-sw" aria-hidden><i /></span>
                            {p.enabled ? "On" : "Off"}
                          </button>
                        </td>
                        <td>
                          <button type="button" className="ad-btn" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : p.id)}>
                            Edit
                            {isOpen ? <ChevronUp width={14} height={14} aria-hidden /> : <ChevronDown width={14} height={14} aria-hidden />}
                          </button>
                        </td>
                      </tr>,
                    ];
                    if (isOpen)
                      rows.push(
                        <tr key={`${p.id}-edit`}>
                          <td colSpan={5} style={{ background: "var(--m-cream)" }}>
                            <ProviderEditor
                              provider={p}
                              patchProvider={patchProvider}
                              onChanged={() => void load()}
                              setError={setError}
                            />
                          </td>
                        </tr>
                      );
                    return rows;
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {blocked.map((p) => (
          <div key={p.id} className="ad-notice is-warn">
            <Plug width={16} height={16} aria-hidden style={{ flex: "none", marginTop: 1 }} />
            <span>
              {p.name} can’t be enabled until{" "}
              {p.clientIdEnv ? (
                <>
                  <span className="ad-mono">{p.clientIdEnv}</span> is set in the server environment
                </>
              ) : (
                "it has a client id env var or a registration path"
              )}
              . Values are never shown here.
            </span>
          </div>
        ))}

        <span className="ad-cap">
          Enabling a provider makes the app offer it. It can’t make the provider accept us — that depends on the provider granting access.
        </span>
      </div>
    </>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="vstack" style={{ gap: 5 }}>
      <span className="ad-lbl">{label}</span>
      <input className="ad-in" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </label>
  );
}

function ProviderEditor({
  provider,
  patchProvider,
  onChanged,
  setError,
}: {
  provider: McpProviderRow;
  patchProvider: (id: string, patch: Record<string, unknown>) => Promise<boolean>;
  onChanged: () => void;
  setError: (e: string | null) => void;
}) {
  const [draft, setDraft] = useState({
    authorizeBase: provider.authorizeBase ?? "",
    authorizePath: provider.authorizePath ?? "",
    tokenPath: provider.tokenPath ?? "",
    revokePath: provider.revokePath ?? "",
    scopes: provider.scopes ?? "",
    clientIdEnv: provider.clientIdEnv ?? "",
    notes: provider.notes ?? "",
  });
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof draft) => (v: string) => setDraft((d) => ({ ...d, [k]: v }));
  const orNull = (v: string) => (v.trim() === "" ? null : v.trim());

  const save = async () => {
    setSaving(true);
    setError(null);
    const ok = await patchProvider(provider.id, {
      authorize_base: orNull(draft.authorizeBase),
      authorize_path: draft.authorizePath.trim(),
      token_path: draft.tokenPath.trim(),
      revoke_path: orNull(draft.revokePath),
      scopes: orNull(draft.scopes),
      client_id_env: orNull(draft.clientIdEnv),
      notes: orNull(draft.notes),
    });
    if (ok) onChanged();
    setSaving(false);
  };

  return (
    <div className="vstack" style={{ gap: 12, padding: "6px 2px" }}>
      <div className="hstack" style={{ gap: 8, flexWrap: "wrap" }}>
        <span className="ad-mono" style={{ color: "var(--m-ink-soft)" }}>{provider.id}</span>
        <span className="ad-pill ad-mute">{provider.authType}</span>
        {provider.clientIdIssuedAt && (
          <span className="ad-cap">Client registered {new Date(provider.clientIdIssuedAt).toLocaleDateString()}</span>
        )}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10 }}>
        <Field label="Authorize base" value={draft.authorizeBase} onChange={set("authorizeBase")} />
        <Field label="Authorize path" value={draft.authorizePath} onChange={set("authorizePath")} />
        <Field label="Token path" value={draft.tokenPath} onChange={set("tokenPath")} />
        <Field label="Revoke path" value={draft.revokePath} onChange={set("revokePath")} />
        <Field label="Scopes" value={draft.scopes} onChange={set("scopes")} />
        <Field label="Client ID env var" value={draft.clientIdEnv} onChange={set("clientIdEnv")} placeholder="Empty when the provider uses DCR" />
      </div>
      <label className="vstack" style={{ gap: 5 }}>
        <span className="ad-lbl">Notes</span>
        <textarea className="ad-in" rows={2} value={draft.notes} onChange={(e) => set("notes")(e.target.value)} />
      </label>
      <div className="hstack" style={{ gap: 8 }}>
        <button type="button" className="ad-btn ad-btn-p" onClick={() => void save()} disabled={saving}>
          {saving ? "Saving…" : "Save provider"}
        </button>
      </div>

      <div className="vstack" style={{ gap: 8, paddingTop: 10, borderTop: "1px solid var(--m-ink-faint)" }}>
        <h3 className="ad-h" style={{ fontSize: 12.5 }}>Servers</h3>
        <ServerList providerId={provider.id} servers={provider.servers} onChanged={onChanged} setError={setError} />
      </div>
    </div>
  );
}

interface ServerDraft {
  serviceKey: string;
  label: string;
  url: string;
  toolAllowlist: string;
  enabled: boolean;
}

const toDraft = (s: McpServerRow): ServerDraft => ({
  serviceKey: s.serviceKey,
  label: s.label ?? "",
  url: s.url,
  toolAllowlist: (s.toolAllowlist ?? []).join(", "),
  enabled: s.enabled,
});

const EMPTY_DRAFT: ServerDraft = { serviceKey: "", label: "", url: "", toolAllowlist: "", enabled: true };

const parseAllowlist = (raw: string): string[] | null => {
  const t = raw.trim();
  return t ? t.split(",").map((x) => x.trim()).filter(Boolean) : null;
};

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
  const [drafts, setDrafts] = useState<Record<string, ServerDraft>>(() => Object.fromEntries(servers.map((s) => [s.serviceKey, toDraft(s)])));
  const [newDraft, setNewDraft] = useState<ServerDraft>(EMPTY_DRAFT);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  useEffect(() => {
     
    setDrafts(Object.fromEntries(servers.map((s) => [s.serviceKey, toDraft(s)])));
  }, [servers]);

  const save = async (draft: ServerDraft, isNew: boolean) => {
    setBusyKey(isNew ? "__new__" : draft.serviceKey);
    setError(null);
    try {
      const res = await fetch("/api/admin/mcp/servers", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider_id: providerId,
          service_key: draft.serviceKey.trim(),
          label: draft.label.trim() || null,
          url: draft.url.trim(),
          tool_allowlist: parseAllowlist(draft.toolAllowlist),
          enabled: draft.enabled,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? "Couldn’t save the server.");
        return;
      }
      if (isNew) setNewDraft(EMPTY_DRAFT);
      onChanged();
    } finally {
      setBusyKey(null);
    }
  };

  const remove = async (key: string) => {
    if (!window.confirm(`Remove the ${key} server? Connected users lose its tools.`)) return;
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
        setError(data?.error ?? "Couldn’t remove the server.");
        return;
      }
      onChanged();
    } finally {
      setBusyKey(null);
    }
  };

  const edit = (key: string, patch: Partial<ServerDraft>) => setDrafts((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));

  return (
    <div className="vstack" style={{ gap: 8 }}>
      {servers.map((s) => {
        const d = drafts[s.serviceKey] ?? toDraft(s);
        return (
          <div key={s.serviceKey} className="ad-inset">
            <div className="hstack" style={{ gap: 8 }}>
              <span className="ad-mono grow" style={{ fontWeight: 700 }}>{s.serviceKey}</span>
              <button
                type="button"
                role="switch"
                aria-checked={d.enabled}
                aria-label={`${s.serviceKey} enabled`}
                className={`ad-fl${d.enabled ? " is-on" : ""}`}
                onClick={() => edit(s.serviceKey, { enabled: !d.enabled })}
              >
                <span className="ad-sw" aria-hidden><i /></span>
                {d.enabled ? "On" : "Off"}
              </button>
              <button
                type="button"
                className="ad-btn ad-btn-d"
                style={{ width: 30, padding: 0, justifyContent: "center" }}
                onClick={() => void remove(s.serviceKey)}
                disabled={busyKey === s.serviceKey}
                aria-label={`Remove ${s.serviceKey}`}
              >
                <Trash2 width={14} height={14} aria-hidden />
              </button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10 }}>
              <Field label="Label" value={d.label} onChange={(v) => edit(s.serviceKey, { label: v })} />
              <Field label="URL" value={d.url} onChange={(v) => edit(s.serviceKey, { url: v })} />
            </div>
            <Field label="Tool allowlist (comma-separated, empty = all)" value={d.toolAllowlist} onChange={(v) => edit(s.serviceKey, { toolAllowlist: v })} />
            <div>
              <button type="button" className="ad-btn" onClick={() => void save(d, false)} disabled={busyKey === s.serviceKey}>
                {busyKey === s.serviceKey ? "Saving…" : "Save server"}
              </button>
            </div>
          </div>
        );
      })}

      <div className="ad-inset" style={{ boxShadow: "inset 0 0 0 1px var(--m-ink-faint)", background: "var(--m-card)" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10 }}>
          <Field label="Service key" value={newDraft.serviceKey} onChange={(v) => setNewDraft({ ...newDraft, serviceKey: v })} placeholder="food" />
          <Field label="Label" value={newDraft.label} onChange={(v) => setNewDraft({ ...newDraft, label: v })} placeholder="Optional" />
          <Field label="URL" value={newDraft.url} onChange={(v) => setNewDraft({ ...newDraft, url: v })} placeholder="https://…" />
        </div>
        <Field label="Tool allowlist (comma-separated, empty = all)" value={newDraft.toolAllowlist} onChange={(v) => setNewDraft({ ...newDraft, toolAllowlist: v })} />
        <div>
          <button
            type="button"
            className="ad-btn"
            onClick={() => void save(newDraft, true)}
            disabled={busyKey === "__new__" || !newDraft.serviceKey.trim() || !newDraft.url.trim()}
          >
            <Plus width={14} height={14} aria-hidden />
            {busyKey === "__new__" ? "Adding…" : "Add server"}
          </button>
        </div>
      </div>
    </div>
  );
}
