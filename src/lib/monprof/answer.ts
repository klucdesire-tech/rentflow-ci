/* Analyse des réponses de l'élève : intention, correction, détection
   d'erreurs typiques. Le moteur pédagogique s'appuie entièrement sur
   ce module pour décider s'il faut avancer, réexpliquer ou remédier. */

import type { ErrorDetector, Expectation, Pitfall } from "@/types/monprof";
import { answerNumber, mentions, normalize, wordCount } from "./text";

/* ── Intentions ─────────────────────────────────────────────── */

export type Intent =
  | "incomprehension"   // « je ne comprends pas », « explique autrement »
  | "indice"            // « donne-moi un indice », « aide-moi »
  | "solution"          // « donne la réponse », « je laisse tomber »
  | "question"          // l'élève pose une question
  | "revision"          // « on révise ? »
  | "examen"            // « fais-moi un test »
  | "defi"              // « donne-moi plus dur »
  | "continuer"         // « ok », « on continue »
  | "reponse";          // tout le reste : c'est une réponse à corriger

const RX: [Intent, RegExp][] = [
  ["incomprehension", /\b(je (ne )?comprends? (rien|pas)|j ai (rien )?pas compris|explique (moi )?(autrement|differemment|plus simplement)|plus simple(ment)?|c est flou|je suis perdu)\b/],
  ["indice", /\b(indice|un peu d aide|aide moi|piste|coup de pouce|par ou commencer)\b/],
  ["solution", /\b(donne (moi )?(la )?(reponse|solution|corrige)|montre (moi )?(la )?(solution|correction)|je (ne )?sais pas|aucune idee|je laisse tomber|passe)\b/],
  ["examen", /\b(examen|evaluation|interro|teste moi|fais moi un test|controle)\b/],
  ["revision", /\b(revis|revoir|rappel|reviser)\w*\b/],
  ["defi", /\b(defi|plus dur|plus difficile|plus complique|challenge)\b/],
  ["continuer", /^(ok|d accord|daccord|oui|compris|c est bon|continue|on continue|suite|next|je suis pret|prete)\b/],
];

export function detectIntent(raw: string): Intent {
  // Le tiret est conservé par normalize() pour les nombres négatifs, mais il
  // colle les mots dans « donne-moi » : on le neutralise ici.
  const t = normalize(raw).replace(/-/g, " ").replace(/\s+/g, " ").trim();
  if (!t) return "reponse";
  for (const [intent, re] of RX) if (re.test(t)) return intent;
  // Une question explicite, mais pas une réponse chiffrée.
  if (/\?$/.test(raw.trim()) && answerNumber(raw) === null && /\b(pourquoi|comment|a quoi|quelle difference|est ce que)\b/.test(t)) {
    return "question";
  }
  return "reponse";
}

/* ── Correction ─────────────────────────────────────────────── */

export interface Judgement {
  /** Réponse considérée comme juste. */
  ok: boolean;
  /** Partiellement juste : l'idée est là mais incomplète. */
  partial: boolean;
  /** Ce que Mon Prof a compris de la réponse (pour le debrief). */
  detail: string;
  /** Couverture 0–1, utilisée pour le score de maîtrise. */
  score: number;
}

const closeEnough = (got: number, want: number, tol?: number) => {
  const t = tol ?? Math.max(Math.abs(want) * 0.01, 0.005);
  return Math.abs(got - want) <= t;
};

export function judge(raw: string, expect: Expectation): Judgement {
  const text = raw.trim();
  if (!text) return { ok: false, partial: false, detail: "réponse vide", score: 0 };

  switch (expect.kind) {
    case "number": {
      const got = answerNumber(text);
      if (got === null) {
        return { ok: false, partial: false, detail: "aucun nombre dans la réponse", score: 0 };
      }
      const ok = closeEnough(got, expect.value, expect.tolerance);
      return {
        ok,
        partial: !ok && closeEnough(got, expect.value, Math.max(Math.abs(expect.value) * 0.1, 0.5)),
        detail: `valeur lue : ${got}`,
        score: ok ? 1 : 0,
      };
    }

    case "keywords": {
      const hit = expect.any.filter((k) => mentions(text, k));
      const bad = (expect.forbidden ?? []).filter((k) => mentions(text, k));
      const min = expect.min ?? 1;
      const ok = hit.length >= min && bad.length === 0;
      return {
        ok,
        partial: !ok && (hit.length > 0 || wordCount(text) >= 6),
        detail: hit.length ? `mots-clés trouvés : ${hit.join(", ")}` : "aucun mot-clé attendu",
        score: Math.min(1, hit.length / Math.max(1, min)),
      };
    }

    case "choice": {
      const t = normalize(text);
      let picked = -1;
      expect.options.forEach((opt, i) => {
        const letter = String.fromCharCode(97 + i);
        if (
          new RegExp(`^${letter}\\b`).test(t) ||
          t === String(i + 1) ||
          normalize(opt) === t ||
          (normalize(opt).length > 5 && t.includes(normalize(opt)))
        ) picked = i;
      });
      const ok = picked === expect.correct;
      return {
        ok,
        partial: false,
        detail: picked >= 0 ? `réponse retenue : ${expect.options[picked]}` : "choix non identifié",
        score: ok ? 1 : 0,
      };
    }

    case "open": {
      const hit = expect.goodSigns.filter((k) => mentions(text, k));
      const long = wordCount(text) >= 8;
      const ok = hit.length >= Math.max(1, Math.ceil(expect.goodSigns.length / 3)) && long;
      return {
        ok,
        partial: !ok && (hit.length > 0 || long),
        detail: hit.length ? `éléments justes : ${hit.join(", ")}` : "explication à préciser",
        score: expect.goodSigns.length ? hit.length / expect.goodSigns.length : long ? 0.6 : 0.2,
      };
    }
  }
}

/* ── Détection des erreurs typiques ─────────────────────────── */

function matches(raw: string, d: ErrorDetector, expect: Expectation): boolean {
  switch (d.kind) {
    case "factor": {
      const got = answerNumber(raw);
      if (got === null || expect.kind !== "number") return false;
      return closeEnough(got, expect.value * d.factor, Math.abs(expect.value * d.factor) * 0.02);
    }
    case "swapped":
    case "value": {
      const got = answerNumber(raw);
      if (got === null) return false;
      return closeEnough(got, d.value, Math.max(Math.abs(d.value) * 0.02, 0.01));
    }
    case "mentions":
      return d.any.some((w) => mentions(raw, w));
  }
}

/** Renvoie la première erreur typique reconnue dans la réponse. */
export function findPitfall(raw: string, expect: Expectation, pitfalls: Pitfall[]): Pitfall | null {
  for (const p of pitfalls) if (matches(raw, p.detector, expect)) return p;
  return null;
}

/* ── Formulation de la réponse attendue ─────────────────────── */

export function describeExpectation(expect: Expectation): string {
  switch (expect.kind) {
    case "number":
      return `${String(expect.value).replace(".", ",")}${expect.unit ? " " + expect.unit : ""}`;
    case "keywords":
      return `une réponse qui contient l'idée de « ${expect.any.slice(0, 3).join(" », « ")} »`;
    case "choice":
      return expect.options[expect.correct];
    case "open":
      return `une explication qui parle de « ${expect.goodSigns.slice(0, 3).join(" », « ")} »`;
  }
}
