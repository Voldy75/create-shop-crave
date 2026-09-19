import type { SVGProps } from "react";

/** meshi mascot — chili. Brand art from Claude Design; hex values are
 *  intentional and exempt from the token rule (see DESIGN.md). */
export function Chili(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path d="M20 14 C15 34 26 52 44 55 C51 55 52 48 46 46 C35 42 28 32 30 17 C30 10 22 8 20 14 Z" fill="#D9453A" stroke="#6E1712" strokeWidth="4" strokeLinejoin="round"></path>
      <path d="M27 12 C29 5 38 5 41 10" stroke="#1E5A34" strokeWidth="5" fill="none" strokeLinecap="round"></path>
      <ellipse cx="24" cy="24" rx="2" ry="2.9" fill="#6E1712"></ellipse>
      <ellipse cx="31" cy="26" rx="2" ry="2.9" fill="#6E1712"></ellipse>
    </svg>
  );
}
