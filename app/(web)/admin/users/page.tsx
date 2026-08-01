"use client";

import { useEffect, useState, useCallback } from "react";
import { Search, Loader2 } from "lucide-react";
import { Chip } from "@/components/cc/chip";
import { StatusPill } from "@/components/cc/status-pill";
import { UserDrawer } from "./user-drawer";
import type { AdminUserRow, AdminPlan, UserStatus, Platform } from "./types";

const STATUS_FILTERS: { value: UserStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "restricted", label: "Restricted" },
  { value: "banned", label: "Banned" },
];

const PLATFORM_FILTERS: { value: Platform | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "web", label: "Web" },
  { value: "ios", label: "iOS" },
  { value: "android", label: "Android" },
];

const STATUS_TONE: Record<UserStatus, "active" | "pending" | "error"> = {
  active: "active",
  restricted: "pending",
  banned: "error",
};

export default function UsersPage() {
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [status, setStatus] = useState<UserStatus | "all">("all");
  const [platform, setPlatform] = useState<Platform | "all">("all");

  const [plans, setPlans] = useState<AdminPlan[]>([]);
  const [selectedUser, setSelectedUser] = useState<AdminUserRow | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 350);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    fetch("/api/admin/plans")
      .then((r) => r.json())
      .then((data) => setPlans(data.plans ?? []))
      .catch(() => {});
  }, []);

  const fetchUsers = useCallback(
    async (cursor: string | null) => {
      if (cursor) setLoadingMore(true);
      else setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (debouncedQ) params.set("q", debouncedQ);
        if (status !== "all") params.set("status", status);
        if (platform !== "all") params.set("platform", platform);
        if (cursor) params.set("cursor", cursor);

        const res = await fetch(`/api/admin/users?${params.toString()}`);
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          setError(data?.error ?? "Failed to load users");
          return;
        }
        setUsers((prev) => (cursor ? [...prev, ...(data.users ?? [])] : data.users ?? []));
        setNextCursor(data.nextCursor ?? null);
      } catch {
        setError("Failed to load users. Check your connection.");
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [debouncedQ, status, platform]
  );

  useEffect(() => {
    fetchUsers(null);
  }, [fetchUsers]);

  const handleUpdated = (updated: AdminUserRow) => {
    setUsers((prev) => prev.map((u) => (u.user_id === updated.user_id ? { ...u, ...updated } : u)));
    setSelectedUser(updated);
  };

  return (
    <main className="max-w-6xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="font-bold text-lg" style={{ color: "var(--cc-text-primary)", letterSpacing: "-0.02em" }}>
          Users
        </h1>
        <p className="text-xs mt-0.5" style={{ color: "var(--cc-text-tertiary)" }}>
          {users.length} loaded
        </p>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search
          className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2"
          style={{ color: "var(--cc-text-tertiary)" }}
        />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by email"
          className="w-full pl-9 pr-3 py-2 text-sm rounded-lg"
          style={{ background: "var(--cc-surface-2)", border: "1px solid var(--cc-border)", color: "var(--cc-text-primary)" }}
        />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div className="flex items-center gap-2">
          <span className="text-xs" style={{ color: "var(--cc-text-tertiary)" }}>Status</span>
          <div className="flex gap-1.5">
            {STATUS_FILTERS.map((f) => (
              <Chip key={f.value} active={status === f.value} onClick={() => setStatus(f.value)}>
                {f.label}
              </Chip>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs" style={{ color: "var(--cc-text-tertiary)" }}>Platform</span>
          <div className="flex gap-1.5">
            {PLATFORM_FILTERS.map((f) => (
              <Chip key={f.value} active={platform === f.value} onClick={() => setPlatform(f.value)}>
                {f.label}
              </Chip>
            ))}
          </div>
        </div>
      </div>

      {error && (
        <div
          className="rounded-xl p-4 text-sm"
          style={{ background: "rgba(255,69,58,0.08)", color: "#ff453a", border: "1px solid rgba(255,69,58,0.15)" }}
        >
          {error}
        </div>
      )}

      {/* Table */}
      <div className="rounded-2xl overflow-hidden" style={{ background: "var(--cc-surface)", border: "1px solid var(--cc-border)" }}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--cc-border)" }}>
                {["Email", "Status", "Plan", "Last-seen platform", "7d requests", "Created"].map((h) => (
                  <th
                    key={h}
                    className="text-left px-4 py-3 text-label"
                    style={{ color: "var(--cc-text-tertiary)" }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center">
                    <Loader2 className="w-5 h-5 animate-spin inline-block" style={{ color: "var(--cc-text-tertiary)" }} />
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-sm" style={{ color: "var(--cc-text-tertiary)" }}>
                    No users match these filters.
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr
                    key={u.user_id}
                    onClick={() => setSelectedUser(u)}
                    className="cursor-pointer transition-colors hover:bg-[var(--cc-surface-2)]"
                    style={{ borderBottom: "1px solid var(--cc-border)" }}
                  >
                    <td className="px-4 py-3" style={{ color: "var(--cc-text-primary)" }}>
                      {u.email ?? u.user_id}
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill tone={STATUS_TONE[u.status]}>{u.status}</StatusPill>
                    </td>
                    <td className="px-4 py-3" style={{ color: "var(--cc-text-secondary)" }}>
                      {u.plan_id ?? "—"}
                    </td>
                    <td className="px-4 py-3" style={{ color: "var(--cc-text-secondary)" }}>
                      {u.last_seen_platform ?? "—"}
                    </td>
                    <td className="px-4 py-3" style={{ color: "var(--cc-text-secondary)" }}>
                      {u.chat_usage_7d}
                    </td>
                    <td className="px-4 py-3" style={{ color: "var(--cc-text-secondary)" }}>
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {nextCursor && !loading && (
        <div className="flex justify-center">
          <button
            onClick={() => fetchUsers(nextCursor)}
            disabled={loadingMore}
            className="btn-pill-secondary flex items-center gap-1.5 text-xs h-8 px-4 disabled:opacity-50"
          >
            {loadingMore && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Load more
          </button>
        </div>
      )}

      {selectedUser && (
        <UserDrawer
          user={selectedUser}
          plans={plans}
          onClose={() => setSelectedUser(null)}
          onUpdated={handleUpdated}
        />
      )}
    </main>
  );
}
