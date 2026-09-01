/**
 * Neo4j MCP connection config.
 *
 * The same graph reached over MCP — supplies get-schema / read-cypher /
 * list-gds-procedures. Credentials default to the public "companies" demo
 * so the agent works out of the box; set MCP_URL / MCP_NEO4J_USERNAME /
 * MCP_NEO4J_PASSWORD in .env to point at your own database.
 */

const DEFAULT_MCP_URL =
  "https://neo4j-mcp-official-1008050579172.us-central1.run.app/mcp";

export const MCP_URL = process.env.MCP_URL?.trim() ?? DEFAULT_MCP_URL;

const MCP_USERNAME = process.env.MCP_NEO4J_USERNAME?.trim() ?? "companies";
const MCP_PASSWORD = process.env.MCP_NEO4J_PASSWORD?.trim() ?? "companies";

/**
 * The three read-only tools published by the official Neo4j MCP server.
 */
export const MCP_TOOLS = [
  "get-schema",
  "read-cypher",
  "list-gds-procedures",
] as const;

/**
 * Returns Basic-auth headers for every request to the MCP server.
 * Called at request time so rotating credentials are picked up without a
 * restart.
 */
export function neo4jMcpHeaders(): Record<string, string> {
  const encoded = Buffer.from(`${MCP_USERNAME}:${MCP_PASSWORD}`).toString(
    "base64",
  );
  return { Authorization: `Basic ${encoded}` };
}
