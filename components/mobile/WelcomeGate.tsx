"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useUser } from "@/app/context/UserContext";
import { BoBowl, Carrot, Tomato, Mushroom, Broccoli } from "@/components/mascots";

/**
 * The other half of onboarding's 6b hand-off loader.
 *
 * Google sign-in from /m/onboarding is a full navigation away (web) or a
 * system-browser round trip (native) — nothing in the onboarding component
 * tree is still mounted when the user lands back in the app, so the loader
 * has to live where they actually arrive: here, wrapping the /m shell.
 *
 * Gated on `?welcome=1` (set by onboarding's signInGoogle) AND UserContext's
 * `syncing` flag, which is real — it tracks the actual pull of remote meal
 * logs/goals in UserContext's syncTracker, not a fixed timer. A floor and a
 * ceiling keep it from flashing for 10ms or hanging if sync silently stalls.
 */
function Gate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const params = useSearchParams();
  const { hydrated, syncing } = useUser();
  const wanted = params?.get("welcome") === "1";

  const [minElapsed, setMinElapsed] = useState(!wanted);
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (!wanted) return;
    const floor = setTimeout(() => setMinElapsed(true), 900);
    const ceiling = setTimeout(() => setTimedOut(true), 6000);
    return () => { clearTimeout(floor); clearTimeout(ceiling); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const visible = wanted && !timedOut && (!minElapsed || !hydrated || syncing);

  useEffect(() => {
    if (wanted && !visible) router.replace("/m");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  if (!visible) return <>{children}</>;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 50, background: "var(--m-cream)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 34px", gap: 14 }}>
      <div style={{ textAlign: "center", display: "flex", flexDirection: "column", gap: 8, animation: "mm-fadeup .8s ease-out both" }}>
        <span className="t-d2">Setting the table&hellip;</span>
        <span className="t-body-soft">Bo is briefing the kitchen.</span>
      </div>
      <div style={{ display: "flex", gap: 16, alignItems: "flex-end", height: 84, marginTop: 18 }}>
        <Carrot width={52} height={52} className="mm-move-bounce" />
        <Tomato width={52} height={52} className="mm-move-bounce" style={{ animationDelay: ".15s" }} />
        <BoBowl width={64} height={64} className="mm-move-bounce" style={{ animationDelay: ".3s" }} />
        <Mushroom width={52} height={52} className="mm-move-bounce" style={{ animationDelay: ".45s" }} />
        <Broccoli width={52} height={52} className="mm-move-bounce" style={{ animationDelay: ".6s" }} />
      </div>
      <div style={{ width: "100%", maxWidth: 250, marginTop: 22 }}>
        <div className="progress progress-lime">
          <i style={{ animation: "mm-fill 3.2s ease-in-out infinite alternate" }} />
        </div>
      </div>
    </div>
  );
}

export default function WelcomeGate({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<>{children}</>}>
      <Gate>{children}</Gate>
    </Suspense>
  );
}
