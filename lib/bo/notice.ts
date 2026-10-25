/**
 * The DPDP notice Bo shows before it stores anything server-side. One copy,
 * read by the server (version check) and by both trees' consent card, so the
 * text a user agrees to and the version recorded against it cannot drift.
 *
 * CHANGING THE TEXT: bump BO_NOTICE_VERSION. Existing profiles then read as
 * `stale` and the user is asked again; profile writes are refused until they
 * re-consent (lib/bo/food-profile.ts updateFoodProfile).
 *
 * Plain language, itemised, says what / why / how long / how to withdraw — the
 * notice contents DPDP Rules 2025 ask for. Final wording still needs legal
 * sign-off before the bo_agent flag goes on in production.
 */

export const BO_NOTICE_VERSION = "2026-10-25";

export interface NoticeItem {
  title: string;
  body: string;
}

export const BO_NOTICE: NoticeItem[] = [
  {
    title: "What Bo saves",
    body: "Your diet, allergies, tastes and goal, how many you cook for, your budget, your Swiggy delivery address choice, and quiet hours. Plus what you ask Bo to do and what it did — searches, carts, orders and bookings you approved.",
  },
  {
    title: "Why",
    body: "So Bo can plan meals, fill carts and find tables for you on any device, without asking the same questions every time. Nothing is used for ads or to train AI models.",
  },
  {
    title: "How long",
    body: "Your food profile stays until you turn this off. What you asked Bo to do is deleted after 90 days. Everything goes when you delete your account.",
  },
  {
    title: "Your choice",
    body: "Turn it off any time here — your profile and Bo's history are deleted straight away. Bo keeps working without it, using the preferences on this device. You can download a copy of everything from Settings at any time.",
  },
  {
    title: "Swiggy",
    body: "Orders, payments and bookings happen on Swiggy. Bo never sees your card or UPI details; your Swiggy order history stays with Swiggy.",
  },
];

/** Where to send questions or complaints about personal data. Must be set before production. */
export const GRIEVANCE_EMAIL = process.env.NEXT_PUBLIC_GRIEVANCE_EMAIL ?? "";
