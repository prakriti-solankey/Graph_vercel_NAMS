import { defineEval } from "eve/evals";

export default defineEval({
  description:
    "A 'who invested in X' question goes to the local investments MCP server.",
  tags: ["graph"],
  async test(t) {
    // The plain question, with no hint about which tool to use — naming the
    // tool was what masked the discovery bug the first time round.
    await t.send("Who are the investors in Neo4j");

    t.succeeded();
    // eve namespaces connection tools as <connection>__<tool>.
    t.calledTool("neo4j-investments__get_investments");
  },
});
