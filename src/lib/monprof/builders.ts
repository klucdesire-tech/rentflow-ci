/* Petits constructeurs pour écrire les cours de façon compacte.
   Le préfixe d'une ligne décide de son rendu au tableau :
     "~"  trait de séparation
     "#"  intitulé de section (Définition, Formule, Exemple…)
     "="  formule
     ">"  étape d'un calcul
     "!"  point à retenir (surligné)
     sinon texte simple. */

import type { BoardFrame, BoardLine } from "@/types/monprof";

export function line(src: string): BoardLine {
  if (src === "~") return { kind: "rule" };
  const head = src[0];
  const rest = src.slice(1).trim();
  switch (head) {
    case "#": return { kind: "label", text: rest };
    case "=": return { kind: "formula", text: rest };
    case ">": return { kind: "step", text: rest };
    case "!": return { kind: "highlight", text: rest };
    default: return { kind: "text", text: src };
  }
}

export const frame = (title: string, ...lines: string[]): BoardFrame => ({
  title,
  lines: lines.map(line),
});
