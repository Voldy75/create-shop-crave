"use client";

/**
 * The server's side of a Bo task while a UPI payment is pending: the chat
 * polls GET /api/bo/tasks/[id] every 10 s, and stops once the payment has an
 * outcome (lib/bo/follow.ts watches and confirms it server-side). The poll
 * also resumes the watcher if it ran out of time, so reopening the chat is
 * enough to finish the order.
 */

import { useEffect, useState } from "react";

export type PaymentOutcome = "pending" | "success" | "failed" | "refund" | "timeout";

export interface TaskFollow {
  status: string;
  payment: { result: PaymentOutcome; amount: string | null } | null;
}

const EVERY_MS = 10_000;

export function useTaskFollow(taskId: string | null, waitingOnPayment: boolean): TaskFollow | null {
  const [follow, setFollow] = useState<{ taskId: string; data: TaskFollow } | null>(null);
  const settled = !!follow && follow.taskId === taskId && !!follow.data.payment && follow.data.payment.result !== "pending";

  useEffect(() => {
    if (!taskId || !waitingOnPayment || settled) return;
    let stop = false;
    const tick = async () => {
      try {
        const res = await fetch(`/api/bo/tasks/${taskId}`, { cache: "no-store" });
        if (!res.ok || stop) return;
        const data = (await res.json()) as TaskFollow;
        if (!stop) setFollow({ taskId, data });
      } catch {
        /* offline for a moment: the next tick tries again */
      }
    };
    void tick();
    const timer = setInterval(() => void tick(), EVERY_MS);
    return () => {
      stop = true;
      clearInterval(timer);
    };
  }, [taskId, waitingOnPayment, settled]);

  return follow && follow.taskId === taskId ? follow.data : null;
}
