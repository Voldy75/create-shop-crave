"use client";

import { useEffect, useState } from "react";
import { X, Loader2 } from "lucide-react";
import { CCButton } from "@/components/cc/button";
import { StatusPill } from "@/components/cc/status-pill";
import type { AdminUserRow, AdminPlan, UserStatus, UserRole } from "./types";

const STATUS_TONE: Record<UserStatus, "active" | "pending" | "error"> = {
  active: "active",
  restricted: "pending",
  banned: "error",
};

interface UserDrawerProps {
  user: AdminUserRow;
  plans: AdminPlan[];
  onClose: () => void;
  onUpdated: (user: AdminUserRow) => void;
}

export function UserDrawer({ user, plans, onClose, onUpdated }: UserDrawerProps) {
  const [current, setCurrent] = useState(user);
  const [role, setRole] = useState<UserRole>(user.role);
  const [planId, setPlanId] = useState<string | null>(user.plan_id);
  const [pendingStatus, setPendingStatus] = useState<UserStatus | null>(null);
  const [reason, setReason] = useState("");
  const [savingRole, setSavingRole] = useState(false);
  const [savingPlan, setSavingPlan] = useState(false);
  const [savingStatus, setSavingStatus] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setCurrent(user);
    setRole(user.role);
    setPlanId(user.plan_id);
    setPendingStatus(null);
    setReason("");
    setError(null);
  }, [user]);

  async function patchUser(body: Record<string, unknown>): Promise<AdminUserRow | null> {
    setError(null);
    const res = await fetch(`/api/admin/users/${current.user_id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      setError(data?.error ?? "Something went wrong");
      return null;
    }
    const updated = { ...current, ...data.user } as AdminUserRow;
    setCurrent(updated);
    onUpdated(updated);
    return updated;
  }

  const handleSaveRole = async () => {
    if (role === current.role) return;
    setSavingRole(true);
    try {
      await patchUser({ role });
    } finally {
      setSavingRole(false);
    }
  };

  const handleSavePlan = async () => {
    if (planId === current.plan_id) return;
    setSavingPlan(true);
    try {
      await patchUser({ plan_id: planId });
    } finally {
      setSavingPlan(false);
    }
  };

  const handleChooseStatus = (status: UserStatus) => {
    setPendingStatus(status);
    setReason("");
    setError(null);
  };

  const handleConfirmStatus = async () => {
    if (!pendingStatus) return;
    setSavingStatus(true);
    try {
      const body: Record<string, unknown> = { status: pendingStatus };
      if (pendingStatus !== "active") body.status_reason = reason.trim();
      const updated = await patchUser(body);
      if (updated) {
        setPendingStatus(null);
        setReason("");
      }
    } finally {
      setSavingStatus(false);
    }
  };

  const reasonRequired = pendingStatus !== null && pendingStatus !== "active";
  const confirmDisabled = savingStatus || (reasonRequired && !reason.trim());

  return (
    <div className="fixed inset-0 z-30 flex justify-end">
      <div
        className="absolute inset-0"
        style={{ background: "color-mix(in srgb, var(--m-forest-2) 55%, transparent)" }}
        onClick={onClose}
      />
      <div
        className="relative w-full max-w-md h-full overflow-y-auto p-6 space-y-6"
        style={{ background: "var(--m-card)", borderLeft: "1px solid var(--m-ink-faint)" }}
      >
        <div className="flex items-start justify-between">
          <div className="min-w-0">
            <p className="font-bold text-lg truncate" style={{ color: "var(--m-ink)" }}>
              {current.email ?? current.user_id}
            </p>
            {current.display_name && (
              <p className="text-sm" style={{ color: "var(--m-ink-soft)" }}>{current.display_name}</p>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 rounded-full transition-colors hover:bg-[var(--m-cream-2)]"
            style={{ color: "var(--m-ink-soft)" }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div
            className="rounded-xl p-3 text-sm"
            style={{
            background: "color-mix(in srgb, var(--m-red) 10%, transparent)",
            color: "var(--m-red)",
            border: "1.5px solid color-mix(in srgb, var(--m-red) 22%, transparent)",
          }}
          >
            {error}
          </div>
        )}

        {/* Details */}
        <div className="space-y-2 text-sm">
          <DetailRow label="Status" value={<StatusPill tone={STATUS_TONE[current.status]}>{current.status}</StatusPill>} />
          <DetailRow label="User ID" value={<code className="text-xs">{current.user_id}</code>} />
          <DetailRow label="Role" value={current.role} />
          <DetailRow label="Plan" value={current.plan_id ?? "—"} />
          <DetailRow label="First seen" value={current.first_seen_platform ?? "—"} />
          <DetailRow label="Last seen" value={current.last_seen_platform ?? "—"} />
          <DetailRow
            label="Last seen at"
            value={current.last_seen_at ? new Date(current.last_seen_at).toLocaleString() : "—"}
          />
          <DetailRow label="7-day requests" value={String(current.chat_usage_7d)} />
          <DetailRow label="Created" value={new Date(current.created_at).toLocaleDateString()} />
          {current.status_reason && (
            <DetailRow label="Status reason" value={current.status_reason} />
          )}
        </div>

        {/* Plan selector */}
        <div className="space-y-2">
          <p className="text-label">Plan</p>
          <div className="flex gap-2">
            <select
              value={planId ?? ""}
              onChange={(e) => setPlanId(e.target.value || null)}
              className="flex-1 px-3 py-2 text-sm rounded-lg"
              style={{ background: "var(--m-cream-2)", border: "1px solid var(--m-ink-faint)", color: "var(--m-ink)" }}
            >
              <option value="">No plan</option>
              {plans.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <CCButton
              variant="secondary"
              size="md"
              onClick={handleSavePlan}
              disabled={savingPlan || planId === current.plan_id}
            >
              {savingPlan && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Save
            </CCButton>
          </div>
        </div>

        {/* Role selector */}
        <div className="space-y-2">
          <p className="text-label">Role</p>
          <div className="flex gap-2">
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
              className="flex-1 px-3 py-2 text-sm rounded-lg"
              style={{ background: "var(--m-cream-2)", border: "1px solid var(--m-ink-faint)", color: "var(--m-ink)" }}
            >
              <option value="user">User</option>
              <option value="support">Support</option>
              <option value="admin">Admin</option>
            </select>
            <CCButton
              variant="secondary"
              size="md"
              onClick={handleSaveRole}
              disabled={savingRole || role === current.role}
            >
              {savingRole && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Save
            </CCButton>
          </div>
        </div>

        {/* Status actions */}
        <div className="space-y-2">
          <p className="text-label">Status actions</p>
          <div className="flex gap-2">
            <CCButton
              variant={pendingStatus === "active" ? "primary" : "secondary"}
              size="sm"
              onClick={() => handleChooseStatus("active")}
              disabled={current.status === "active" && pendingStatus === null}
            >
              Active
            </CCButton>
            <CCButton
              variant={pendingStatus === "restricted" ? "primary" : "secondary"}
              size="sm"
              onClick={() => handleChooseStatus("restricted")}
            >
              Restrict
            </CCButton>
            <CCButton
              variant={pendingStatus === "banned" ? "destructive" : "secondary"}
              size="sm"
              onClick={() => handleChooseStatus("banned")}
            >
              Ban
            </CCButton>
          </div>

          {pendingStatus && (
            <div className="mt-2 space-y-2 p-3 rounded-xl" style={{ background: "var(--m-cream-2)", border: "1px solid var(--m-ink-faint)" }}>
              <p className="text-xs" style={{ color: "var(--m-ink-soft)" }}>
                {pendingStatus === "active"
                  ? "Restore this account to active status."
                  : `${pendingStatus === "banned" ? "Banning" : "Restricting"} requires a reason (shown in the audit log).`}
              </p>
              {reasonRequired && (
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Reason (required)"
                  rows={3}
                  className="w-full px-3 py-2 text-sm rounded-lg resize-none"
                  style={{ background: "var(--m-card)", border: "1px solid var(--m-ink-faint)", color: "var(--m-ink)" }}
                />
              )}
              <div className="flex gap-2">
                <CCButton size="sm" onClick={handleConfirmStatus} disabled={confirmDisabled}>
                  {savingStatus && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Confirm
                </CCButton>
                <CCButton size="sm" variant="ghost" onClick={() => { setPendingStatus(null); setReason(""); }}>
                  Cancel
                </CCButton>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span style={{ color: "var(--m-ink-soft)" }}>{label}</span>
      <span style={{ color: "var(--m-ink)" }}>{value}</span>
    </div>
  );
}
