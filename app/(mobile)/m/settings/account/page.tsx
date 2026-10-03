"use client";

/**
 * /m/settings/account — Profile → Account, built to F10 10a (with 10b's
 * blocked step as a bottom sheet over it).
 *
 * Delete is a quiet row at the very bottom, under a divider — never a button.
 *
 * DRAWN BUT NOT BUILT: 10a's "Preferences · Diet, allergies, tastes, goal" row.
 * Mobile has no screen that edits those after onboarding (only the onboarding
 * flow writes them), so the row would be a dead link. Recorded in handoff.md;
 * web has Settings → Preferences (WF10).
 *
 * The blocked sheet says the right thing per provider — a Razorpay pass is a
 * one-time purchase whose days are forfeited; a Stripe subscription is
 * recurring and is CANCELLED by deletion. See lib/account.ts.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, ChevronRight, Download, Sparkles, Trash2 } from "lucide-react";
import { useUser } from "@/app/context/UserContext";
import { BoBowl } from "@/components/mascots";
import { type AccountSummary, fetchAccountSummary, formatDate } from "@/lib/account-client";

const shell: React.CSSProperties = {
  minHeight: "100dvh",
  background: "var(--m-cream)",
  padding: "calc(env(safe-area-inset-top, 12px) + 10px) 20px calc(env(safe-area-inset-bottom, 0px) + 24px)",
  gap: 14,
};

const initials = (name: string, email?: string | null) => {
  const parts = (name || email || "?").trim().split(/[\s@._-]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "?") + (parts[1]?.[0] ?? "")).toUpperCase();
};

export default function MobileAccountPage() {
  const router = useRouter();
  const { user, userName, hydrated } = useUser();
  const [summary, setSummary] = useState<AccountSummary | null>(null);
  const [blocked, setBlocked] = useState(false);
  const [ack, setAck] = useState(false);

  useEffect(() => {
    if (hydrated && !user) router.replace("/m/profile");
  }, [hydrated, user, router]);

  useEffect(() => {
    let alive = true;
    fetchAccountSummary().then((s) => alive && setSummary(s));
    return () => {
      alive = false;
    };
  }, []);

  const pass = summary?.pass ?? null;
  const provider = summary?.signInProvider ? summary.signInProvider.charAt(0).toUpperCase() + summary.signInProvider.slice(1) : null;

  const startDelete = () => {
    if (pass) {
      setAck(false);
      setBlocked(true);
    } else {
      router.push("/m/settings/account/delete");
    }
  };

  return (
    <div className="vstack" style={shell}>
      <div className="hstack">
        <button className="icon-btn" onClick={() => router.back()} aria-label="Back">
          <ArrowLeft width={20} height={20} />
        </button>
        <span className="t-h1 grow" style={{ marginLeft: 10 }}>Account</span>
      </div>

      <div className="hstack" style={{ gap: 14, padding: "6px 2px" }}>
        <span
          aria-hidden
          style={{ width: 52, height: 52, borderRadius: "50%", background: "var(--m-tint-peach)", display: "flex", alignItems: "center", justifyContent: "center", font: "800 19px var(--m-font-display)", color: "var(--text-burnt)" /* 19px bold = large text (3:1); burnt on peach is 3.61, under the 4.5 an 18px label needs */, flex: "none" }}
        >
          {initials(userName, user?.email)}
        </span>
        <div className="vstack grow" style={{ gap: 1, minWidth: 0 }}>
          <span className="t-h1">{userName || user?.email?.split("@")[0] || "You"}</span>
          <span className="t-cap" style={{ overflowWrap: "anywhere" }}>
            {[user?.email, provider].filter(Boolean).join(" · ")}
          </span>
        </div>
      </div>

      <div className="vstack" style={{ gap: 10 }}>
        <button className="row" onClick={() => router.push("/m/paywall")} style={{ width: "100%", textAlign: "left", border: "none" }}>
          <span className="icon-btn tint-lav" style={{ boxShadow: "none", color: "var(--text-plum)", flex: "none" }} aria-hidden>
            <Sparkles width={20} height={20} />
          </span>
          <div className="vstack grow" style={{ gap: 1, minWidth: 0 }}>
            <span className="t-h2">
              {pass ? (pass.recurring ? "meshi+ · monthly" : "meshi+ · 31-day pass") : "Free plan"}
            </span>
            <span className="t-cap">
              {pass
                ? pass.recurring
                  ? `Renews ${formatDate(pass.endsAt)}`
                  : `${pass.daysLeft ?? 0} day${pass.daysLeft === 1 ? "" : "s"} left · ends ${formatDate(pass.endsAt)}`
                : summary == null
                  ? "Loading…"
                  : summary.chatDailyLimit == null
                    ? "Unlimited Bo chats"
                    : `${summary.chatDailyLimit} Bo chat${summary.chatDailyLimit === 1 ? "" : "s"} a day`}
            </span>
          </div>
          <ChevronRight width={18} height={18} style={{ color: "var(--m-ink-soft)", flex: "none" }} aria-hidden />
        </button>

        <button className="row" onClick={() => router.push("/m/settings/data")} style={{ width: "100%", textAlign: "left", border: "none" }}>
          <span className="icon-btn tint-green" style={{ boxShadow: "none", color: "var(--figure-accent)", flex: "none" }} aria-hidden>
            <Download width={20} height={20} />
          </span>
          <div className="vstack grow" style={{ gap: 1, minWidth: 0 }}>
            <span className="t-h2">Download your data</span>
            <span className="t-cap">One ZIP · JSON and CSV</span>
          </div>
          <ChevronRight width={18} height={18} style={{ color: "var(--m-ink-soft)", flex: "none" }} aria-hidden />
        </button>
      </div>

      <div className="grow" />

      <div style={{ paddingTop: 12, borderTop: "1px solid var(--m-ink-faint)" }}>
        <button type="button" className="dlrow" onClick={startDelete} disabled={summary == null}>
          <Trash2 width={19} height={19} style={{ color: "var(--m-ink-soft)", flex: "none" }} aria-hidden />
          <div className="vstack grow" style={{ gap: 2 }}>
            <span className="t-h2">Delete account</span>
            <span className="t-cap">Permanently removes your account and data</span>
          </div>
          <ChevronRight width={17} height={17} style={{ color: "var(--m-ink-soft)" }} aria-hidden />
        </button>
      </div>

      {blocked && pass && (
        <div className="sheet-scrim" onClick={() => setBlocked(false)}>
          <div className="dlsheet" role="dialog" aria-modal="true" aria-labelledby="m-blocked-title" onClick={(e) => e.stopPropagation()}>
            <span className="dlhandle" aria-hidden />
            <div className="hstack" style={{ gap: 12 }}>
              <span className="tint-lav" style={{ width: 44, height: 44, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }} aria-hidden>
                <BoBowl width={28} height={28} />
              </span>
              <div className="vstack grow" style={{ gap: 1 }}>
                <span className="t-h1" id="m-blocked-title">
                  {pass.recurring ? "Active meshi+ subscription" : `${pass.daysLeft ?? 0} days of meshi+ left`}
                </span>
                <span className="t-cap">
                  {pass.recurring ? `Monthly · renews ${formatDate(pass.endsAt)}` : `31-day pass · ends ${formatDate(pass.endsAt)}`}
                </span>
              </div>
            </div>
            <span className="t-body">
              {pass.recurring
                ? "Deleting your account cancels this subscription right away, so you won’t be charged again. The rest of this billing period is forfeited."
                : `Your pass was a one-time purchase. Deleting your account ends it now and the remaining ${pass.daysLeft ?? 0} days are forfeited.`}
            </span>
            <button type="button" className={`dlack${ack ? " is-on" : ""}`} aria-pressed={ack} onClick={() => setAck(!ack)}>
              <span className="dlbox" aria-hidden>
                <Check width={14} height={14} />
              </span>
              <span className="t-body">
                {pass.recurring
                  ? "I understand my subscription will be cancelled."
                  : `I understand I’ll lose the remaining ${pass.daysLeft ?? 0} days.`}
              </span>
            </button>
            <button type="button" className="pill-primary" onClick={() => setBlocked(false)} autoFocus>
              Keep my account
            </button>
            <button
              type="button"
              className="chip dlgo"
              disabled={!ack}
              style={{ alignSelf: "center" }}
              onClick={() => router.push("/m/settings/account/delete?ack=1")}
            >
              Continue to delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
