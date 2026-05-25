"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, Utensils, MapPin, Crown, ChevronRight, LogOut, Salad } from "lucide-react";
import { useUser } from "@/app/context/UserContext";

/**
 * Profile / Me tab — meshi ScreenSettings. Account header + grouped rows
 * linking to the real surfaces (notifications, Swiggy, dietary prefs),
 * dietary chips, and sign out. Wired to UserContext.
 */
export default function ProfileTab() {
  const router = useRouter();
  const { user, userName, dietaryPreferences, location, signOut, hydrated } = useUser();

  const name = hydrated && userName ? userName : "Guest";
  const initials = hydrated && userName ? userName.slice(0, 2).toUpperCase() : "··";

  const rows: { icon: typeof Bell; label: string; sub: string; href: string }[] = [
    { icon: Bell, label: "Notifications", sub: "Daily nudge · WhatsApp · push", href: "/settings/notifications" },
    { icon: Utensils, label: "Swiggy account", sub: "Connect for ordering", href: "/settings/notifications" },
    { icon: MapPin, label: "Location", sub: location ? "Set" : "Not set", href: "/m/onboarding" },
    { icon: Crown, label: "Go Pro", sub: "Unlimited AI + ordering", href: "/m/paywall" },
  ];

  return (
    <div className="col" style={{ minHeight: "100dvh", background: "var(--cc-bg)" }}>
      <div style={{ padding: "calc(env(safe-area-inset-top,12px) + 10px) 16px 8px" }}>
        <h1 className="t-h1">Me</h1>
      </div>

      <div className="scroll" style={{ flex: 1, padding: "8px 14px 90px" }}>
        {/* Account header */}
        <div className="card row" style={{ padding: 16, gap: 14 }}>
          <div style={{ width: 56, height: 56, borderRadius: "50%", background: "var(--cc-acc)", color: "#fff", display: "grid", placeItems: "center", fontWeight: 700, fontSize: 20, flexShrink: 0 }}>{initials}</div>
          <div className="col" style={{ flex: 1, gap: 2, minWidth: 0 }}>
            <span className="t-h2" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{name}</span>
            <span className="t-small">{user?.email ?? "Not signed in"}</span>
          </div>
          {!user && (
            <button className="chip chip-solid" onClick={() => router.push("/m/onboarding")}>Sign in</button>
          )}
        </div>

        {/* Dietary prefs */}
        {hydrated && dietaryPreferences.length > 0 && (
          <div style={{ marginTop: 18 }}>
            <span className="t-cap" style={{ padding: "0 4px" }}>HOW YOU EAT</span>
            <div className="row" style={{ flexWrap: "wrap", gap: 8, marginTop: 10 }}>
              {dietaryPreferences.map((p) => (
                <span key={p} className="chip on" style={{ textTransform: "capitalize" }}><Salad width={12} height={12} />{p}</span>
              ))}
            </div>
          </div>
        )}

        {/* Settings rows */}
        <div className="col card" style={{ marginTop: 18, padding: 0, overflow: "hidden" }}>
          {rows.map((r, i) => {
            const Icon = r.icon;
            return (
              <Link key={r.label} href={r.href} className="row" style={{ padding: "14px 16px", gap: 12, borderTop: i === 0 ? "none" : "1px solid var(--cc-line)", textDecoration: "none", color: "var(--cc-ink-1)" }}>
                <div style={{ width: 34, height: 34, borderRadius: 9, background: "var(--cc-surf-3)", display: "grid", placeItems: "center", color: "var(--cc-acc)", flexShrink: 0 }}>
                  <Icon width={18} height={18} />
                </div>
                <div className="col" style={{ flex: 1, gap: 1 }}>
                  <span style={{ fontSize: 15, fontWeight: 600 }}>{r.label}</span>
                  <span className="t-small" style={{ fontSize: 12 }}>{r.sub}</span>
                </div>
                <ChevronRight width={18} height={18} style={{ color: "var(--cc-ink-3)" }} />
              </Link>
            );
          })}
        </div>

        {user && (
          <button onClick={() => signOut()} className="pill-secondary" style={{ marginTop: 18 }}>
            <LogOut width={16} height={16} /> Sign out
          </button>
        )}

        <p className="t-small" style={{ textAlign: "center", marginTop: 18, color: "var(--cc-ink-4)" }}>meshi · Crave &amp; Create</p>
      </div>
    </div>
  );
}
