import { defineDynamic } from "eve";
import { defineMcpClientConnection } from "eve/connections";
import { MEMORY_MCP_URL, memoryApiKey, memoryMode } from "../lib/nams";

export default defineDynamic({
  events: {

    "session.started": () => {
      if (memoryMode() !== "mcp") return null;

      return defineMcpClientConnection({
        url: MEMORY_MCP_URL,

        description:
          "Neo4j Agent Memory. Long-term memory about this user across every past " +
          "conversation: people, organizations, places and projects they have " +
          "mentioned, plus the running history of this conversation. Search it " +
          "before answering anything personal, and store what you learn.",

        auth: {
          getToken: async () => ({ token: memoryApiKey() }),
        },

        tools: {
          allow: [
            "memory_create_conversation",
            "memory_add_messages",
            "memory_search_entities",
            "memory_add_entity",
            "memory_get_context",
          ],
        },
      });
    },
  },
});
