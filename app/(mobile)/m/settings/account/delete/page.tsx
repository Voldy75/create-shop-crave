"use client";

/**
 * /m/settings/account/delete — F10 10c (confirm) + 10d (in progress).
 *
 * DEVIATION FROM THE BOARD (decided 2026-10-03): 10c confirms by signing in
 * with Google again. Native Google sign-in has never run end-to-end — the
 * Supabase redirect URL is still a pending blocker — so that would have made
 * deletion the least-tested path in the app. Mobile confirms by typing DELETE,
 * exactly like web, and the server enforces it. Switch to re-auth once native
 * OAuth is verified on a device.
 *
 * The rows and the three real phases come from lib/account-client, shared
 * with web, so the two platforms describe and perform deletion identically.
 */

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  BellOff,
  BookmarkX,
  Check,
  CreditCard,
  LogOut,
  MessageSquareX,
  Plug,
  Salad,
  Target,
  Utensils,
} from "lucide-react";
import { useUser } from "@/app/context/UserContext";
import {
  type AccountSummary,
  type DeletionPhase,
  type DeletionRow,
  buildDeletionRows,
  deletionErrorCopy,
  deviceCounts,
  fetchAccountSummary,
  runDeletion,
} from "@/lib/account-client";

const ICON: Record<DeletionRow["key"], React.ElementType> = {
  billing: CreditCard,
  recipes: BookmarkX,
  logs: Utensils,
  goals: Target,
  prefs: Salad,
  chats: MessageSquareX,
  notif: BellOff,
  store: Plug,
  signout: LogOut,
};

const shell: React.CSSProperties = {
  minHeight: "100dvh",
  background: "var(--m-cream)",
  padding: "calc(env(safe-area-inset-top, 12px) + 10px) 20px calc(env(safe-area-inset-bottom, 0px) + 24px)",
  gap: 14,
};

export default function MobileDeletePage() {
  return (
    <Suspense fallback={null}>
      <DeleteInner />
    </Suspense>
  );
}

function DeleteInner() {
  const router = useRouter();
  const params = useSearchParams();
  const acknowledged = params?.get("ack") === "1";
  const { user, hydrated, signOut } = useUser();
  const [summary, setSummary] = useState<AccountSummary | null>(null);
  const [typed, setTyped] = useState("");
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState<Set<DeletionPhase>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const counts = useMemo(() => deviceCounts(), []);

  useEffect(() => {
    if (hydrated && !user && !running) router.replace("/m/profile");
  }, [hydrated, user, running, router]);

  useEffect(() => {
    let alive = true;
    fetchAccountSummary().then((s) => {
      if (!alive) return;
      setSummary(s);
      // An active pass must go through the blocked step first. The server
      // enforces this too (409); this just avoids a pointless round trip.
      if (s?.pass && !acknowledged) router.replace("/m/settings/account");
    });
    return () => {
      alive = false;
    };
  }, [acknowledged, router]);

  const rows = useMemo(() => buildDeletionRows(summary, counts), [summary, counts]);
  const armed = typed.trim() === "DELETE";

  const run = async () => {
    setRunning(true);
    setError(null);
    setDone(new Set());
    const result = await runDeletion(acknowledged, signOut, (phases) => setDone(new Set(phases)));
    if (!result.ok) {
      if (result.error === "pass_active") {
        router.replace("/m/settings/account");
        return;
      }
      setRunning(false);
      setError(deletionErrorCopy(result.error));
      return;
    }
    router.replace("/m/account-deleted");
  };

  // ── 10d · In progress ──
  if (running) {
    const all = buildDeletionRows(summary, counts, { includeSignOut: true });
    return (
      <div className="vstack" style={{ ...shell, justifyContent: "center" }} role="dialog" aria-modal="true" aria-labelledby="m-del-progress">
        <div className="vstack" style={{ gap: 6 }}>
          <span className="t-h1" id="m-del-progress">Deleting your account</span>
          <span className="t-body-soft">A few seconds. Keep the app open until it finishes.</span>
        </div>
        <ul className="card vstack" aria-live="polite" style={{ gap: 14, padding: "18px 18px", listStyle: "none", margin: 0 }}>
          {all.map((row) => {
            const isDone = done.has(row.phase);
            return (
              <li key={row.key} className={`dlstep${isDone ? " is-done" : ""}`}>
                <span style={{ width: 26, display: "inline-flex", justifyContent: "center", flex: "none" }}>
                  <span className="dlsp" aria-hidden />
                  <span className="dltick" aria-hidden>
                    <Check width={13} height={13} />
                  </span>
                </span>
                <span className="t-h2">
                  {row.label}
                  <span className="sr-only">{isDone ? " — done" : " — in progress"}</span>
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    );
  }

  // ── 10c · Confirm ──
  return (
    <div className="vstack" style={shell}>
      <div className="hstack">
        <button className="icon-btn" onClick={() => router.back()} aria-label="Back">
          <ArrowLeft width={20} height={20} />
        </button>
        <span className="t-h1 grow" style={{ marginLeft: 10 }}>Delete account</span>
      </div>

      <div className="hstack" style={{ gap: 12, alignItems: "flex-start" }}>
        <span className="dlwarn" aria-hidden>
          <AlertTriangle width={20} height={20} />
        </span>
        <div className="vstack grow" style={{ gap: 4 }}>
          <span className="t-h1">This permanently deletes</span>
          <span className="t-body">
            Right away. <b>It cannot be undone</b> and nothing can be restored.
          </span>
        </div>
      </div>

      <ul className="vstack" style={{ gap: 12, listStyle: "none", margin: 0, padding: 0 }}>
        {rows.map(({ key, label, sub }) => {
          const Icon = ICON[key];
          return (
            <li key={key} className="hstack" style={{ gap: 12, alignItems: "flex-start" }}>
              <Icon width={18} height={18} style={{ color: "var(--m-ink-soft)", flex: "none", marginTop: 2 }} aria-hidden />
              <div className="vstack grow" style={{ gap: 1 }}>
                <span className="t-h2">{label}</span>
                {sub && <span className="t-cap">{sub}</span>}
              </div>
            </li>
          );
        })}
      </ul>

      <span className="t-cap" style={{ padding: "10px 12px", borderRadius: 12, background: "var(--m-cream-2)" }}>
        Saved recipes, preferences and chat history live on this device and are cleared here. Other phones or
        browsers keep their own copy until you sign out there.
      </span>

      {error && (
        <span className="t-cap" role="alert" style={{ color: "var(--text-red)", padding: "10px 12px", borderRadius: 12, background: "color-mix(in srgb, var(--m-red) 10%, var(--m-card))" }}>
          {error}
        </span>
      )}

      <div className="grow" />

      <div className="vstack" style={{ gap: 8 }}>
        <label className="t-h2" htmlFor="m-del-confirm">
          Type <span style={{ color: "var(--text-red)", letterSpacing: ".08em" }}>DELETE</span> to confirm
        </label>
        <input
          id="m-del-confirm"
          className={`dlin${armed ? " is-armed" : ""}`}
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          placeholder="DELETE"
          autoComplete="off"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
        />
      </div>
      <button type="button" className="dlred dlgo" disabled={!armed || summary == null} onClick={() => void run()}>
        <AlertTriangle width={17} height={17} aria-hidden />
        Delete account
      </button>
      <button type="button" className="chip" style={{ alignSelf: "center" }} onClick={() => router.back()}>
        Cancel
      </button>
    </div>
  );
}
