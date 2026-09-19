import type { SVGProps } from "react";

/** meshi mascot — pineapple. Brand art from Claude Design; hex values are
 *  intentional and exempt from the token rule (see DESIGN.md). */
export function Pineapple(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path d="M32 22 L18 8 M32 22 L32 4 M32 22 L46 8" stroke="#1E5A34" strokeWidth="9" strokeLinecap="round"></path>
      <ellipse cx="32" cy="41" rx="15" ry="17" fill="#A6D34D" stroke="#1E5A34" strokeWidth="4"></ellipse>
      <path d="M19 47 h26 M21 34 h22" stroke="#1E5A34" strokeWidth="3" strokeLinecap="round"></path>
      <ellipse cx="27" cy="41" rx="2.2" ry="3.2" fill="#1E5A34"></ellipse>
      <ellipse cx="37" cy="41" rx="2.2" ry="3.2" fill="#1E5A34"></ellipse>
    </svg>
  );
}
