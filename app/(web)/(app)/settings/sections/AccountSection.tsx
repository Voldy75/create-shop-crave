"use client";

/**
 * Settings → Account, built to w11a (with w11f's export states inline).
 *
 * WHAT CHANGED FROM THE OLD SECTION, deliberately:
 *   - Delete account exists. It is a quiet row under a divider at the very
 *     bottom — never a button (the board's own rule). The flow itself is
 *     components/web/DeleteAccountFlow.tsx.
 *   - Sign out is a NEUTRAL row. It used to be styled red like a destructive
 *     action; next to a real delete that blurs which action is dangerous.
 *     It stays (the board drops it) because below 768px the sidebar menu that
 *     also holds sign-out is hidden, and removing it would strand those users.
 *   - Admin entry is decided by the SERVER (/api/account → isAdmin, the same
 *     rule requireAdmin uses). It used to compare against
 *     NEXT_PUBLIC_ADMIN_EMAIL, which only worked if that variable was set —
 *     and setting it compiles the admin's email into the public bundle.
 *   - The plan card shows the real plan: the live chat cap from the plans
 *     table (never a hardcoded "2"), or the real pass/subscription with its
 *     provider-correct terms.
 *
 * Export is generated on request (decided 2026-10-03): the board's "you can
 * leave and come back" copy is not used, because nothing persists the file.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, Download, FileArchive, LogOut, Shield, Trash2 } from "lucide-react";
import { useUser } from "@/app/context/UserContext";
import { BoBowl } from "@/components/mascots";
import { UpgradeDialog } from "@/components/UpgradeDialog";
import { DeleteAccountFlow } from "@/components/web/DeleteAccountFlow";
import { saveBYOK } from "@/lib/byok";
import {
  type AccountSummary,
  type ExportFile,
  fetchAccountSummary,
  formatBytes,
  formatDate,
  requestExport,
} from "@/lib/account-client";

type ExportState = { kind: "idle" } | { kind: "preparing"; at: Date } | { kind: "ready"; file: ExportFile } | { kind: "error" };

const initials = (name: string, email?: string | null) => {
  const src = (name || email || "?").trim();
  const parts = src.split(/[\s@._-]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "?") + (parts[1]?.[0] ?? "")).toUpperCase();
};
const time = (d: Date) => d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });

export function AccountSection() {
  const { user, userName, signOut } = useUser();
  const router = useRouter();
  const [summary, setSummary] = useState<AccountSummary | null>(null);
  const [exp, setExp] = useState<ExportState>({ kind: "idle" });
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = () => fetchAccountSummary().then(setSummary);
  useEffect(() => {
    let alive = true;
    fetchAccountSummary().then((s) => alive && setSummary(s));
    return () => {
      alive = false;
    };
  }, []);

  // Release the export blob when it is replaced or the section unmounts.
  useEffect(() => {
    return () => {
      if (exp.kind === "ready") URL.revokeObjectURL(exp.file.url);
    };
  }, [exp]);

  const startExport = async () => {
    setExp({ kind: "preparing", at: new Date() });
    try {
      setExp({ kind: "ready", file: await requestExport() });
    } catch {
      setExp({ kind: "error" });
    }
  };

  const download = (file: ExportFile) => {
    const a = document.createElement("a");
    a.href = file.url;
    a.download = file.filename;
    a.click();
  };

  const pass = summary?.pass ?? null;
  const provider = summary?.signInProvider ? summary.signInProvider.charAt(0).toUpperCase() + summary.signInProvider.slice(1) : null;

  return (
    <div className="vstack" style={{ gap: 16 }}>
      {/* Profile */}
      <div className="card" style={{ padding: "22px 24px", display: "flex", gap: 16, alignItems: "center" }}>
        <span
          aria-hidden
          style={{ width: 56, height: 56, borderRadius: "50%", background: "var(--m-tint-peach)", display: "flex", alignItems: "center", justifyContent: "center", font: "800 19px var(--m-font-display)", color: "var(--text-burnt)", flex: "none" }}
        >
          {initials(userName, user?.email)}
        </span>
        <div className="vstack grow" style={{ gap: 3, minWidth: 0 }}>
          <span className="t-d2" style={{ fontSize: 19 }}>{userName || user?.email?.split("@")[0] || "You"}</span>
          <span className="t-cap" style={{ overflowWrap: "anywhere" }}>
            {[user?.email, provider && `signed in with ${provider}`].filter(Boolean).join(" · ")}
          </span>
        </div>
      </div>

      {/* Plan */}
      {pass ? (
        <div className="card tint-lav" style={{ padding: "18px 24px", display: "flex", gap: 16, alignItems: "center", boxShadow: "none" }}>
          <BoBowl width={36} height={36} aria-hidden style={{ flex: "none" }} />
          <div className="vstack grow" style={{ gap: 2 }}>
            <span className="t-h1" style={{ fontSize: 17 }}>{pass.recurring ? "meshi+ · monthly" : "meshi+ · 31-day pass"}</span>
            <span className="t-cap">
              {pass.recurring
                ? `Renews ${formatDate(pass.endsAt)} · cancel any time`
                : `${pass.daysLeft ?? 0} day${pass.daysLeft === 1 ? "" : "s"} left · ends ${formatDate(pass.endsAt)} · doesn’t renew`}
            </span>
          </div>
        </div>
      ) : (
        <div className="card" style={{ padding: "18px 24px", display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ width: 44, height: 44, borderRadius: 14, background: "var(--m-cream-2)", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }} aria-hidden>
            <BoBowl width={30} height={30} />
          </span>
          <div className="vstack grow" style={{ gap: 2 }}>
            <span className="t-h1" style={{ fontSize: 17 }}>Free plan</span>
            <span className="t-cap">
              {summary == null
                ? "Loading your plan…"
                : summary.chatDailyLimit == null
                  ? "Unlimited Bo chats"
                  : `${summary.chatDailyLimit} Bo chat${summary.chatDailyLimit === 1 ? "" : "s"} a day`}
            </span>
          </div>
          <button type="button" className="chip" onClick={() => setShowUpgrade(true)}>
            See meshi+ pass
          </button>
        </div>
      )}

      {/* Download your data — w11f's three states, inline */}
      <div className="card" style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
        <div className="hstack" style={{ gap: 14, flexWrap: "wrap" }}>
          <span style={{ width: 44, height: 44, borderRadius: 14, background: "var(--m-cream-2)", color: "var(--m-ink-soft)", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }} aria-hidden>
            <Download width={20} height={20} />
          </span>
          <div className="vstack grow" style={{ gap: 2, minWidth: 220 }}>
            <span className="t-h1" style={{ fontSize: 17 }}>Download your data</span>
            <span className="t-cap">Saved recipes, meal logs, goals and preferences as JSON and CSV files, in one ZIP</span>
          </div>
          {exp.kind === "idle" || exp.kind === "error" ? (
            <button type="button" className="chip" onClick={() => void startExport()}>
              <Download width={15} height={15} aria-hidden />
              Request export
            </button>
          ) : null}
        </div>

        {exp.kind === "preparing" && (
          <div className="hstack" role="status" style={{ gap: 12, padding: "13px 15px", borderRadius: 15, background: "var(--m-cream-2)" }}>
            <span className="dlsp" aria-hidden />
            <div className="vstack grow" style={{ gap: 2 }}>
              <span className="t-h2" style={{ fontSize: 14 }}>Preparing your export</span>
              <span className="t-cap" style={{ fontSize: 12 }}>Requested {time(exp.at)}. This takes a few seconds.</span>
            </div>
          </div>
        )}

        {exp.kind === "ready" && (
          <div className="vstack" style={{ gap: 12 }}>
            <div className="hstack" style={{ gap: 12, padding: "13px 15px", borderRadius: 15, background: "var(--m-tint-green)" }}>
              <FileArchive width={20} height={20} style={{ color: "var(--figure-accent)", flex: "none" }} aria-hidden />
              <div className="vstack grow" style={{ gap: 2, minWidth: 0 }}>
                <span className="t-h2" style={{ fontSize: 14, overflowWrap: "anywhere" }}>{exp.file.filename}</span>
                <span className="t-cap" style={{ fontSize: 12 }}>
                  Prepared {time(exp.file.preparedAt)} · {formatBytes(exp.file.bytes)}
                </span>
              </div>
            </div>
            <div className="hstack" style={{ gap: 10, flexWrap: "wrap" }}>
              <button type="button" className="xbtn xbtn-f" onClick={() => download(exp.file)}>
                <Download width={16} height={16} aria-hidden />
                Download
              </button>
              <button type="button" className="chip" onClick={() => void startExport()}>
                Request a new one
              </button>
            </div>
          </div>
        )}

        {exp.kind === "error" && (
          <span className="t-cap" role="alert" style={{ color: "var(--text-red)" }}>
            Couldn’t prepare your export. Please try again.
          </span>
        )}
      </div>

      {summary?.isAdmin && (
        <button type="button" className="dlrow" onClick={() => router.push("/admin")}>
          <Shield width={19} height={19} style={{ color: "var(--figure-accent)", flex: "none" }} aria-hidden />
          <div className="vstack grow" style={{ gap: 2 }}>
            <span className="t-h2" style={{ fontSize: 14.5 }}>Admin console</span>
            <span className="t-cap" style={{ fontSize: 12 }}>Users, plans, flags and providers</span>
          </div>
          <ChevronRight width={17} height={17} style={{ color: "var(--m-ink-soft)" }} aria-hidden />
        </button>
      )}

      <button
        type="button"
        className="dlrow"
        onClick={async () => {
          await signOut();
          router.replace("/");
        }}
      >
        <LogOut width={19} height={19} style={{ color: "var(--m-ink-soft)", flex: "none" }} aria-hidden />
        <div className="vstack grow" style={{ gap: 2 }}>
          <span className="t-h2" style={{ fontSize: 14.5 }}>Sign out</span>
          <span className="t-cap" style={{ fontSize: 12 }}>On this browser</span>
        </div>
      </button>

      {/* Delete — a quiet row under a divider, at the very bottom. */}
      <div style={{ marginTop: 18, paddingTop: 14, borderTop: "1px solid var(--m-ink-faint)" }}>
        <button type="button" className="dlrow" onClick={() => setDeleting(true)} disabled={summary == null}>
          <Trash2 width={19} height={19} style={{ color: "var(--m-ink-soft)", flex: "none" }} aria-hidden />
          <div className="vstack grow" style={{ gap: 2 }}>
            <span className="t-h2" style={{ fontSize: 14.5 }}>Delete account</span>
            <span className="t-cap" style={{ fontSize: 12 }}>Permanently removes your account and everything in it</span>
          </div>
          <ChevronRight width={17} height={17} style={{ color: "var(--m-ink-soft)" }} aria-hidden />
        </button>
      </div>

      {deleting && (
        <DeleteAccountFlow
          summary={summary}
          onClose={() => setDeleting(false)}
          onExport={() => {
            setDeleting(false);
            void startExport();
          }}
        />
      )}

      {showUpgrade && (
        <UpgradeDialog
          onClose={() => setShowUpgrade(false)}
          onProActivated={() => {
            setShowUpgrade(false);
            void load();
          }}
          onBYOKSave={(p, k) => {
            saveBYOK(p, k);
            setShowUpgrade(false);
          }}
        />
      )}
    </div>
  );
}
