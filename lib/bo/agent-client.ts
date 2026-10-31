"use client";

/**
 * Client side of /api/bo (the Bo agent), shared by the web and mobile chat.
 *
 * TASK ID. The first turn of a conversation creates a task on the server and
 * spends one unit of the daily task quota; the response carries X-Bo-Task-Id.
 * Every later turn — including the automatic resend after an Approval card
 * tap — must send it back as `taskId`, or each turn would start (and charge)
 * a new task. The transport keeps it, per chat, and forgets it when the
 * server says the task is gone or spent.
 *
 * AUTOMATIC RESEND. After the user answers every approval in the last
 * message, `sendAutomaticallyWhen` posts the conversation again so the server
 * can run (or skip) the approved call. The tap itself is the user's input.
 */

import { DefaultChatTransport, lastAssistantMessageIsCompleteWithApprovalResponses, type UIMessage } from "ai";
import type { ApprovalReason } from "@/lib/bo/swiggy-tools";

export const sendAfterApproval = lastAssistantMessageIsCompleteWithApprovalResponses;

export interface BoTransport {
  transport: DefaultChatTransport<UIMessage>;
  /** Start the next message as a NEW task (new conversation). */
  resetTask: () => void;
  /** The current task's id, once the server has issued one. */
  taskId: () => string | null;
}

export function createBoTransport(onResponse?: (res: Response) => void): BoTransport {
  let taskId: string | null = null;
  const transport = new DefaultChatTransport<UIMessage>({
    api: "/api/bo",
    prepareSendMessagesRequest: ({ messages, body }) => ({
      body: { ...(body ?? {}), messages, taskId },
    }),
    fetch: async (url, init) => {
      const res = await fetch(url, init);
      const id = res.headers.get("X-Bo-Task-Id");
      if (id) taskId = id;
      // Gone, spent, or never ours: the next message starts a fresh task.
      else if (res.status === 404 || res.status === 429) taskId = null;
      onResponse?.(res);
      return res;
    },
  });
  return {
    transport,
    resetTask: () => {
      taskId = null;
    },
    taskId: () => taskId,
  };
}

/** The server's approval reason (JSON), tolerating a plain-text reason. */
export function parseApprovalReason(raw: string | undefined): ApprovalReason {
  try {
    const v = JSON.parse(raw ?? "") as Partial<ApprovalReason>;
    if (v && typeof v.action === "string") {
      const bill = v.bill && Array.isArray(v.bill.items) && v.bill.items.length && Array.isArray(v.bill.lines) ? v.bill : undefined;
      return {
        action: v.action,
        service: typeof v.service === "string" ? v.service : "",
        summary: typeof v.summary === "string" ? v.summary : "",
        ...(bill ? { bill } : {}),
      };
    }
  } catch {
    /* plain text */
  }
  return { action: raw || "Approve this step", service: "", summary: "" };
}
