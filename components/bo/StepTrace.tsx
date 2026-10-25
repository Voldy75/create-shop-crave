"use client";

/**
 * "What Bo did" — the step trace under a Bo reply. Built only from the tool
 * parts already in the message (no extra server data): one plain-language
 * line per Swiggy call, ticked when done, amber when Swiggy pushed back.
 *
 * OPEN WHILE BO WORKS, ONE LINE AFTER. Expanded while the reply is
 * streaming so the user sees the cart being built before the Approval card
 * asks for money; folds to "Bo took 5 steps on Swiggy" once the reply ends or
 * a card is waiting, so the card and follow-up stay on screen on a phone.
 * The user's own toggle wins over both.
 *
 * Approval tools (place order, book) are left out — their card is the step.
 * meshi-b classes only (.card, .t-*) plus tokens: both root layouts load
 * meshi-b and meshi-motion (mm-ring, covered by its reduced-motion rule).
 */

import { useId, useState } from "react";
import { AlertTriangle, Check, ChevronDown } from "lucide-react";
import { serviceForTool, type SwiggyService } from "@/components/SwiggyAttribution";
import { isApprovalPart, type ApprovalPart } from "@/components/bo/ApprovalCard";

type StepState = "running" | "done" | "warn";
export interface Step {
  id: string;
  label: string;
  state: StepState;
  service: SwiggyService | null;
}

const SERVICE_NAME: Record<SwiggyService, string> = { food: "Swiggy", instamart: "Instamart", dineout: "Dineout" };

// [while running, once done] — keyed by the bare Swiggy tool name.
const LABELS: Record<string, [string, string]> = {
  get_addresses: ["Checking your saved addresses", "Checked your saved addresses"],
  your_go_to_items: ["Looking at your go-to orders", "Looked at your go-to orders"],
  search_restaurants: ["Searching restaurants", "Searched restaurants"],
  search_menu: ["Searching menus", "Searched menus"],
  get_restaurant_menu: ["Reading the menu", "Read the menu"],
  update_food_cart: ["Updating your Swiggy cart", "Updated your Swiggy cart"],
  flush_food_cart: ["Clearing your Swiggy cart", "Cleared your Swiggy cart"],
  apply_food_coupon: ["Applying a coupon", "Applied a coupon"],
  get_food_cart: ["Reading your cart", "Read your cart and bill"],
  search_products: ["Searching Instamart", "Searched Instamart"],
  update_cart: ["Updating your Instamart cart", "Updated your Instamart cart"],
  clear_cart: ["Clearing your Instamart cart", "Cleared your Instamart cart"],
  get_cart: ["Reading your cart", "Read your cart and bill"],
  get_payment_options: ["Getting payment options", "Got your payment options"],
  check_payment_status: ["Checking your payment", "Checked your payment"],
  confirm_order: ["Confirming your order", "Confirmed your order"],
  get_food_orders: ["Checking your orders", "Checked your orders"],
  get_orders: ["Checking your orders", "Checked your orders"],
  track_food_order: ["Checking where your order is", "Checked where your order is"],
  track_order: ["Checking where your order is", "Checked where your order is"],
  search_restaurants_dineout: ["Looking for tables", "Looked for tables"],
  get_restaurant_details: ["Reading restaurant details", "Read restaurant details"],
  get_available_slots: ["Checking open slots", "Checked open slots"],
  get_booking_status: ["Checking your booking", "Checked your booking"],
};

const QUERY_KEYS = ["query", "searchQuery", "search_query", "keyword", "dish"];

function toolNameOf(p: ApprovalPart): string | null {
  return p.type === "dynamic-tool" ? p.toolName ?? null : p.type.startsWith("tool-") ? p.type.slice(5) : null;
}

function querySuffix(input: unknown): string {
  const a = (input ?? {}) as Record<string, unknown>;
  const q = QUERY_KEYS.map((k) => a[k]).find((v): v is string => typeof v === "string" && v.trim() !== "");
  if (!q) return "";
  const t = q.trim();
  return ` for “${t.length > 32 ? `${t.slice(0, 31)}…` : t}”`;
}

function stepOf(p: ApprovalPart, i: number): Step | null {
  const full = toolNameOf(p);
  if (!full || isApprovalPart(p) || p.state === "output-denied") return null;
  const service = serviceForTool(full);
  const bare = full.includes("__") ? full.slice(full.indexOf("__") + 2) : full;
  const [doing, did] = LABELS[bare] ?? [`Using ${service ? SERVICE_NAME[service] : "a tool"}`, `Used ${service ? SERVICE_NAME[service] : "a tool"} (${bare.replace(/_/g, " ")})`];
  const q = /search/.test(bare) ? querySuffix(p.input) : "";
  const id = p.toolCallId ?? `${full}-${i}`;

  if (p.state === "input-streaming" || p.state === "input-available") return { id, label: doing + q, state: "running", service };
  const out = (p.output ?? null) as { error?: string } | null;
  if (p.state === "output-error" || out?.error) {
    const why =
      out?.error === "rate_limited"
        ? "Swiggy was busy"
        : out?.error === "swiggy_reconnect_required"
          ? "Swiggy needs reconnecting in Settings"
          : "Swiggy returned an error";
    return { id, label: `${did}${q} — ${why}`, state: "warn", service };
  }
  return { id, label: did + q, state: "done", service };
}

export function boSteps(parts?: ReadonlyArray<ApprovalPart>): Step[] {
  return (parts ?? []).map((p, i) => stepOf(p, i)).filter((s): s is Step => s !== null);
}

function joinServices(steps: Step[]): string {
  const names = [...new Set(steps.map((s) => s.service).filter((s): s is SwiggyService => !!s))].map((s) => SERVICE_NAME[s]);
  return names.length ? ` on ${names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}` : names[0]}` : "";
}

/** A dot with a soft ring: "working". Static under reduced motion. */
function Pulse() {
  return (
    <span aria-hidden style={{ position: "relative", width: 16, height: 16, flex: "none", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
      <span style={{ position: "absolute", inset: 0, borderRadius: "50%", border: "2px solid var(--figure-accent)", animation: "mm-ring 1.3s ease-out infinite" }} />
      <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--figure-accent)" }} />
    </span>
  );
}

function StepIcon({ state }: { state: StepState }) {
  if (state === "running") return <Pulse />;
  if (state === "warn") return <AlertTriangle width={16} height={16} aria-hidden style={{ color: "var(--text-burnt)", flex: "none" }} />;
  return <Check width={16} height={16} aria-hidden style={{ color: "var(--figure-accent)", flex: "none" }} />;
}

export function StepTrace({ parts, active, waiting }: { parts?: ReadonlyArray<ApprovalPart>; active: boolean; waiting: boolean }) {
  const listId = useId();
  const [userOpen, setUserOpen] = useState<boolean | null>(null);
  const steps = boSteps(parts);
  if (!steps.length) return null;

  const open = userOpen ?? (active && !waiting);
  const running = [...steps].reverse().find((s) => s.state === "running");
  const n = steps.length;
  const headline = active
    ? running
      ? `${running.label}…`
      : "Bo is working…"
    : `Bo took ${n} step${n === 1 ? "" : "s"}${joinServices(steps)}`;
  const anyWarn = steps.some((s) => s.state === "warn");

  return (
    <div className="card" style={{ padding: "2px 14px", boxShadow: "none", border: "1.5px solid var(--m-cream-2)", width: "100%" }}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setUserOpen(!open)}
        className="hstack"
        style={{ width: "100%", minHeight: 44, gap: 10, padding: 0, background: "none", border: "none", textAlign: "left", cursor: "pointer", color: "var(--m-ink)" }}
      >
        {active ? <Pulse /> : <StepIcon state={anyWarn ? "warn" : "done"} />}
        <span className="t-body grow" style={{ fontSize: 14, minWidth: 0 }} aria-live="polite">
          {headline}
          {active && <span className="t-cap"> · step {n}</span>}
        </span>
        <ChevronDown
          width={18}
          height={18}
          aria-hidden
          style={{ flex: "none", color: "var(--m-ink-soft)", transform: open ? "rotate(180deg)" : undefined, transition: "transform .2s" }}
        />
      </button>
      <ol id={listId} hidden={!open} style={{ listStyle: "none", margin: 0, padding: "0 0 8px" }}>
        {steps.map((s) => (
          <li
            key={s.id}
            className="hstack t-cap"
            style={{
              gap: 10,
              padding: "8px 0",
              borderTop: "1px solid var(--m-cream-2)",
              color: s.state === "warn" ? "var(--text-burnt)" : s.state === "running" ? "var(--m-ink)" : undefined,
            }}
          >
            <StepIcon state={s.state} />
            <span style={{ minWidth: 0, overflowWrap: "anywhere" }}>{s.label}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
