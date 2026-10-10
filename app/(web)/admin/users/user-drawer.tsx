"use client";

/**
 * User detail drawer, built to w12b's right-hand panel.
 *
 * Board → build:
 *   - Details grid, Access card (Restrict / Unrestrict), "Admin actions" log:
 *     built. The log is real — admin_audit_log rows for this user, via
 *     GET /api/admin/users/[id].
 *   - "Admin note" textarea: NOT built. There is no column for a free-text
 *     note; restricting or banning requires a reason (status_reason), which is
 *     shown in the Access card and recorded in the audit log.
 *   - Kept from the old drawer (the board doesn't draw them, but they are the
 *     only place these can be changed): Plan, Role, and Ban.
 */

import { useCallback, useEffect, useState } from "react";
import { Ban, X } from "lucide-react";
import { PLATFORM_LABEL, STATUS_PILL, relDay, shortDate, userInitials } from "./format";
import type { AdminPlan, AdminUserRow, UserRole, UserStatus } from "./types";

interface AuditAction {
  id: string;
  action: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  created_at: string;
  actor: string | null;
}

interface UserDrawerProps {
  user: AdminUserRow;
  plans: AdminPlan[];
  onClose: () => void;
  onUpdated: (user: AdminUserRow) => void;
}

const describe = (a: AuditAction) => {
  const after = a.after ?? {};
  switch (a.action) {
    case "user.status_change":
      return `status → ${String(after.status ?? "?")}${after.status_reason ? ` (“${String(after.status_reason)}”)` : ""}`;
    case "user.role_change":
      return `role → ${String(after.role ?? "?")}`;
    case "user.plan_change":
      return `plan → ${String(after.plan_id ?? "none")}`;
    default:
      return a.action;
  }
};

export function UserDrawer({ user, plans, onClose, onUpdated }: UserDrawerProps) {
  const [current, setCurrent] = useState(user);
  const [role, setRole] = useState<UserRole>(user.role);
  const [planId, setPlanId] = useState<string | null>(user.plan_id);
  const [pendingStatus, setPendingStatus] = useState<UserStatus | null>(null);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState<"role" | "plan" | "status" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [signIn, setSignIn] = useState<string | null>(null);
  const [actions, setActions] = useState<AuditAction[] | null>(null);

  const loadDetail = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/admin/users/${id}`);
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setActions([]);
        return;
      }
      setSignIn(data.signInProvider ?? null);
      setActions(data.actions ?? []);
    } catch {
      setActions([]);
    }
  }, []);

  useEffect(() => {
     
    setCurrent(user);
    setRole(user.role);
    setPlanId(user.plan_id);
    setPendingStatus(null);
    setReason("");
    setError(null);
    setSignIn(null);
    setActions(null);
     
    void loadDetail(user.user_id);
  }, [user, loadDetail]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function patchUser(body: Record<string, unknown>): Promise<AdminUserRow | null> {
    setError(null);
    const res = await fetch(`/api/admin/users/${current.user_id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      setError(data?.error ?? "Couldn’t save. Nothing was changed.");
      return null;
    }
    const updated = { ...current, ...data.user } as AdminUserRow;
    setCurrent(updated);
    onUpdated(updated);
    void loadDetail(updated.user_id);
    return updated;
  }

  const save = async (kind: "role" | "plan", body: Record<string, unknown>) => {
    setSaving(kind);
    try {
      await patchUser(body);
    } finally {
      setSaving(null);
    }
  };

  const confirmStatus = async () => {
    if (!pendingStatus) return;
    setSaving("status");
    try {
      const body: Record<string, unknown> = { status: pendingStatus };
      if (pendingStatus !== "active") body.status_reason = reason.trim();
      if (await patchUser(body)) {
        setPendingStatus(null);
        setReason("");
      }
    } finally {
      setSaving(null);
    }
  };

  const reasonRequired = pendingStatus !== null && pendingStatus !== "active";
  const pill = STATUS_PILL[current.status];
  const planName = current.plan_id ? plans.find((p) => p.id === current.plan_id)?.name ?? current.plan_id : "Free (default)";

  return (
    <aside className="ad-drawer" aria-label="User detail">
      <div className="hstack" style={{ gap: 10, padding: "14px 16px", borderBottom: "1px solid var(--m-ink-faint)" }}>
        <h2 className="ad-h grow">User detail</h2>
        <button type="button" className="ad-btn" style={{ width: 30, padding: 0, justifyContent: "center" }} onClick={onClose} aria-label="Close">
          <X width={15} height={15} aria-hidden />
        </button>
      </div>

      <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 16 }}>
        <div className="hstack" style={{ gap: 11 }}>
          <span className="ad-av-sm" style={{ width: 38, height: 38, fontSize: 13 }} aria-hidden>
            {userInitials(current)}
          </span>
          <div className="vstack grow" style={{ gap: 1, minWidth: 0 }}>
            <span style={{ font: "800 15px var(--m-font-display)", overflowWrap: "anywhere" }}>
              {current.display_name || current.email?.split("@")[0] || "—"}
            </span>
            <span className="ad-cap" style={{ overflowWrap: "anywhere" }}>{current.email ?? "no email"}</span>
          </div>
          <span className={`ad-pill ${pill.cls}`}>{pill.label}</span>
        </div>

        {error && (
          <div className="ad-notice is-bad" role="alert">
            {error}
          </div>
        )}

        <dl className="ad-kv" style={{ margin: 0 }}>
          <dt>User ID</dt>
          <dd><span className="ad-mono">{current.user_id}</span></dd>
          <dt>Platform</dt>
          <dd>
            {current.last_seen_platform ? PLATFORM_LABEL[current.last_seen_platform] : "—"}
            {current.first_seen_platform && current.first_seen_platform !== current.last_seen_platform
              ? ` (joined on ${PLATFORM_LABEL[current.first_seen_platform]})`
              : ""}
          </dd>
          <dt>Sign-in</dt>
          <dd>{signIn ? signIn.charAt(0).toUpperCase() + signIn.slice(1) : actions === null ? "…" : "—"}</dd>
          <dt>Plan</dt>
          <dd>{planName}</dd>
          <dt>Role</dt>
          <dd style={{ textTransform: "capitalize" }}>{current.role}</dd>
          <dt>Joined</dt>
          <dd>{shortDate(current.created_at)}</dd>
          <dt>Last seen</dt>
          <dd>
            {current.last_seen_at
              ? `${relDay(current.last_seen_at)}, ${new Date(current.last_seen_at).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}`
              : "—"}
          </dd>
          <dt>Bo requests</dt>
          <dd>{current.chat_usage_7d} in the last 7 days</dd>
        </dl>

        {/* Access */}
        <div className="ad-inset">
          <h3 className="ad-h" style={{ fontSize: 12.5 }}>Access</h3>
          {current.status === "active" ? (
            <span className="ad-cap" style={{ fontSize: 12 }}>Restricting stops Bo and photo scans; they can still read their data. Banning blocks the whole app. Data is kept either way.</span>
          ) : (
            <span className="ad-cap" style={{ fontSize: 12, color: "var(--text-red)" }}>
              {pill.label}
              {current.status_changed_at ? ` ${relDay(current.status_changed_at).toLowerCase()}` : ""}
              {current.status_reason ? ` · “${current.status_reason}”` : ""}
            </span>
          )}

          {pendingStatus ? (
            <div className="vstack" style={{ gap: 8 }}>
              {reasonRequired ? (
                <label className="vstack" style={{ gap: 5 }}>
                  <span className="ad-cap" style={{ fontSize: 12 }}>
                    Reason for {pendingStatus === "banned" ? "banning" : "restricting"} (required, kept in the audit log)
                  </span>
                  <textarea className="ad-in" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} autoFocus />
                </label>
              ) : (
                <span className="ad-cap" style={{ fontSize: 12 }}>Restore full access for this account?</span>
              )}
              <div className="hstack" style={{ gap: 8 }}>
                <button
                  type="button"
                  className={`ad-btn ${pendingStatus === "active" ? "ad-btn-p" : "ad-btn-d"}`}
                  onClick={() => void confirmStatus()}
                  disabled={saving === "status" || (reasonRequired && !reason.trim())}
                >
                  {saving === "status" ? "Saving…" : pendingStatus === "active" ? "Unrestrict" : pendingStatus === "banned" ? "Ban user" : "Restrict user"}
                </button>
                <button type="button" className="ad-btn" onClick={() => setPendingStatus(null)}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="hstack" style={{ gap: 8, flexWrap: "wrap" }}>
              {current.status === "active" ? (
                <>
                  <button type="button" className="ad-btn ad-btn-d" onClick={() => { setReason(""); setPendingStatus("restricted"); }}>
                    <Ban width={14} height={14} aria-hidden />
                    Restrict user
                  </button>
                  <button type="button" className="ad-btn ad-btn-d" onClick={() => { setReason(""); setPendingStatus("banned"); }}>
                    Ban
                  </button>
                </>
              ) : (
                <>
                  <button type="button" className="ad-btn" onClick={() => setPendingStatus("active")}>
                    Unrestrict
                  </button>
                  {current.status === "restricted" && (
                    <button type="button" className="ad-btn ad-btn-d" onClick={() => { setReason(""); setPendingStatus("banned"); }}>
                      Ban
                    </button>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* Plan + role — not on the board; the only place to change them. */}
        <div className="vstack" style={{ gap: 10 }}>
          <label className="vstack" style={{ gap: 5 }}>
            <span className="ad-h" style={{ fontSize: 12.5 }}>Plan</span>
            <div className="hstack" style={{ gap: 8 }}>
              <select className="ad-in grow" value={planId ?? ""} onChange={(e) => setPlanId(e.target.value || null)}>
                <option value="">Default (free)</option>
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <button
                type="button"
                className="ad-btn"
                onClick={() => void save("plan", { plan_id: planId })}
                disabled={saving === "plan" || planId === current.plan_id}
              >
                {saving === "plan" ? "Saving…" : "Save"}
              </button>
            </div>
          </label>
          <label className="vstack" style={{ gap: 5 }}>
            <span className="ad-h" style={{ fontSize: 12.5 }}>Role</span>
            <div className="hstack" style={{ gap: 8 }}>
              <select className="ad-in grow" value={role} onChange={(e) => setRole(e.target.value as UserRole)}>
                <option value="user">User</option>
                <option value="support">Support</option>
                <option value="admin">Admin</option>
              </select>
              <button
                type="button"
                className="ad-btn"
                onClick={() => void save("role", { role })}
                disabled={saving === "role" || role === current.role}
              >
                {saving === "role" ? "Saving…" : "Save"}
              </button>
            </div>
          </label>
        </div>

        <div className="vstack" style={{ gap: 6 }}>
          <h3 className="ad-h" style={{ fontSize: 12.5 }}>Admin actions</h3>
          {actions === null ? (
            <span className="ad-sk" style={{ width: "80%", height: 10 }} />
          ) : actions.length === 0 ? (
            <span className="ad-cap">None yet.</span>
          ) : (
            <ul className="vstack" style={{ gap: 4, listStyle: "none", margin: 0, padding: 0 }}>
              {actions.map((a) => (
                <li key={a.id} className="ad-cap" style={{ overflowWrap: "anywhere" }}>
                  {new Date(a.created_at).toLocaleDateString(undefined, { day: "numeric", month: "short" })} · {describe(a)}
                  {a.actor ? ` · ${a.actor}` : ""}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </aside>
  );
}
