import type { SVGProps } from "react";

/** meshi mascot — avocado. Brand art from Claude Design; hex values are
 *  intentional and exempt from the token rule (see DESIGN.md). */
export function Avocado(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path d="M32 7 C43 7 50 21 50 36 C50 50 42 58 32 58 C22 58 14 50 14 36 C14 21 21 7 32 7 Z" fill="#F19A2E" stroke="#7A3E12" strokeWidth="4" strokeLinejoin="round"></path>
      <circle cx="32" cy="42" r="8.5" fill="#7A3E12"></circle>
      <ellipse cx="27" cy="24" rx="2.2" ry="3.2" fill="#7A3E12"></ellipse>
      <ellipse cx="37" cy="24" rx="2.2" ry="3.2" fill="#7A3E12"></ellipse>
    </svg>
  );
}
