/* ══════════════════════════════════════════════════════════════
   MON PROF — Moteur pédagogique
   Machine à états : DIAGNOSTIC → EXPLICATION → QUESTION → ANALYSE
   → (REMÉDIATION | APPROFONDISSEMENT) → EXERCICE → VALIDATION
   → ÉTAPE SUIVANTE, avec révision espacée et mode examen.

   Règle absolue appliquée ici : on ne quitte jamais une notion parce
   que l'élève a dit « oui ». On la quitte quand canValidate() est
   satisfait, c'est-à-dire quand la maîtrise a été démontrée sur les
   quatre dimensions ET sur un exercice différent de l'exemple.
   ══════════════════════════════════════════════════════════════ */

import type {
  BoardFrame, Check, Concept, ConceptMemory, Course, Diagnostic, Dimension,
  Exercise, ExamItem, Expectation, LearnerProfile, Message, PendingTask,
  Strategy, TutorState, TutorTurn,
} from "@/types/monprof";
import { STATUS_ICON } from "@/types/monprof";
import { describeExpectation, detectIntent, findPitfall, judge } from "./answer";
import { frame } from "./builders";
import {
  canValidate, conceptIdsInOrder, dueForReview, emptyMemory, getMemory,
  globalMastery, nextConcept, recordEvidence, validate,
} from "./mastery";
import { mentions, normalize, uid } from "./text";

export interface TutorContext {
  course: Course;
  state: TutorState;
  memory: Record<string, ConceptMemory>;
  profile: LearnerProfile;
  diagnostic: Diagnostic;
}

export function initialState(courseId: string): TutorState {
  return {
    courseId,
    phase: "diagnostic",
    mode: "EXPLICATION",
    conceptId: null,
    explanationIndex: 0,
    checkIndex: 0,
    exerciseIndex: 0,
    pending: null,
    exam: null,
    board: null,
    turn: 0,
    reviewQueue: [],
    diagnosticStep: 0,
  };
}

/* ── Brouillon de tour ──────────────────────────────────────── */

interface Draft {
  msgs: Message[];
  board: BoardFrame | null;
  state: TutorState;
  patch: Record<string, ConceptMemory>;
  errorLabel?: string;
  diagnosticPatch?: Partial<Diagnostic>;
  strategyThatWorked?: Strategy;
}

const message = (text: string, tone: Message["tone"] = "neutre"): Message => ({
  id: uid(), from: "prof", text, tone, at: Date.now(),
});

const push = (d: Draft, text: string, tone: Message["tone"] = "neutre") => {
  d.msgs.push(message(text, tone));
};

/** Texte lu à voix haute : on retire les décorations visuelles. */
function toSpeech(msgs: Message[]): string {
  return msgs
    .map((m) => m.text)
    .join(" ")
    .replace(/[─│┌┐└┘├┤■□▌]/g, " ")
    .replace(/\s*\n\s*/g, ". ")
    .replace(/[•·]/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function finish(d: Draft): TutorTurn {
  return {
    state: { ...d.state, board: d.board ?? d.state.board },
    messages: d.msgs,
    board: d.board ?? d.state.board,
    speech: toSpeech(d.msgs),
    memoryPatch: d.patch,
    errorLabel: d.errorLabel,
    diagnosticPatch: d.diagnosticPatch,
    strategyThatWorked: d.strategyThatWorked,
  };
}

const draft = (ctx: TutorContext): Draft => ({
  msgs: [],
  board: null,
  state: { ...ctx.state, turn: ctx.state.turn + 1 },
  patch: {},
});

/* ── Accès mémoire ──────────────────────────────────────────── */

function mem(d: Draft, ctx: TutorContext, id: string): ConceptMemory {
  return d.patch[id] ?? ctx.memory[id] ?? emptyMemory();
}

function setMem(d: Draft, id: string, m: ConceptMemory) {
  d.patch[id] = m;
}

function conceptOf(ctx: TutorContext, id: string | null): Concept | null {
  return id ? ctx.course.concepts[id] ?? null : null;
}

function stepNumber(course: Course, id: string): number {
  return conceptIdsInOrder(course).indexOf(id) + 1;
}

/* ── Rythme, adapté au diagnostic (§17) ─────────────────────── */

const isFast = (ctx: TutorContext) => ctx.diagnostic.confidence >= 8;
const isFragile = (ctx: TutorContext) => ctx.diagnostic.confidence > 0 && ctx.diagnostic.confidence <= 4;

/* ══════════════════════════════════════════════════════════════
   DIAGNOSTIC (§3)
   ══════════════════════════════════════════════════════════════ */

const DIAG_QUESTIONS: { key: keyof Diagnostic; prompt: string }[] = [
  { key: "level", prompt: "Pour commencer, dis-moi où tu en es : quelle est ta classe, ou ton niveau sur ce sujet ?" },
  { key: "goal", prompt: "Très bien. Et quel est ton objectif : comprendre la notion, préparer un contrôle, rattraper un retard ?" },
  { key: "known", prompt: "Qu'est-ce que tu connais déjà de ce sujet ? Même vaguement, même si tu n'es pas sûr." },
  { key: "difficulties", prompt: "Y a-t-il un point précis qui t'a déjà posé problème ? Si tu ne sais pas, réponds simplement « je ne sais pas »." },
  { key: "minutes", prompt: "Combien de temps as-tu devant toi aujourd'hui, en minutes ?" },
  { key: "confidence", prompt: "Dernière question, et on commence : sur 10, à combien estimes-tu ta confiance sur ce sujet ?" },
];

function askDiagnostic(d: Draft, step: number) {
  d.state.diagnosticStep = step;
  d.state.phase = "diagnostic";
  push(d, DIAG_QUESTIONS[step].prompt);
}

function cartographie(d: Draft, ctx: TutorContext) {
  const { course } = ctx;
  const ids = conceptIdsInOrder(course);
  d.state.phase = "cartographie";

  const plan = course.chapters
    .map((ch) => {
      const lines = ch.conceptIds.map((id) => {
        const c = course.concepts[id];
        return `   ${String(stepNumber(course, id)).padStart(2, "0")} ─ ${c.title}`;
      });
      return `${ch.title}\n${lines.join("\n")}`;
    })
    .join("\n\n");

  const minutes = ctx.diagnostic.minutes || 0;
  const budget =
    minutes > 0 && minutes < 20
      ? `Tu as ${minutes} minutes : on ne fera pas tout, et ce n'est pas grave. On avancera proprement sur la première notion plutôt que de survoler les six.`
      : minutes >= 20
      ? `Avec ${minutes} minutes, on peut viser deux étapes solides. Mieux vaut deux notions maîtrisées que six notions vues.`
      : "";

  push(d, `Merci, c'est exactement ce que j'avais besoin de savoir. J'ai organisé le cours en ${ids.length} étapes, dans l'ordre où elles s'appuient les unes sur les autres.`);
  push(d, plan);
  if (budget) push(d, budget);

  d.board = frame(
    "PROGRESSION",
    ...course.chapters.flatMap((ch) => [
      `#${ch.title}`,
      ...ch.conceptIds.map((id) => `${String(stepNumber(course, id)).padStart(2, "0")} ─ ${course.concepts[id].title}`),
      "~",
    ]),
    "!On ne passe à l'étape suivante qu'une fois la précédente démontrée",
  );
}

/* ══════════════════════════════════════════════════════════════
   ENSEIGNEMENT
   ══════════════════════════════════════════════════════════════ */

function enterConcept(d: Draft, ctx: TutorContext, conceptId: string) {
  const concept = ctx.course.concepts[conceptId];
  d.state.conceptId = conceptId;
  d.state.explanationIndex = 0;
  d.state.checkIndex = 0;
  d.state.exerciseIndex = 0;
  d.state.mode = "EXPLICATION";
  d.state.phase = "explication";

  const n = stepNumber(ctx.course, conceptId);
  const locked = concept.prerequisites.filter((p) => !getMemory(ctx.memory, p).validated);

  push(d, `ÉTAPE ${n} — ${concept.title}\n\nObjectif : ${concept.objective}`, "validation");

  if (locked.length) {
    const names = locked.map((p) => ctx.course.concepts[p]?.title).filter(Boolean).join(", ");
    push(d, `Petite précision avant de commencer : cette notion s'appuie sur « ${names} ». On va donc avancer doucement, et je reviendrai en arrière si je vois que ça coince.`);
  }
  if (isFragile(ctx)) {
    push(d, "Tu m'as dit ne pas être très à l'aise sur ce sujet. On va prendre le temps qu'il faut, et je te poserai beaucoup de petites questions plutôt qu'une grosse.");
  }

  deliverExplanation(d, ctx, concept, 0);
  askCheck(d, ctx, concept, 0);
}

function deliverExplanation(d: Draft, ctx: TutorContext, concept: Concept, index: number) {
  const i = Math.min(index, concept.explanations.length - 1);
  const ex = concept.explanations[i];
  d.state.explanationIndex = i;
  push(d, ex.say);
  if (ex.board) d.board = ex.board;
}

function askCheck(d: Draft, ctx: TutorContext, concept: Concept, index: number) {
  const check = concept.checks[index];
  if (!check) {
    askExercise(d, ctx, concept, d.state.exerciseIndex);
    return;
  }
  d.state.checkIndex = index;
  d.state.phase = "question";
  d.state.mode = "QUESTION";
  d.state.pending = {
    kind: "check",
    conceptId: concept.id,
    itemId: check.id,
    hintsUsed: 0,
    tries: 0,
    expect: check.expect,
    dimension: check.dimension,
  };
  push(d, check.prompt);
}

function askExercise(d: Draft, ctx: TutorContext, concept: Concept, index: number) {
  const ex = concept.exercises[index];
  if (!ex) {
    remediateWeakest(d, ctx, concept);
    return;
  }
  d.state.exerciseIndex = index;
  d.state.phase = "exercice";
  d.state.mode = "COACH";
  d.state.pending = {
    kind: "exercise",
    conceptId: concept.id,
    itemId: ex.id,
    hintsUsed: 0,
    tries: 0,
    expect: ex.expect,
    dimension: ex.dimension,
    difficulty: ex.difficulty,
  };
  push(d, `EXERCICE ${index + 1} — difficulté ${ex.difficulty}/5\n\n${ex.prompt}`);
  d.board = frame(
    `EXERCICE ${index + 1}`,
    ...ex.prompt.slice(0, 220).split(/(?<=[.;?])\s+/).slice(0, 4),
    "~",
    "!Essaie d'abord seul. Demande un indice si tu bloques.",
  );
}

/** Aucun item disponible : on retravaille la dimension la plus faible. */
function remediateWeakest(d: Draft, ctx: TutorContext, concept: Concept) {
  const m = mem(d, ctx, concept.id);
  const report = canValidate(m);
  const order: Dimension[] = ["comprendre", "identifier", "appliquer", "raisonner"];
  const weakest = order.reduce((a, b) => (m.scores[a] <= m.scores[b] ? a : b));

  push(
    d,
    `On ne va pas passer à la suite tout de suite. Il te manque encore ${report.missing[0] ?? "un peu de pratique"}. Ce n'est pas un échec — c'est exactement pour ça qu'on travaille.`,
    "indice"
  );

  // On change de stratégie d'explication avant de redemander (§11).
  deliverExplanation(d, ctx, concept, d.state.explanationIndex + 1);

  const check = concept.checks.find((c) => c.dimension === weakest) ?? concept.checks[0];
  const exercise = concept.exercises.find((e) => e.dimension === weakest && e.difficulty >= 2);

  if (weakest === "appliquer" && exercise) {
    const idx = concept.exercises.indexOf(exercise);
    askExercise(d, ctx, concept, idx);
  } else if (check) {
    askCheck(d, ctx, concept, concept.checks.indexOf(check));
  } else {
    askExercise(d, ctx, concept, 0);
  }
}

/* ── Synthèse et passage à l'étape suivante (§20) ───────────── */

function progressionTable(ctx: TutorContext, patch: Record<string, ConceptMemory>): string {
  return conceptIdsInOrder(ctx.course)
    .map((id) => {
      const m = patch[id] ?? ctx.memory[id] ?? emptyMemory();
      const icon = STATUS_ICON[m.validated ? "acquis" : m.status];
      const pct = globalMastery(m);
      return `${icon}  ${String(stepNumber(ctx.course, id)).padStart(2, "0")} ${ctx.course.concepts[id].title} — ${pct} %`;
    })
    .join("\n");
}

function synthese(d: Draft, ctx: TutorContext, concept: Concept) {
  const m = validate(mem(d, ctx, concept.id));
  setMem(d, concept.id, m);
  d.state.phase = "synthese";
  d.state.pending = null;

  push(d, "Voilà. Cette fois, ce n'est pas juste une bonne réponse : tu as expliqué, tu as appliqué, et tu as réussi un exercice différent de l'exemple. Je considère donc la notion comme maîtrisée.", "validation");
  push(
    d,
    `CE QUE TU SAIS MAINTENANT\n${concept.summary.know.map((k) => `• ${k}`).join("\n")}\n\nCE QUE TU DOIS RETENIR\n> ${concept.summary.retain}\n\nCOMPÉTENCE VALIDÉE\n> ${concept.summary.skill}`,
    "validation"
  );
  push(d, progressionTable(ctx, d.patch));

  d.board = frame(
    "ÉTAPE VALIDÉE",
    `#${concept.title}`,
    ...concept.summary.know.map((k) => `>${k}`),
    "~",
    "# À retenir",
    `!${concept.summary.retain}`,
  );

  const next = nextConcept(ctx.course, { ...ctx.memory, ...d.patch });
  if (!next) {
    push(d, "Et ce n'était pas la dernière étape : c'était la dernière tout court. Tu as parcouru tout le cours, et chaque notion a été validée sur preuve. Si tu veux, je peux te faire passer une évaluation finale — dis-moi simplement « examen ».");
    d.state.phase = "termine";
    return;
  }

  push(d, `Cette étape est maintenant maîtrisée. La suivante s'appelle « ${ctx.course.concepts[next].title} ». Tu veux qu'on enchaîne, ou tu as une question sur ce qu'on vient de faire ?`);
}

/* ── Après une réponse résolue : que fait-on ensuite ? ──────── */

function afterResolved(d: Draft, ctx: TutorContext, concept: Concept) {
  const m = mem(d, ctx, concept.id);
  const report = canValidate(m);

  if (report.ok) {
    synthese(d, ctx, concept);
    return;
  }

  // Encore des vérifications à passer ?
  if (d.state.checkIndex + 1 < concept.checks.length && d.state.exerciseIndex === 0) {
    askCheck(d, ctx, concept, d.state.checkIndex + 1);
    return;
  }

  // Sinon, on pratique.
  const nextEx = d.state.exerciseIndex + (d.state.phase === "exercice" ? 1 : 0);
  if (nextEx < concept.exercises.length) {
    if (d.state.phase !== "exercice") {
      push(d, "Bien. La compréhension est là — maintenant il faut que la main suive. On passe à la pratique.");
    }
    askExercise(d, ctx, concept, nextEx);
    return;
  }

  remediateWeakest(d, ctx, concept);
}

function goToNextConcept(d: Draft, ctx: TutorContext) {
  const merged = { ...ctx.memory, ...d.patch };

  // Révision espacée avant d'ouvrir une nouvelle notion (§16).
  const due = dueForReview(ctx.course, merged, d.state.turn).filter((id) => !d.state.reviewQueue.includes(id));
  if (due.length) {
    startReview(d, ctx, due[0]);
    return;
  }

  const next = nextConcept(ctx.course, merged);
  if (!next) {
    push(d, "Il ne reste plus aucune notion en attente : tout le cours est validé. Dis-moi « examen » si tu veux une évaluation globale, ou « révision » pour que je te repose des questions surprises.");
    d.state.phase = "termine";
    return;
  }
  enterConcept(d, ctx, next);
}

/* ══════════════════════════════════════════════════════════════
   RÉVISION (§16)
   ══════════════════════════════════════════════════════════════ */

function startReview(d: Draft, ctx: TutorContext, conceptId: string) {
  const concept = ctx.course.concepts[conceptId];
  if (!concept) { goToNextConcept(d, ctx); return; }

  const item =
    concept.exercises.find((e) => e.difficulty >= 2 && e.expect.kind !== "open") ??
    concept.checks.find((c) => c.dimension === "appliquer") ??
    concept.checks[0];

  d.state.mode = "REVISION";
  d.state.phase = "revision";
  d.state.reviewQueue = [...d.state.reviewQueue, conceptId];
  d.state.conceptId = conceptId;

  push(d, `Petite question surprise avant d'ouvrir la suite — c'est comme ça qu'on vérifie qu'une notion tient dans le temps, et pas seulement cinq minutes après l'explication.`, "indice");
  push(d, `Rappel sur « ${concept.title} » : ${"prompt" in item ? item.prompt : ""}`);

  d.state.pending = {
    kind: "check",
    conceptId,
    itemId: item.id,
    hintsUsed: 0,
    tries: 0,
    expect: item.expect,
    dimension: "dimension" in item ? item.dimension : "appliquer",
  };
  d.board = frame("RÉVISION", `#${concept.title}`, `!${concept.summary.retain}`);
}

/* ══════════════════════════════════════════════════════════════
   EXAMEN (§15)
   ══════════════════════════════════════════════════════════════ */

function buildExam(ctx: TutorContext): ExamItem[] {
  const items: ExamItem[] = [];
  for (const id of conceptIdsInOrder(ctx.course)) {
    const m = getMemory(ctx.memory, id);
    const studied = m.status !== "non-etudie";
    if (!studied) continue;
    const concept = ctx.course.concepts[id];
    const check = concept.checks.find((c) => c.dimension === "appliquer") ?? concept.checks[0];
    const exo = concept.exercises.find((e) => e.difficulty >= 2);
    if (check) items.push({ conceptId: id, itemId: check.id, kind: "check", prompt: check.prompt, expect: check.expect, dimension: check.dimension, points: 2 });
    if (exo) items.push({ conceptId: id, itemId: exo.id, kind: "exercise", prompt: exo.prompt, expect: exo.expect, dimension: exo.dimension, points: 3 });
  }
  return items.slice(0, 8);
}

function startExam(d: Draft, ctx: TutorContext) {
  const items = buildExam(ctx);
  if (!items.length) {
    push(d, "On ne peut pas encore faire d'examen : il faut avoir travaillé au moins une notion. Commençons par là, l'évaluation viendra ensuite.");
    return;
  }
  const total = items.reduce((a, i) => a + i.points, 0);
  d.state.exam = { items, index: 0, answers: [], total };
  d.state.mode = "EXAMEN";
  d.state.phase = "examen";

  push(d, `MODE EXAMEN\n\n${items.length} questions, barème sur ${total} points. Je ne corrige rien avant la fin : réponds du mieux que tu peux, et si tu sèches, écris « je ne sais pas » et on passe à la suivante.`, "validation");
  askExamQuestion(d, ctx);
}

function askExamQuestion(d: Draft, ctx: TutorContext) {
  const exam = d.state.exam;
  if (!exam) return;
  const item = exam.items[exam.index];
  push(d, `Question ${exam.index + 1}/${exam.items.length} (${item.points} pts)\n\n${item.prompt}`);
  d.state.pending = {
    kind: "exam",
    conceptId: item.conceptId,
    itemId: item.itemId,
    hintsUsed: 0,
    tries: 0,
    expect: item.expect,
    dimension: item.dimension,
  };
  d.board = frame("EXAMEN EN COURS", `#Question ${exam.index + 1} / ${exam.items.length}`, "~", "!Aucune correction avant la fin");
}

function handleExamAnswer(d: Draft, ctx: TutorContext, raw: string) {
  const exam = d.state.exam;
  if (!exam) return;
  const item = exam.items[exam.index];
  const verdict = judge(raw, item.expect);
  const points = verdict.ok ? item.points : verdict.partial ? Math.round(item.points / 2) : 0;

  exam.answers = [...exam.answers, { itemId: item.itemId, ok: verdict.ok, raw, points }];
  exam.index += 1;

  if (exam.index < exam.items.length) {
    push(d, "C'est noté. Question suivante.");
    askExamQuestion(d, ctx);
    return;
  }

  /* — Correction détaillée — */
  const score = exam.answers.reduce((a, x) => a + x.points, 0);
  const pct = Math.round((score / exam.total) * 100);

  const detail = exam.answers
    .map((a, i) => {
      const it = exam.items[i];
      const icon = a.ok ? "✅" : a.points > 0 ? "🟠" : "❌";
      return `${icon} Q${i + 1} — ${a.points}/${it.points}${a.ok ? "" : `  (attendu : ${describeExpectation(it.expect)})`}`;
    })
    .join("\n");

  const byConcept = new Map<string, { ok: number; total: number }>();
  exam.answers.forEach((a, i) => {
    const cid = exam.items[i].conceptId;
    const cur = byConcept.get(cid) ?? { ok: 0, total: 0 };
    byConcept.set(cid, { ok: cur.ok + (a.ok ? 1 : 0), total: cur.total + 1 });
  });

  const mastered: string[] = [];
  const toWork: string[] = [];
  byConcept.forEach((v, cid) => {
    const title = ctx.course.concepts[cid]?.title ?? cid;
    (v.ok === v.total ? mastered : toWork).push(title);
    // L'examen compte comme preuve : il nourrit la mémoire.
    const ratio = v.total ? v.ok / v.total : 0;
    setMem(d, cid, recordEvidence(mem(d, ctx, cid), "appliquer", ratio, { turn: d.state.turn }));
  });

  push(d, `RÉSULTAT : ${score}/${exam.total} — ${pct} %`, pct >= 70 ? "succes" : "erreur");
  push(d, detail);
  push(
    d,
    `COMPÉTENCES MAÎTRISÉES\n${mastered.length ? mastered.map((t) => `🟢 ${t}`).join("\n") : "— aucune pour l'instant, et ce n'est pas grave : on sait maintenant où travailler."}\n\nÀ RETRAVAILLER\n${toWork.length ? toWork.map((t) => `🟠 ${t}`).join("\n") : "— rien, c'est du solide."}`
  );
  d.board = frame("RÉSULTAT D'EXAMEN", `=${score} / ${exam.total}`, `!${pct} %`, "~", ...toWork.map((t) => `>À retravailler : ${t}`));

  d.state.exam = null;
  d.state.pending = null;
  d.state.mode = "EXPLICATION";
  d.state.phase = "synthese";

  if (toWork.length) {
    push(d, `On va reprendre « ${toWork[0]} » ensemble : dis-moi « on continue » quand tu es prêt.`);
    const cid = [...byConcept.entries()].find(([c, v]) => v.ok !== v.total)?.[0];
    if (cid) d.state.conceptId = cid;
  } else {
    push(d, "Rien à reprendre. Dis-moi « on continue » pour avancer dans le cours.");
  }
}

/* ══════════════════════════════════════════════════════════════
   TRAITEMENT D'UNE RÉPONSE (analyse → remédiation ou validation)
   ══════════════════════════════════════════════════════════════ */

function itemOf(concept: Concept, pending: PendingTask): Check | Exercise | null {
  if (pending.kind === "exercise" || pending.kind === "guided") {
    return concept.exercises.find((e) => e.id === pending.itemId) ?? null;
  }
  return (
    concept.checks.find((c) => c.id === pending.itemId) ??
    concept.exercises.find((e) => e.id === pending.itemId) ??
    null
  );
}

const PRAISE = [
  "Exactement.",
  "C'est ça, et c'est bien mené.",
  "Parfait.",
  "Très bien — et tu ne t'es pas laissé piéger.",
];

function handleAnswer(d: Draft, ctx: TutorContext, raw: string) {
  const pending = d.state.pending;
  if (!pending) { goToNextConcept(d, ctx); return; }

  const concept = ctx.course.concepts[pending.conceptId];
  if (!concept) { d.state.pending = null; goToNextConcept(d, ctx); return; }

  if (pending.kind === "guided") { handleGuided(d, ctx, concept, raw); return; }

  const item = itemOf(concept, pending);
  const verdict = judge(raw, pending.expect);

  /* ── Réussite ── */
  if (verdict.ok) {
    const m = recordEvidence(mem(d, ctx, concept.id), pending.dimension, 1, {
      difficulty: pending.difficulty,
      turn: d.state.turn,
    });
    setMem(d, concept.id, m);
    d.strategyThatWorked = concept.explanations[d.state.explanationIndex]?.strategy;

    const praise = PRAISE[d.state.turn % PRAISE.length];
    const debrief = item && "debrief" in item ? item.debrief : item ? item.solution.join(" · ") : "";
    push(d, `${praise} ${debrief}`.trim(), "succes");
    d.state.pending = null;

    // Réussir ne suffit pas : on demande parfois la justification (§9).
    const m2 = mem(d, ctx, concept.id);
    const needsJustification =
      pending.kind === "exercise" &&
      (pending.difficulty ?? 1) >= 2 &&
      m2.evidence.raisonner === 0;

    if (needsJustification) {
      push(d, "Maintenant, la question qui compte vraiment : explique-moi comment tu as obtenu ce résultat. Pas le résultat — la démarche.");
      d.state.pending = {
        kind: "check",
        conceptId: concept.id,
        itemId: `just-${pending.itemId}`,
        hintsUsed: 0,
        tries: 0,
        dimension: "raisonner",
        expect: { kind: "open", goodSigns: [...concept.keywords.slice(0, 4), "divise", "multiplie", "additionne", "ordonne", "formule", "etape"] },
      };
      d.state.phase = "question";
      return;
    }

    if (d.state.phase === "revision") {
      push(d, "Parfait — la notion a tenu dans le temps, c'est ça qui m'intéresse. On peut avancer.");
      d.state.phase = "synthese";
      d.state.pending = null;
      goToNextConcept(d, ctx);
      return;
    }

    afterResolved(d, ctx, concept);
    return;
  }

  /* ── Presque ── */
  if (verdict.partial && pending.tries === 0) {
    d.state.pending = { ...pending, tries: 1 };
    push(d, `Tu n'es pas loin — ${verdict.detail}. Reprends juste la dernière étape de ton raisonnement et redis-moi ta réponse.`, "indice");
    return;
  }

  /* ── Erreur ── */
  const pitfall = item ? findPitfall(raw, pending.expect, concept.pitfalls) : null;
  const tries = pending.tries + 1;

  if (pitfall) {
    d.errorLabel = pitfall.label;
    const m = recordEvidence(mem(d, ctx, concept.id), pending.dimension, 0.15, {
      turn: d.state.turn,
      errorLabel: pitfall.label,
    });
    setMem(d, concept.id, m);
    push(d, `Ta démarche est intéressante, regardons précisément où le raisonnement change. ${pitfall.diagnosis}`, "erreur");
    push(d, pitfall.remediation, "indice");
  } else {
    push(d, `Ce n'est pas encore ça. Ne cherche pas à deviner : reprenons le raisonnement au bon endroit.`, "erreur");
  }

  const exercise = item && "hints" in item ? item : null;

  if (tries === 1) {
    if (exercise) {
      push(d, `INDICE 1 — ${exercise.hints[0]}`, "indice");
      d.state.pending = { ...pending, tries, hintsUsed: 1 };
    } else {
      deliverExplanation(d, ctx, concept, d.state.explanationIndex + 1);
      push(d, `Je repose la question, autrement : ${item && "prompt" in item ? item.prompt : ""}`);
      d.state.pending = { ...pending, tries };
    }
    return;
  }

  if (tries === 2) {
    push(d, "On change complètement d'approche. Ce n'est pas toi le problème, c'est mon explication qui ne t'a pas parlé.", "indice");
    deliverExplanation(d, ctx, concept, d.state.explanationIndex + 1);
    if (exercise) {
      push(d, `INDICE 2 — ${exercise.hints[1] ?? exercise.hints[0]}`, "indice");
      d.state.pending = { ...pending, tries, hintsUsed: 2 };
    } else {
      push(d, `Reprends : ${item && "prompt" in item ? item.prompt : ""}`);
      d.state.pending = { ...pending, tries };
    }
    return;
  }

  // Troisième échec : on découpe l'exercice, ou on corrige et on repart.
  if (exercise && exercise.guided && exercise.guided.length) {
    startGuided(d, ctx, concept, exercise);
    return;
  }

  const m = recordEvidence(mem(d, ctx, concept.id), pending.dimension, 0.2, { turn: d.state.turn });
  setMem(d, concept.id, m);

  if (exercise) {
    push(d, `On la fait ensemble, étape par étape :\n${exercise.solution.map((s, i) => `${i + 1}. ${s}`).join("\n")}`, "indice");
    d.board = frame("CORRECTION", ...exercise.solution.map((s) => `>${s}`));
  } else if (item && "debrief" in item) {
    push(d, item.debrief, "indice");
  }
  push(d, "Je ne valide pas la notion là-dessus : je veux te la voir réussir sur un autre exercice. On y va.");
  d.state.pending = null;
  afterResolved(d, ctx, concept);
}

/* ── Mode exercice guidé (§14) ──────────────────────────────── */

function startGuided(d: Draft, ctx: TutorContext, concept: Concept, exercise: Exercise) {
  d.state.phase = "guide";
  d.state.mode = "COACH";
  push(d, "On arrête d'essayer en bloc. Je découpe l'exercice en petites questions, et tu réponds une par une. Tu vas voir, tu sais déjà faire chaque morceau.", "indice");
  const first = exercise.guided![0];
  push(d, `Étape 1 — ${first.question}`);
  d.state.pending = {
    kind: "guided",
    conceptId: concept.id,
    itemId: exercise.id,
    guidedIndex: 0,
    hintsUsed: 0,
    tries: 0,
    expect: first.expect,
    dimension: exercise.dimension,
    difficulty: exercise.difficulty,
  };
  d.board = frame("EXERCICE GUIDÉ", ...exercise.guided!.map((g, i) => `>Étape ${i + 1} : ${g.question}`));
}

function handleGuided(d: Draft, ctx: TutorContext, concept: Concept, raw: string) {
  const pending = d.state.pending!;
  const exercise = concept.exercises.find((e) => e.id === pending.itemId);
  if (!exercise || !exercise.guided) { d.state.pending = null; afterResolved(d, ctx, concept); return; }

  const idx = pending.guidedIndex ?? 0;
  const stepDef = exercise.guided[idx];
  const verdict = judge(raw, stepDef.expect);

  if (verdict.ok) push(d, "Oui, c'est ça.", "succes");
  else push(d, `Pas tout à fait : c'était ${describeExpectation(stepDef.expect)}. On continue, l'important c'est la suite.`, "indice");

  const nextIdx = idx + 1;
  if (nextIdx < exercise.guided.length) {
    push(d, `Étape ${nextIdx + 1} — ${exercise.guided[nextIdx].question}`);
    d.state.pending = { ...pending, guidedIndex: nextIdx, expect: exercise.guided[nextIdx].expect };
    return;
  }

  // Toutes les étapes passées : on redonne l'exercice complet.
  push(d, "Tu as fait tout le travail, morceau par morceau. Maintenant, reprends l'exercice en entier et donne-moi le résultat final.");
  push(d, exercise.prompt);
  d.state.phase = "exercice";
  d.state.pending = {
    kind: "exercise",
    conceptId: concept.id,
    itemId: exercise.id,
    hintsUsed: 3,
    tries: 0,
    expect: exercise.expect,
    dimension: exercise.dimension,
    difficulty: exercise.difficulty,
  };
}

/* ══════════════════════════════════════════════════════════════
   INTENTIONS PARTICULIÈRES
   ══════════════════════════════════════════════════════════════ */

function handleIncomprehension(d: Draft, ctx: TutorContext) {
  const concept = conceptOf(ctx, d.state.conceptId);
  if (!concept) {
    push(d, "D'accord. Reprenons depuis le début, autrement.");
    goToNextConcept(d, ctx);
    return;
  }
  push(d, "D'accord. On va changer complètement d'approche — je ne vais pas te redire la même chose avec d'autres mots.", "indice");

  const next = (d.state.explanationIndex + 1) % concept.explanations.length;
  deliverExplanation(d, ctx, concept, next);

  const easy = concept.checks.find((c) => c.dimension === "comprendre") ?? concept.checks[0];
  if (easy) {
    push(d, `Dis-moi juste ça, et rien d'autre : ${easy.prompt}`);
    d.state.pending = {
      kind: "check",
      conceptId: concept.id,
      itemId: easy.id,
      hintsUsed: 0,
      tries: 0,
      expect: easy.expect,
      dimension: easy.dimension,
    };
    d.state.phase = "question";
  }
}

function handleHint(d: Draft, ctx: TutorContext) {
  const pending = d.state.pending;
  const concept = conceptOf(ctx, d.state.conceptId);
  if (!pending || !concept) {
    push(d, "Je ne t'ai pas encore posé de question ! Laisse-moi t'en poser une, et je t'aiderai volontiers dessus.");
    return;
  }
  const item = itemOf(concept, pending);
  if (!item || !("hints" in item)) {
    push(d, "Sur cette question-là, il n'y a pas d'astuce à donner : reformule avec tes mots, même maladroitement. C'est ta formulation qui m'intéresse, pas le vocabulaire exact.", "indice");
    return;
  }
  const n = Math.min(pending.hintsUsed, item.hints.length - 1);
  push(d, `INDICE ${n + 1} — ${item.hints[n]}`, "indice");
  if (pending.hintsUsed >= item.hints.length - 1) {
    push(d, "C'est mon dernier indice. Essaie maintenant : même une réponse fausse me dira où ça coince.");
  }
  d.state.pending = { ...pending, hintsUsed: pending.hintsUsed + 1 };
}

function handleSolutionRequest(d: Draft, ctx: TutorContext) {
  const pending = d.state.pending;
  const concept = conceptOf(ctx, d.state.conceptId);
  if (!pending || !concept) {
    push(d, "Il n'y a rien à corriger pour l'instant. On reprend le cours ?");
    return;
  }
  const item = itemOf(concept, pending);

  // On ne donne jamais la solution d'emblée : d'abord le mode guidé.
  if (item && "guided" in item && item.guided && item.guided.length && pending.kind !== "guided") {
    push(d, "Non, ne regarde pas la solution tout de suite. On va la construire ensemble, tu verras que tu en sais plus que tu ne crois.", "indice");
    startGuided(d, ctx, concept, item);
    return;
  }

  if (item && "hints" in item && pending.hintsUsed < item.hints.length) {
    push(d, "Pas encore la solution. D'abord un indice — et si après ça tu bloques toujours, je te montre tout.", "indice");
    handleHint(d, ctx);
    return;
  }

  const m = recordEvidence(mem(d, ctx, concept.id), pending.dimension, 0.2, { turn: d.state.turn });
  setMem(d, concept.id, m);

  if (item && "solution" in item) {
    push(d, `Voilà la résolution complète :\n${item.solution.map((s, i) => `${i + 1}. ${s}`).join("\n")}`, "indice");
    d.board = frame("CORRECTION", ...item.solution.map((s) => `>${s}`));
  } else if (item && "debrief" in item) {
    push(d, item.debrief, "indice");
  }
  push(
    d,
    item && "solution" in item
      ? "Lis-la, puis je te donne un exercice du même type. C'est en le refaisant toi-même que ça rentrera."
      : "Garde ça en tête : je vais te redemander la même chose autrement un peu plus loin, et là je veux que ça vienne de toi."
  );
  d.state.pending = null;
  afterResolved(d, ctx, concept);
}

/** Question libre de l'élève : on répond à partir du cours (§22). */
function handleQuestion(d: Draft, ctx: TutorContext, raw: string) {
  const words = normalize(raw).split(" ").filter((w) => w.length > 3);
  let best: { concept: Concept; score: number } | null = null;

  for (const id of conceptIdsInOrder(ctx.course)) {
    const c = ctx.course.concepts[id];
    const hay = `${c.title} ${c.keywords.join(" ")} ${c.summary.retain}`;
    const score = words.filter((w) => mentions(hay, w)).length + (mentions(raw, c.title) ? 2 : 0);
    if (score > 0 && (!best || score > best.score)) best = { concept: c, score };
  }

  if (best) {
    const simple = best.concept.explanations.find((e) => e.strategy === "simple") ?? best.concept.explanations[0];
    push(d, `Bonne question, et elle tombe bien. Ça concerne « ${best.concept.title} ».`);
    push(d, simple.say);
    push(d, `En une ligne : ${best.concept.summary.retain}`, "indice");
    if (simple.board) d.board = simple.board;
  } else {
    push(d, "Je préfère être honnête : ta question sort de ce que contient ce cours, donc je ne vais pas t'inventer une réponse. Reformule-la avec les mots du cours, ou ajoute le passage concerné à tes documents et je l'intégrerai à la progression.");
  }

  // On revient exactement là où on s'était arrêtés.
  const pending = d.state.pending;
  const concept = conceptOf(ctx, d.state.conceptId);
  if (pending && concept) {
    const item = itemOf(concept, pending);
    if (item && "prompt" in item) push(d, `Revenons à notre question : ${item.prompt}`);
  }
}

function handleDefi(d: Draft, ctx: TutorContext) {
  const concept = conceptOf(ctx, d.state.conceptId);
  if (!concept) { push(d, "Commençons par une notion, et je te donnerai ensuite de quoi te faire transpirer."); return; }
  const hardest = concept.exercises.reduce((a, b) => (b.difficulty > a.difficulty ? b : a), concept.exercises[0]);
  d.state.mode = "DEFI";
  push(d, "Très bien, on monte d'un cran. Celui-là demande de réfléchir, pas d'appliquer.", "indice");
  askExercise(d, ctx, concept, concept.exercises.indexOf(hardest));
}

function handleRevision(d: Draft, ctx: TutorContext) {
  const merged = { ...ctx.memory, ...d.patch };
  const studied = conceptIdsInOrder(ctx.course).filter((id) => getMemory(merged, id).status !== "non-etudie");
  if (!studied.length) {
    push(d, "Il n'y a encore rien à réviser — on n'a pas commencé. Autant s'y mettre tout de suite.");
    goToNextConcept(d, ctx);
    return;
  }
  const target = dueForReview(ctx.course, merged, d.state.turn)[0] ?? studied[d.state.turn % studied.length];
  startReview(d, ctx, target);
}

/* ══════════════════════════════════════════════════════════════
   API PUBLIQUE
   ══════════════════════════════════════════════════════════════ */

/** Premier tour : diagnostic, ou reprise là où l'élève s'était arrêté. */
export function begin(ctx: TutorContext, learnerName?: string): TutorTurn {
  const d = draft(ctx);
  const hello = learnerName ? `Bonjour ${learnerName} !` : "Bonjour !";

  if (!ctx.diagnostic.done) {
    push(d, `${hello} Je suis Mon Prof. On va travailler « ${ctx.course.title} » ensemble.`);
    push(d, "Avant de commencer à expliquer quoi que ce soit, j'ai besoin de savoir où tu en es. Trois ou quatre questions rapides, et on attaque.");
    askDiagnostic(d, 0);
    d.board = frame("MON PROF", `#Cours`, ctx.course.title, "~", "# Avant de commencer", ">Diagnostic : où en es-tu ?");
    return finish(d);
  }

  // Reprise de session (§18)
  const merged = ctx.memory;
  const current = nextConcept(ctx.course, merged);
  const validated = conceptIdsInOrder(ctx.course).filter((id) => getMemory(merged, id).validated);

  push(d, `${hello} Content de te revoir.`);
  if (validated.length) {
    const last = ctx.course.concepts[validated[validated.length - 1]];
    const weak = conceptIdsInOrder(ctx.course)
      .map((id) => ({ id, m: getMemory(merged, id) }))
      .filter((x) => x.m.status === "en-cours" || x.m.status === "non-acquis");
    push(
      d,
      `La dernière fois, on avait validé « ${last.title} ».` +
        (weak.length ? ` Il restait « ${ctx.course.concepts[weak[0].id].title} » à consolider.` : "")
    );
  }
  if (current) {
    push(d, `On reprend sur « ${ctx.course.concepts[current].title} ». Prêt ?`);
    enterConcept(d, ctx, current);
  } else {
    push(d, "Tout le cours est validé. Veux-tu une évaluation globale (« examen ») ou une séance de révision ?");
    d.state.phase = "termine";
  }
  return finish(d);
}

/** Tour de parole de l'élève. */
export function handle(raw: string, ctx: TutorContext): TutorTurn {
  const d = draft(ctx);
  const intent = detectIntent(raw);

  /* — Diagnostic en cours — */
  if (d.state.phase === "diagnostic") {
    const step = d.state.diagnosticStep;
    const q = DIAG_QUESTIONS[step];
    const value =
      q.key === "minutes"
        ? Math.max(0, Math.min(600, Number((raw.match(/\d+/) ?? ["30"])[0])))
        : q.key === "confidence"
        ? Math.max(0, Math.min(10, Number((raw.match(/\d+/) ?? ["5"])[0])))
        : raw.trim().slice(0, 200);
    d.diagnosticPatch = { [q.key]: value } as Partial<Diagnostic>;

    if (step + 1 < DIAG_QUESTIONS.length) {
      askDiagnostic(d, step + 1);
      return finish(d);
    }

    d.diagnosticPatch = { ...d.diagnosticPatch, done: true };
    const merged: TutorContext = { ...ctx, diagnostic: { ...ctx.diagnostic, ...d.diagnosticPatch } as Diagnostic };
    cartographie(d, merged);
    const first = nextConcept(ctx.course, ctx.memory);
    if (first) enterConcept(d, merged, first);
    return finish(d);
  }

  /* — Examen : aucune aide, aucune correction avant la fin — */
  if (d.state.exam) {
    if (intent === "solution" || intent === "indice") {
      push(d, "Pas pendant l'examen — c'est le principe. Écris ce que tu penses, même partiellement : un raisonnement amorcé rapporte des points.");
      return finish(d);
    }
    handleExamAnswer(d, ctx, raw);
    return finish(d);
  }

  /* — Intentions transversales — */
  switch (intent) {
    case "examen": startExam(d, ctx); return finish(d);
    case "revision": handleRevision(d, ctx); return finish(d);
    case "defi": handleDefi(d, ctx); return finish(d);
    case "incomprehension": handleIncomprehension(d, ctx); return finish(d);
    case "indice": handleHint(d, ctx); return finish(d);
    case "solution": handleSolutionRequest(d, ctx); return finish(d);
    case "question": handleQuestion(d, ctx, raw); return finish(d);
    case "continuer":
      if (!d.state.pending) {
        if (d.state.phase === "synthese" || d.state.phase === "cartographie" || d.state.phase === "termine") {
          goToNextConcept(d, ctx);
        } else {
          const concept = conceptOf(ctx, d.state.conceptId);
          if (concept) afterResolved(d, ctx, concept);
          else goToNextConcept(d, ctx);
        }
        return finish(d);
      }
      // « ok » alors qu'une question est posée : on redemande la réponse.
      push(d, "Je veux bien te croire, mais un « d'accord » ne me dit pas si tu as compris. Réponds-moi vraiment, même approximativement.", "indice");
      return finish(d);
    case "reponse":
    default:
      break;
  }

  if (!d.state.pending) {
    const concept = conceptOf(ctx, d.state.conceptId);
    if (concept && (d.state.phase === "synthese" || d.state.phase === "termine")) {
      goToNextConcept(d, ctx);
    } else if (concept) {
      afterResolved(d, ctx, concept);
    } else {
      goToNextConcept(d, ctx);
    }
    return finish(d);
  }

  handleAnswer(d, ctx, raw);
  return finish(d);
}

/** Tableau de progression exporté pour l'interface. */
export function progressionLines(course: Course, memory: Record<string, ConceptMemory>) {
  return conceptIdsInOrder(course).map((id) => {
    const m = getMemory(memory, id);
    return {
      id,
      step: stepNumber(course, id),
      title: course.concepts[id].title,
      status: m.validated ? ("acquis" as const) : m.status,
      mastery: globalMastery(m),
      locked: course.concepts[id].prerequisites.some((p) => !getMemory(memory, p).validated),
    };
  });
}

export type { Expectation };
