"use client";

/**
 * Admin → Users, built to w12b (empty state: w12h).
 *
 * Kept from the old screen, because the API works this way: search is by
 * email (the board says "name or email"; the API filters email only), the
 * Platform filter is the LAST-seen platform, and paging is a cursor, so the
 * footer offers "Load more" rather than the board's numbered Prev/Next.
 * "Banned" stays as a status — the board only draws Active/Restricted, but
 * the API has three states and hiding one would hide those users.
 */

import { useCallback, useEffect, useState } from "react";
import { Search } from "lucide-react";
import { Pea } from "@/components/mascots";
import { AdminError, AdminLoading, AdminTop } from "../admin-shell";
import { UserDrawer } from "./user-drawer";
import type { AdminPlan, AdminUserRow, Platform, UserStatus } from "./types";
import { PLATFORM_LABEL, STATUS_PILL, relDay, shortDate, userInitials } from "./format";

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
  const [selected, setSelected] = useState<AdminUserRow | null>(null);

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
          setError(data?.error ?? "Couldn’t load users.");
          return;
        }
        setUsers((prev) => (cursor ? [...prev, ...(data.users ?? [])] : data.users ?? []));
        setNextCursor(data.nextCursor ?? null);
      } catch {
        setError("Couldn’t load users. Check your connection.");
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [debouncedQ, status, platform]
  );

  useEffect(() => {
     
    void fetchUsers(null);
  }, [fetchUsers]);

  const handleUpdated = (updated: AdminUserRow) => {
    setUsers((prev) => prev.map((u) => (u.user_id === updated.user_id ? { ...u, ...updated } : u)));
    setSelected(updated);
  };

  const planName = (id: string | null) => (id ? plans.find((p) => p.id === id)?.name ?? id : null);
  const filtered = status !== "all" || platform !== "all" || !!debouncedQ;
  const clearFilters = () => {
    setStatus("all");
    setPlatform("all");
    setQ("");
  };

  const emptyCopy = (() => {
    if (debouncedQ) return { title: `No users match “${debouncedQ}”`, sub: "Search looks at email addresses." };
    if (status !== "all" && platform === "all")
      return {
        title: `No ${STATUS_PILL[status].label.toLowerCase()} users`,
        sub: status === "active" ? "Every account is restricted or banned." : "Users you restrict or ban from the detail drawer appear here.",
      };
    if (platform !== "all" && status === "all")
      return { title: `No users on ${PLATFORM_LABEL[platform]}`, sub: "Platform is where each user was last seen." };
    if (filtered) return { title: "No users match these filters", sub: "Try clearing a filter." };
    return { title: "No users yet", sub: "Accounts appear here after their first sign-in." };
  })();

  return (
    <div style={{ display: "flex", flex: 1, minWidth: 0 }}>
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <AdminTop title="Users">
          {loading ? <AdminLoading /> : <span className="ad-cap">{users.length}{nextCursor ? "+" : ""} shown</span>}
        </AdminTop>
        <div className="ad-body">
          <div className="hstack" style={{ gap: 14, flexWrap: "wrap" }}>
            <label className="ad-search">
              <Search width={15} height={15} aria-hidden />
              <span className="sr-only">Search by email</span>
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search email" type="search" />
            </label>
            <span className="ad-lbl" id="ad-f-status">Status</span>
            <div className="ad-seg" role="group" aria-labelledby="ad-f-status">
              {STATUS_FILTERS.map((f) => (
                <button key={f.value} type="button" className={status === f.value ? "is-on" : ""} aria-pressed={status === f.value} onClick={() => setStatus(f.value)}>
                  {f.label}
                </button>
              ))}
            </div>
            <span className="ad-lbl" id="ad-f-platform">Platform</span>
            <div className="ad-seg" role="group" aria-labelledby="ad-f-platform">
              {PLATFORM_FILTERS.map((f) => (
                <button key={f.value} type="button" className={platform === f.value ? "is-on" : ""} aria-pressed={platform === f.value} onClick={() => setPlatform(f.value)}>
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {error && <AdminError>{error}</AdminError>}

          <div className="ad-card" style={{ overflow: "hidden" }}>
            <div className="ad-scroll">
              <table className="ad-tbl">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Platform</th>
                    <th>Plan</th>
                    <th>Status</th>
                    <th>Joined</th>
                    <th>Last seen</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    [0, 1, 2, 3, 4].map((i) => (
                      <tr key={i}>
                        <td><div className="hstack" style={{ gap: 9 }}><span className="ad-sk" style={{ width: 26, height: 26, borderRadius: "50%" }} /><span className="ad-sk" style={{ width: 150, height: 11 }} /></div></td>
                        <td><span className="ad-sk" style={{ width: 40, height: 11 }} /></td>
                        <td><span className="ad-sk" style={{ width: 50, height: 11 }} /></td>
                        <td><span className="ad-sk" style={{ width: 54, height: 11 }} /></td>
                        <td><span className="ad-sk" style={{ width: 60, height: 11 }} /></td>
                        <td><span className="ad-sk" style={{ width: 60, height: 11 }} /></td>
                      </tr>
                    ))
                  ) : users.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ padding: "54px 12px" }}>
                        <div className="vstack" style={{ gap: 8, alignItems: "center", textAlign: "center" }}>
                          <Pea width={64} height={64} aria-hidden style={{ animation: "mm-bob 3.4s ease-in-out infinite" }} />
                          <span className="ad-h">{emptyCopy.title}</span>
                          <span className="ad-cap" style={{ fontSize: 12 }}>{emptyCopy.sub}</span>
                          {filtered && (
                            <button type="button" className="ad-btn" style={{ marginTop: 4 }} onClick={clearFilters}>
                              Show all users
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    users.map((u) => {
                      const plan = planName(u.plan_id);
                      const isSel = selected?.user_id === u.user_id;
                      return (
                        <tr
                          key={u.user_id}
                          className={`is-click${isSel ? " is-sel" : ""}`}
                          tabIndex={0}
                          aria-selected={isSel}
                          onClick={() => setSelected(u)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              setSelected(u);
                            }
                          }}
                        >
                          <td>
                            <div className="hstack" style={{ gap: 9 }}>
                              <span className="ad-av-sm" aria-hidden>{userInitials(u)}</span>
                              <div className="vstack" style={{ gap: 0, minWidth: 0 }}>
                                <span style={{ fontWeight: 700 }}>{u.display_name || u.email?.split("@")[0] || "—"}</span>
                                <span className="ad-cap">{u.email ?? u.user_id}</span>
                              </div>
                            </div>
                          </td>
                          <td>{u.last_seen_platform ? PLATFORM_LABEL[u.last_seen_platform] : "—"}</td>
                          <td>
                            <span className={`ad-pill ${plan && u.plan_id !== "free" ? "ad-plus" : "ad-mute"}`}>{plan ?? "Free"}</span>
                          </td>
                          <td>
                            <span className={`ad-pill ${STATUS_PILL[u.status].cls}`}>{STATUS_PILL[u.status].label}</span>
                          </td>
                          <td style={{ whiteSpace: "nowrap" }}>{shortDate(u.created_at)}</td>
                          <td style={{ whiteSpace: "nowrap" }}>{relDay(u.last_seen_at)}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            <div className="ad-foot">
              <span className="ad-cap">
                {loading ? "Loading…" : `${users.length} shown${nextCursor ? " · more available" : ""}`}
              </span>
              <div className="grow" />
              {nextCursor && !loading && (
                <button type="button" className="ad-btn" onClick={() => void fetchUsers(nextCursor)} disabled={loadingMore}>
                  {loadingMore ? "Loading…" : "Load more"}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {selected && (
        <UserDrawer user={selected} plans={plans} onClose={() => setSelected(null)} onUpdated={handleUpdated} />
      )}
    </div>
  );
}
