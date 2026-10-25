"use client";

/**
 * A Bo reply in the order it happened: Bo's opening line, the step trace,
 * the Approval card, then what Bo said after the user's tap ("Complete the
 * payment in your UPI app…"). Joining all the text into one bubble would put
 * that follow-up ABOVE the card it is about. Adjacent text parts merge into
 * one bubble; the trace sits where Bo's first Swiggy call happened.
 */

import { ApprovalCard, isApprovalPart, type ApprovalPart, type Respond } from "@/components/bo/ApprovalCard";
import { boSteps, StepTrace } from "@/components/bo/StepTrace";

type Part = ApprovalPart & { text?: string };
type Segment = { kind: "text"; text: string } | { kind: "approval"; part: ApprovalPart } | { kind: "trace" };

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
    } else if (!traced && boSteps([p]).length) {
      traced = true;
      out.push({ kind: "trace" });
    }
  }
  return out.filter((s) => s.kind !== "text" || s.text.trim());
}

/** The reply has a step trace. While it streams, the trace says what Bo is
 *  doing, so the screen's generic "thinking" dots would only repeat it. */
export function boIsShowingWork(parts?: ReadonlyArray<Part>): boolean {
  return boSteps(parts).length > 0;
}

/** Renders a Bo reply's segments; each tree supplies its own text bubble.
 *  `active`: this reply is still streaming. */
export function BoReply({
  parts,
  respond,
  busy,
  active,
  renderText,
}: {
  parts?: ReadonlyArray<Part>;
  respond: Respond;
  busy: boolean;
  active: boolean;
  renderText: (text: string, key: string) => React.ReactNode;
}) {
  const waiting = (parts ?? []).some((p) => isApprovalPart(p) && p.state === "approval-requested");
  return (
    <>
      {boSegments(parts).map((s, i) =>
        s.kind === "text" ? (
          renderText(s.text.trim(), `t${i}`)
        ) : s.kind === "trace" ? (
          <StepTrace key="trace" parts={parts} active={active} waiting={waiting} />
        ) : (
          <ApprovalCard key={s.part.toolCallId ?? s.part.approval!.id} part={s.part} respond={respond} busy={busy} />
        )
      )}
    </>
  );
}
