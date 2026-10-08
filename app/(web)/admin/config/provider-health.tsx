export interface ProvidersBlock {
  razorpay: { secretPresent: boolean; keyIdPresent: boolean };
  stripe: { secretPresent: boolean; webhookSecretPresent: boolean; priceIdPresent: boolean };
  gemini: { keyPresent: boolean };
  maps: { keyPresent: boolean };
  firebase: { serviceAccountPresent: boolean };
  twilio: { authTokenPresent: boolean };
}

/**
 * w12f's Health card. Read-only: only whether each env var is set — there is
 * deliberately no path that reads or writes a value. The list is the keys the
 * server actually reads, not the board's illustrative set.
 */
export function healthChecks(p: ProvidersBlock) {
  return [
    { envVar: "GOOGLE_GENERATIVE_AI_API_KEY", present: p.gemini.keyPresent },
    { envVar: "RAZORPAY_KEY_ID", present: p.razorpay.keyIdPresent },
    { envVar: "RAZORPAY_KEY_SECRET", present: p.razorpay.secretPresent },
    { envVar: "STRIPE_SECRET_KEY", present: p.stripe.secretPresent },
    { envVar: "STRIPE_WEBHOOK_SECRET", present: p.stripe.webhookSecretPresent },
    { envVar: "STRIPE_PRO_PRICE_ID", present: p.stripe.priceIdPresent },
    { envVar: "GOOGLE_MAPS_API_KEY", present: p.maps.keyPresent },
    { envVar: "FIREBASE_SERVICE_ACCOUNT", present: p.firebase.serviceAccountPresent },
    { envVar: "TWILIO_AUTH_TOKEN", present: p.twilio.authTokenPresent },
  ];
}

export function ProviderHealth({ providers }: { providers: ProvidersBlock }) {
  return (
    <ul className="vstack" style={{ gap: 0, listStyle: "none", margin: 0, padding: 0 }}>
      {healthChecks(providers).map((c) => (
        <li
          key={c.envVar}
          className="hstack"
          style={{ gap: 8, padding: "7px 14px", borderBottom: "1px solid color-mix(in srgb, var(--m-ink) 6%, transparent)" }}
        >
          <span className="ad-dot" style={{ background: c.present ? "var(--m-forest)" : "var(--m-red)" }} aria-hidden />
          <span className="ad-mono grow" style={{ fontSize: 11.5 }}>{c.envVar}</span>
          <span className={`ad-pill ${c.present ? "ad-ok" : "ad-bad"}`}>{c.present ? "Set" : "Missing"}</span>
        </li>
      ))}
    </ul>
  );
}
