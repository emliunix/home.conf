/**
 * Demand atoms and shared evaluation types (host ↔ kernel seam).
 *
 * Keys are the single identity of an oracle atom: `module::pred(args)` with
 * `writeTerm` args (no spaces). The kernel's `core_atom_key/2` and the host's
 * `oracleAtomKey` must agree; answers and Demands use that key only.
 */

import type { Oracle } from "./checker.js";
import { termText, writeTerm, type Term } from "./terms.js";

export type Mode = "certain" | "possible";
export type BindingStatus = "violated" | "satisfied" | "undetermined";

/** The engine's view of answered oracle atoms: absent means never asked. */
export interface OracleView {
  lookup(key: string): { label: string } | undefined;
}

export interface Demand {
  key: string;
  /** The atom as diagnostics print it, e.g. `golden.purpose(d.md, scope)`. */
  atom: string;
  oracle: Oracle;
  inputs: Term[];
}

/** A judge / threshold demotion is this label; the kernel reads it as u. */
export const UNKNOWN = "unknown";

/** The canonical key of an oracle atom: its predicate and ground inputs. */
export function oracleAtomKey(predicate: string, inputs: Term[]): string {
  return `${predicate}(${inputs.map(writeTerm).join(",")})`;
}

export function atomText(predicate: string, args: Term[]): string {
  return `${predicate.replace("::", ".")}(${args.map(termText).join(", ")})`;
}
