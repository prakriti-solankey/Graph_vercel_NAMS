import type { MemoryClient } from "@neo4j-labs/agent-memory";
import { makeClient, type NamsConfig, type NamsScope } from "@neo4j-labs/nams-ai-provider";

export type MemoryMode = "provider" | "middleware" | "mcp" | "off";

export const MEMORY_ENDPOINT =
  process.env.MEMORY_ENDPOINT?.trim() || "https://memory.neo4jlabs.com/v1";

export const MEMORY_MCP_URL =
  process.env.MEMORY_MCP_URL?.trim() || "https://memory.neo4jlabs.com/mcp";

export function memoryMode(): MemoryMode {
  const raw = process.env.MEMORY_MODE?.trim().toLowerCase() || "off";
  if (raw === "provider" || raw === "middleware" || raw === "mcp" || raw === "off") {
    return raw;
  }
  throw new Error(
    `MEMORY_MODE is "${raw}". It must be one of: provider, middleware, mcp, off. Check your .env.local.`,
  );
}

export function memoryApiKey(): string {
  const key = process.env.MEMORY_API_KEY;
  if (!key) {
    throw new Error(
      "MEMORY_API_KEY is not set. Copy .env.example to .env.local and paste your key from https://memory.neo4jlabs.com",
    );
  }
  return key;
}

export function workshopUserId(): string {
  return process.env.WORKSHOP_USER_ID?.trim() || "workshop-student";
}

export function namsConfig(): NamsConfig {
  return {
    apiKey: memoryApiKey(),
    endpoint: MEMORY_ENDPOINT,
    ...(process.env.MEMORY_WORKSPACE_ID?.trim()
      ? { workspaceId: process.env.MEMORY_WORKSPACE_ID.trim() }
      : {}),
  };
}

export function namsScope(): NamsScope {
  return { userId: workshopUserId() };
}

let cached: MemoryClient | undefined;

export function namsClient(): MemoryClient {
  cached ??= makeClient(namsConfig());
  return cached;
}
