import { readFileSync, writeFileSync } from "node:fs";

import { FROZEN_EVALUATION_CONTEXT, createFrozenPrompt } from "../src/eval/prompt.ts";
import { readApiConfig } from "../src/eval/env.ts";

type Msg = { role: string; content: string };

const MODE = process.argv[2];
const FILE = process.argv[3] ?? "/tmp/flow-cache-probe.json";
if (MODE !== "save" && MODE !== "load") {
  console.error("usage: cache-probe.ts <save|load> [file]");
  process.exit(2);
}

const frozen = createFrozenPrompt(FROZEN_EVALUATION_CONTEXT);
const config = readApiConfig();
const url = `${config.baseUrl.replace(/\/$/, "")}/chat/completions`;

async function call(messages: Msg[]) {
  const started = performance.now();
  const res = await fetch(url, {
    method: "POST",
    headers: { authorization: `Bearer ${config.apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({ model: config.model, temperature: 0, messages }),
  });
  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: Record<string, unknown>;
    error?: unknown;
  };
  return { json, latencyMs: Math.round(performance.now() - started) };
}

if (MODE === "save") {
  const messages: Msg[] = [
    { role: "system", content: frozen.text },
    { role: "user", content: "Case 1: a design sits at status reviewed with every accepted P1 solved. What next?" },
  ];
  const { json, latencyMs } = await call(messages);
  const assistant = json.choices?.[0]?.message?.content ?? "";
  writeFileSync(FILE, JSON.stringify([...messages, { role: "assistant", content: assistant }], null, 2));
  console.log("SAVE", JSON.stringify({ mode: MODE, model: config.model, latencyMs, usage: json.usage }, null, 2));
} else {
  const saved = JSON.parse(readFileSync(FILE, "utf8")) as Msg[];
  const messages: Msg[] = [
    ...saved,
    { role: "user", content: "Case 2: implementation is done and fresh evidence proves the outcome. What next?" },
  ];
  const { json, latencyMs } = await call(messages);
  console.log("LOAD", JSON.stringify({ mode: MODE, model: config.model, latencyMs, usage: json.usage }, null, 2));
}
