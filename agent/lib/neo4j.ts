import neo4j, { type Driver } from "neo4j-driver";

const LOCAL_MCP_URL = "http://localhost:8000/mcp";

export const HOSTED_MCP_URL =
  "https://neo4j-mcp-official-1008050579172.us-central1.run.app/mcp";

export const MCP_URL = process.env.MCP_URL?.trim() || LOCAL_MCP_URL;

const MCP_USERNAME = process.env.MCP_NEO4J_USERNAME?.trim() || "companies";
const MCP_PASSWORD = process.env.MCP_NEO4J_PASSWORD?.trim() || "companies";

export const MCP_TOOLS = [
  "get-schema",
  "read-cypher",
  "list-gds-procedures",
] as const;

function isLocalUrl(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "0.0.0.0" ||
      hostname === "[::1]" ||
      hostname.endsWith(".local")
    );
  } catch {
    return false;
  }
}

export function neo4jMcpHeaders(): Record<string, string> {
  const hasExplicitCreds = Boolean(
    process.env.MCP_NEO4J_USERNAME?.trim() ||
      process.env.MCP_NEO4J_PASSWORD?.trim(),
  );
  if (isLocalUrl(MCP_URL) && !hasExplicitCreds) return {};

  const encoded = Buffer.from(`${MCP_USERNAME}:${MCP_PASSWORD}`).toString(
    "base64",
  );
  return { Authorization: `Basic ${encoded}` };
}

let reachable: { at: number; ok: boolean } | undefined;

export async function mcpReachable(timeoutMs = 1500): Promise<boolean> {
  if (reachable && Date.now() - reachable.at < 60_000) return reachable.ok;
  let ok = false;
  try {
    const response = await fetch(MCP_URL, {
      method: "HEAD",
      headers: neo4jMcpHeaders(),
      signal: AbortSignal.timeout(timeoutMs),
    });
    ok = response.status < 500;
  } catch {
    ok = false;
  }
  reachable = { at: Date.now(), ok };
  return ok;
}

const BOLT_URI = process.env.NEO4J_URI?.trim() || "neo4j+s://demo.neo4jlabs.com:7687";
const BOLT_USERNAME = process.env.NEO4J_USERNAME?.trim() || "companies";
const BOLT_PASSWORD = process.env.NEO4J_PASSWORD?.trim() || "companies";
const BOLT_DATABASE = process.env.NEO4J_DATABASE?.trim() || "companies";

let driver: Driver | undefined;

function getDriver(): Driver {
  driver ??= neo4j.driver(
    BOLT_URI,
    neo4j.auth.basic(BOLT_USERNAME, BOLT_PASSWORD),
    { maxConnectionPoolSize: 10, connectionAcquisitionTimeout: 10_000 },
  );
  return driver;
}

export async function readQuery<T = Record<string, unknown>>(
  cypher: string,
  params: Record<string, unknown> = {},
): Promise<T[]> {
  const { records } = await getDriver().executeQuery(cypher, params, {
    database: BOLT_DATABASE,
    routing: "READ",
  });
  return records.map((record) => toPlain(record.toObject()) as T);
}

function toPlain(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (neo4j.isInt(value)) {
    return value.inSafeRange() ? value.toNumber() : value.toString();
  }
  if (Array.isArray(value)) return value.map(toPlain);
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") {
    if ("toString" in value && value.constructor?.name?.startsWith("Date")) {
      return String(value);
    }
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, toPlain(v)]),
    );
  }
  return value;
}
