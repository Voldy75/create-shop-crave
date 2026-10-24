"use client";

/**
 * "Let Bo remember you" — the DPDP consent card for Bo's server-side food
 * profile. Shown at the top of Preferences on web (Settings → Preferences) and
 * mobile (/m/settings/preferences); the same component in both, so the notice
 * a user agrees to is word-for-word the same everywhere.
 *
 * Renders NOTHING unless the bo_agent flag is on and the user is signed in
 * (lib/bo/consent-client: flag off = the API 404s = state "off").
 *
 * CONSENT RULES THIS CARD KEEPS (DPDP Act 2023, Rules 2025):
 *   - itemised notice shown BEFORE the choice, not behind a link;
 *   - no pre-ticked boxes: the 18+ confirmation starts unticked and the
 *     button stays disabled until it is ticked;
 *   - declining is free — "Not now" is the default, and Bo keeps working
 *     from this device's preferences;
 *   - withdrawing is as easy as agreeing: one button, one confirmation, and
 *     the profile + Bo's history are deleted in that request;
 *   - nudges are a separate, optional purpose with their own switch.
 *
 * Only meshi-b classes (.card, .pill-*, .chip, .badge-*, .t-*) — both root
 * layouts load meshi-b; meshi-app's .xsw toggle exists on web only.
 */

import { useEffect, useId, useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { BoBowl } from "@/components/mascots";
import { BO_NOTICE, GRIEVANCE_EMAIL } from "@/lib/bo/notice";
import {
  grantBoConsent,
  loadBoConsent,
  setBoNudges,
  useBoConsent,
  withdrawBoConsent,
} from "@/lib/bo/consent-client";

const ERRORS: Record<string, string> = {
  age_confirmation_required: "Please confirm you are 18 or older.",
  notice_changed: "This notice was just updated — please read it again.",
  consent_required: "Turn on Bo’s memory first.",
  network: "You seem to be offline. Try again.",
};
const errorText = (code: string) => ERRORS[code] ?? "Something went wrong. Please try again.";

export function BoMemoryCard() {
  const state = useBoConsent();
  const [busy, setBusy] = useState<null | "grant" | "withdraw" | "nudges">(null);
  const [error, setError] = useState<string | null>(null);
  const [ageOk, setAgeOk] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [announce, setAnnounce] = useState("");
  const ageId = useId();
  const noticeId = useId();

  useEffect(() => {
    void loadBoConsent();
  }, []);

  if (state.status === "error") {
    return (
      <div className="card hstack" style={{ padding: 16, gap: 12, boxShadow: "none" }} role="status">
        <span className="t-cap grow">Couldn’t load Bo’s memory settings.</span>
        <button type="button" className="chip" onClick={() => void loadBoConsent(true)}>
          Try again
        </button>
      </div>
    );
  }
  if (state.status !== "ready") return null;

  const { consent } = state;
  const on = consent.profile && !consent.stale;

  const run = async (kind: "grant" | "withdraw" | "nudges", fn: () => Promise<{ ok: boolean; error?: string }>, done: string) => {
    setBusy(kind);
    setError(null);
    const r = await fn();
    setBusy(null);
    if (r.ok) setAnnounce(done);
    else setError(errorText(r.error ?? ""));
  };

  const withdraw = () =>
    void run("withdraw", withdrawBoConsent, "Bo’s memory is off and your profile was deleted.").then(() =>
      setConfirmDelete(false)
    );

  if (on) {
    return (
      <section className="card vstack" style={{ padding: "20px 22px", gap: 14 }} aria-labelledby={`${noticeId}-on`}>
        <div className="hstack" style={{ gap: 12 }}>
          <span className="icon-btn tint-green" style={{ boxShadow: "none", color: "var(--figure-accent)", flex: "none" }} aria-hidden>
            <ShieldCheck width={20} height={20} />
          </span>
          <div className="vstack grow" style={{ gap: 2, minWidth: 0 }}>
            <h2 id={`${noticeId}-on`} className="t-h2" style={{ margin: 0 }}>Bo remembers your food profile</h2>
            <span className="t-cap">Saved to your account, so Bo knows you on every device.</span>
          </div>
          <span className="badge badge-forest" style={{ flex: "none" }}>On</span>
        </div>

        <div className="hstack" style={{ gap: 12, flexWrap: "wrap" }}>
          <div className="vstack grow" style={{ gap: 2, minWidth: 180 }}>
            <span className="t-body" style={{ fontWeight: 700 }}>Dinner ideas from Bo</span>
            <span className="t-cap">Optional. Bo may suggest a plan in the evening, outside your quiet hours.</span>
          </div>
          <button
            type="button"
            className={`chip${consent.nudges ? " chip-active" : ""}`}
            aria-pressed={consent.nudges}
            disabled={busy !== null}
            onClick={() =>
              void run("nudges", () => setBoNudges(!consent.nudges), consent.nudges ? "Dinner ideas turned off." : "Dinner ideas turned on.")
            }
          >
            {busy === "nudges" ? <Loader2 width={14} height={14} className="animate-spin" aria-hidden /> : null}
            {consent.nudges ? "On" : "Off"}
          </button>
        </div>

        <WithdrawControls
          confirming={confirmDelete}
          setConfirming={(v) => {
            setError(null);
            setConfirmDelete(v);
          }}
          busy={busy !== null}
          deleting={busy === "withdraw"}
          onWithdraw={withdraw}
        />

        {error && <span className="t-cap" role="alert" style={{ color: "var(--text-red)" }}>{error}</span>}
        <span className="sr-only" role="status" aria-live="polite">{announce}</span>
      </section>
    );
  }

  return (
    <section className="card vstack tint-lav" style={{ padding: "20px 22px", gap: 14 }} aria-labelledby={noticeId}>
      <div className="hstack" style={{ gap: 12 }}>
        <BoBowl width={44} height={44} style={{ flex: "none" }} aria-hidden />
        <div className="vstack grow" style={{ gap: 2, minWidth: 0 }}>
          <h2 id={noticeId} className="t-h2" style={{ margin: 0 }}>
            {consent.stale ? "Bo’s memory: we’ve updated how it works" : "Let Bo remember you"}
          </h2>
          <span className="t-cap">
            {consent.stale
              ? "Please read the notice again. Until you do, Bo won’t update your saved profile."
              : "So Bo can plan, order and book for you on any device. Off unless you turn it on."}
          </span>
        </div>
      </div>

      <dl className="vstack" style={{ gap: 10, margin: 0 }}>
        {BO_NOTICE.map((item) => (
          <div key={item.title} className="vstack" style={{ gap: 2 }}>
            <dt className="t-body" style={{ fontWeight: 700 }}>{item.title}</dt>
            <dd className="t-body-soft" style={{ margin: 0 }}>{item.body}</dd>
          </div>
        ))}
        {GRIEVANCE_EMAIL && (
          <div className="vstack" style={{ gap: 2 }}>
            <dt className="t-body" style={{ fontWeight: 700 }}>Questions or complaints</dt>
            <dd className="t-body-soft" style={{ margin: 0 }}>
              Write to <a href={`mailto:${GRIEVANCE_EMAIL}`} style={{ color: "var(--figure-accent)", fontWeight: 700 }}>{GRIEVANCE_EMAIL}</a>.
            </dd>
          </div>
        )}
      </dl>

      <label htmlFor={ageId} className="hstack" style={{ gap: 10, cursor: "pointer" }}>
        <input
          id={ageId}
          type="checkbox"
          checked={ageOk}
          onChange={(e) => setAgeOk(e.target.checked)}
          style={{ width: 20, height: 20, accentColor: "var(--figure-accent)", flex: "none" }}
        />
        <span className="t-body">I’m 18 or older</span>
      </label>

      <div className="hstack" style={{ gap: 12, flexWrap: "wrap" }}>
        <button
          type="button"
          className="pill-primary pill-sm"
          disabled={!ageOk || busy !== null}
          aria-disabled={!ageOk || busy !== null}
          style={{ opacity: !ageOk ? 0.5 : 1 }}
          onClick={() => void run("grant", () => grantBoConsent(ageOk), "Bo’s memory is on.")}
        >
          {busy === "grant" ? "Turning on…" : consent.stale ? "Agree and keep on" : "Turn on"}
        </button>
        <span className="t-cap">Not now? Bo still works with the preferences on this device.</span>
      </div>

      {consent.stale && (
        <WithdrawControls
          confirming={confirmDelete}
          setConfirming={(v) => {
            setError(null);
            setConfirmDelete(v);
          }}
          busy={busy !== null}
          deleting={busy === "withdraw"}
          onWithdraw={withdraw}
        />
      )}

      {error && <span className="t-cap" role="alert" style={{ color: "var(--text-red)" }}>{error}</span>}
      <span className="sr-only" role="status" aria-live="polite">{announce}</span>
    </section>
  );
}

/** "Turn off" → a one-step confirmation → delete. Same in the on and stale views. */
function WithdrawControls({
  confirming,
  setConfirming,
  busy,
  deleting,
  onWithdraw,
}: {
  confirming: boolean;
  setConfirming: (v: boolean) => void;
  busy: boolean;
  deleting: boolean;
  onWithdraw: () => void;
}) {
  if (!confirming) {
    return (
      <button type="button" className="pill-secondary pill-sm" style={{ alignSelf: "flex-start" }} onClick={() => setConfirming(true)}>
        Turn off Bo’s memory
      </button>
    );
  }
  return (
    <div className="vstack" style={{ gap: 10 }} role="group" aria-label="Confirm turning off Bo’s memory">
      <span className="t-body">
        This deletes your Bo profile and everything Bo did for you, now. Preferences on this device stay.
      </span>
      <div className="hstack" style={{ gap: 10, flexWrap: "wrap" }}>
        {/* Destructive: red label AND ring (pill-secondary's ring is forest, lime in
            dark). --text-red measured 5.8:1 light / 5.3:1 dark on the card. */}
        <button
          type="button"
          className="pill-secondary pill-sm"
          style={{ color: "var(--text-red)", boxShadow: "inset 0 0 0 2.5px var(--text-red)" }}
          disabled={busy}
          onClick={onWithdraw}
        >
          {deleting ? "Deleting…" : "Turn off and delete"}
        </button>
        <button type="button" className="chip" onClick={() => setConfirming(false)} disabled={busy}>
          Keep it
        </button>
      </div>
    </div>
  );
}
