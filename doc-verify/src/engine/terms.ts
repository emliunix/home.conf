/**
 * Prolog terms as data, exchanged with the runtime in canonical form.
 *
 * The runtime's reader parses every rule body (design 04 §Rule syntax). It hands the
 * parsed term back through `write_canonical/1` with `numbervars`, so a variable named
 * `D` arrives as `'$VAR'('D')`. This module reads that canonical form and writes terms
 * back as Prolog text for the evaluation program.
 */

export type Term =
  | { kind: "var"; name: string }
  | { kind: "atom"; name: string }
  | { kind: "number"; value: number }
  | { kind: "string"; value: string }
  | { kind: "compound"; functor: string; args: Term[] };

export const atom = (name: string): Term => ({ kind: "atom", name });
export const variable = (name: string): Term => ({ kind: "var", name });
export const compound = (functor: string, args: Term[]): Term => ({ kind: "compound", functor, args });
export const number = (value: number): Term => ({ kind: "number", value });
export const list = (items: Term[]): Term => items.reduceRight<Term>((tail, head) => compound(".", [head, tail]), atom("[]"));

export function listItems(term: Term): Term[] | undefined {
  const items: Term[] = [];
  let cursor = term;
  for (;;) {
    if (cursor.kind === "atom" && cursor.name === "[]") {
      return items;
    }
    if (cursor.kind === "compound" && cursor.functor === "." && cursor.args.length === 2) {
      items.push(cursor.args[0] as Term);
      cursor = cursor.args[1] as Term;
      continue;
    }
    return undefined;
  }
}

/** Flattens a right-nested `,` conjunction into its literals. */
export function conjuncts(term: Term): Term[] {
  if (term.kind === "compound" && term.functor === "," && term.args.length === 2) {
    return [...conjuncts(term.args[0] as Term), ...conjuncts(term.args[1] as Term)];
  }
  return [term];
}

export function variablesOf(term: Term, into: Set<string> = new Set()): Set<string> {
  if (term.kind === "var") {
    if (term.name !== "_") {
      into.add(term.name);
    }
  } else if (term.kind === "compound") {
    for (const arg of term.args) {
      variablesOf(arg, into);
    }
  }
  return into;
}

export function termEquals(left: Term, right: Term): boolean {
  return writeTerm(left) === writeTerm(right);
}

/** The atom or number text of a ground argument, for report values. */
export function termText(term: Term): string {
  switch (term.kind) {
    case "atom":
      return term.name;
    case "number":
      return String(term.value);
    case "string":
      return term.value;
    case "var":
      return term.name;
    case "compound": {
      const items = listItems(term);
      return items === undefined ? writeTerm(term) : `[${items.map(termText).join(", ")}]`;
    }
  }
}

/** Writes a term as Prolog text the reader accepts unambiguously. */
export function writeTerm(term: Term): string {
  switch (term.kind) {
    case "var":
      return term.name === "_" ? "_" : `_V_${term.name}`;
    case "atom":
      return quoteAtom(term.name);
    case "number":
      return Number.isInteger(term.value) ? String(term.value) : term.value.toExponential();
    case "string":
      return JSON.stringify(term.value);
    case "compound": {
      const items = listItems(term);
      if (items !== undefined) {
        return `[${items.map(writeTerm).join(",")}]`;
      }
      return `${quoteAtom(term.functor)}(${term.args.map(writeTerm).join(",")})`;
    }
  }
}

export function quoteAtom(name: string): string {
  if (/^[a-z][A-Za-z0-9_]*$/.test(name) || name === "[]" || name === "{}" || name === "!" || name === ";") {
    return name;
  }
  return `'${name.replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/\n/g, "\\n")}'`;
}

/** Writes a JavaScript string as a Prolog string literal. */
export function prologString(value: string): string {
  return JSON.stringify(value);
}

export class TermSyntaxError extends Error {}

/**
 * Reads one or more terms written by `write_canonical/1` with `ignore_ops(true)` and
 * `numbervars(true)`. `'$VAR'(Name)` becomes a variable named `Name`; an unbound
 * variable (`_123`) becomes the anonymous variable.
 */
export function readCanonical(text: string): Term {
  const reader = new CanonicalReader(text);
  const term = reader.term();
  reader.end();
  return term;
}

class CanonicalReader {
  private position = 0;

  constructor(private readonly text: string) {}

  term(): Term {
    this.skipSpace();
    const char = this.text[this.position];
    if (char === undefined) {
      throw new TermSyntaxError("unexpected end of term");
    }
    if (char === "[") {
      return this.listTerm();
    }
    if (char === "{") {
      this.position += 1;
      this.skipSpace();
      if (this.text[this.position] === "}") {
        this.position += 1;
        return this.maybeCompound("{}");
      }
      const inner = this.term();
      this.expect("}");
      return compound("{}", [inner]);
    }
    if (char === '"') {
      return { kind: "string", value: this.quoted('"') };
    }
    if (char === "'") {
      return this.maybeCompound(this.quoted("'"));
    }
    if (/[0-9]/.test(char) || (char === "-" && /[0-9]/.test(this.text[this.position + 1] ?? ""))) {
      return this.numberTerm();
    }
    if (/[A-Z_]/.test(char)) {
      const name = this.take(/[A-Za-z0-9_]/);
      return variable(name === "_" || /^_[0-9A-Z]/.test(name) ? "_" : name);
    }
    if (/[a-z]/.test(char)) {
      return this.maybeCompound(this.take(/[A-Za-z0-9_]/));
    }
    const symbol = this.take(/[+\-*/\\^<>=~:.?@#&$]/);
    if (symbol.length === 0) {
      throw new TermSyntaxError(`unexpected character ${JSON.stringify(char)} at ${String(this.position)}`);
    }
    return this.maybeCompound(symbol);
  }

  end(): void {
    this.skipSpace();
    if (this.position !== this.text.length) {
      throw new TermSyntaxError(`trailing text after term at ${String(this.position)}`);
    }
  }

  private maybeCompound(functor: string): Term {
    if (this.text[this.position] === "(") {
      this.position += 1;
      const args: Term[] = [];
      for (;;) {
        args.push(this.term());
        this.skipSpace();
        if (this.text[this.position] === ",") {
          this.position += 1;
          continue;
        }
        this.expect(")");
        break;
      }
      if (functor === "$VAR" && args.length === 1) {
        const inner = args[0] as Term;
        if (inner.kind === "atom") {
          return variable(inner.name);
        }
        if (inner.kind === "number") {
          return variable("_");
        }
      }
      return compound(functor, args);
    }
    return atom(functor);
  }

  private listTerm(): Term {
    this.expect("[");
    this.skipSpace();
    if (this.text[this.position] === "]") {
      this.position += 1;
      return this.maybeCompound("[]");
    }
    const items: Term[] = [];
    let tail: Term = atom("[]");
    for (;;) {
      items.push(this.term());
      this.skipSpace();
      const char = this.text[this.position];
      if (char === ",") {
        this.position += 1;
        continue;
      }
      if (char === "|") {
        this.position += 1;
        tail = this.term();
        this.skipSpace();
      }
      this.expect("]");
      break;
    }
    return items.reduceRight<Term>((rest, head) => compound(".", [head, rest]), tail);
  }

  private numberTerm(): Term {
    const start = this.position;
    if (this.text[this.position] === "-") {
      this.position += 1;
    }
    this.take(/[0-9]/);
    if (this.text[this.position] === "." && /[0-9]/.test(this.text[this.position + 1] ?? "")) {
      this.position += 1;
      this.take(/[0-9]/);
      if (/[eE]/.test(this.text[this.position] ?? "")) {
        this.position += 1;
        if (/[+-]/.test(this.text[this.position] ?? "")) {
          this.position += 1;
        }
        this.take(/[0-9]/);
      }
    }
    return number(Number(this.text.slice(start, this.position)));
  }

  private quoted(delimiter: string): string {
    this.position += 1;
    let out = "";
    for (;;) {
      const char = this.text[this.position];
      if (char === undefined) {
        throw new TermSyntaxError("unterminated quoted token");
      }
      this.position += 1;
      if (char === delimiter) {
        if (this.text[this.position] === delimiter) {
          out += delimiter;
          this.position += 1;
          continue;
        }
        return out;
      }
      if (char === "\\") {
        const next = this.text[this.position];
        this.position += 1;
        switch (next) {
          case "n": out += "\n"; break;
          case "t": out += "\t"; break;
          case "\\": out += "\\"; break;
          case "'": out += "'"; break;
          case '"': out += '"'; break;
          case "\n": break;
          case "x": {
            const hex = this.take(/[0-9a-fA-F]/);
            if (this.text[this.position] === "\\") {
              this.position += 1;
            }
            out += String.fromCodePoint(Number.parseInt(hex, 16));
            break;
          }
          default: {
            if (next !== undefined && /[0-7]/.test(next)) {
              const octal = next + this.take(/[0-7]/);
              if (this.text[this.position] === "\\") {
                this.position += 1;
              }
              out += String.fromCodePoint(Number.parseInt(octal, 8));
            } else {
              out += next ?? "";
            }
          }
        }
        continue;
      }
      out += char;
    }
  }

  private take(pattern: RegExp): string {
    const start = this.position;
    while (this.position < this.text.length && pattern.test(this.text[this.position] as string)) {
      this.position += 1;
    }
    return this.text.slice(start, this.position);
  }

  private expect(char: string): void {
    this.skipSpace();
    if (this.text[this.position] !== char) {
      throw new TermSyntaxError(`expected ${JSON.stringify(char)} at ${String(this.position)}, saw ${JSON.stringify(this.text.slice(this.position, this.position + 12))}`);
    }
    this.position += 1;
  }

  private skipSpace(): void {
    while (/\s/.test(this.text[this.position] ?? "")) {
      this.position += 1;
    }
  }
}
