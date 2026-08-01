import type { SVGProps } from "react";

/** meshi mascot — beet. Brand art from Claude Design; hex values are
 *  intentional and exempt from the token rule (see DESIGN.md). */
export function Beet(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path d="M24 22 C18 8 30 4 32 15 C34 4 46 8 40 22 Z" fill="#9C5BBE" stroke="#4A1D5B" strokeWidth="4" strokeLinejoin="round"></path>
      <circle cx="32" cy="37" r="15" fill="#C08BDD" stroke="#4A1D5B" strokeWidth="4"></circle>
      <path d="M32 52 C34 56 31 61 27 62" stroke="#4A1D5B" strokeWidth="4" fill="none" strokeLinecap="round"></path>
      <ellipse cx="27" cy="36" rx="2.2" ry="3.2" fill="#4A1D5B"></ellipse>
      <ellipse cx="37" cy="36" rx="2.2" ry="3.2" fill="#4A1D5B"></ellipse>
    </svg>
  );
}
