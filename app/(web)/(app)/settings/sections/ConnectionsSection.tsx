"use client";

import React from "react";
import { Loader2, ExternalLink } from "lucide-react";

interface MCPService {
  id: string;
  flagId: string;
  name: string;
  description: string;
  logo: string;
  color: string;
}

const SERVICES: MCPService[] = [
  {
    id: "swiggy",
    flagId: "mcp_swiggy",
    name: "Swiggy",
    description: "Order food, groceries, and book tables via chat.",
    logo: "🍛",
    color: "#fc8019", // hex-ok: Swiggy brand orange
  },
  {
    id: "instacart",
    flagId: "mcp_instacart",
    name: "Instacart",
    description: "Shop groceries from local stores, delivered in hours.",
    logo: "🛒",
    color: "#43b02a", // hex-ok: Instacart brand green
  },
  {
    id: "zomato",
    flagId: "mcp_zomato",
    name: "Zomato",
    description: "Discover restaurants, order food, and book tables.",
    logo: "🍽️",
    color: "#e23744", // hex-ok: Zomato brand red
  },
];

export function ConnectionsSection({
  flags,
  flagsLoading,
}: {
  flags: Record<string, boolean>;
  flagsLoading: boolean;
}) {
  if (flagsLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2
          className="w-5 h-5 animate-spin"
          style={{ color: "var(--m-ink-soft)" }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div
        className="p-4"
        style={{
          background: "var(--m-card)",
          border: "1px solid var(--m-ink-faint)",
          borderRadius: "16px",
        }}
      >
        <h2
          style={{
            fontSize: "15px",
            fontWeight: 700,
            color: "var(--m-ink)",
          }}
        >
          MCP server connections
        </h2>
        <p
          style={{
            fontSize: "12px",
            color: "var(--m-ink-soft)",
            marginTop: "4px",
            lineHeight: 1.5,
          }}
        >
          Connect external services so the AI can place orders, search menus, and
          manage your cart directly from chat.
        </p>
      </div>

      {SERVICES.map((svc) => {
        const enabled = flags[svc.flagId] ?? false;
        return (
          <div
            key={svc.id}
            className="p-4"
            style={{
              background: "var(--m-card)",
              border: "1px solid var(--m-ink-faint)",
              borderRadius: "16px",
              opacity: enabled ? 1 : 0.55,
            }}
          >
            <div className="flex items-start gap-3">
              <div
                className="flex-shrink-0 flex items-center justify-center"
                style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "10px",
                  background: `${svc.color}15`,
                  fontSize: "18px",
                }}
              >
                {svc.logo}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <h3
                    style={{
                      fontSize: "14px",
                      fontWeight: 700,
                      color: "var(--m-ink)",
                    }}
                  >
                    {svc.name}
                  </h3>
                  <span
                    style={{
                      fontSize: "10px",
                      fontWeight: 700,
                      color: enabled ? svc.color : "var(--m-ink-soft)",
                      background: enabled
                        ? `${svc.color}15`
                        : "var(--m-cream-2)",
                      padding: "2px 7px",
                      borderRadius: "980px",
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                    }}
                  >
                    {enabled ? "Available" : "Coming soon"}
                  </span>
                </div>
                <p
                  style={{
                    fontSize: "11px",
                    color: "var(--m-ink-soft)",
                    marginTop: "2px",
                  }}
                >
                  {svc.description}
                </p>
              </div>
            </div>

            <div className="mt-3">
              {enabled ? (
                <button
                  className="inline-flex items-center gap-1.5 px-4 py-2 transition-colors"
                  style={{
                    fontSize: "12px",
                    fontWeight: 600,
                    background: svc.color,
                    color: "#fff",
                    borderRadius: "980px",
                  }}
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Connect {svc.name}
                </button>
              ) : (
                <p
                  style={{
                    fontSize: "11px",
                    color: "var(--m-ink-soft)",
                    fontStyle: "italic",
                  }}
                >
                  This integration will be available once the admin enables it.
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
