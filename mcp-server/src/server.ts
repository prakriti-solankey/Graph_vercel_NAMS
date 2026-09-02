import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { closeDriver, getInvestments } from "./neo4j.js";

// This server runs as its own process, outside the agent, so nothing has
// loaded .env for it. Now that no endpoint is hardcoded, it has to read the
// file itself — real environment variables still win, and a missing file is
// fine when the values come from the shell.
try {
  process.loadEnvFile?.();
} catch {
  // no .env here — rely on the shell environment
}

const NAME = "neo4j-investments-mcp";
const VERSION = "0.1.0";

const PORT = Number(process.env.INVESTMENTS_MCP_PORT?.trim() || 8100);
const PATH = process.env.INVESTMENTS_MCP_PATH?.trim() || "/mcp";
const TRANSPORT =
  process.env.MCP_TRANSPORT?.trim().toLowerCase() === "stdio" ? "stdio" : "http";

const TOOLS: Tool[] = [
  {
    name: "get_investments",
    // Wording matters more than it looks: eve's connection_search scores a tool
    // by token overlap with the user's question, and "investments" does not
    // match "investors". Without the words people actually ask with, this tool
    // scores zero and the model never sees its schema.
    description:
      "Look up the investors in a company by its exact name. " +
      "Returns the id, name, and type of each investor — Person or Organization. " +
      "Use this for questions about who invested in a company, " +
      "who its investors or backers are, and its funding relationships.",
    inputSchema: {
      type: "object",
      properties: {
        company: {
          type: "string",
          description:
            "Exact company name as it appears in the graph, e.g. 'Neo4j'.",
        },
      },
      required: ["company"],
    },
  },
];

/**
 * A fresh Server per connection. The HTTP transport runs statelessly — one
 * transport per request — so each request gets its own instance.
 */
function buildServer(): Server {
  const server = new Server(
    { name: NAME, version: VERSION },
    { capabilities: { tools: {} } },
  );

  // Tell the client what tools we expose.
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOLS,
  }));

  // Route every tool call to its handler.
  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    if (req.params.name !== "get_investments") {
      return {
        content: [{ type: "text", text: `Unknown tool: ${req.params.name}` }],
        isError: true,
      };
    }

    const company = (req.params.arguments ?? {}).company;
    if (typeof company !== "string" || company.trim() === "") {
      return {
        content: [{ type: "text", text: "get_investments needs a company name." }],
        isError: true,
      };
    }

    return { content: [{ type: "text", text: await getInvestments(company) }] };
  });

  return server;
}

async function main() {
  if (TRANSPORT === "stdio") {
    const server = buildServer();
    await server.connect(new StdioServerTransport());
    // stdout carries the protocol, so logs go to stderr.
    console.error(`${NAME} listening on stdio`);
    return;
  }

  const http = createServer((req, res) => {
    void handleHttp(req, res).catch((error) => {
      console.error("[mcp] request failed:", error);
      if (!res.headersSent) res.writeHead(500).end();
    });
  });

  http.listen(PORT, () => {
    console.error(`${NAME} listening at http://localhost:${PORT}${PATH}`);
  });

  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.on(signal, () => {
      http.close();
      void closeDriver().finally(() => process.exit(0));
    });
  }
}

async function handleHttp(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);

  // Cheap liveness probe: the agent HEADs this URL to decide whether to mount
  // the connection at all, and the MCP transport itself has no answer for HEAD.
  if (req.method === "HEAD") {
    res.writeHead(url.pathname === PATH ? 200 : 404).end();
    return;
  }

  if (url.pathname !== PATH) {
    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: `Not found. MCP is served at ${PATH}.` }));
    return;
  }

  // Stateless: a transport and server per request, discarded when it closes.
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  const server = buildServer();

  res.on("close", () => {
    void transport.close();
    void server.close();
  });

  await server.connect(transport);
  await transport.handleRequest(req, res);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
