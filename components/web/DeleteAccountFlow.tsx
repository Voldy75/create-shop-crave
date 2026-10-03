"use client";

/**
 * Account deletion — web, built to WF11 (w11b blocked, w11c confirm,
 * w11d in progress; w11e is app/(web)/account-deleted).
 *
 * WHAT IS REAL HERE, because a deletion screen is the worst place to imply
 * something that did not happen:
 *   - The counts on the confirm list are this device's real numbers.
 *   - The in-progress rows tick when the work they name has ACTUALLY finished,
 *     in three real phases: the server request (account + everything the
 *     database cascades), the local wipe (this browser's saved recipes,
 *     preferences and Bo threads), and signing out. Rows in the same phase
 *     tick together because they finish together — nothing is animated on a
 *     timer to look sequential.
 *   - The paid-entitlement step says the right thing per provider. Razorpay is
 *     a one-time 31-day pass (days are forfeited); Stripe is a monthly
 *     subscription, which deletion CANCELS first — and if that cancel fails,
 *     the server deletes nothing and this screen says so.
 *
 * Confirmation is typed DELETE, enforced again on the server.
 */

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  BookmarkX,
  Check,
  CreditCard,
  Download,
  LogOut,
  MessageSquareX,
  Plug,
  Salad,
  Target,
  Utensils,
  BellOff,
} from "lucide-react";
import { useUser } from "@/app/context/UserContext";
import {
  type AccountSummary,
  clearLocalAccountData,
  deleteAccountRequest,
  deviceCounts,
  formatDate,
} from "@/lib/account-client";
import { BoBowl } from "@/components/mascots";

type Phase = "blocked" | "confirm" | "progress" | "error";
type StepPhase = "server" | "local" | "signout";

interface Row {
  key: string;
  label: string;
  sub?: string;
  icon: React.ElementType;
  phase: StepPhase;
}

export function DeleteAccountFlow({
  summary,
  onClose,
  onExport,
}: {
  summary: AccountSummary | null;
  onClose: () => void;
  onExport: () => void;
}) {
  const router = useRouter();
  const { signOut } = useUser();
  const pass = summary?.pass ?? null;
  const [phase, setPhase] = useState<Phase>(pass ? "blocked" : "confirm");
  const [ack, setAck] = useState(false);
  const [typed, setTyped] = useState("");
  const [done, setDone] = useState<Set<StepPhase>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const counts = useMemo(() => deviceCounts(), []);

  const armed = typed.trim() === "DELETE";

  const rows: Row[] = useMemo(() => {
    const r: Row[] = [];
    if (pass?.recurring) {
      r.push({ key: "billing", label: "meshi+ subscription", sub: "Cancelled — you won’t be charged again", icon: CreditCard, phase: "server" });
    }
    r.push(
      {
        key: "recipes",
        label: "Saved recipes",
        sub:
          `${counts.savedRecipes} saved in this browser` +
          (counts.savedPlaces ? ` · ${counts.savedPlaces} saved place${counts.savedPlaces === 1 ? "" : "s"}` : ""),
        icon: BookmarkX,
        phase: "local",
      },
      {
        key: "logs",
        label: "Meal logs and streak",
        sub:
          `${Math.max(counts.mealLogs, summary?.serverMealLogs ?? 0)} logged meals` +
          (counts.streak > 0 ? ` · your ${counts.streak}-day streak ends` : ""),
        icon: Utensils,
        phase: "server",
      },
      { key: "goals", label: "Nutrition goals", sub: "Calorie target and weight goal", icon: Target, phase: "server" },
      { key: "prefs", label: "Dietary preferences", sub: "Diet, allergies and cuisine tastes", icon: Salad, phase: "local" },
      { key: "chats", label: "Bo conversations", sub: "Chat history kept in this browser", icon: MessageSquareX, phase: "local" },
      { key: "notif", label: "Notification subscriptions", sub: "Web push and WhatsApp nudges stop", icon: BellOff, phase: "server" }
    );
    if ((summary?.storeConnections ?? 0) > 0) {
      r.push({
        key: "store",
        label: "Connected store account",
        sub: "Swiggy is disconnected from meshi. Your Swiggy account itself is not touched.",
        icon: Plug,
        phase: "server",
      });
    }
    return r;
  }, [counts, pass, summary]);

  const runDelete = async () => {
    setPhase("progress");
    setDone(new Set());
    setError(null);

    const result = await deleteAccountRequest(!!pass);
    if (!result.ok) {
      if (result.error === "pass_active") {
        setPhase("blocked");
        return;
      }
      setError(
        result.error === "billing_not_stopped"
          ? "We couldn’t cancel your meshi+ subscription, so nothing was deleted and you are still subscribed. Please try again in a minute."
          : result.error === "network"
            ? "Couldn’t reach meshi. Nothing was confirmed as deleted — check your connection and try again."
            : "Something went wrong and your account was not fully deleted. Please try again."
      );
      setPhase("error");
      return;
    }
    setDone(new Set<StepPhase>(["server"]));

    clearLocalAccountData();
    setDone(new Set<StepPhase>(["server", "local"]));

    try {
      await signOut();
    } catch {
      // The auth user no longer exists, so the server may refuse the sign-out
      // call. The local session is what matters, and the wipe above already
      // removed this browser's data; carry on to the signed-out landing.
    }
    setDone(new Set<StepPhase>(["server", "local", "signout"]));
    router.replace("/account-deleted");
  };

  // ── In progress (w11d): full-screen, no way to wander off mid-delete ──
  if (phase === "progress") {
    const signRow: Row = { key: "signout", label: "Signing you out", icon: LogOut, phase: "signout" };
    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="del-progress-title"
        style={{ position: "fixed", inset: 0, zIndex: 70, background: "var(--m-cream)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
      >
        <div className="card" style={{ width: 520, maxWidth: "100%", padding: "28px 30px", display: "flex", flexDirection: "column", gap: 20 }}>
          <div className="vstack" style={{ gap: 6 }}>
            <span className="t-d2" id="del-progress-title" style={{ fontSize: 22 }}>Deleting your account</span>
            <span className="t-body-soft">This takes a few seconds. Please keep this tab open until it finishes.</span>
          </div>
          <ul className="vstack" aria-live="polite" style={{ gap: 12, listStyle: "none", margin: 0, padding: 0 }}>
            {[...rows, signRow].map((row) => {
              const isDone = done.has(row.phase);
              return (
                <li key={row.key} className={`dlstep${isDone ? " is-done" : ""}`}>
                  <span style={{ width: 26, display: "inline-flex", justifyContent: "center", flex: "none" }}>
                    <span className="dlsp" aria-hidden />
                    <span className="dltick" aria-hidden>
                      <Check width={13} height={13} />
                    </span>
                  </span>
                  <span className="t-h2" style={{ fontSize: 14.5 }}>
                    {row.label}
                    <span className="sr-only">{isDone ? " — done" : " — in progress"}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    );
  }

  return (
    <div className="dlscrim" onClick={onClose}>
      <div
        className="card dlpanel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="del-title"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.key === "Escape" && onClose()}
      >
        {phase === "blocked" && pass && (
          <>
            <div className="hstack" style={{ gap: 14 }}>
              <span className="tint-lav" style={{ width: 48, height: 48, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
                <BoBowl width={30} height={30} aria-hidden />
              </span>
              <div className="vstack grow" style={{ gap: 3 }}>
                <span className="t-d2" id="del-title" style={{ fontSize: 21 }}>
                  {pass.recurring
                    ? "You have an active meshi+ subscription"
                    : `You have ${pass.daysLeft ?? 0} day${pass.daysLeft === 1 ? "" : "s"} of meshi+ left`}
                </span>
                <span className="t-cap">
                  {pass.recurring
                    ? `Monthly · renews ${formatDate(pass.endsAt)}`
                    : `31-day pass · ends ${formatDate(pass.endsAt)}`}
                </span>
              </div>
            </div>
            <span className="t-body">
              {pass.recurring
                ? "Deleting your account cancels this subscription right away, so you won’t be charged again. The rest of the current billing period is forfeited."
                : `Your pass was a one-time purchase. Deleting your account ends it immediately — the remaining ${pass.daysLeft ?? 0} days are forfeited and can’t be moved to another account.`}
            </span>
            <button type="button" className={`dlack${ack ? " is-on" : ""}`} aria-pressed={ack} onClick={() => setAck(!ack)}>
              <span className="dlbox" aria-hidden>
                <Check width={14} height={14} />
              </span>
              <span className="t-body">
                {pass.recurring
                  ? "I understand my subscription will be cancelled and I’ll lose the rest of this period."
                  : `I understand I’ll lose the remaining ${pass.daysLeft ?? 0} days of my pass.`}
              </span>
            </button>
            <div className="hstack" style={{ gap: 12, flexWrap: "wrap" }}>
              <button type="button" className="xbtn xbtn-f" onClick={onClose} autoFocus>
                Keep my account
              </button>
              <button type="button" className="chip dlgo" disabled={!ack} onClick={() => setPhase("confirm")}>
                Continue to delete
              </button>
              <div className="grow" />
              <button type="button" className="wlink" style={{ background: "none", border: "none", cursor: "pointer" }} onClick={onExport}>
                Download your data first
              </button>
            </div>
          </>
        )}

        {phase === "confirm" && (
          <>
            <div className="hstack" style={{ gap: 14 }}>
              <span className="dlwarn" aria-hidden>
                <AlertTriangle width={22} height={22} />
              </span>
              <div className="vstack grow" style={{ gap: 3 }}>
                <span className="t-d2" id="del-title" style={{ fontSize: 21 }}>Delete your account permanently</span>
                <span className="t-cap">{summary?.email}</span>
              </div>
            </div>
            <span className="t-body">
              This deletes the following right away. <b>It cannot be undone</b> — there is no recovery period and
              nothing can be restored later.
            </span>
            <ul className="vstack" style={{ gap: 12, listStyle: "none", margin: 0, padding: 0 }}>
              {rows.map(({ key, label, sub, icon: Icon }) => (
                <li key={key} className="hstack" style={{ gap: 12, alignItems: "flex-start" }}>
                  <Icon width={18} height={18} style={{ color: "var(--m-ink-soft)", flex: "none", marginTop: 2 }} aria-hidden />
                  <div className="vstack grow" style={{ gap: 1 }}>
                    <span className="t-h2" style={{ fontSize: 14.5 }}>{label}</span>
                    {sub && <span className="t-cap">{sub}</span>}
                  </div>
                </li>
              ))}
            </ul>
            {/* Device-local data: say what this can and cannot reach. */}
            <span className="t-cap" style={{ padding: "10px 12px", borderRadius: 12, background: "var(--m-cream-2)" }}>
              Saved recipes, preferences and chat history live in this browser and are cleared here. Other browsers
              or phones keep their own copy until you sign out there.
            </span>
            <button type="button" className="wlink" style={{ background: "none", border: "none", cursor: "pointer", alignSelf: "flex-start" }} onClick={onExport}>
              <Download width={15} height={15} aria-hidden />
              Download a copy of your data first
            </button>
            <div className="vstack" style={{ gap: 8 }}>
              <label className="t-h2" htmlFor="del-confirm" style={{ fontSize: 14.5 }}>
                Type <span style={{ color: "var(--text-red)", letterSpacing: ".08em" }}>DELETE</span> to confirm
              </label>
              <input
                id="del-confirm"
                className={`dlin${armed ? " is-armed" : ""}`}
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && armed && void runDelete()}
                placeholder="DELETE"
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                autoFocus
              />
            </div>
            <div className="hstack" style={{ gap: 14, alignItems: "center" }}>
              <div className="grow" />
              <button type="button" className="wlink" style={{ background: "none", border: "none", cursor: "pointer" }} onClick={onClose}>
                Cancel
              </button>
              <button type="button" className="dlred dlgo" disabled={!armed} onClick={() => void runDelete()}>
                <AlertTriangle width={16} height={16} aria-hidden />
                Delete account
              </button>
            </div>
          </>
        )}

        {phase === "error" && (
          <>
            <div className="hstack" style={{ gap: 14 }}>
              <span className="dlwarn" aria-hidden>
                <AlertTriangle width={22} height={22} />
              </span>
              <span className="t-d2" id="del-title" style={{ fontSize: 21 }}>Your account wasn’t deleted</span>
            </div>
            <span className="t-body" role="alert">{error}</span>
            <div className="hstack" style={{ gap: 12 }}>
              <div className="grow" />
              <button type="button" className="wlink" style={{ background: "none", border: "none", cursor: "pointer" }} onClick={onClose}>
                Close
              </button>
              <button type="button" className="xbtn xbtn-f" onClick={() => setPhase("confirm")}>
                Try again
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
