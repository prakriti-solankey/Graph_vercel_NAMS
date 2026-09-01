import { defineMcpClientConnection } from "eve/connections";
import { MCP_TOOLS, MCP_URL, neo4jMcpHeaders } from "../lib/neo4j";

/**
 * The Neo4j knowledge graph over MCP.
 *
 * Mounts the official Neo4j MCP server as a read-only connection and exposes
 * three tools:
 *   - get-schema          — node labels, relationship types, property keys
 *   - read-cypher         — run read-only Cypher against the database
 *   - list-gds-procedures — which GDS procedures this database actually has
 *
 * Credentials are supplied as Basic auth via neo4jMcpHeaders(); the defaults
 * point at the public "companies" demo graph. Override with:
 *   MCP_URL             — endpoint (default: official hosted MCP server)
 *   MCP_NEO4J_USERNAME  — database username
 *   MCP_NEO4J_PASSWORD  — database password
 */
export default defineMcpClientConnection({
  url: MCP_URL,
  description:
    "The Neo4j knowledge graph. Read the graph's schema (labels, relationship " +
    "types, property keys) and run read-only Cypher against it. Use for " +
    "anything structural — investors, subsidiaries, industries, counts, paths " +
    "— and check the schema with get-schema before writing a query.",
  headers: neo4jMcpHeaders,

  tools: {
    allow: [...MCP_TOOLS],
  },
});
