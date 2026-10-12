// Term helpers for the naive reference: a tiny Prolog-syntax reader for witness facts and atom
// keys, and the canonical text every subject compares (`module::pred(args)`, no spaces, atoms
// quoted only when Prolog requires it). Syntax only; no semantics lives here.
export const atom = (name) => ({ kind: "atom", name });
export const num = (value) => ({ kind: "number", value });
export const NIL = atom("[]");
export const list = (items) => items.reduceRight((tail, head) => ({ kind: "compound", functor: ".", args: [head, tail] }), NIL);

export function listItems(t) {
  const out = [];
  for (; t.kind === "compound" && t.functor === "." && t.args.length === 2; t = t.args[1]) out.push(t.args[0]);
  return t.kind === "atom" && t.name === "[]" ? out : undefined;
}

export function quote(name) {
  if (/^[a-z][A-Za-z0-9_]*$/.test(name) || name === "[]") return name;
  return `'${name.replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/\n/g, "\\n")}'`;
}

/** Canonical text of a term; an unbound variable prints as its name, a count interval as lo..hi. */
export function key(t) {
  switch (t.kind) {
    case "atom": return quote(t.name);
    case "number": return String(t.value);
    case "string": return JSON.stringify(t.value);
    case "var": return t.name;
    case "interval": return `${t.lo}..${t.hi}`;
    case "compound": {
      const items = listItems(t);
      return items ? `[${items.map(key).join(",")}]` : `${quote(t.functor)}(${t.args.map(key).join(",")})`;
    }
  }
  throw new Error(`no key for ${JSON.stringify(t)}`);
}

/** The value of a binding as a witness writes it: an atom's name, a number, a list's text. */
export function plain(t) {
  if (t.kind === "atom") return t.name;
  if (t.kind === "number") return t.value;
  if (t.kind === "string") return t.value;
  return key(t);
}

/** Reads one Prolog term: atoms (bare or quoted), numbers, strings, lists, compounds. */
export function parseTerm(text) {
  let i = 0;
  const ws = () => { while (/\s/.test(text[i] ?? "")) i += 1; };
  const expect = (c) => { ws(); if (text[i] !== c) throw new Error(`expected ${c} at ${i} in ${text}`); i += 1; };
  const quoted = (q) => {
    let out = ""; i += 1;
    for (;;) {
      const c = text[i++];
      if (c === undefined) throw new Error(`unterminated quote in ${text}`);
      if (c === q) { if (text[i] === q) { out += q; i += 1; continue; } return out; }
      if (c === "\\") { const e = text[i++]; out += e === "n" ? "\n" : e === "t" ? "\t" : e; continue; }
      out += c;
    }
  };
  const term = () => {
    ws();
    const c = text[i];
    if (c === "[") {
      i += 1; ws();
      if (text[i] === "]") { i += 1; return NIL; }
      const items = [term()];
      for (ws(); text[i] === ","; ws()) { i += 1; items.push(term()); }
      expect("]");
      return list(items);
    }
    if (c === '"') return { kind: "string", value: quoted('"') };
    const n = /^-?\d+(\.\d+)?/.exec(text.slice(i));
    if (n) { i += n[0].length; return num(Number(n[0])); }
    let name;
    if (c === "'") name = quoted("'");
    else {
      const m = /^[a-z][A-Za-z0-9_]*(::[a-z][A-Za-z0-9_]*)?|^[A-Z_][A-Za-z0-9_]*/.exec(text.slice(i));
      if (!m) throw new Error(`cannot read ${text.slice(i)}`);
      i += m[0].length; name = m[0];
      if (/^[A-Z_]/.test(name)) return { kind: "var", name };
    }
    if (text[i] !== "(") return atom(name);
    i += 1;
    const args = [term()];
    for (ws(); text[i] === ","; ws()) { i += 1; args.push(term()); }
    expect(")");
    return { kind: "compound", functor: name, args };
  };
  const t = term(); ws();
  if (text[i] === ".") i += 1;
  ws();
  if (i !== text.length) throw new Error(`trailing text in ${text}: ${text.slice(i)}`);
  return t;
}

/** A witness fact `section(d, a, root)` as {pred: "core::section", args}. */
export function parseFact(text) {
  const t = parseTerm(text);
  if (t.kind === "atom") return { pred: `core::${t.name}`, args: [] };
  return { pred: t.functor.includes("::") ? t.functor : `core::${t.functor}`, args: t.args };
}

/** An atom key as written in `answers`: `mod::pred(args)`; the module part may hold `.` or `-`. */
export function normalizeAtom(text) {
  const open = text.indexOf("(");
  const pred = open < 0 ? text : text.slice(0, open);
  if (open < 0) return pred;
  const t = parseTerm(`x${text.slice(open)}`);
  return `${pred}(${t.args.map(key).join(",")})`;
}
