import type { SVGProps } from "react";

/** meshi mascot — tomato. Brand art from Claude Design; hex values are
 *  intentional and exempt from the token rule (see DESIGN.md). */
export function Tomato(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" {...props}>
      <circle cx="32" cy="37" r="17" fill="#F19A2E" stroke="#7A3E12" strokeWidth="4"></circle>
      <path d="M32 21 C28 14 21 14 19 18 C25 21 28 23 32 21 C36 23 39 21 45 18 C43 14 36 14 32 21 Z" fill="#7A3E12" stroke="#7A3E12" strokeWidth="2" strokeLinejoin="round"></path>
      <ellipse cx="27" cy="37" rx="2.2" ry="3.2" fill="#7A3E12"></ellipse>
      <ellipse cx="37" cy="37" rx="2.2" ry="3.2" fill="#7A3E12"></ellipse>
    </svg>
  );
}
