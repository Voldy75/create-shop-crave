"use client";

/**
 * Which way this device can pay by UPI. Swiggy's own widget detects this, but
 * Bo doesn't use the widget and Swiggy says never to ask the user, so the
 * client reports it with each turn:
 *   phone    UPI apps are installed here, so a Pay link can open one.
 *   desktop  They aren't (computers and tablets), so UPI means scanning a QR.
 * It only picks the payment path offered; it decides nothing about money.
 */

import { isNative } from "@/lib/native-bridge";
import type { BoDevice } from "@/lib/bo/prompt";

export function boDevice(): BoDevice | null {
  if (typeof navigator === "undefined") return null;
  if (isNative()) return "phone";
  const hint = (navigator as Navigator & { userAgentData?: { mobile?: boolean } }).userAgentData?.mobile;
  if (typeof hint === "boolean") return hint ? "phone" : "desktop";
  return /iPhone|iPod|Android.+Mobile/i.test(navigator.userAgent) ? "phone" : "desktop";
}
