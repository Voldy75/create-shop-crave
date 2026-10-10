import type { AdminUserRow, Platform, UserStatus } from "./types";

/** Display helpers shared by the users table and the detail drawer. */

export const STATUS_PILL: Record<UserStatus, { cls: string; label: string }> = {
  active: { cls: "ad-ok", label: "Active" },
  restricted: { cls: "ad-warn", label: "Restricted" },
  banned: { cls: "ad-bad", label: "Banned" },
};

export const PLATFORM_LABEL: Record<Platform, string> = { web: "Web", ios: "iOS", android: "Android" };

export const userInitials = (u: Pick<AdminUserRow, "display_name" | "email">) => {
  const parts = (u.display_name || u.email || "?").trim().split(/[\s@._-]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "?") + (parts[1]?.[0] ?? "")).toUpperCase();
};

export const relDay = (iso: string | null) => {
  if (!iso) return "—";
  const d = new Date(iso);
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  if (days <= 0 && new Date().toDateString() === d.toDateString()) return "Today";
  if (days <= 1) return "Yesterday";
  if (days < 30) return `${days} days ago`;
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
};

export const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
