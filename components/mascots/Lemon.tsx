import type { SVGProps } from "react";

/** meshi mascot — lemon. Brand art from Claude Design; hex values are
 *  intentional and exempt from the token rule (see DESIGN.md). */
export function Lemon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" {...props}>
      <g transform="rotate(-14 32 32)">
        <circle cx="11" cy="34" r="4.5" fill="#F2D34C" stroke="#8A6A0D" strokeWidth="4"></circle>
        <circle cx="53" cy="34" r="4.5" fill="#F2D34C" stroke="#8A6A0D" strokeWidth="4"></circle>
        <ellipse cx="32" cy="34" rx="20" ry="14.5" fill="#F2D34C" stroke="#8A6A0D" strokeWidth="4"></ellipse>
        <ellipse cx="27" cy="33" rx="2.2" ry="3.2" fill="#8A6A0D"></ellipse>
        <ellipse cx="37" cy="33" rx="2.2" ry="3.2" fill="#8A6A0D"></ellipse>
      </g>
    </svg>
  );
}
