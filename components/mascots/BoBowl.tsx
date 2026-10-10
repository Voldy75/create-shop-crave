import type { SVGProps } from "react";

/** meshi mascot — bo bowl. Brand art from Claude Design; hex values are
 *  intentional and exempt from the token rule (see DESIGN.md). */
export function BoBowl(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" {...props}>
      <ellipse cx="32" cy="28" rx="21" ry="13" fill="#FFF6DF" stroke="#7A3E12" strokeWidth="4"></ellipse>
      <ellipse cx="26" cy="27" rx="2.3" ry="3.2" fill="#7A3E12"></ellipse>
      <ellipse cx="38" cy="27" rx="2.3" ry="3.2" fill="#7A3E12"></ellipse>
      <path d="M9 36 C9 51 19 58 32 58 C45 58 55 51 55 36 Z" fill="#1E5A34" stroke="#14421F" strokeWidth="4" strokeLinejoin="round"></path>
      <path d="M15 44 h34" stroke="#3D7A52" strokeWidth="3.5" strokeLinecap="round"></path>
    </svg>
  );
}
