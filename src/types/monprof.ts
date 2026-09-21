/* ══════════════════════════════════════════════════════════════
   MON PROF — Modèle de domaine
   Tout est sérialisable en JSON : la mémoire de l'élève et les
   cours analysés sont persistés dans localStorage.
   ══════════════════════════════════════════════════════════════ */

/* ── Vérification de la maîtrise ────────────────────────────── */

/** Les 4 dimensions de la maîtrise (cf. §8 du cahier des charges). */
export type Dimension = "comprendre" | "identifier" | "appliquer" | "raisonner";

export const DIMENSIONS: Dimension[] = ["comprendre", "identifier", "appliquer", "raisonner"];

export const DIMENSION_LABEL: Record<Dimension, string> = {
  comprendre: "Comprendre la définition",
  identifier: "Identifier la méthode",
  appliquer: "Appliquer / calculer",
  raisonner: "Interpréter / justifier",
};

/** 🔴 non acquis · 🟠 en cours · 🟢 acquis · ⬜ pas encore étudié */
export type Status = "non-etudie" | "non-acquis" | "en-cours" | "acquis";

export const STATUS_ICON: Record<Status, string> = {
  "non-etudie": "⬜",
  "non-acquis": "🔴",
  "en-cours": "🟠",
  acquis: "🟢",
};

export const STATUS_LABEL: Record<Status, string> = {
  "non-etudie": "Pas encore étudiée",
  "non-acquis": "Non acquis",
  "en-cours": "En cours d'acquisition",
  acquis: "Acquis",
};

/* ── Attentes de réponse ────────────────────────────────────── */

/**
 * Spécification déclarative d'une réponse attendue.
 * Déclarative (et non une fonction) pour rester sérialisable :
 * les cours analysés sont stockés dans localStorage.
 */
export type Expectation =
  /** Valeur numérique, avec tolérance absolue ou relative. */
  | { kind: "number"; value: number; tolerance?: number; unit?: string }
  /** L'élève doit mentionner au moins `min` des mots-clés listés. */
  | { kind: "keywords"; any: string[]; min?: number; forbidden?: string[] }
  /** Choix parmi des propositions ; `correct` est l'index. */
  | { kind: "choice"; options: string[]; correct: number }
  /** Réponse ouverte : aucune correction automatique stricte. */
  | { kind: "open"; goodSigns: string[] };

/** Erreur fréquente détectable automatiquement sur une réponse. */
export type ErrorDetector =
  /** L'élève a répondu `value × factor` (ex. oubli du ×100). */
  | { kind: "factor"; factor: number }
  /** L'élève a inversé numérateur et dénominateur. */
  | { kind: "swapped"; value: number }
  /** Une valeur numérique précise et fausse, typique d'une confusion. */
  | { kind: "value"; value: number }
  /** Des mots qui trahissent une confusion. */
  | { kind: "mentions"; any: string[] };

export interface Pitfall {
  id: string;
  /** Nom court de l'erreur, affiché dans le profil de l'élève. */
  label: string;
  detector: ErrorDetector;
  /** Ce que Mon Prof dit quand il détecte l'erreur. */
  diagnosis: string;
  /** La remédiation proposée juste après. */
  remediation: string;
}

/* ── Contenu pédagogique ────────────────────────────────────── */

export type Strategy =
  | "simple"
  | "exemple"
  | "analogie"
  | "visuel"
  | "demonstration"
  | "reformulation";

export const STRATEGY_LABEL: Record<Strategy, string> = {
  simple: "Explication simple",
  exemple: "Exemple concret",
  analogie: "Analogie du quotidien",
  visuel: "Représentation visuelle",
  demonstration: "Démonstration pas à pas",
  reformulation: "Reformulation minimale",
};

export interface Explanation {
  strategy: Strategy;
  /** Ce que dit le professeur (voix / conversation). */
  say: string;
  /** Ce qui s'écrit au tableau à ce moment-là (optionnel). */
  board?: BoardFrame;
}

/** Une « ardoise » : ce qui apparaît progressivement au tableau. */
export interface BoardFrame {
  title: string;
  lines: BoardLine[];
}

export type BoardLine =
  | { kind: "rule" }
  | { kind: "label"; text: string }
  | { kind: "text"; text: string }
  | { kind: "formula"; text: string }
  | { kind: "step"; text: string }
  | { kind: "highlight"; text: string };

export interface Check {
  id: string;
  dimension: Dimension;
  prompt: string;
  expect: Expectation;
  /** Explication donnée après la réponse, juste ou fausse. */
  debrief: string;
}

export interface Exercise {
  id: string;
  /** 1 = application directe … 5 = défi de maîtrise (cf. §13). */
  difficulty: 1 | 2 | 3 | 4 | 5;
  dimension: Dimension;
  prompt: string;
  expect: Expectation;
  /** 3 indices de plus en plus explicites (cf. §13). */
  hints: string[];
  /** Découpage pour le mode « exercice guidé » (cf. §14). */
  guided?: { question: string; expect: Expectation }[];
  /** Résolution complète, montrée en dernier recours seulement. */
  solution: string[];
}

export interface Concept {
  id: string;
  title: string;
  objective: string;
  /** Niveau dans la progression : 1 fondamentaux → 5 maîtrise. */
  level: 1 | 2 | 3 | 4 | 5;
  prerequisites: string[];
  keywords: string[];
  explanations: Explanation[];
  checks: Check[];
  exercises: Exercise[];
  pitfalls: Pitfall[];
  summary: { know: string[]; retain: string; skill: string };
}

export interface Chapter {
  id: string;
  title: string;
  conceptIds: string[];
}

export interface Course {
  id: string;
  title: string;
  subject: string;
  createdAt: number;
  /** "seed" = cours intégré, "import" = cours analysé depuis un texte. */
  origin: "seed" | "import";
  chapters: Chapter[];
  concepts: Record<string, Concept>;
}

/* ── Mémoire de l'élève ─────────────────────────────────────── */

export interface ConceptMemory {
  /** Score 0–100 par dimension. */
  scores: Record<Dimension, number>;
  /** Nombre de preuves apportées par dimension (une réponse = 1). */
  evidence: Record<Dimension, number>;
  /** Exercices réussis, par difficulté. */
  solved: number[];
  attempts: number;
  errors: string[];
  /** Index du dernier tour où la notion a été travaillée (révision espacée). */
  lastSeenTurn: number;
  status: Status;
  /** Validé explicitement par le moteur de validation. */
  validated: boolean;
}

export interface Diagnostic {
  level: string;
  goal: string;
  known: string;
  difficulties: string;
  minutes: number;
  confidence: number;
  done: boolean;
}

export interface LearnerProfile {
  name: string;
  /** Stratégie d'explication qui a le mieux fonctionné jusqu'ici. */
  preferredStrategy: Strategy | null;
  /** Erreurs fréquentes, cumulées tous cours confondus. */
  frequentErrors: Record<string, number>;
}

export interface CourseProgress {
  courseId: string;
  diagnostic: Diagnostic;
  memory: Record<string, ConceptMemory>;
  currentConceptId: string | null;
  turn: number;
  lastSession: number;
  /** Petit résumé « où on s'était arrêté » (cf. §18). */
  lastPosition: string;
}

/* ── Machine à états pédagogique (cf. §30) ──────────────────── */

export type Phase =
  | "diagnostic"
  | "cartographie"
  | "explication"
  | "question"
  | "analyse"
  | "remediation"
  | "exercice"
  | "guide"
  | "validation"
  | "synthese"
  | "revision"
  | "examen"
  | "termine";

export type Mode =
  | "EXPLICATION"
  | "QUESTION"
  | "COACH"
  | "CORRECTION"
  | "REVISION"
  | "EXAMEN"
  | "DEFI";

export interface PendingTask {
  kind: "check" | "exercise" | "guided" | "exam";
  conceptId: string;
  /** id du Check / de l'Exercise concerné. */
  itemId: string;
  /** Étape courante en mode exercice guidé. */
  guidedIndex?: number;
  /** Nombre d'indices déjà donnés (0–3). */
  hintsUsed: number;
  tries: number;
  expect: Expectation;
  dimension: Dimension;
  difficulty?: number;
}

export interface ExamItem {
  conceptId: string;
  itemId: string;
  kind: "check" | "exercise";
  prompt: string;
  expect: Expectation;
  dimension: Dimension;
  points: number;
}

export interface ExamState {
  items: ExamItem[];
  index: number;
  answers: { itemId: string; ok: boolean; raw: string; points: number }[];
  /** Barème total de l'épreuve. */
  total: number;
}

export interface TutorState {
  courseId: string;
  phase: Phase;
  mode: Mode;
  conceptId: string | null;
  /** Index de l'explication en cours dans concept.explanations. */
  explanationIndex: number;
  /** Index du check en cours. */
  checkIndex: number;
  /** Index de l'exercice en cours. */
  exerciseIndex: number;
  pending: PendingTask | null;
  exam: ExamState | null;
  board: BoardFrame | null;
  /** Compteur de tours, sert à la révision espacée. */
  turn: number;
  /** Notions à réviser, empilées par le moteur de révision. */
  reviewQueue: string[];
  diagnosticStep: number;
}

/* ── Conversation ───────────────────────────────────────────── */

export interface Message {
  id: string;
  from: "prof" | "eleve";
  text: string;
  /** Marque visuelle : ✅ réussite, ❌ erreur, 💡 indice, 🎯 validation. */
  tone?: "neutre" | "succes" | "erreur" | "indice" | "validation";
  at: number;
}

/** Résultat d'un tour du moteur : ce que dit le prof + le tableau. */
export interface TutorTurn {
  state: TutorState;
  messages: Message[];
  board: BoardFrame | null;
  /** Texte à lire par la synthèse vocale (voix du professeur). */
  speech: string;
  /** Mises à jour de la mémoire de l'élève à appliquer. */
  memoryPatch: Record<string, ConceptMemory>;
  /** Erreur détectée à enregistrer dans le profil. */
  errorLabel?: string;
  /** Réponses du diagnostic initial à enregistrer. */
  diagnosticPatch?: Partial<Diagnostic>;
  /** Stratégie d'explication qui vient de fonctionner. */
  strategyThatWorked?: Strategy;
}
