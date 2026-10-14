/**
 * Production kernel surface: WFS core under swipl-wasm, loader, and module translator.
 * The migration is design/06-kernel-migration.md, kept with the kernel trials on branch
 * dv/trusted-kernel-trials; the specification is docs/doc-verify-model.md.
 */

export { CORE_PL, Kernel, PrologError, SANDBOX_META, SANDBOX_PRIMITIVES, atomTerm } from "./kernel.js";
export type {
  KernelEvaluateOptions,
  KernelLoadOptions,
  KernelReport,
  MissingRow,
  SandboxCensus,
  StatusRow,
  UnfoundedRow,
} from "./kernel.js";

export {
  compileWitnessModule,
  parseFactText,
  predName,
  syntaxProgram,
  translateProgram,
  translateWitness,
} from "./translate.js";
export type { CompileWitnessResult, FactTerm, TranslateProgram, WitnessInput } from "./translate.js";
