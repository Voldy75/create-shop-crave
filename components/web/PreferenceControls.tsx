"use client";

/**
 * The four preference cards from WF10, shared by /welcome (first-run) and
 * Settings → Preferences so the two can never disagree about how a choice
 * looks or is stored. Storage rules live in lib/preferences.ts.
 *
 * Every chip is a real <button aria-pressed> rather than the board's hidden
 * checkbox + :has() — React owns the state, and a button is keyboard- and
 * screen-reader-correct by default.
 *
 * Unrecognised saved values (mobile onboarding uses different option lists)
 * render as extra selected chips, so tapping elsewhere can never silently
 * delete them. Tapping one removes it, which is the only way it goes.
 */

import { useState, type ReactNode } from "react";
import { Ban, Check, Heart, MapPin, Plus, ShieldAlert } from "lucide-react";
import { BoBowl, Carrot, Leek } from "@/components/mascots";
import { useUser } from "@/app/context/UserContext";
import type { WeightGoal } from "@/lib/types";
import {
  ALLERGY_OPTIONS,
  CUISINE_OPTIONS,
  DIET_OPTIONS,
  GOAL_OPTIONS,
  extras,
  has,
  norm,
  toggle,
} from "@/lib/preferences";

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function Chip({
  on,
  onClick,
  kind = "diet",
  children,
}: {
  on: boolean;
  onClick: () => void;
  kind?: "diet" | "allergy" | "taste";
  children: ReactNode;
}) {
  const cls = `ob-chip${kind === "allergy" ? " ob-al" : kind === "taste" ? " ob-ta" : ""}${on ? " is-on" : ""}`;
  return (
    <button type="button" aria-pressed={on} className={cls} onClick={onClick}>
      {kind === "allergy" ? (
        <Ban className="obi" width={16} height={16} aria-hidden />
      ) : (
        <Check className="obi" width={15} height={15} aria-hidden />
      )}
      {kind === "allergy" ? <span className="obt">{children}</span> : children}
    </button>
  );
}

const chipRow: React.CSSProperties = { display: "flex", flexWrap: "wrap", gap: 10 };
const cardPad: React.CSSProperties = { padding: "22px 24px", display: "flex", flexDirection: "column", gap: 14 };

export function DietCard({ diets, onChange }: { diets: string[]; onChange: (next: string[]) => void }) {
  return (
    <div className="card" style={cardPad}>
      <div className="hstack" style={{ gap: 10, flexWrap: "wrap" }}>
        <span className="t-h1" style={{ fontSize: 18 }}>Diet</span>
        <span className="t-cap">Filters · recipes and dishes that don&apos;t fit are left out</span>
      </div>
      <div style={chipRow}>
        {DIET_OPTIONS.map((d) => (
          <Chip key={d} on={has(diets, d)} onClick={() => onChange(toggle(diets, norm(d)))}>
            {d}
          </Chip>
        ))}
        {extras(diets, DIET_OPTIONS).map((d) => (
          <Chip key={d} on onClick={() => onChange(toggle(diets, d))}>
            {cap(d)}
          </Chip>
        ))}
      </div>
    </div>
  );
}

export function AllergyCard({
  allergies,
  onChange,
}: {
  allergies: string[];
  onChange: (next: string[]) => void;
}) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const v = norm(draft);
    if (!v) return;
    if (!has(allergies, v)) onChange([...allergies, v]);
    setDraft("");
  };
  return (
    <div className="card ob-alcard" style={cardPad}>
      <div className="hstack ob-alhead" style={{ gap: 10, flexWrap: "wrap" }}>
        <ShieldAlert width={20} height={20} aria-hidden />
        <span className="t-h1" style={{ fontSize: 18, color: "inherit" }}>Allergies · hard no</span>
        <span className="t-cap" style={{ color: "inherit" }}>
          Strict · checked against every ingredient, never overridden by tastes
        </span>
      </div>
      <div style={chipRow}>
        {ALLERGY_OPTIONS.map((a) => (
          <Chip key={a} kind="allergy" on={has(allergies, a)} onClick={() => onChange(toggle(allergies, norm(a)))}>
            {a}
          </Chip>
        ))}
        {extras(allergies, ALLERGY_OPTIONS).map((a) => (
          <Chip key={a} kind="allergy" on onClick={() => onChange(toggle(allergies, a))}>
            {cap(a)}
          </Chip>
        ))}
      </div>
      <div
        className="input"
        style={{ height: 44, maxWidth: 360, boxShadow: "inset 0 0 0 1.5px color-mix(in srgb, var(--m-red) 22%, transparent)" }}
      >
        <Plus width={16} height={16} style={{ color: "var(--text-red)", flex: "none" }} aria-hidden />
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder="Add another allergy"
          aria-label="Add another allergy"
          style={{ flex: 1, minWidth: 0, background: "none", border: "none", padding: 0, font: "inherit", fontSize: 13.5, color: "inherit", outline: "none" }}
        />
        {draft.trim() && (
          <button type="button" onClick={add} className="t-cap" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-red)", fontWeight: 700, flex: "none" }}>
            Add
          </button>
        )}
      </div>
    </div>
  );
}

export function TasteCard({ tastes, onChange }: { tastes: string[]; onChange: (next: string[]) => void }) {
  return (
    <div className="card" style={cardPad}>
      <div className="hstack" style={{ gap: 10, flexWrap: "wrap" }}>
        <Heart width={19} height={19} style={{ color: "var(--figure-accent)" }} aria-hidden />
        <span className="t-h1" style={{ fontSize: 18 }}>Cuisines you enjoy</span>
        <span className="t-cap">Soft · nudges what comes first, never hides anything</span>
      </div>
      <div style={chipRow}>
        {CUISINE_OPTIONS.map((c) => (
          <Chip key={c} kind="taste" on={has(tastes, c)} onClick={() => onChange(toggle(tastes, c))}>
            {c}
          </Chip>
        ))}
        {extras(tastes, CUISINE_OPTIONS).map((c) => (
          <Chip key={c} kind="taste" on onClick={() => onChange(toggle(tastes, c))}>
            {c}
          </Chip>
        ))}
      </div>
    </div>
  );
}

const GOAL_MASCOT: Record<WeightGoal, typeof Leek> = { lose: Leek, maintain: BoBowl, gain: Carrot };

export function GoalPicker({
  goal,
  onChange,
}: {
  goal: WeightGoal | null;
  onChange: (next: WeightGoal | null) => void;
}) {
  return (
    <div role="radiogroup" aria-label="Weight goal" style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
      {GOAL_OPTIONS.map(({ value, label, sub }) => {
        const on = goal === value;
        const Mascot = GOAL_MASCOT[value];
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={on}
            className={`ob-goal${on ? " is-on" : ""}`}
            // Tapping the chosen goal again clears it: the goal is optional,
            // and "no goal" is a real, neutral state, not a missing answer.
            onClick={() => onChange(on ? null : value)}
            style={{ minWidth: 180 }}
          >
            <div className="hstack" style={{ justifyContent: "space-between" }}>
              <Mascot className="gm" width={38} height={38} aria-hidden />
              <span className="ob-dot" aria-hidden />
            </div>
            <span className="t-h1" style={{ fontSize: 16 }}>{label}</span>
            <span className="t-cap">{sub}</span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * Location — browser geolocation only. The board also draws a city name
 * ("Powai, Mumbai") and a "Type a city" field; neither has anything behind it
 * (location is raw lat/lng and nothing geocodes), so neither is drawn. Chosen
 * deliberately on 2026-10-03 — see handoff.md.
 */
export function LocationCard() {
  const { location, setLocation, requestLocation, isLoadingLocation, locationError } = useUser();
  return (
    <div className="card" style={cardPad}>
      <div className="hstack" style={{ gap: 10, flexWrap: "wrap" }}>
        <MapPin width={19} height={19} style={{ color: "var(--figure-accent)" }} aria-hidden />
        <span className="t-h1" style={{ fontSize: 18 }}>Location</span>
        <span className="t-cap">Used for nearby restaurants, grocery prices and delivery</span>
      </div>
      {location ? (
        <div className="hstack" style={{ gap: 12, flexWrap: "wrap" }}>
          <span className="icon-btn tint-green" style={{ boxShadow: "none", color: "var(--figure-accent)", flex: "none" }} aria-hidden>
            <MapPin width={18} height={18} />
          </span>
          <div className="vstack grow" style={{ gap: 1, minWidth: 0 }}>
            <span className="t-h2">Using your location</span>
            <span className="t-cap">From your browser · allowed</span>
          </div>
          <button type="button" className="chip" onClick={() => setLocation(null)}>
            Stop using
          </button>
        </div>
      ) : (
        <div className="vstack" style={{ gap: 8 }}>
          <div className="hstack" style={{ gap: 12, flexWrap: "wrap" }}>
            <button
              type="button"
              className="xbtn"
              onClick={() => void requestLocation()}
              disabled={isLoadingLocation}
              aria-busy={isLoadingLocation}
            >
              {isLoadingLocation ? <span className="dlsp" aria-hidden /> : <MapPin width={16} height={16} aria-hidden />}
              {isLoadingLocation ? "Asking your browser…" : "Use my location"}
            </button>
          </div>
          {locationError && (
            <span className="t-cap" role="alert" style={{ color: "var(--text-red)" }}>
              {locationError}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
