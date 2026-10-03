import type { SVGProps } from "react";

/** meshi mascot — onion. Brand art from Claude Design; hex values are
 *  intentional and exempt from the token rule (see DESIGN.md). */
export function Onion(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path d="M32 15 C46 23 52 31 52 41 C52 52 42 58 32 58 C22 58 12 52 12 41 C12 31 18 23 32 15 Z" fill="#F0B45A" stroke="#7A3E12" strokeWidth="4" strokeLinejoin="round"></path>
      <path d="M32 14 C30 8 34 4 39 4" stroke="#7A3E12" strokeWidth="4" fill="none" strokeLinecap="round"></path>
      <path d="M22 24 C18 32 18 42 21 50 M42 24 C46 32 46 42 43 50" stroke="#7A3E12" strokeWidth="3" fill="none" strokeLinecap="round"></path>
      <ellipse cx="27" cy="38" rx="2.2" ry="3.2" fill="#7A3E12"></ellipse>
      <ellipse cx="37" cy="38" rx="2.2" ry="3.2" fill="#7A3E12"></ellipse>
    </svg>
  );
}
