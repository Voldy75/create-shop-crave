import type { ComponentType, SVGProps } from "react";

import { Avocado } from "./Avocado";
import { Beet } from "./Beet";
import { BoBowl } from "./BoBowl";
import { Broccoli } from "./Broccoli";
import { Carrot } from "./Carrot";
import { Chili } from "./Chili";
import { Leek } from "./Leek";
import { Lemon } from "./Lemon";
import { Mushroom } from "./Mushroom";
import { Onion } from "./Onion";
import { Pea } from "./Pea";
import { Pineapple } from "./Pineapple";
import { Tomato } from "./Tomato";

export {
  Avocado,
  Beet,
  BoBowl,
  Broccoli,
  Carrot,
  Chili,
  Leek,
  Lemon,
  Mushroom,
  Onion,
  Pea,
  Pineapple,
  Tomato,
};

export const MASCOT_NAMES = [
  "avocado",
  "beet",
  "bo-bowl",
  "broccoli",
  "carrot",
  "chili",
  "leek",
  "lemon",
  "mushroom",
  "onion",
  "pea",
  "pineapple",
  "tomato",
] as const;

export type MascotName = (typeof MASCOT_NAMES)[number];

export const MASCOTS: Record<MascotName, ComponentType<SVGProps<SVGSVGElement>>> = {
  avocado: Avocado,
  beet: Beet,
  "bo-bowl": BoBowl,
  broccoli: Broccoli,
  carrot: Carrot,
  chili: Chili,
  leek: Leek,
  lemon: Lemon,
  mushroom: Mushroom,
  onion: Onion,
  pea: Pea,
  pineapple: Pineapple,
  tomato: Tomato,
};

export { MascotFor } from "./MascotFor";
