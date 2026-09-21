/* Mini-évaluateur d'expressions arithmétiques (sans eval).
   Il sert à l'analyseur de cours : quand un cours importé contient un
   calcul d'exemple du type « 20 ÷ 50 × 100 = 40 », on le reconnaît, on
   le vérifie, puis on en génère des variantes dont Mon Prof connaît la
   réponse exacte. C'est ce qui permet de proposer de vrais exercices
   chiffrés sur un cours qu'on n'a pas écrit à la main. */

export type Expr =
  | { t: "num"; v: number }
  | { t: "op"; op: "+" | "-" | "*" | "/"; a: Expr; b: Expr };

type Token = { k: "num"; v: number } | { k: "op"; v: string } | { k: "par"; v: "(" | ")" };

function tokenize(src: string): Token[] | null {
  const s = src
    .replace(/[×xX]/g, "*")
    .replace(/[÷:]/g, "/")
    .replace(/[−–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim();

  const tokens: Token[] = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (c === " ") { i++; continue; }
    if (c === "(" || c === ")") { tokens.push({ k: "par", v: c }); i++; continue; }
    if ("+-*/".includes(c)) { tokens.push({ k: "op", v: c }); i++; continue; }
    const m = /^\d+(?:[  ]\d{3})*(?:[.,]\d+)?/.exec(s.slice(i));
    if (m) {
      const v = Number(m[0].replace(/[  ]/g, "").replace(",", "."));
      if (Number.isNaN(v)) return null;
      tokens.push({ k: "num", v });
      i += m[0].length;
      continue;
    }
    return null; // caractère inattendu : ce n'est pas un calcul
  }
  return tokens.length ? tokens : null;
}

/** Analyse descendante : expr := terme (('+'|'-') terme)* */
export function parseExpression(src: string): Expr | null {
  const tokens = tokenize(src);
  if (!tokens) return null;
  let pos = 0;

  const peek = () => tokens[pos];

  function parseFactor(): Expr | null {
    const tk = peek();
    if (!tk) return null;
    if (tk.k === "op" && tk.v === "-") {
      pos++;
      const inner = parseFactor();
      return inner ? { t: "op", op: "-", a: { t: "num", v: 0 }, b: inner } : null;
    }
    if (tk.k === "num") { pos++; return { t: "num", v: tk.v }; }
    if (tk.k === "par" && tk.v === "(") {
      pos++;
      const inner = parseExpr();
      const close = peek();
      if (!inner || !close || close.k !== "par" || close.v !== ")") return null;
      pos++;
      return inner;
    }
    return null;
  }

  function parseTerm(): Expr | null {
    let left = parseFactor();
    if (!left) return null;
    for (;;) {
      const tk = peek();
      if (tk && tk.k === "op" && (tk.v === "*" || tk.v === "/")) {
        pos++;
        const right = parseFactor();
        if (!right) return null;
        left = { t: "op", op: tk.v, a: left, b: right };
      } else return left;
    }
  }

  function parseExpr(): Expr | null {
    let left = parseTerm();
    if (!left) return null;
    for (;;) {
      const tk = peek();
      if (tk && tk.k === "op" && (tk.v === "+" || tk.v === "-")) {
        pos++;
        const right = parseTerm();
        if (!right) return null;
        left = { t: "op", op: tk.v, a: left, b: right };
      } else return left;
    }
  }

  const out = parseExpr();
  return out && pos === tokens.length ? out : null;
}

export function evalExpr(e: Expr): number {
  if (e.t === "num") return e.v;
  const a = evalExpr(e.a);
  const b = evalExpr(e.b);
  switch (e.op) {
    case "+": return a + b;
    case "-": return a - b;
    case "*": return a * b;
    case "/": return b === 0 ? NaN : a / b;
  }
}

const SYMBOL = { "+": "+", "-": "−", "*": "×", "/": "÷" } as const;

export function formatExpr(e: Expr): string {
  if (e.t === "num") return String(Math.round(e.v * 1000) / 1000).replace(".", ",");
  return `${formatExpr(e.a)} ${SYMBOL[e.op]} ${formatExpr(e.b)}`;
}

export function numbersOf(e: Expr): number[] {
  return e.t === "num" ? [e.v] : [...numbersOf(e.a), ...numbersOf(e.b)];
}

/** Remplace les nombres (dans l'ordre de lecture) pour créer une variante. */
export function withNumbers(e: Expr, values: number[], cursor = { i: 0 }): Expr {
  if (e.t === "num") {
    const v = cursor.i < values.length ? values[cursor.i] : e.v;
    cursor.i++;
    return { t: "num", v };
  }
  return { t: "op", op: e.op, a: withNumbers(e.a, values, cursor), b: withNumbers(e.b, values, cursor) };
}

/** Un calcul repéré dans un cours, avec son résultat vérifié. */
export interface Computation {
  raw: string;
  expr: Expr;
  result: number;
}

/**
 * Cherche dans un texte les calculs de la forme « … = résultat » et ne
 * garde que ceux dont le résultat annoncé est effectivement juste :
 * c'est la garantie qu'on a bien compris l'exemple du cours.
 */
export function findComputations(text: string): Computation[] {
  const out: Computation[] = [];
  const re = /([\d.,\s ()+\-*/×÷x−]{5,60}?)=\s*(-?\d+(?:[  ]\d{3})*(?:[.,]\d+)?)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const left = m[1].trim();
    if (!/[+\-*/×÷x]/.test(left.slice(1))) continue;       // il faut un opérateur
    if ((left.match(/\d/g) ?? []).length < 2) continue;      // et au moins deux nombres
    const expr = parseExpression(left);
    if (!expr) continue;
    const value = evalExpr(expr);
    const stated = Number(m[2].replace(/[  ]/g, "").replace(",", "."));
    if (!Number.isFinite(value)) continue;
    const tol = Math.max(Math.abs(stated) * 0.02, 0.01);
    if (Math.abs(value - stated) > tol) continue;            // le cours dit autre chose : on s'abstient
    out.push({ raw: left, expr, result: Math.round(value * 1000) / 1000 });
  }
  return out;
}

/**
 * Repère les nombres qui appartiennent à la formule elle-même plutôt qu'aux
 * données : une constante ronde multipliée ou divisée (le « × 100 » d'un
 * pourcentage). Ceux-là ne doivent jamais bouger dans une variante.
 */
function constantPositions(e: Expr, out: boolean[] = [], cursor = { i: 0 }, scaling = false): boolean[] {
  if (e.t === "num") {
    out[cursor.i] = scaling && (e.v === 10 || e.v === 100 || e.v === 1000);
    cursor.i++;
    return out;
  }
  const mult = e.op === "*" || e.op === "/";
  constantPositions(e.a, out, cursor, mult);
  constantPositions(e.b, out, cursor, mult);
  return out;
}

/** Génère une variante d'un calcul : mêmes opérations, autres nombres. */
export function variant(c: Computation, seed: number): Computation | null {
  const nums = numbersOf(c.expr);
  if (!nums.length) return null;
  const frozen = constantPositions(c.expr);
  const next = nums.map((n, i) => {
    if (frozen[i]) return n;
    const step = ((seed + i * 3) % 4) + 1;
    const scaled = Number.isInteger(n) ? n + step * (n >= 10 ? 5 : 1) : Math.round((n + step / 4) * 100) / 100;
    return scaled;
  });
  if (next.every((n, i) => n === nums[i])) return null;
  const expr = withNumbers(c.expr, next);
  const value = evalExpr(expr);
  if (!Number.isFinite(value)) return null;
  return { raw: formatExpr(expr), expr, result: Math.round(value * 1000) / 1000 };
}
