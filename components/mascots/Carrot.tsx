import type { SVGProps } from "react";

/** meshi mascot — carrot. Brand art from Claude Design; hex values are
 *  intentional and exempt from the token rule (see DESIGN.md). */
export function Carrot(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path d="M28 12 C24 4 14 4 12 10 C18 12 23 14 28 12 Z" fill="#7A3E12" stroke="#7A3E12" strokeWidth="3" strokeLinejoin="round"></path>
      <g transform="rotate(14 32 32)">
        <path d="M32 12 C42 12 46 20 44 27 L36 54 C34 60 30 60 28 54 L20 27 C18 20 22 12 32 12 Z" fill="#F19A2E" stroke="#7A3E12" strokeWidth="4" strokeLinejoin="round"></path>
        <path d="M24 34 l7 2 M27 44 l6 2" stroke="#7A3E12" strokeWidth="3" strokeLinecap="round"></path>
        <ellipse cx="27" cy="23" rx="2.2" ry="3" fill="#7A3E12"></ellipse>
        <ellipse cx="37" cy="23" rx="2.2" ry="3" fill="#7A3E12"></ellipse>
      </g>
    </svg>
  );
}
