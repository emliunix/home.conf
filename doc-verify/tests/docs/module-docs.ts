/**
 * The module-docs gate (design/13 §Verification design): every `docs/modules/<pkg>/` quad states
 * only exports its source files have, pairs every claimed property with an existing test, and
 * names each test's tier truthfully.
 *
 * Documents are read through `read` so a seeded defect can replace one; source files and the
 * vitest configuration are always read from the repository.
 */

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import ts from "typescript";

export type ReadDoc = (rel: string) => string | undefined;

export const TIERS = ["unit", "subprocess", "kernel-slow"] as const;
export type Tier = (typeof TIERS)[number];

const ENTRY_POINT = "none (entry point)";
const IDENT = /^[A-Za-z_$][\w$]*$/;
const KERNEL_SLOW = "doc-verify/tests/kernel-slow/";

/** Split one Markdown table row into trimmed cells, ignoring `|` inside backtick spans. */
export function splitRow(line: string): string[] {
  const body = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  const cells: string[] = [];
  let cur = "";
  let inCode = false;
  for (const ch of body) {
    if (ch === "`") inCode = !inCode;
    if (ch === "|" && !inCode) {
      cells.push(cur.trim());
      cur = "";
    } else {
      cur += ch;
    }
  }
  cells.push(cur.trim());
  return cells;
}

/** The first table under `## heading` (or the first table in the file when heading is undefined). */
export function tableRows(text: string, heading?: string): { header: string[]; rows: { line: number; cells: string[] }[] } | undefined {
  const lines = text.split("\n");
  let i = 0;
  if (heading !== undefined) {
    i = lines.findIndex((l) => l.trim() === `## ${heading}`);
    if (i < 0) return undefined;
  }
  for (; i < lines.length; i++) {
    const l = lines[i] ?? "";
    if (heading !== undefined && i > 0 && /^#{1,2} /.test(l) && l.trim() !== `## ${heading}`) return undefined;
    if (l.trim().startsWith("|")) break;
  }
  if (i >= lines.length) return undefined;
  const header = splitRow(lines[i] ?? "");
  const rows: { line: number; cells: string[] }[] = [];
  for (let j = i + 2; j < lines.length && (lines[j] ?? "").trim().startsWith("|"); j++) {
    rows.push({ line: j + 1, cells: splitRow(lines[j] ?? "") });
  }
  return { header, rows };
}

function backticked(cell: string): string | undefined {
  const m = /^`([^`]+)`$/.exec(cell.trim());
  return m?.[1];
}

function listOfBackticked(cell: string): string[] | undefined {
  const parts = cell.split(",").map((p) => p.trim());
  const out: string[] = [];
  for (const p of parts) {
    const v = backticked(p);
    if (v === undefined) return undefined;
    out.push(v);
  }
  return out;
}

/** The names a TypeScript file exports, re-exports and aliases resolved. */
const exportCache = new Map<string, Map<string, Set<string>>>();

export function exportedNames(root: string, files: string[]): Map<string, Set<string>> {
  const key = `${root}\0${[...files].sort().join("\0")}`;
  const hit = exportCache.get(key);
  if (hit !== undefined) return hit;
  const out = compileExports(root, files);
  exportCache.set(key, out);
  return out;
}

function compileExports(root: string, files: string[]): Map<string, Set<string>> {
  const abs = files.map((f) => path.join(root, f));
  const program = ts.createProgram(abs, {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.NodeNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext,
    noEmit: true,
    skipLibCheck: true,
  });
  const checker = program.getTypeChecker();
  const out = new Map<string, Set<string>>();
  for (const [k, file] of abs.entries()) {
    const sf = program.getSourceFile(file);
    const sym = sf === undefined ? undefined : checker.getSymbolAtLocation(sf);
    const names = new Set<string>(sym === undefined ? [] : checker.getExportsOfModule(sym).map((s) => s.getName()));
    out.set(files[k] as string, names);
  }
  return out;
}

/** Where vitest runs a test file, read from the repository's `vitest.config.ts`. */
export function tierOf(root: string, testPath: string): Tier | undefined {
  if (testPath.startsWith(KERNEL_SLOW)) return "kernel-slow";
  const config = readFileSync(path.join(root, "vitest.config.ts"), "utf8");
  const block = /const SUBPROCESS = \[([\s\S]*?)\];/.exec(config)?.[1] ?? "";
  const subprocess = [...block.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
  if (subprocess.includes(testPath)) return "subprocess";
  if (testPath.startsWith("doc-verify/tests/") && testPath.endsWith(".test.ts")) return "unit";
  return undefined;
}

export function modulePackages(root: string): string[] {
  const dir = path.join(root, "docs/modules");
  return readdirSync(dir).filter((d) => statSync(path.join(dir, d)).isDirectory()).sort();
}

/** Every violation of the gate, as `path:line clause: message`. Empty when the docs hold. */
export function checkModuleDocs(root: string, read: ReadDoc = (rel) => {
  const p = path.join(root, rel);
  return existsSync(p) ? readFileSync(p, "utf8") : undefined;
}): string[] {
  const out: string[] = [];
  const isFile = (rel: string) => existsSync(path.join(root, rel)) && statSync(path.join(root, rel)).isFile();

  for (const pkg of modulePackages(root)) {
    const base = `docs/modules/${pkg}`;

    // Contract: Module cell (clause 1), Exports cell (clause 2), grammar (clause 6).
    const contractPath = `${base}/contract.md`;
    const contract = read(contractPath);
    const surface = contract === undefined ? undefined : tableRows(contract, "Public surface");
    if (surface === undefined) {
      out.push(`${contractPath} clause 6: no Public surface table`);
    } else {
      const wanted: { line: number; file: string; exports: string[] | "entry" }[] = [];
      for (const row of surface.rows) {
        const [moduleCell = "", exportsCell = ""] = row.cells;
        const file = backticked(moduleCell);
        if (file === undefined || !file.includes("/")) {
          out.push(`${contractPath}:${row.line} clause 6: Module cell is not one backticked repository path: ${moduleCell}`);
          continue;
        }
        if (!isFile(file)) {
          out.push(`${contractPath}:${row.line} clause 1: ${file} does not exist or is not a file`);
          continue;
        }
        if (exportsCell === ENTRY_POINT) {
          wanted.push({ line: row.line, file, exports: "entry" });
          continue;
        }
        const names = listOfBackticked(exportsCell);
        if (names === undefined || names.length === 0 || names.some((n) => !IDENT.test(n))) {
          out.push(`${contractPath}:${row.line} clause 6: Exports cell is not a list of backticked identifiers or '${ENTRY_POINT}': ${exportsCell}`);
          continue;
        }
        wanted.push({ line: row.line, file, exports: names });
      }
      const tsFiles = wanted.filter((w) => w.file.endsWith(".ts")).map((w) => w.file);
      const actual = exportedNames(root, tsFiles);
      for (const w of wanted) {
        const have = actual.get(w.file);
        if (have === undefined) {
          out.push(`${contractPath}:${w.line} clause 2: ${w.file} is not a TypeScript file`);
          continue;
        }
        if (w.exports === "entry") {
          if (have.size > 0) out.push(`${contractPath}:${w.line} clause 2: ${w.file} is marked an entry point but exports ${[...have].sort().join(", ")}`);
          continue;
        }
        for (const name of w.exports) {
          if (!have.has(name)) out.push(`${contractPath}:${w.line} clause 2: ${w.file} does not export ${name}`);
        }
      }
    }

    // Properties and verification: pairing (clause 3), tests exist (clause 4), tier (clause 5), grammar (clause 6).
    const propsPath = `${base}/properties.md`;
    const verPath = `${base}/verification.md`;
    const props = read(propsPath);
    const ver = read(verPath);
    const idPattern = new RegExp(`^P-${pkg}-\\d\\d$`);
    const claimed = new Set<string>();
    const propTable = props === undefined ? undefined : tableRows(props);
    if (propTable === undefined) {
      out.push(`${propsPath} clause 6: no property table`);
    } else {
      for (const row of propTable.rows) {
        const id = row.cells[0] ?? "";
        if (!idPattern.test(id)) out.push(`${propsPath}:${row.line} clause 6: '${id}' is not a P-${pkg}-NN id`);
        else claimed.add(id);
      }
    }
    const verTable = ver === undefined ? undefined : tableRows(ver);
    const paired = new Set<string>();
    if (verTable === undefined) {
      out.push(`${verPath} clause 6: no verification table`);
    } else {
      const header = verTable.header.join(" | ");
      if (header !== "Property | Check (deciding test) | Limit") {
        out.push(`${verPath} clause 6: header is '${header}', not 'Property | Check (deciding test) | Limit'`);
      }
      for (const row of verTable.rows) {
        const [id = "", check = "", limit = ""] = row.cells;
        const at = `${verPath}:${row.line}`;
        if (!claimed.has(id)) out.push(`${at} clause 3: ${id} is not claimed in ${propsPath}`);
        paired.add(id);
        if (check === "none") {
          if (!limit.startsWith("not in force")) out.push(`${at} clause 6: a 'none' row's Limit must begin with 'not in force'`);
          continue;
        }
        const tests = listOfBackticked(check);
        if (tests === undefined || tests.length === 0) {
          out.push(`${at} clause 6: Check cell is not a list of backticked test paths or 'none': ${check}`);
          continue;
        }
        const tierWord = /^([a-z-]+);/.exec(limit)?.[1];
        if (tierWord === undefined || !(TIERS as readonly string[]).includes(tierWord)) {
          out.push(`${at} clause 6: Limit does not begin with a tier (${TIERS.join(", ")}) and ';': ${limit}`);
          continue;
        }
        for (const t of tests) {
          if (!t.endsWith(".test.ts") && !t.startsWith(KERNEL_SLOW)) {
            out.push(`${at} clause 6: ${t} is not a test file`);
            continue;
          }
          if (!isFile(t)) {
            out.push(`${at} clause 4: ${t} does not exist`);
            continue;
          }
          const tier = tierOf(root, t);
          if (tier !== tierWord) out.push(`${at} clause 5: ${t} runs in ${tier ?? "no tier"}, the row says ${tierWord}`);
        }
      }
    }
    for (const id of claimed) {
      if (!paired.has(id)) out.push(`${verPath} clause 3: ${id} has no verification row`);
    }
  }
  return out;
}
