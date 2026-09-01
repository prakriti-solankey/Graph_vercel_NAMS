# Eve — Vercel Agent with Neo4j Agent Memory

Eve is a chat agent built with the [Vercel AI SDK](https://sdk.vercel.ai) and
deployable on [Vercel](https://vercel.com). It uses
[`@neo4j-labs/nams-ai-provider`](https://www.npmjs.com/package/@neo4j-labs/nams-ai-provider)
as its memory provider, backed by the Neo4j Agent Memory Service (NAMS), so
Eve remembers facts and preferences about each user across sessions.

## How it works

- `src/app/api/chat/route.ts` defines Eve as an `ai` SDK `ToolLoopAgent`.
- When `MEMORY_API_KEY` is configured, the agent's model is wrapped with
  `createNamsProvider`, which automatically retrieves relevant memories from
  Neo4j before each response and persists new memories after each response.
- When `MEMORY_API_KEY` is not set, Eve falls back to a plain model with no
  persistent memory, so local development works without a Neo4j Agent Memory
  account.
- `src/app/page.tsx` is a minimal chat UI built with `useChat` from
  `@ai-sdk/react`.

## Getting started

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env.local` and fill in your keys:

   ```bash
   cp .env.example .env.local
   ```

   - `OPENAI_API_KEY` — API key for the language model (OpenAI by default).
   - `MEMORY_API_KEY` — API key for the Neo4j Agent Memory Service, available
     for free at [memory.neo4jlabs.com](https://memory.neo4jlabs.com). Optional;
     without it Eve runs without persistent memory.

3. Run the development server:

   ```bash
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000) and chat with Eve.

## Deploying to Vercel

Deploy this project to Vercel and configure the `OPENAI_API_KEY` and
`MEMORY_API_KEY` environment variables in the project settings. No Neo4j
infrastructure to manage — the Neo4j Agent Memory Service is fully hosted.

## Scripts

- `npm run dev` — start the local development server
- `npm run build` — create a production build
- `npm run start` — run the production build
- `npm run lint` — lint the codebase
