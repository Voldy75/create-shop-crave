import { createElement, type SVGProps } from "react";
import { mascotComponentFor } from "@/lib/ingredient-mascot";

/**
 * MascotFor — render the mascot that lib/ingredient-mascot maps a string to.
 *
 * Exists because `const Mascot = mascotComponentFor(x)` in a component's render
 * body trips the React Compiler's "Cannot create components during render"
 * check — it cannot prove the returned value is a stable component type. Inside
 * a `.map()` callback the compiler tolerates it (which is why RecipeView and
 * /cart do it that way and are clean), but at the top level of a component it
 * is an error.
 *
 * Resolving the lookup INSIDE a real component makes it a plain render, so any
 * caller can just write `<MascotFor name={x} width={20} />` and stop thinking
 * about it. Prefer this over hoisting the lookup into a useMemo.
 */
export function MascotFor({ name, ...props }: { name: string } & SVGProps<SVGSVGElement>) {
  // createElement, not <Mascot />: binding the resolved type to a capitalised
  // local and rendering it reads to the compiler as defining a component here.
  // Creating an ELEMENT from a looked-up type is just a render.
  return createElement(mascotComponentFor(name), props);
}
