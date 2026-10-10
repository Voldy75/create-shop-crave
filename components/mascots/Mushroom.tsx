import type { SVGProps } from "react";

/** meshi mascot — mushroom. Brand art from Claude Design; hex values are
 *  intentional and exempt from the token rule (see DESIGN.md). */
export function Mushroom(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path d="M9 33 C9 14 55 14 55 33 C55 36 52 37 48 37 H16 C12 37 9 36 9 33 Z" fill="#C08BDD" stroke="#4A1D5B" strokeWidth="4" strokeLinejoin="round"></path>
      <path d="M24 37 h16 l-1 14 c0 7 -14 7 -14 0 Z" fill="#E3C8F2" stroke="#4A1D5B" strokeWidth="4" strokeLinejoin="round"></path>
      <ellipse cx="27" cy="27" rx="2.2" ry="3.2" fill="#4A1D5B"></ellipse>
      <ellipse cx="37" cy="27" rx="2.2" ry="3.2" fill="#4A1D5B"></ellipse>
    </svg>
  );
}
