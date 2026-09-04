"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { isNative, initDeepLinks, registerNativePush } from "@/lib/native-bridge";

/**
 * Mounted once in the /m shell. On the Capacitor native runtime it wires
 * deep-link returns (OAuth bounces) into client navigation and registers the
 * device for push. No-op in the browser PWA — every call feature-detects first.
 */
export default function NativeInit() {
  const router = useRouter();

  useEffect(() => {
    if (!isNative()) return;
    let cleanup = () => {};
    let cancelled = false;

    initDeepLinks((path) => router.replace(path)).then((fn) => {
      if (cancelled) fn();
      else cleanup = fn;
    });

    // Best-effort push registration; the token is persisted server-side.
    void registerNativePush();

    return () => {
      cancelled = true;
      cleanup();
    };
  }, [router]);

  return null;
}
