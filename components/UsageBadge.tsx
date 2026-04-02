"use client";

import { Zap } from "lucide-react";

interface UsageBadgeProps {
  count: number;
  limit: number;
}

export function UsageBadge({ count, limit }: UsageBadgeProps) {
  const remaining = Math.max(0, limit - count);
  const isExhausted = remaining === 0;
  const isLow = remaining === 1;

  return (
    <div
      className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full transition-colors ${
        isExhausted
          ? "bg-red-50 text-red-600"
          : isLow
          ? "bg-amber-50 text-amber-600"
          : "bg-gray-50 text-gray-500"
      }`}
      title={`${remaining} of ${limit} free requests remaining today`}
    >
      <Zap className={`w-3 h-3 ${isExhausted ? "fill-red-500" : isLow ? "fill-amber-500" : ""}`} />
      {isExhausted ? "Limit reached" : `${count}/${limit} free`}
    </div>
  );
}
