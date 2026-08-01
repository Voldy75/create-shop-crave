import { StatusPill } from "@/components/cc/status-pill";

interface ProviderCheck {
  label: string;
  envVar: string;
  present: boolean;
}

export interface ProvidersBlock {
  razorpay: { secretPresent: boolean; keyIdPresent: boolean };
  stripe: { secretPresent: boolean; webhookSecretPresent: boolean; priceIdPresent: boolean };
  gemini: { keyPresent: boolean };
  maps: { keyPresent: boolean };
  firebase: { serviceAccountPresent: boolean };
  twilio: { authTokenPresent: boolean };
}

/**
 * Read-only. Never renders an input for a secret value -- only whether the
 * env var is set. There is deliberately no write path here.
 */
export function ProviderHealth({ providers }: { providers: ProvidersBlock }) {
  const checks: ProviderCheck[] = [
    { label: "Razorpay secret", envVar: "RAZORPAY_KEY_SECRET", present: providers.razorpay.secretPresent },
    { label: "Razorpay key id", envVar: "RAZORPAY_KEY_ID", present: providers.razorpay.keyIdPresent },
    { label: "Stripe secret", envVar: "STRIPE_SECRET_KEY", present: providers.stripe.secretPresent },
    { label: "Stripe webhook secret", envVar: "STRIPE_WEBHOOK_SECRET", present: providers.stripe.webhookSecretPresent },
    { label: "Stripe price id", envVar: "STRIPE_PRO_PRICE_ID", present: providers.stripe.priceIdPresent },
    { label: "Gemini key", envVar: "GOOGLE_GENERATIVE_AI_API_KEY", present: providers.gemini.keyPresent },
    { label: "Google Maps key", envVar: "GOOGLE_MAPS_API_KEY", present: providers.maps.keyPresent },
    { label: "Firebase service account", envVar: "FIREBASE_SERVICE_ACCOUNT", present: providers.firebase.serviceAccountPresent },
    { label: "Twilio auth token", envVar: "TWILIO_AUTH_TOKEN", present: providers.twilio.authTokenPresent },
  ];

  return (
    <div className="space-y-2">
      {checks.map((c) => (
        <div
          key={c.envVar}
          className="flex items-center justify-between p-3 rounded-xl"
          style={{ background: "var(--cc-surface-2)", border: "1px solid var(--cc-border)" }}
        >
          <div>
            <p className="text-sm" style={{ color: "var(--cc-text-primary)" }}>{c.label}</p>
            <code className="text-xs" style={{ color: "var(--cc-text-tertiary)" }}>{c.envVar}</code>
          </div>
          <StatusPill tone={c.present ? "active" : "error"}>
            {c.present ? "Present" : "Missing"}
          </StatusPill>
        </div>
      ))}
      <p className="text-xs pt-1" style={{ color: "var(--cc-text-tertiary)" }}>
        Set missing values in the Vercel dashboard (Project → Settings → Environment Variables). Secrets are never
        read or written here.
      </p>
    </div>
  );
}
