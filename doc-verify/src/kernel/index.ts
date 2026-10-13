/**
 * Production kernel surface: WFS core under swipl-wasm, loader, and module translator.
 * See design/06-kernel-migration.md.
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
