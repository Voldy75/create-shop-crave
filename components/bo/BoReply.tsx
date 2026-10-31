"use client";

/**
 * A Bo reply in the order it happened: Bo's opening line, the step trace,
 * the Approval card, then what Bo said after the user's tap ("Complete the
 * payment in your UPI app…"). Joining all the text into one bubble would put
 * that follow-up ABOVE the card it is about. Adjacent text parts merge into
 * one bubble; the trace sits where Bo's first Swiggy call happened. A
 * "cook it yourself" answer is a recipe card, built from the tool call's
 * input (lib/bo/cook-tools.ts). A ride is a card built from the tool's output
 * (lib/bo/ride-tools.ts).
 */

import { ApprovalCard, isApprovalPart, type ApprovalPart, type Respond } from "@/components/bo/ApprovalCard";
import { boSteps, StepTrace } from "@/components/bo/StepTrace";
import { BoRecipeCard, recipeFromInput, type CookActions } from "@/components/bo/BoRecipeCard";
import { BoRideCard, rideFromOutput } from "@/components/bo/BoRideCard";

type Part = ApprovalPart & { text?: string };
type Segment =
  | { kind: "text"; text: string }
  | { kind: "approval"; part: ApprovalPart }
  | { kind: "recipe"; part: ApprovalPart }
  | { kind: "ride"; part: ApprovalPart }
  | { kind: "trace" };

const RECIPE_PART = "tool-meshi_cook__show_recipe";
const RIDE_PART = "tool-meshi_ride__show_ride";

export function boSegments(parts?: ReadonlyArray<Part>): Segment[] {
  const out: Segment[] = [];
  let traced = false;
  for (const p of parts ?? []) {
    if (p.type === "text" && typeof p.text === "string") {
      const prev = out[out.length - 1];
      if (prev?.kind === "text") prev.text += p.text;
      else out.push({ kind: "text", text: p.text });
    } else if (isApprovalPart(p)) {
      out.push({ kind: "approval", part: p });
    } else if (p.type === RECIPE_PART) {
      out.push({ kind: "recipe", part: p });
    } else if (p.type === RIDE_PART) {
      out.push({ kind: "ride", part: p });
    } else if (!traced && boSteps([p]).length) {
      traced = true;
      out.push({ kind: "trace" });
    }
  }
  return out.filter((s) => s.kind !== "text" || s.text.trim());
}

/** The reply has a step trace, a recipe card or a ride card. While it streams, those say
 *  what Bo is doing, so the screen's generic "thinking" dots would only
 *  repeat them. */
export function boIsShowingWork(parts?: ReadonlyArray<Part>): boolean {
  return boSteps(parts).length > 0 || (parts ?? []).some((p) => p.type === RECIPE_PART || p.type === RIDE_PART);
}

/** Renders a Bo reply's segments; each tree supplies its own text bubble.
 *  `active`: this reply is still streaming. */
export function BoReply({
  parts,
  respond,
  busy,
  active,
  renderText,
  cook,
}: {
  parts?: ReadonlyArray<Part>;
  respond: Respond;
  busy: boolean;
  active: boolean;
  renderText: (text: string, key: string) => React.ReactNode;
  /** The recipe card's buttons; each tree routes them its own way. */
  cook?: CookActions;
}) {
  const waiting = (parts ?? []).some((p) => isApprovalPart(p) && p.state === "approval-requested");
  return (
    <>
      {boSegments(parts).map((s, i) =>
        s.kind === "text" ? (
          renderText(s.text.trim(), `t${i}`)
        ) : s.kind === "trace" ? (
          <StepTrace key="trace" parts={parts} active={active} waiting={waiting} />
        ) : s.kind === "recipe" ? (
          <RecipeSegment key={s.part.toolCallId ?? `r${i}`} part={s.part} cook={cook} busy={busy} />
        ) : s.kind === "ride" ? (
          <RideSegment key={s.part.toolCallId ?? `u${i}`} part={s.part} />
        ) : (
          <ApprovalCard key={s.part.toolCallId ?? s.part.approval!.id} part={s.part} respond={respond} busy={busy} />
        )
      )}
    </>
  );
}

/** The card once the recipe is complete; a placeholder while Bo writes it. */
function RecipeSegment({ part, cook, busy }: { part: ApprovalPart; cook?: CookActions; busy: boolean }) {
  const recipe = part.state === "input-streaming" ? null : recipeFromInput(part.input);
  if (recipe) return <BoRecipeCard recipe={recipe} actions={cook} busy={busy} />;
  if (part.state === "output-error") return null;
  return (
    <div className="card t-body-soft" role="status" style={{ padding: "13px 17px", fontSize: 14 }}>
      Bo is writing a recipe…
    </div>
  );
}

/** The card once the tool has answered; nothing if it found no destination. */
function RideSegment({ part }: { part: ApprovalPart }) {
  const ride = part.state === "output-available" ? rideFromOutput(part.output) : null;
  if (ride) return <BoRideCard ride={ride} />;
  if (part.state === "output-available" || part.state === "output-error") return null;
  return (
    <div className="card t-body-soft" role="status" style={{ padding: "13px 17px", fontSize: 14 }}>
      Bo is getting your ride ready…
    </div>
  );
}
