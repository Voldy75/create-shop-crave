import { useEffect, useState } from "react";

export interface FeatureFlag {
  id: string;
  enabled: boolean;
  description: string | null;
  updated_at: string;
}

let cachedFlags: Record<string, boolean> | null = null;
let fetchPromise: Promise<Record<string, boolean>> | null = null;

async function loadFlags(): Promise<Record<string, boolean>> {
  if (cachedFlags) return cachedFlags;
  if (fetchPromise) return fetchPromise;
  // Public, anon-client, RLS-governed read. NOT /api/admin/flags, which is now
  // admin-only for every verb.
  fetchPromise = fetch("/api/flags")
    .then((r) => r.json())
    .then((data) => {
      const map: Record<string, boolean> = {};
      for (const f of data.flags ?? []) map[f.id] = f.enabled;
      cachedFlags = map;
      return map;
    })
    .catch(() => ({}));
  return fetchPromise;
}

export function invalidateFlagCache() {
  cachedFlags = null;
  fetchPromise = null;
}

export function useFeatureFlags(): {
  flags: Record<string, boolean>;
  loading: boolean;
  isEnabled: (id: string) => boolean;
} {
  const [flags, setFlags] = useState<Record<string, boolean>>(cachedFlags ?? {});
  const [loading, setLoading] = useState(!cachedFlags);

  useEffect(() => {
    loadFlags().then((f) => {
      setFlags(f);
      setLoading(false);
    });
  }, []);

  return {
    flags,
    loading,
    isEnabled: (id: string) => flags[id] ?? false,
  };
}

export function useFlag(id: string): boolean {
  const { isEnabled } = useFeatureFlags();
  return isEnabled(id);
}
