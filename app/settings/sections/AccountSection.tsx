"use client";

import React from "react";
import { LogOut, Shield, Mail, User } from "lucide-react";
import { useRouter } from "next/navigation";
import { useUser } from "@/app/context/UserContext";

const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL;

export function AccountSection() {
  const { user, userName, signOut } = useUser();
  const router = useRouter();
  const isAdmin = user?.email === ADMIN_EMAIL;

  const handleSignOut = async () => {
    await signOut();
    router.replace("/");
  };

  return (
    <div className="space-y-4">
      {/* Profile card */}
      <div
        className="p-4"
        style={{
          background: "var(--cc-surface)",
          border: "1px solid var(--cc-border)",
          borderRadius: "16px",
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold shrink-0"
            style={{ background: "var(--cc-accent)", fontSize: "16px" }}
          >
            {userName ? userName[0].toUpperCase() : "U"}
          </div>
          <div className="flex-1 min-w-0">
            <p
              style={{
                fontSize: "15px",
                fontWeight: 700,
                color: "var(--cc-text-primary)",
              }}
            >
              {userName || "User"}
            </p>
            <div className="flex items-center gap-1 mt-0.5">
              <Mail className="w-3 h-3" style={{ color: "var(--cc-text-tertiary)" }} />
              <p
                className="truncate"
                style={{
                  fontSize: "12px",
                  color: "var(--cc-text-secondary)",
                }}
              >
                {user?.email}
              </p>
            </div>
          </div>
          {isAdmin && (
            <span
              style={{
                fontSize: "10px",
                fontWeight: 700,
                color: "var(--cc-accent)",
                background: "rgba(255,107,53,0.12)",
                padding: "2px 8px",
                borderRadius: "980px",
                textTransform: "uppercase",
                letterSpacing: "0.04em",
              }}
            >
              Admin
            </span>
          )}
        </div>
      </div>

      {/* Admin access */}
      {isAdmin && (
        <button
          onClick={() => router.push("/admin")}
          className="w-full p-4 flex items-center gap-3 transition-colors"
          style={{
            background: "var(--cc-surface)",
            border: "1px solid var(--cc-border)",
            borderRadius: "16px",
            textAlign: "left",
          }}
        >
          <div
            className="flex-shrink-0 flex items-center justify-center"
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "10px",
              background: "rgba(255,107,53,0.10)",
              color: "var(--cc-accent)",
            }}
          >
            <Shield className="w-4 h-4" />
          </div>
          <div>
            <p style={{ fontSize: "14px", fontWeight: 600, color: "var(--cc-text-primary)" }}>
              Admin Dashboard
            </p>
            <p style={{ fontSize: "11px", color: "var(--cc-text-secondary)" }}>
              Feature flags, user stats, and analytics
            </p>
          </div>
        </button>
      )}

      {/* Account info */}
      <div
        className="p-4"
        style={{
          background: "var(--cc-surface)",
          border: "1px solid var(--cc-border)",
          borderRadius: "16px",
        }}
      >
        <h3 style={{ fontSize: "13px", fontWeight: 600, color: "var(--cc-text-primary)", marginBottom: "12px" }}>
          Account details
        </h3>
        <div className="space-y-3">
          <Row label="Auth provider" value={user?.app_metadata?.provider ?? "email"} />
          <Row
            label="Account created"
            value={user?.created_at ? new Date(user.created_at).toLocaleDateString() : "—"}
          />
          <Row
            label="User ID"
            value={user?.id ? `${user.id.slice(0, 8)}...` : "—"}
          />
        </div>
      </div>

      {/* Sign out */}
      <button
        onClick={handleSignOut}
        className="w-full flex items-center justify-center gap-2 py-3 transition-colors"
        style={{
          fontSize: "14px",
          fontWeight: 600,
          color: "#ff453a",
          background: "rgba(255,69,58,0.08)",
          border: "1px solid rgba(255,69,58,0.15)",
          borderRadius: "12px",
        }}
      >
        <LogOut className="w-4 h-4" />
        Sign out
      </button>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span style={{ fontSize: "12px", color: "var(--cc-text-secondary)" }}>{label}</span>
      <span
        style={{
          fontSize: "12px",
          fontWeight: 500,
          color: "var(--cc-text-primary)",
          background: "var(--cc-surface-2)",
          padding: "2px 8px",
          borderRadius: "6px",
        }}
      >
        {value}
      </span>
    </div>
  );
}
