#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { generateText, gateway, stepCountIs } from "ai";
import { createOpenAI, openai } from "@ai-sdk/openai";
import { createNams, enforceQueryMemory, ensureMemoryStored } from "@neo4j-labs/nams-ai-provider";

function loadEnv(file = ".env") {
  try {
    for (const raw of readFileSync(file, "utf8").split("\n")) {
      const m = raw.replace(/\r$/, "").match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
      if (!m) continue;
      const value = m[2].trim().replace(/^["']|["']$/g, "");
      if (value) process.env[m[1]] ??= value;
    }
  } catch {
    console.error("\n  No .env found. Run:  cp .env.example .env\n");
    process.exit(1);
  }
}

const MODEL_ID = process.env.AGENT_MODEL?.trim() || "openai/gpt-5.4-mini";

function baseModel(id = MODEL_ID) {
  const route = (process.env.MODEL_ROUTING || "").trim().toLowerCase();
  const compatUrl = process.env.OPENAI_COMPATIBLE_BASE_URL?.trim();
  const compatKey = process.env.OPENAI_COMPATIBLE_API_KEY?.trim();
  const openaiKey = process.env.OPENAI_API_KEY?.trim();
  const gatewayKey = process.env.AI_GATEWAY_API_KEY?.trim();
  const bare = id.replace(/^openai\//, "");

  if ((route === "openai-compatible" || compatUrl) && compatUrl && compatKey) {
    return createOpenAI({ baseURL: compatUrl, apiKey: compatKey })(id);
  }
  if (route === "gateway" && gatewayKey) return gateway(id);
  if (openaiKey) return openai(bare);
  if (gatewayKey) return gateway(id);
  throw new Error("No usable model key. Set OPENAI_API_KEY in .env");
}

function namsCreds() {
  const apiKey = process.env.MEMORY_API_KEY?.trim();
  if (!apiKey) {
    console.error("\n  MEMORY_API_KEY is not set. Get one free at https://memory.neo4jlabs.com\n");
    process.exit(1);
  }
  return { apiKey, endpoint: process.env.MEMORY_ENDPOINT?.trim() || "https://memory.neo4jlabs.com/v1" };
}

const scope = () => ({ userId: process.env.WORKSPACE_ID?.trim() || "workshop-student" });

const GRAPH_MCP_URL =
  process.env.MCP_URL?.trim() || "https://neo4j-mcp-official-1008050579172.us-central1.run.app/mcp";
const graphMcpConfig = () => {
  const user = process.env.MCP_NEO4J_USERNAME?.trim() || "companies";
  const pass = process.env.MCP_NEO4J_PASSWORD?.trim() || "companies";
  return {
    url: GRAPH_MCP_URL,
    headers: { Authorization: `Basic ${Buffer.from(`${user}:${pass}`).toString("base64")}` },
    toolPrefix: "graph_",
    optional: true,
  };
};

const FACT = process.argv[2] || "Hi! I'm Ananya, I'm doing my final year project on drone navigation with my friend Rohit.";
const QUESTION = process.argv[3] || "What am I working on, and who with?";
const SYSTEM =
  "You are a friendly assistant whose memory survives between conversations. " +
  "Answer in two or three sentences. Cycle: call query_memory BEFORE you answer " +
  "anything about the user, then answer, then call store_memory for any new fact " +
  "they told you. If you don't know something, say so - never invent a memory.";

function memoryToolCalls(steps = []) {
  const names = [];
  for (const s of steps ?? []) for (const c of s.toolCalls ?? [])
    if (/memory/i.test(String(c.toolName ?? ""))) names.push(c.toolName);
  return names;
}
const allToolCalls = (steps = []) =>
  (steps ?? []).flatMap((s) => (s.toolCalls ?? []).map((c) => c.toolName));

loadEnv();
console.log(`\n  MODE = tools (custom query_memory / store_memory + Neo4j graph MCP)`);
console.log(`  memory for: ${scope().userId}\n`);

const nams = createNams(namsCreds());

const { tools, close, mcp } = await nams.toolsWithMcp(scope(), graphMcpConfig());
const model = baseModel();

console.log(`  tools ready: ${Object.keys(tools).join(", ")}`);
console.log(`  graph MCP:   ${mcp?.connected ? `connected (${mcp.toolNames.join(", ")})` : `not connected${mcp?.error ? ` - ${mcp.error.message}` : ""} - memory tools only`}\n`);

const guard = enforceQueryMemory({ graceSteps: 2 });
const maybeStore = ensureMemoryStored(tools);

try {
  console.log(`  1. Conversation A - user says:\n     "${FACT}"`);
  const a = await generateText({
    model, system: SYSTEM, tools, prepareStep: guard, stopWhen: stepCountIs(6),
    messages: [{ role: "user", content: FACT }],
  });
  console.log(`     tools called: ${allToolCalls(a.steps).join(", ") || "(none)"}`);
  console.log(`     fallback store: ${JSON.stringify(await maybeStore(a))}`);
  console.log(`     agent: ${a.text}\n`);

  console.log(`  2. Conversation B (brand new) - user asks:\n     "${QUESTION}"`);
  const b = await generateText({
    model, system: SYSTEM, tools, prepareStep: guard, stopWhen: stepCountIs(6),
    messages: [{ role: "user", content: QUESTION }],
  });
  console.log(`     tools called: ${allToolCalls(b.steps).join(", ") || "(none)"}`);
  console.log(`     fallback store: ${JSON.stringify(await maybeStore(b))}`);
  console.log(`     agent: ${b.text}\n`);

  console.log(`  3. memory tools the model used in B: ${memoryToolCalls(b.steps).join(", ") || "(none)"}`);
  console.log(`     In provider/middleware this is ALWAYS empty - there the wrapper`);
  console.log(`     does it. Here the model calls query_memory / store_memory itself.`);
} finally {
  await close();
}

console.log(`
  WHAT TO NOTICE
  Memory here is just tools from the package - query_memory / store_memory -
  sitting in the SAME toolset as the Neo4j graph MCP. enforceQueryMemory made
  the model look before answering; ensureMemoryStored caught anything it
  forgot to save. Every call is visible above, unlike provider/middleware.
`);
