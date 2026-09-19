import type { SVGProps } from "react";

/** meshi mascot — leek. Brand art from Claude Design; hex values are
 *  intentional and exempt from the token rule (see DESIGN.md). */
export function Leek(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path d="M32 32 L16 8 M32 32 L32 6 M32 32 L48 8" stroke="#1E5A34" strokeWidth="11" strokeLinecap="round"></path>
      <path d="M32 32 L16 8 M32 32 L32 6 M32 32 L48 8" stroke="#C7E06B" strokeWidth="4" strokeLinecap="round"></path>
      <path d="M26 28 h12 c1 0 2 1 2 3 l-1 20 c0 8 -14 8 -14 0 l-1 -20 c0 -2 1 -3 2 -3 Z" fill="#C7E06B" stroke="#1E5A34" strokeWidth="4" strokeLinejoin="round"></path>
      <ellipse cx="28.5" cy="44" rx="2" ry="2.8" fill="#1E5A34"></ellipse>
      <ellipse cx="36" cy="44" rx="2" ry="2.8" fill="#1E5A34"></ellipse>
    </svg>
  );
}
