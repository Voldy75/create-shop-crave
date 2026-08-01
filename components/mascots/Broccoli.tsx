import type { SVGProps } from "react";

/** meshi mascot — broccoli. Brand art from Claude Design; hex values are
 *  intentional and exempt from the token rule (see DESIGN.md). */
export function Broccoli(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path d="M27 34 l-2 16 c2 4 12 4 14 0 l-2 -16" fill="#C7E06B" stroke="#1E5A34" strokeWidth="4" strokeLinejoin="round"></path>
      <circle cx="20" cy="26" r="11" fill="#A6D34D" stroke="#1E5A34" strokeWidth="4"></circle>
      <circle cx="43" cy="30" r="9" fill="#A6D34D" stroke="#1E5A34" strokeWidth="4"></circle>
      <circle cx="34" cy="19" r="12" fill="#A6D34D" stroke="#1E5A34" strokeWidth="4"></circle>
      <ellipse cx="30" cy="19" rx="2.2" ry="3.2" fill="#1E5A34"></ellipse>
      <ellipse cx="39" cy="19" rx="2.2" ry="3.2" fill="#1E5A34"></ellipse>
    </svg>
  );
}
