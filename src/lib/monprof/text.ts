/* Outils de traitement du texte français : normalisation, extraction
   de nombres, mots-clés. Utilisés par l'analyseur de cours et par le
   correcteur de réponses. */

const ACCENTS: Record<string, string> = {
  à: "a", â: "a", ä: "a", á: "a", ã: "a",
  ç: "c",
  è: "e", é: "e", ê: "e", ë: "e",
  î: "i", ï: "i", í: "i",
  ô: "o", ö: "o", ó: "o", õ: "o",
  ù: "u", û: "u", ü: "u", ú: "u",
  ÿ: "y", ñ: "n", œ: "oe", æ: "ae",
};

export const deaccent = (s: string) =>
  s.toLowerCase().replace(/[àâäáãçèéêëîïíôöóõùûüúÿñœæ]/g, (c) => ACCENTS[c] ?? c);

/** Minuscules, sans accents, sans ponctuation, espaces normalisés. */
export const normalize = (s: string) =>
  deaccent(s)
    .replace(/[^\p{L}\p{N}\s.,%/*+=-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

export const STOPWORDS = new Set(
  ("le la les un une des du de d l et ou a au aux en dans sur pour par avec sans sous ce cet cette ces " +
    "son sa ses leur leurs il elle ils elles on nous vous je tu me te se qui que quoi dont ou est sont " +
    "etre avoir fait faire plus moins tres bien donc alors ainsi si ne pas peut peuvent chaque tout tous " +
    "toute toutes meme aussi entre lorsque quand comme c s n y")
    .split(" ")
);

/** Mots significatifs d'un texte, triés par fréquence décroissante. */
export function keywords(text: string, max = 8): string[] {
  const freq = new Map<string, number>();
  for (const w of normalize(text).split(/[^\p{L}\p{N}]+/u)) {
    if (w.length < 4 || STOPWORDS.has(w) || /^\d+$/.test(w)) continue;
    freq.set(w, (freq.get(w) ?? 0) + 1);
  }
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, max)
    .map(([w]) => w);
}

/** Tous les nombres d'un texte, virgule décimale française comprise. */
export function numbersIn(text: string): number[] {
  const out: number[] = [];
  const re = /-?\d+(?:[.,]\d+)?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const n = Number(m[0].replace(",", "."));
    if (!Number.isNaN(n)) out.push(n);
  }
  return out;
}

/** Le dernier nombre énoncé : c'est presque toujours la réponse. */
export function answerNumber(text: string): number | null {
  const ns = numbersIn(text);
  return ns.length ? ns[ns.length - 1] : null;
}

/** Contient-il ce mot-clé (comparaison insensible aux accents) ? */
export function mentions(text: string, word: string): boolean {
  const t = normalize(text);
  const w = normalize(word);
  if (!w) return false;
  return new RegExp(`(^|[^\\p{L}])${escapeRe(w)}`, "u").test(t);
}

export const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Nombre de mots. Sert à juger si une explication est « développée ». */
export const wordCount = (s: string) => (normalize(s).match(/\p{L}+/gu) ?? []).length;

/** Formate un nombre à la française, sans décimales inutiles. */
export const num = (n: number) => {
  const r = Math.round(n * 1000) / 1000;
  return String(r).replace(".", ",");
};

/** Génère un identifiant court et stable à partir d'un titre. */
export const slug = (s: string, fallback = "notion") => {
  const base = deaccent(s)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return base || fallback;
};

export const uid = () => Math.random().toString(36).slice(2, 10);
