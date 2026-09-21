/* Moteur de maîtrise : convertit les preuves apportées par l'élève
   (réponses, exercices, explications) en niveau de maîtrise, et décide
   si une notion peut être validée. Une notion n'est JAMAIS acquise
   parce que l'élève dit « oui » — seulement parce qu'il l'a démontré. */

import type { Concept, ConceptMemory, Course, Dimension, Status } from "@/types/monprof";
import { DIMENSIONS } from "@/types/monprof";

/** Poids de chaque dimension dans la maîtrise globale. */
const WEIGHT: Record<Dimension, number> = {
  comprendre: 0.25,
  identifier: 0.2,
  appliquer: 0.35,
  raisonner: 0.2,
};

/** Seuils de validation, dimension par dimension. */
const THRESHOLD: Record<Dimension, number> = {
  comprendre: 70,
  identifier: 60,
  appliquer: 70,
  raisonner: 60,
};

const GLOBAL_THRESHOLD = 78;

/** Au bout de combien de tours une notion validée redemande un rappel. */
export const REVIEW_AFTER_TURNS = 8;

export function emptyMemory(): ConceptMemory {
  const zero = () => ({ comprendre: 0, identifier: 0, appliquer: 0, raisonner: 0 });
  return {
    scores: zero(),
    evidence: zero(),
    solved: [],
    attempts: 0,
    errors: [],
    lastSeenTurn: -999,
    status: "non-etudie",
    validated: false,
  };
}

export function getMemory(memory: Record<string, ConceptMemory>, id: string): ConceptMemory {
  return memory[id] ?? emptyMemory();
}

/**
 * Enregistre une preuve. `score` ∈ [0,1] : 1 = réussite pleine.
 * La dernière preuve pèse plus lourd que l'historique, pour que la
 * remédiation puisse réellement rattraper une notion mal partie.
 */
export function recordEvidence(
  mem: ConceptMemory,
  dimension: Dimension,
  score: number,
  opts: { difficulty?: number; turn: number; errorLabel?: string } = { turn: 0 }
): ConceptMemory {
  const s = Math.max(0, Math.min(1, score)) * 100;
  const prev = mem.scores[dimension];
  const seen = mem.evidence[dimension];
  const next = seen === 0 ? s : Math.round(prev * 0.45 + s * 0.55);

  const scores = { ...mem.scores, [dimension]: Math.round(next) };
  const evidence = { ...mem.evidence, [dimension]: seen + 1 };
  const solved = [...mem.solved];

  if (opts.difficulty && score >= 0.999) {
    if (!solved.includes(opts.difficulty)) solved.push(opts.difficulty);
    // Réussir un exercice difficile prouve aussi le transfert.
    if (opts.difficulty >= 3) {
      scores.raisonner = Math.max(scores.raisonner, Math.round(scores.raisonner * 0.5 + 70 * 0.5));
      evidence.raisonner = evidence.raisonner + (evidence.raisonner === 0 ? 1 : 0);
    }
  }

  const errors = opts.errorLabel && !mem.errors.includes(opts.errorLabel)
    ? [...mem.errors, opts.errorLabel]
    : mem.errors;

  const updated: ConceptMemory = {
    ...mem,
    scores,
    evidence,
    solved,
    errors,
    attempts: mem.attempts + 1,
    lastSeenTurn: opts.turn,
  };

  return { ...updated, status: statusOf(updated) };
}

export function globalMastery(mem: ConceptMemory): number {
  const total = DIMENSIONS.reduce((acc, d) => acc + mem.scores[d] * WEIGHT[d], 0);
  return Math.round(total);
}

export function statusOf(mem: ConceptMemory): Status {
  const seen = DIMENSIONS.some((d) => mem.evidence[d] > 0);
  if (!seen) return "non-etudie";
  if (mem.validated) return "acquis";
  const g = globalMastery(mem);
  if (g < 45) return "non-acquis";
  if (g < GLOBAL_THRESHOLD) return "en-cours";
  return canValidate(mem).ok ? "acquis" : "en-cours";
}

export interface ValidationReport {
  ok: boolean;
  global: number;
  /** Ce qui manque encore pour valider, en clair. */
  missing: string[];
}

/**
 * Règle de validation (§9) : il faut avoir démontré les quatre
 * dimensions ET réussi au moins un exercice de transfert (difficulté ≥ 2),
 * c'est-à-dire différent de l'exemple du cours.
 */
export function canValidate(mem: ConceptMemory): ValidationReport {
  const missing: string[] = [];
  if (mem.evidence.comprendre === 0 || mem.scores.comprendre < THRESHOLD.comprendre)
    missing.push("expliquer la notion avec tes mots");
  if (mem.evidence.identifier === 0 || mem.scores.identifier < THRESHOLD.identifier)
    missing.push("reconnaître la méthode à utiliser");
  if (mem.evidence.appliquer === 0 || mem.scores.appliquer < THRESHOLD.appliquer)
    missing.push("appliquer correctement sur un calcul");
  if (mem.evidence.raisonner === 0 || mem.scores.raisonner < THRESHOLD.raisonner)
    missing.push("justifier ton résultat");
  if (!mem.solved.some((d) => d >= 2))
    missing.push("réussir un exercice différent de l'exemple");

  const global = globalMastery(mem);
  if (global < GLOBAL_THRESHOLD) missing.push(`atteindre ${GLOBAL_THRESHOLD} % de maîtrise (tu es à ${global} %)`);

  return { ok: missing.length === 0, global, missing };
}

export function validate(mem: ConceptMemory): ConceptMemory {
  return { ...mem, validated: true, status: "acquis" };
}

/* ── Progression dans le cours ──────────────────────────────── */

export function conceptIdsInOrder(course: Course): string[] {
  return course.chapters.flatMap((c) => c.conceptIds);
}

/** Les prérequis d'une notion sont-ils tous acquis ? */
export function unlocked(concept: Concept, memory: Record<string, ConceptMemory>): boolean {
  return concept.prerequisites.every((p) => getMemory(memory, p).validated);
}

/** Prochaine notion à travailler : la première non validée dont les
    prérequis sont acquis ; à défaut, la première non validée. */
export function nextConcept(course: Course, memory: Record<string, ConceptMemory>): string | null {
  const ids = conceptIdsInOrder(course);
  const pending = ids.filter((id) => !getMemory(memory, id).validated);
  if (!pending.length) return null;
  const ready = pending.find((id) => unlocked(course.concepts[id], memory));
  return ready ?? pending[0];
}

export function courseMastery(course: Course, memory: Record<string, ConceptMemory>): number {
  const ids = conceptIdsInOrder(course);
  if (!ids.length) return 0;
  const sum = ids.reduce((acc, id) => acc + globalMastery(getMemory(memory, id)), 0);
  return Math.round(sum / ids.length);
}

export function stepPosition(course: Course, memory: Record<string, ConceptMemory>): { step: number; total: number } {
  const ids = conceptIdsInOrder(course);
  const done = ids.filter((id) => getMemory(memory, id).validated).length;
  return { step: Math.min(done + 1, ids.length), total: ids.length };
}

/** Notions validées depuis longtemps : candidates à la révision (§16). */
export function dueForReview(
  course: Course,
  memory: Record<string, ConceptMemory>,
  turn: number
): string[] {
  return conceptIdsInOrder(course).filter((id) => {
    const m = getMemory(memory, id);
    return m.validated && turn - m.lastSeenTurn >= REVIEW_AFTER_TURNS;
  });
}
