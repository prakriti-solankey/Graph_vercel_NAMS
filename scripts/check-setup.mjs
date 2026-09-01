#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";

const ok = (m) => console.log(`  \x1b[32m✓\x1b[0m ${m}`);
const bad = (m, fix) => {
  console.log(`  \x1b[31m✗\x1b[0m ${m}`);
  if (fix) console.log(`    \x1b[33m→ ${fix}\x1b[0m`);
  failures += 1;
};
const note = (m) => console.log(`  \x1b[2m·\x1b[0m ${m}`);
let failures = 0;

console.log("\n  Checking your setup…\n");

const major = Number(process.versions.node.split(".")[0]);
if (major >= 20) {
  ok(`Node ${process.versions.node}`);
} else {
  bad(`Node ${process.versions.node} is too old`, "Install Node 20 or newer from https://nodejs.org");
}

if (existsSync(".env.local")) {
  ok(".env.local exists");
  loadEnv(".env.local");
} else {
  bad(".env.local is missing", "Run: cp .env.example .env.local — then fill in the two keys");
}

const openaiKey = process.env.OPENAI_API_KEY?.trim();
const gatewayKey = process.env.AI_GATEWAY_API_KEY?.trim();
const routing = (process.env.MODEL_ROUTING ?? "").trim().toLowerCase();

if (routing && routing !== "openai" && routing !== "gateway") {
  bad(`MODEL_ROUTING="${routing}" isn't valid`, "Use openai, gateway, or leave it blank");
} else if (routing === "gateway" || (!routing && !openaiKey && gatewayKey)) {
  if (gatewayKey) {
    ok("AI_GATEWAY_API_KEY is set — the model runs through Vercel AI Gateway");
  } else {
    bad("MODEL_ROUTING=gateway but AI_GATEWAY_API_KEY is empty", "Add the key, or switch to OPENAI_API_KEY");
  }
} else if (openaiKey) {
  if (openaiKey.startsWith("sk-")) {
    ok("OPENAI_API_KEY is set — the model runs against OpenAI directly");
  } else {
    bad("OPENAI_API_KEY doesn't look right (keys start with sk-)", "Copy it again from https://platform.openai.com/api-keys");
  }
} else {
  bad("No model key found", "Set OPENAI_API_KEY (or AI_GATEWAY_API_KEY) in .env.local");
}

const mode = (process.env.MEMORY_MODE ?? "off").trim().toLowerCase();
const modes = {
  provider: "createNamsProvider() wrapping the model provider (agent/lib/model.ts)",
  middleware: "createNams().wrap() around one model instance (agent/lib/model.ts)",
  mcp: "the hosted MCP server, 12 tools discovered at runtime (agent/connections/nams.ts)",
  off: "no memory at all — the 'before' picture",
};

if (!(mode in modes)) {
  bad(`MEMORY_MODE="${mode}" isn't valid`, "Use one of: provider, middleware, mcp, off");
} else {
  ok(`MEMORY_MODE=${mode} — ${modes[mode]}`);
}

const endpoint = process.env.MEMORY_ENDPOINT?.trim() || "https://memory.neo4jlabs.com/v1";
const memoryKey = process.env.MEMORY_API_KEY?.trim();

if (mode === "off") {
  note("MEMORY_API_KEY not checked — MEMORY_MODE=off doesn't use it");
} else if (!memoryKey) {
  bad("MEMORY_API_KEY is empty", "Sign up free at https://memory.neo4jlabs.com and create a key");
} else if (!memoryKey.startsWith("nams_")) {
  bad("MEMORY_API_KEY doesn't look right (keys start with nams_)", "Copy it again from https://memory.neo4jlabs.com");
} else {
  try {
    const res = await fetch(`${endpoint}/conversations?limit=1`, {
      headers: { authorization: `Bearer ${memoryKey}` },
      signal: AbortSignal.timeout(15_000),
    });
    if (res.ok) {
      ok("MEMORY_API_KEY works — Neo4j Agent Memory answered");
    } else if (res.status === 401 || res.status === 403) {
      bad(`Neo4j rejected the key (HTTP ${res.status})`, "Create a fresh key at https://memory.neo4jlabs.com");
    } else {
      bad(`Neo4j returned HTTP ${res.status}`, "Check https://memory.neo4jlabs.com is up, then retry");
    }
  } catch (error) {
    bad(`Couldn't reach ${endpoint} (${error.message})`, "Check your internet connection or campus firewall");
  }
}

const user = process.env.WORKSHOP_USER_ID?.trim();
if (mode === "off") {
  note("WORKSHOP_USER_ID not checked — MEMORY_MODE=off stores nothing");
} else if (user) {
  ok(`Memories will be filed under "${user}"`);
} else {
  bad("WORKSHOP_USER_ID is empty", "Put your own name in .env.local so you get your own memory");
}

if (failures === 0) {
  console.log("\n  \x1b[32mAll good.\x1b[0m Next: \x1b[1mnpm run dev\x1b[0m\n");
} else {
  console.log(`\n  \x1b[31m${failures} thing${failures === 1 ? "" : "s"} to fix.\x1b[0m See the arrows above.\n`);
  process.exit(1);
}

function loadEnv(file) {
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (!match) continue;
    const value = match[2].trim().replace(/^["']|["']$/g, "");
    if (value) process.env[match[1]] ??= value;
  }
}
