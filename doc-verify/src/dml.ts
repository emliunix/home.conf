import { canonicalJson, sha256 } from "./hash.js";
import { ExpandedQuestion, SemanticAnswer } from "./rubric.js";
import { Verdict } from "./types.js";

export interface DmlProgram {
  source: string;
  hash: string;
}

export interface DmlOutcome {
  verdict: Verdict;
  ruleId: string;
  answers: SemanticAnswer[];
}

export function buildDml(input: { state: unknown; questions: ExpandedQuestion[]; threshold: number }): DmlProgram {
  if (input.questions.length === 0) {
    throw new Error("cannot build DML without questions");
  }
  const variables = input.questions.map((_, index) => `A${String(index)}`);
  const specifications = input.questions.map((question, index) => {
    const variable = variableAt(variables, index);
    return (
    `choose(${quote(question.item.question.instruction)}, [` +
      `supported-${quote("The evidence directly supports the criterion")}, ` +
      `refuted-${quote("The evidence contradicts the criterion")}, ` +
      `unknown-${quote("The evidence does not resolve the criterion")}]) - ${variable}`
    );
  });
  const args = variables.join(", ");
  const clauses: string[] = [];
  for (const [index, question] of input.questions.entries()) {
    if (question.item.critical) {
      clauses.push(`decide(${args}, 'NO-GO', ${quote(`${question.id}.refuted`)}) :- ${variableAt(variables, index)} == refuted.`);
    }
  }
  for (const [index, question] of input.questions.entries()) {
    if (question.item.critical) {
      clauses.push(`decide(${args}, 'NEEDS-REVIEW', ${quote(`${question.id}.unknown`)}) :- ${variableAt(variables, index)} == unknown.`);
    }
  }
  const scored = input.questions
    .map((question, index) => ({ question, variable: variableAt(variables, index) }));
  if (scored.length > 0) {
    const terms = scored.map(({ question, variable }, index) => {
      const scoreVar = `S${String(index)}`;
      return { scoreVar, goal: `answer_score(${variable}, ${scoreVar})`, weighted: `${scoreVar} * ${String(question.item.weight)}` };
    });
    const totalWeight = scored.reduce((sum, { question }) => sum + question.item.weight, 0);
    clauses.push(
      `decide(${args}, 'NEEDS-REVIEW', 'weighted.threshold') :- ` +
      `${terms.map(({ goal }) => goal).join(", ")}, Score is (${terms.map(({ weighted }) => weighted).join(" + ")}) / ${String(totalWeight)}, Score < ${String(input.threshold)}.`,
    );
  }
  clauses.push(`decide(${args}, 'PASS', 'all.required.facts').`);

  const source = [
    "answer_score(supported, 1).",
    "answer_score(refuted, 0).",
    "answer_score(unknown, 0).",
    ...clauses,
    "",
    "agent_main :-",
    `    with_judgment(jev, judge(${quote(canonicalJson(input.state))}, [`,
    specifications.map((specification) => `        ${specification}`).join(",\n"),
    "    ])),",
    `    decide(${args}, Verdict, Rule),`,
    `    format(string(Result), "~w|~w|~w", [Verdict, Rule, [${args}]]),`,
    "    answer(Result).",
    "",
  ].join("\n");
  assertRestrictedDml(source);
  return { source, hash: sha256(source) };
}

export function parseDmlOutcome(content: string): DmlOutcome {
  const [rawVerdict, rawRule, rawAnswers] = content.trim().split("|", 3);
  const verdict = stripAtom(rawVerdict ?? "");
  if (verdict !== "PASS" && verdict !== "NO-GO" && verdict !== "NEEDS-REVIEW" && verdict !== "BLOCKED") {
    throw new Error("DML returned an unknown verdict");
  }
  const list = rawAnswers?.trim();
  if (list === undefined || !list.startsWith("[") || !list.endsWith("]")) {
    throw new Error("DML returned malformed answers");
  }
  const body = list.slice(1, -1).trim();
  const answers = body.length === 0
    ? []
    : body.split(",").map((value) => stripAtom(value.trim())).map((value) => {
        if (!isSemanticAnswer(value)) {
          throw new Error("DML returned an unknown semantic answer");
        }
        return value;
      });
  return { verdict, ruleId: stripAtom(rawRule ?? ""), answers };
}

export function assertRestrictedDml(source: string): void {
  const executable = source.replace(/"(?:\\.|[^"\\])*"/g, '""');
  const prohibited = ["task(", "prompt(", "exec(", "consult(", "use_module(", "read_file(", "write_file(", "http_get(", "http_post("];
  const found = prohibited.find((token) => executable.includes(token));
  if (found !== undefined) {
    throw new Error(`generated DML contains prohibited capability: ${found}`);
  }
}

function quote(value: string): string {
  return JSON.stringify(value);
}

function stripAtom(value: string): string {
  const trimmed = value.trim();
  return trimmed.startsWith("'") && trimmed.endsWith("'") ? trimmed.slice(1, -1) : trimmed;
}

function variableAt(variables: string[], index: number): string {
  const variable = variables[index];
  if (variable === undefined) {
    throw new Error(`missing generated variable ${String(index)}`);
  }
  return variable;
}

function isSemanticAnswer(value: string): value is SemanticAnswer {
  return value === "supported" || value === "refuted" || value === "unknown";
}
