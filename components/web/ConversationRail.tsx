"use client";

/**
 * ConversationRail — the w8a 288px thread list, left of the chat pane.
 *
 * WHAT THE ARTBOARD SHOWS THAT IS NOT BUILT, and why:
 *  - "Search 42 chats…" as a live search over a fixed count. Search IS built
 *    (it filters titles and snippets); the count is the real number of stored
 *    threads, not 42.
 *  - A "Pinned" group. Nothing stores a pin flag, so a Pinned header would
 *    always be empty or a lie. Grouping is Today / Earlier — see
 *    groupConversations, which explains why "Earlier this week" collapses to
 *    "Earlier" under a 3-day window.
 *  - "History synced · kept 90 days". The footer states the real retention and
 *    does NOT claim syncing — this is localStorage, per-device.
 *
 * The thread icon is picked by mascotComponentFor's deterministic hash over the
 * title, not at random: a random pick would reshuffle every icon on each
 * re-render, which is the trap lib/ingredient-mascot.ts's own comment warns
 * about for the ingredient grid.
 */

import { useMemo, useState } from "react";
import { Plus, Search, Trash2, MessageSquare } from "lucide-react";
import { mascotComponentFor, tileTint } from "@/lib/ingredient-mascot";
import {
  groupConversations,
  relativeStamp,
  type Conversation,
} from "@/lib/conversation-history";

interface Props {
  conversations: Conversation[];
  /** id of the thread currently open in the pane, if it is a stored one. */
  activeId: string | null;
  onOpen: (c: Conversation) => void;
  onDelete: (id: string) => void;
  onNew: () => void;
}

export function ConversationRail({ conversations, activeId, onOpen, onDelete, onNew }: Props) {
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return conversations;
    return conversations.filter(
      (c) =>
        c.title.toLowerCase().includes(needle) ||
        c.snippet.toLowerCase().includes(needle)
    );
  }, [conversations, q]);

  const groups = useMemo(() => groupConversations(filtered), [filtered]);

  return (
    <aside className="conv-rail" aria-label="Conversations">
      <div className="vstack" style={{ gap: 12, padding: "18px 14px 12px", flex: "none" }}>
        <div className="hstack" style={{ gap: 8 }}>
          <span className="t-h1 grow">Conversations</span>
          <button
            onClick={onNew}
            className="icon-btn"
            style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--m-forest)", color: "var(--m-on-deep)" }}
            aria-label="Start a new chat"
            title="New chat"
          >
            <Plus width={17} height={17} />
          </button>
        </div>

        <div className="input" style={{ height: 40 }}>
          <Search width={16} height={16} style={{ color: "var(--m-ink-soft)", flex: "none" }} aria-hidden />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={
              conversations.length === 1 ? "Search 1 chat…" : `Search ${conversations.length} chats…`
            }
            className="grow"
            style={{ background: "none", border: "none", padding: 0, font: "inherit", color: "inherit", minWidth: 0 }}
            aria-label="Search conversations"
          />
        </div>
      </div>

      <div className="conv-rail-scroll">
        {conversations.length === 0 && (
          <div className="vstack" style={{ gap: 8, alignItems: "center", padding: "34px 18px", textAlign: "center" }}>
            <MessageSquare width={22} height={22} style={{ color: "var(--m-ink-soft)" }} aria-hidden />
            <span className="t-cap">Your chats with Bo show up here.</span>
          </div>
        )}

        {conversations.length > 0 && filtered.length === 0 && (
          <div style={{ padding: "24px 18px", textAlign: "center" }}>
            <span className="t-cap">Nothing matches &ldquo;{q.trim()}&rdquo;.</span>
          </div>
        )}

        {groups.map((group) => (
          <div key={group.label} className="vstack" style={{ gap: 3, marginBottom: 14 }}>
            <span className="t-micro" style={{ padding: "0 11px 5px" }}>{group.label}</span>
            {group.items.map((c, i) => {
              const Mascot = mascotComponentFor(c.title);
              return (
                <div key={c.id} className="conv-row">
                  <button
                    className={`thr grow${c.id === activeId ? " is-active" : ""}`}
                    onClick={() => onOpen(c)}
                    aria-current={c.id === activeId ? "true" : undefined}
                  >
                    <span
                      style={{
                        width: 34, height: 34, borderRadius: 11, flex: "none",
                        background: tileTint(i),
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}
                      aria-hidden
                    >
                      <Mascot width={22} height={22} />
                    </span>
                    <span className="vstack grow" style={{ gap: 1, minWidth: 0 }}>
                      <span className="t-h2 conv-clip" style={{ fontSize: 13.5 }}>{c.title}</span>
                      {c.snippet && <span className="t-cap conv-clip" style={{ fontSize: 11.5 }}>{c.snippet}</span>}
                    </span>
                    <span className="t-cap" style={{ fontSize: 11, flex: "none" }}>{relativeStamp(c.at)}</span>
                  </button>
                  {/* Outside the .thr button — a button cannot nest in a button.
                      Revealed on hover by .thr-x, but focus-visible keeps it
                      reachable by keyboard. */}
                  <button
                    className="thr-x conv-del"
                    onClick={() => onDelete(c.id)}
                    aria-label={`Delete conversation: ${c.title}`}
                    title="Delete"
                  >
                    <Trash2 width={14} height={14} />
                  </button>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Honest retention footer — see the file header on what was not copied. */}
      <div className="conv-rail-foot">
        <span className="t-cap" style={{ fontSize: 11 }}>
          Kept 3 days on this device
        </span>
      </div>
    </aside>
  );
}
