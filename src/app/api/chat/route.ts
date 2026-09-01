import { openai } from "@ai-sdk/openai";
import { createNamsProvider } from "@neo4j-labs/nams-ai-provider";
import {
  ToolLoopAgent,
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  stepCountIs,
  type UIMessage,
} from "ai";

export const maxDuration = 30;

const EVE_INSTRUCTIONS =
  "You are Eve, a helpful AI assistant with a persistent memory of the " +
  "people you talk to. Use any memories provided to you to personalize " +
  "your responses, and be concise and friendly.";

export async function POST(req: Request) {
  const { messages, userId }: { messages: UIMessage[]; userId?: string } =
    await req.json();

  const memoryApiKey = process.env.MEMORY_API_KEY;

  // Eve works with or without Neo4j Agent Memory configured: if no API key
  // is set, fall back to the plain model so local development still works.
  const model = memoryApiKey
    ? createNamsProvider({
        apiKey: memoryApiKey,
        baseProvider: openai,
        scope: { userId: userId ?? "anonymous" },
      }).languageModel("gpt-4o-mini")
    : openai("gpt-4o-mini");

  const agent = new ToolLoopAgent({
    model,
    instructions: EVE_INSTRUCTIONS,
    stopWhen: stepCountIs(10),
  });

  const stream = createUIMessageStream({
    execute: async ({ writer }) => {
      const result = await agent.stream({
        messages: await convertToModelMessages(messages),
      });
      writer.merge(result.toUIMessageStream());
    },
  });

  return createUIMessageStreamResponse({ stream });
}
