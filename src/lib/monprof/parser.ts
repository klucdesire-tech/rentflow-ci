/* Analyseur de cours (§4 et §30 phase 2).
   Transforme un cours brut — collé, importé en .txt/.md, ou recopié
   depuis un PDF — en progression pédagogique : chapitres, notions,
   prérequis, explications, vérifications et exercices.

   Le principe : on ne devine jamais un résultat. Les exercices chiffrés
   ne sont générés que lorsqu'un calcul du cours a été reconnu ET vérifié
   (cf. findComputations). Sinon, on produit des questions de
   compréhension, d'explication et de raisonnement, qui restent
   corrigeables par mots-clés. */

import type {
  Chapter, Check, Concept, Course, Exercise, Explanation, Pitfall,
} from "@/types/monprof";
import { frame } from "./builders";
import { findComputations, formatExpr, variant, type Computation } from "./expr";
import { deaccent, keywords, slug, uid } from "./text";

/* ── Découpage du texte ─────────────────────────────────────── */

interface Block { title: string; body: string; isChapter: boolean }

const CHAPTER_RE = /^\s*(chapitre|partie|module|unite|unité)\s+\w+/i;
const NUMBERED_RE = /^\s*(\d{1,2}|[IVXivx]{1,4})\s*[.)°\-–]\s+\S/;
/** Même motif, mais qui ne consomme pas la première lettre du titre. */
const NUMBER_PREFIX_RE = /^\s*(\d{1,2}|[IVXivx]{1,4})\s*[.)°\-–]\s+(?=\S)/;
const BULLET_RE = /^\s*[-*•·–]\s+/;
/** Sous-sections qui décrivent une notion sans en être une. */
const GENERIC_SECTION_RE = /^(d[ée]finitions?|formules?|exemples?|introduction|remarques?|propri[ée]t[ée]s?|m[ée]thode|application|exercices?|à retenir|a retenir)\s*:?$/i;

function looksLikeHeading(line: string): { yes: boolean; level: number; text: string } {
  const raw = line.trim();
  if (!raw) return { yes: false, level: 0, text: "" };

  const md = /^(#{1,6})\s+(.+)$/.exec(raw);
  if (md) {
    const text = md[2].trim();
    const stripped = text.replace(NUMBER_PREFIX_RE, "").trim();
    return { yes: true, level: md[1].length, text: stripped.length > 2 ? stripped : text };
  }

  if (CHAPTER_RE.test(raw)) return { yes: true, level: 1, text: raw.replace(/^[#\s]+/, "") };

  const num = NUMBERED_RE.exec(raw);
  if (num && raw.length < 90 && !/[.;]$/.test(raw)) {
    return { yes: true, level: 2, text: raw.replace(NUMBER_PREFIX_RE, "").trim() || raw };
  }

  // Ligne courte, sans ponctuation finale, en majuscules ou suivie de ":"
  const isUpper = raw.length < 70 && raw === raw.toUpperCase() && /\p{L}{3}/u.test(raw);
  const isLabel = raw.length < 70 && /:$/.test(raw);
  if (isUpper || isLabel) return { yes: true, level: 2, text: raw.replace(/:$/, "").trim() };

  return { yes: false, level: 0, text: "" };
}

function segment(text: string): Block[] {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const blocks: Block[] = [];
  let current: Block | null = null;

  for (const line of lines) {
    const h = looksLikeHeading(line);
    if (h.yes && current && GENERIC_SECTION_RE.test(h.text.trim())) {
      // « Définition », « Exemple »… décrivent la notion en cours : on les
      // rattache à son corps plutôt que d'en faire une notion à part.
      current.body += `${h.text.trim()} :\n`;
    } else if (h.yes) {
      if (current) blocks.push(current);
      current = { title: h.text, body: "", isChapter: h.level === 1 };
    } else if (current) {
      current.body += line + "\n";
    } else if (line.trim()) {
      current = { title: "", body: line + "\n", isChapter: false };
    }
  }
  if (current) blocks.push(current);

  // Aucun titre détecté : on découpe par paragraphes.
  const hasTitles = blocks.some((b) => b.title);
  if (!hasTitles) {
    return text
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter((p) => p.length > 40)
      .slice(0, 12)
      .map((p) => {
        const [first, ...rest] = p.split("\n");
        return {
          title: first.replace(BULLET_RE, "").slice(0, 60),
          body: rest.join("\n") || p,
          isChapter: false,
        };
      });
  }

  return blocks.filter((b) => b.title || b.body.trim().length > 30);
}

/* ── Extraction du contenu d'une notion ─────────────────────── */

const sentences = (s: string) =>
  s.split(/(?<=[.!?])\s+|\n/).map((x) => x.replace(BULLET_RE, "").trim()).filter((x) => x.length > 12);

function extractDefinition(body: string, title: string): string {
  const lines = body.split("\n").map((l) => l.trim()).filter(Boolean);
  const idx = lines.findIndex((l) => /^d[ée]finition/i.test(l));
  if (idx >= 0) {
    const inline = lines[idx].replace(/^d[ée]finition\s*[:：-]?\s*/i, "").trim();
    if (inline.length > 10) return inline;
    if (lines[idx + 1]) return lines[idx + 1];
  }
  const s = sentences(body);
  return s[0] ?? `${title} est la notion étudiée dans cette étape.`;
}

const isFormula = (l: string) =>
  /=/.test(l) && /[\d+\-*/×÷√]/.test(l) && l.trim().length < 80 && !/^[A-ZÀ-Ü][a-zà-ü ]{20,}/.test(l.trim());

function extractFormulas(body: string): string[] {
  return body
    .split("\n")
    .map((l) => l.replace(BULLET_RE, "").trim())
    // « Formule : p = … » s'écrit sous l'intitulé « Formule » du tableau :
    // on retire le préfixe pour ne pas l'afficher deux fois.
    .map((l) => l.replace(/^(formules?|d[ée]finitions?|expression)\s*:\s*/i, "").trim())
    .filter(isFormula)
    .slice(0, 3);
}

function extractExamples(body: string): string[] {
  const lines = body.split("\n").map((l) => l.trim());
  const out: string[] = [];
  lines.forEach((l, i) => {
    if (/^exemple|par exemple/i.test(l)) {
      const inline = l.replace(/^exemple\s*[:：-]?\s*/i, "").trim();
      if (inline.length > 8) out.push(inline);
      else if (lines[i + 1]) out.push(lines[i + 1]);
    }
  });
  return out.slice(0, 2);
}

/* ── Génération des exercices ───────────────────────────────── */

function numericExercise(
  c: Computation,
  difficulty: 1 | 2 | 3 | 4 | 5,
  seed: number,
  title: string
): Exercise | null {
  const v = variant(c, seed);
  if (!v) return null;
  const value = v.result;
  if (!Number.isFinite(value)) return null;

  return {
    id: `x-${uid()}`,
    difficulty,
    dimension: "appliquer",
    prompt: `Applique la méthode de « ${title} » et calcule : ${formatExpr(v.expr)}`,
    expect: { kind: "number", value, tolerance: Math.max(Math.abs(value) * 0.01, 0.01) },
    hints: [
      "Reprends l'exemple du cours : la suite d'opérations est exactement la même, seuls les nombres changent.",
      `Le cours faisait : ${c.raw} = ${String(c.result).replace(".", ",")}. Calque-toi dessus.`,
      `Effectue les opérations de gauche à droite en respectant les priorités : ${formatExpr(v.expr)}.`,
    ],
    solution: [
      `Calcul à mener : ${formatExpr(v.expr)}`,
      `Résultat : ${String(value).replace(".", ",")}`,
    ],
  };
}

function conceptualExercises(title: string, kws: string[], definition: string): Exercise[] {
  const signs = kws.slice(0, 5);
  return [
    {
      id: `x-${uid()}`,
      difficulty: 3,
      dimension: "raisonner",
      prompt: `Explique « ${title} » à quelqu'un qui n'a jamais vu cette notion. Tu as le droit à trois phrases maximum.`,
      expect: { kind: "open", goodSigns: signs.length ? signs : ["definition"] },
      hints: [
        "Commence par : à quoi ça sert ?",
        "Utilise un exemple concret, c'est souvent plus clair qu'une définition.",
        `Appuie-toi sur les mots-clés de la notion : ${signs.join(", ")}.`,
      ],
      solution: [`Idée à faire passer : ${definition}`],
    },
    {
      id: `x-${uid()}`,
      difficulty: 4,
      dimension: "raisonner",
      prompt: `Donne un exemple de ton choix où « ${title} » s'applique, et dis pourquoi cette notion est utile dans ce cas.`,
      expect: { kind: "open", goodSigns: signs.length ? signs : ["exemple"] },
      hints: [
        "Prends une situation de ta vie quotidienne.",
        "Un bon exemple doit contenir les mêmes éléments que dans le cours.",
        "Dis ce que la notion permet de savoir que l'on ne savait pas avant.",
      ],
      solution: ["Un exemple valable réutilise les mêmes éléments que ceux du cours, dans un contexte nouveau."],
    },
    {
      id: `x-${uid()}`,
      difficulty: 5,
      dimension: "raisonner",
      prompt: `Défi : quelle erreur fait-on le plus souvent avec « ${title} », et comment l'éviter ?`,
      expect: { kind: "open", goodSigns: [...signs, "erreur", "confusion", "oubli"] },
      hints: [
        "Repense à ce qui t'a toi-même fait hésiter.",
        "Souvent l'erreur vient d'une confusion entre deux notions proches.",
        "Formule une règle de vérification qu'on peut appliquer à la fin du calcul.",
      ],
      solution: ["Identifier l'erreur typique et énoncer un contrôle simple pour l'éviter suffit à valider."],
    },
  ];
}

/* ── Construction d'une notion ──────────────────────────────── */

function buildConcept(block: Block, index: number, total: number, prevIds: string[], prevTitles: string[]): Concept {
  const title = (block.title || `Notion ${index + 1}`).replace(/\s+/g, " ").trim().slice(0, 70);
  const body = block.body.trim();
  const full = `${title}\n${body}`;
  const definition = extractDefinition(body, title);
  const formulas = extractFormulas(body);
  const examples = extractExamples(body);
  const comps = findComputations(body);
  const kws = keywords(full, 6);
  // Sur un cours court, une notion par niveau ; sur un cours long, on répartit.
  const level = (total <= 5
    ? Math.min(5, index + 1)
    : Math.min(5, Math.max(1, Math.ceil(((index + 1) / total) * 5)))) as 1 | 2 | 3 | 4 | 5;

  /* Prérequis : la notion précédente, si le texte s'y réfère. */
  const prerequisites: string[] = [];
  if (prevIds.length) {
    const hay = deaccent(full);
    const backRef = prevTitles.findIndex((t) => t.length > 3 && hay.includes(deaccent(t).slice(0, Math.min(12, t.length))));
    if (backRef >= 0) prerequisites.push(prevIds[backRef]);
    else if (index > 0) prerequisites.push(prevIds[prevIds.length - 1]);
  }

  /* — Explications, plusieurs stratégies (§2) — */
  const explanations: Explanation[] = [
    {
      strategy: "simple",
      say: `On attaque « ${title} ». Voici l'idée essentielle, dans sa version la plus simple : ${definition}`,
      board: frame(
        title.toUpperCase().slice(0, 40),
        "# Définition",
        ...definition.slice(0, 220).split(/(?<=[.;])\s+/).slice(0, 3),
        ...(formulas.length ? ["~", "# Formule", ...formulas.map((f) => `=${f}`)] : []),
      ),
    },
  ];

  if (examples.length || comps.length) {
    const ex = examples[0] ?? `${comps[0].raw} = ${String(comps[0].result).replace(".", ",")}`;
    explanations.push({
      strategy: "exemple",
      say: `Passons tout de suite à un cas concret, c'est toujours plus parlant qu'une définition : ${ex}`,
      board: frame(
        "EXEMPLE",
        ...(comps.length
          ? [`>${comps[0].raw}`, `=${String(comps[0].result).replace(".", ",")}`]
          : ex.slice(0, 200).split(/(?<=[.;])\s+/).slice(0, 4)),
      ),
    });
  }

  if (comps.length) {
    explanations.push({
      strategy: "demonstration",
      say: "Reprenons ce calcul très lentement, étape par étape. Je veux que tu voies d'où vient chaque nombre avant de le refaire toi-même.",
      board: frame(
        "PAS À PAS",
        "> 1. Repérer les données de l'énoncé",
        "> 2. Choisir la formule de la notion",
        `> 3. Remplacer : ${comps[0].raw}`,
        `= ${String(comps[0].result).replace(".", ",")}`,
        "~",
        "! Vérifie toujours l'ordre des opérations",
      ),
    });
  }

  const bodySentences = sentences(body);
  if (bodySentences.length > 1) {
    explanations.push({
      strategy: "reformulation",
      say: `Je te le redis autrement, avec les mots du cours : ${bodySentences.slice(0, 2).join(" ")}`,
      board: frame("À RETENIR", ...bodySentences.slice(0, 3).map((s) => `!${s.slice(0, 90)}`)),
    });
  }

  explanations.push({
    strategy: "visuel",
    say: "Regarde le tableau : je n'y garde que l'essentiel. Si tu devais ne retenir que trois lignes de cette notion, ce seraient celles-là.",
    board: frame(
      "L'ESSENTIEL",
      `!${definition.slice(0, 100)}`,
      ...(formulas.length ? ["~", ...formulas.map((f) => `=${f}`)] : []),
      ...(kws.length ? ["~", `# Mots-clés`, kws.join(" · ")] : []),
    ),
  });

  /* — Vérifications, une par dimension (§8) — */
  const checks: Check[] = [
    {
      id: `c-${uid()}`,
      dimension: "comprendre",
      prompt: `Avec tes propres mots : qu'est-ce que « ${title} » ?`,
      expect: { kind: "keywords", any: kws.length ? kws : [title.toLowerCase()], min: kws.length >= 3 ? 2 : 1 },
      debrief: `Ce qu'il fallait faire apparaître : ${definition}`,
    },
    {
      id: `c-${uid()}`,
      dimension: "identifier",
      prompt: formulas.length
        ? `Quelle est la formule (ou la règle) à utiliser pour « ${title} » ? Tu peux l'écrire avec tes mots.`
        : `Dans quelle situation utilise-t-on « ${title} » ? Donne le signal qui doit te mettre sur cette piste.`,
      expect: formulas.length
        ? { kind: "keywords", any: [...kws.slice(0, 3), ...(formulas[0].match(/\p{L}{3,}/gu) ?? []).slice(0, 3)], min: 1 }
        : { kind: "keywords", any: kws.length ? kws : ["utilise"], min: 1 },
      debrief: formulas.length ? `La formule du cours : ${formulas[0]}` : `Repère-toi aux mots-clés : ${kws.join(", ")}.`,
    },
  ];

  if (comps.length) {
    const v = variant(comps[0], 1);
    if (v) {
      checks.push({
        id: `c-${uid()}`,
        dimension: "appliquer",
        prompt: `À toi de calculer : ${formatExpr(v.expr)}`,
        expect: { kind: "number", value: v.result, tolerance: Math.max(Math.abs(v.result) * 0.01, 0.01) },
        debrief: `${formatExpr(v.expr)} = ${String(v.result).replace(".", ",")}. Même méthode que dans l'exemple du cours.`,
      });
    }
  }
  if (checks.length < 3) {
    checks.push({
      id: `c-${uid()}`,
      dimension: "appliquer",
      prompt: `Applique « ${title} » à un cas que tu inventes : décris la situation, puis dis quel serait le résultat.`,
      expect: { kind: "open", goodSigns: kws.length ? kws : ["exemple"] },
      debrief: "Un cas inventé qui réutilise correctement la notion suffit : c'est la preuve que tu sais t'en servir.",
    });
  }

  checks.push({
    id: `c-${uid()}`,
    dimension: "raisonner",
    prompt: `Pourquoi cette notion est-elle utile ? Que permet-elle de faire qu'on ne pouvait pas faire avant ?`,
    expect: { kind: "open", goodSigns: [...kws.slice(0, 4), "permet", "utile"] },
    debrief: `Une notion se retient d'autant mieux qu'on sait à quoi elle sert. Ici : ${definition}`,
  });

  /* — Exercices progressifs (§13) — */
  const exercises: Exercise[] = [];
  comps.slice(0, 2).forEach((c, i) => {
    const e1 = numericExercise(c, (i === 0 ? 1 : 2) as 1 | 2, i + 2, title);
    if (e1) exercises.push(e1);
  });
  if (comps.length) {
    const e2 = numericExercise(comps[0], 2, 7, title);
    if (e2 && exercises.length < 2) exercises.push(e2);
  }
  exercises.push(...conceptualExercises(title, kws, definition));

  /* — Erreurs typiques déductibles de la forme du calcul — */
  const pitfalls: Pitfall[] = [];
  if (comps.length) {
    const raw = comps[0].raw;
    if (/[×*]\s*100/.test(raw)) {
      pitfalls.push({
        id: `pf-${uid()}`,
        label: "Multiplication par 100 oubliée",
        detector: { kind: "factor", factor: 0.01 },
        diagnosis: "Ton calcul est juste jusqu'au bout, mais il manque la multiplication par 100.",
        remediation: "Ta méthode est bonne : c'est une étape sautée, pas une incompréhension. Relis la formule du cours jusqu'à la toute fin avant de donner ton résultat.",
      });
    }
    if (/[/÷]/.test(raw)) {
      pitfalls.push({
        id: `pf-${uid()}`,
        label: "Division inversée",
        detector: { kind: "value", value: Math.round((1 / (comps[0].result || 1)) * 1000) / 1000 },
        diagnosis: "Tu as inversé les deux nombres de la division.",
        remediation: "Repère dans l'énoncé ce qui joue le rôle de référence : c'est toujours lui qui passe au dénominateur.",
      });
    }
  }

  return {
    id: `${slug(title, `notion-${index + 1}`)}-${index + 1}`,
    title,
    objective: `À la fin de cette étape, tu sauras expliquer et utiliser « ${title} » sur un cas nouveau.`,
    level,
    prerequisites,
    keywords: kws,
    explanations,
    checks,
    exercises,
    pitfalls,
    summary: {
      know: [
        `Expliquer ce qu'est « ${title} »`,
        formulas.length ? `Utiliser : ${formulas[0]}` : `Reconnaître quand appliquer « ${title} »`,
        "Traiter un cas différent de l'exemple du cours",
      ],
      retain: formulas[0] ?? definition.slice(0, 160),
      skill: `Tu sais utiliser « ${title} » de façon autonome.`,
    },
  };
}

/* ── Point d'entrée ─────────────────────────────────────────── */

export interface ParseResult {
  course: Course;
  /** Ce que l'analyse a trouvé, affiché à l'élève avant de commencer. */
  report: string[];
}

export function parseCourse(rawText: string, titleHint?: string): ParseResult {
  const text = rawText.trim();
  const blocks = segment(text);

  const chapterBlocks: { title: string; concepts: Block[] }[] = [];
  let bucket: { title: string; concepts: Block[] } | null = null;

  for (const b of blocks) {
    if (b.isChapter) {
      bucket = { title: b.title || `Chapitre ${chapterBlocks.length + 1}`, concepts: [] };
      chapterBlocks.push(bucket);
      if (b.body.trim().length > 60) bucket.concepts.push({ ...b, title: b.title, isChapter: false });
    } else {
      if (!bucket) {
        bucket = { title: "Chapitre 1", concepts: [] };
        chapterBlocks.push(bucket);
      }
      bucket.concepts.push(b);
    }
  }

  const flat = chapterBlocks.flatMap((c) => c.concepts);
  const total = flat.length;

  const concepts: Record<string, Concept> = {};
  const chapters: Chapter[] = [];
  const prevIds: string[] = [];
  const prevTitles: string[] = [];
  let index = 0;

  for (const chap of chapterBlocks) {
    const ids: string[] = [];
    for (const block of chap.concepts) {
      const concept = buildConcept(block, index, total, [...prevIds], [...prevTitles]);
      // Sécurité : jamais deux notions avec le même identifiant.
      let id = concept.id;
      while (concepts[id]) id = `${concept.id}-${uid().slice(0, 3)}`;
      concepts[id] = { ...concept, id };
      ids.push(id);
      prevIds.push(id);
      prevTitles.push(concept.title);
      index++;
    }
    if (ids.length) chapters.push({ id: `ch-${uid()}`, title: chap.title, conceptIds: ids });
  }

  const title =
    titleHint?.trim() ||
    blocks.find((b) => b.isChapter)?.title ||
    blocks[0]?.title ||
    "Mon cours";

  const course: Course = {
    id: `c-${uid()}`,
    title: title.slice(0, 70),
    subject: "Cours importé",
    createdAt: Date.now(),
    origin: "import",
    chapters,
    concepts,
  };

  const nbComputations = Object.values(concepts).reduce(
    (acc, c) => acc + c.exercises.filter((e) => e.expect.kind === "number").length, 0
  );

  const report = [
    `${chapters.length} chapitre${chapters.length > 1 ? "s" : ""} identifié${chapters.length > 1 ? "s" : ""}`,
    `${Object.keys(concepts).length} notion${Object.keys(concepts).length > 1 ? "s" : ""} à travailler`,
    `${Object.values(concepts).reduce((a, c) => a + c.exercises.length, 0)} exercices préparés, dont ${nbComputations} chiffré${nbComputations > 1 ? "s" : ""}`,
    `Prérequis chaînés : une notion ne s'ouvre qu'une fois la précédente validée`,
  ];

  return { course, report };
}

/** Le texte fourni est-il exploitable ? */
export function canParse(text: string): { ok: boolean; reason?: string } {
  const t = text.trim();
  if (t.length < 120) return { ok: false, reason: "Le texte est trop court : il me faut au moins quelques paragraphes pour construire une progression." };
  if (!/\p{L}{4}/u.test(t)) return { ok: false, reason: "Je ne reconnais pas de texte lisible dans ce contenu." };
  return { ok: true };
}
