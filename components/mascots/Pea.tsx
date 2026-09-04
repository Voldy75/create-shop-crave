import type { SVGProps } from "react";

/** meshi mascot — pea. Brand art from Claude Design; hex values are
 *  intentional and exempt from the token rule (see DESIGN.md). */
export function Pea(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path d="M8 36 C18 18 46 18 56 36 C46 54 18 54 8 36 Z" fill="#C7E06B" stroke="#1E5A34" strokeWidth="4" strokeLinejoin="round"></path>
      <circle cx="19" cy="36" r="7" fill="#A6D34D" stroke="#1E5A34" strokeWidth="3.5"></circle>
      <circle cx="45" cy="36" r="7" fill="#A6D34D" stroke="#1E5A34" strokeWidth="3.5"></circle>
      <circle cx="32" cy="36" r="7.5" fill="#A6D34D" stroke="#1E5A34" strokeWidth="3.5"></circle>
      <ellipse cx="29.5" cy="35.5" rx="1.8" ry="2.6" fill="#1E5A34"></ellipse>
      <ellipse cx="35" cy="35.5" rx="1.8" ry="2.6" fill="#1E5A34"></ellipse>
    </svg>
  );
}
