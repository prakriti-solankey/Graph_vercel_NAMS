# eve + Neo4j Agent Memory

A chatbot that **remembers you between conversations**.

Close the tab. Come back tomorrow. It still knows your name, your project, and
who your friends are — because none of that lived in the chat window. It lived
in a graph.

---

## What this workshop is about

Two ideas, and everything here exists to make them concrete.

**1. An agent is just files.** There is no framework ceremony. A file in
`agent/tools/` *is* a tool. Its filename *is* the tool's name. Add a file,
restart, the agent can do a new thing. That is [Vercel eve](https://eve.dev).

**2. Chat history is not memory.** Every chatbot "remembers" what you said two
messages ago — that is just the transcript being resent. Real memory survives a
closed tab, and it isn't a list, it's a graph of people, places and projects
that link to each other. That is
[Neo4j Agent Memory](https://neo4j.com/labs/agent-memory/) (NAMS).

The workshop is the comparison: the same agent, wired to the same memory, in
**three different ways** — plus `off`, so you can see what it's like without.

---

## How it actually works

```
  you type
     │
     ▼
  Next.js chat UI  ──────────►  eve agent  ──────────►  the model
  (app/, components/)           (agent/)                (OpenAI)
                                    │
                                    │  before answering: what do we know?
                                    │  after answering:  write it down
                                    ▼
                          Neo4j Agent Memory
                       (a graph of what it knows about you)
```

In plain language:

1. You type a message. The browser sends it to the **agent**, not to OpenAI.
2. The agent looks you up in Neo4j and quietly pastes what it finds into the
   prompt — *"this person is Ananya, she's building a drone project with
   Rohit."*
3. The model answers, having been told those things as if it already knew them.
4. The agent writes the new turn back to Neo4j, which pulls out the people and
   projects mentioned and links them into the graph.

Steps 2 and 4 are the whole trick, and switching `MEMORY_MODE` changes *who
does them* — the library, or the model itself.

---

## Why Vercel

Four reasons this is built on Vercel's stack rather than a general framework.

**eve makes the agent a folder.** Tools, instructions, channels and connections
are files in `agent/`. There is no registry to update and nothing to import.
You can read the entire agent in five minutes, which matters a lot when you are
learning rather than shipping.

**One model, many providers.** The agent talks to the model through the
[AI SDK](https://ai-sdk.dev), so `openai/gpt-5.4-mini` can become
`anthropic/claude-sonnet-5` by editing one string. If you'd rather not manage a
provider key at all, Vercel AI Gateway takes one key and resolves every model
behind it.

**Sessions survive.** eve gives each conversation a durable id, so the chat can
be resumed after a refresh. That is what makes "close the tab and come back"
demonstrable rather than a claim.

**Deployment is one command.** `npm run deploy` puts the same agent on Vercel
with no config, so the last ten minutes of the workshop can be "now put it on
the internet".

---

## Setup

You need **Node 20 or newer** (`node -v`) and about five minutes.

```bash
npm install
cp .env.example .env
```

### Required

| Variable | What it's for | Where to get it |
|---|---|---|
| `OPENAI_API_KEY` | lets the agent think | [platform.openai.com/api-keys](https://platform.openai.com/api-keys) |
| `MEMORY_API_KEY` | lets the agent remember — **only needed once `MEMORY_MODE` is not `off`** | [memory.neo4jlabs.com](https://memory.neo4jlabs.com) (free, starts with `nams_`) |
| `WORKSPACE_ID` | whose memory this is — **put your own name here** so you don't share a brain with the person next to you | you |

### Optional

| Variable | Default | What it does |
|---|---|---|
| `MEMORY_MODE` | `off` | Which memory integration is live. See [the four modes](#the-four-modes). |
| `AI_GATEWAY_API_KEY` | — | Use Vercel AI Gateway instead of OpenAI directly. One key, every model. |
| `MODEL_ROUTING` | auto | Force `openai` or `gateway`. Left blank, OpenAI wins when its key is set and no gateway credential is present. |
| `AGENT_MODEL` | `openai/gpt-5.4-mini` | Which model answers. Try `anthropic/claude-sonnet-5` on the gateway route. |
| `AGENT_MODEL_CONTEXT_TOKENS` | `400000` | The model's context window. Lower it if you switch to a smaller model. |
| `MEMORY_ENDPOINT` | `https://memory.neo4jlabs.com/v1` | Point at your own NAMS server. |
| `MEMORY_MCP_URL` | `https://memory.neo4jlabs.com/mcp` | Point at your own NAMS MCP server. |

### Check it

```bash
npm run check
```

Tests your keys against the real services and tells you exactly what's wrong.
Fix anything red before moving on.

### Run it

```bash
npm run dev
```

It asks first: **memory on or off?** Say off and the agent forgets you between
chats. Say on and it asks **which mode** — `middleware`, `provider`, or `tools`
which are custom tools (the MCP server). The pick applies to that run only; `.env` is left alone, and
pressing Enter twice keeps whatever `MEMORY_MODE` is already in `.env`. In a
non-interactive shell (CI) the prompt is skipped and `.env` wins.

Open <http://localhost:3000>.

---

## Try this first

Start with `MEMORY_MODE=off` — the default — and watch it fail.

1. *"I'm Ananya, I'm doing my final year project on drone navigation with my
   friend Rohit."*
2. Click **New chat**.
3. *"What am I working on?"*

It has no idea. Now set `MEMORY_MODE=provider` in `.env`, restart, and do
the same three steps.

It knows. Open the **Agent Memory** panel above the answer to see exactly what
it had to work with, then open <https://memory.neo4jlabs.com> and look at the
nodes it made.

---

## The four modes

Pick one at the `npm run dev` prompt (or set `MEMORY_MODE` in `.env` and just
press Enter through it), and the chip in the app's header changes with it. The
prompt calls `mcp` **tools**; the other three names match.

| `MEMORY_MODE` | Who decides to remember | The code | Guide |
|---|---|---|---|
| `off` | nobody — it doesn't | — | — |
| `provider` | nobody — it always happens | [`agent/lib/model.ts`](agent/lib/model.ts) | [docs/02](docs/02-mode-transparent.md) |
| `middleware` | nobody — it always happens | [`agent/lib/model.ts`](agent/lib/model.ts) | [docs/02](docs/02-mode-transparent.md) |
| `tools` | the model, per turn | [`agent/connections/nams.ts`](agent/connections/nams.ts) | [docs/03](docs/03-mode-mcp.md) |

`provider` and `middleware` both come from the
[`@neo4j-labs/nams-ai-provider`](https://www.npmjs.com/package/@neo4j-labs/nams-ai-provider)
package and behave identically — one wraps the whole model *provider*, the other
wraps a single *model*. `mcp` uses no package at all: just a URL and a key, with
the tool list published by the server.

---

## Where things live

```
agent/                       the agent itself
├── agent.ts                 which model answers
├── instructions.md          the system prompt, in plain English
├── lib/
│   ├── nams.ts              config: which mode, whose memory, which server
│   └── model.ts             builds the model, wrapping it with memory
├── connections/
│   └── nams.ts              the MCP mode — a URL and a key
├── tools/
│   └── get_weather.ts       an example tool that has nothing to do with memory
└── channels/
    └── eve.ts               who is allowed to talk to the agent

app/, components/            the chat UI, built on Neo4j's Needle design system
scripts/                     npm run check / demo / dev
docs/                        the long version of everything below
```

**Read `agent/lib/model.ts` first.** Every memory mode passes through it, and it
is about forty lines.

### The example tool

[`agent/tools/get_weather.ts`](agent/tools/get_weather.ts) exists to show what a
tool looks like when it isn't about memory. Ask *"what's the weather in
Bengaluru?"* and watch it appear in the **Reasoning Trace** panel. It needs no
API key.

Copy it, rename the file, and you have a new tool — that is the whole extension
story.

---

## The chat UI

Two panels sit above every answer.

**Agent Memory** shows what the graph actually held, in four tabs: `recent`,
`observations`, `insights` and `entities`. It reads Neo4j directly through
[`app/api/memory/route.ts`](app/api/memory/route.ts) rather than watching for
tool calls, which is what makes it work in *every* mode — in `provider` and
`middleware` the model never calls a memory tool, so there would otherwise be
nothing to show.

**Reasoning Trace** shows the agent's own steps: its thinking, and every tool
call with its input and result. It is empty in `provider` and `middleware`, and
full in `mcp`. That contrast is the workshop, made visible.

---

## Commands

| Command | What it does |
|---|---|
| `npm run check` | verify your keys and setup |
| `npm run demo` | memory on its own, twenty lines, no agent |
| `npm run dev` | the chat app at localhost:3000 |
| `npm run chat` | the same agent in your terminal, no browser |
| `npm run typecheck` | catch mistakes before running |
| `npm run deploy` | put it on Vercel |

`npm run dev` runs two processes — the agent and the web UI — and wants about
**2 GB of free memory**. On a small machine, `npm run chat` gives you the same
agent and the same memory in your terminal for a fraction of that.

---

## Documentation

| | |
|---|---|
| [00 · Workshop guide](docs/00-workshop-guide.md) | run-of-show for whoever is teaching |
| [01 · Setup](docs/01-setup.md) | the long version of the steps above |
| [02 · Modes: provider & middleware](docs/02-mode-transparent.md) | memory the model can't see |
| [03 · Mode: mcp](docs/03-mode-mcp.md) | memory over Model Context Protocol |
| [04 · Adding a tool](docs/04-adding-a-tool.md) | how `get_weather.ts` works, and how to write your own |
| [05 · Troubleshooting](docs/05-troubleshooting.md) | when it breaks |

## Reference

- [eve docs](https://eve.dev/docs) · [AI SDK](https://ai-sdk.dev) · [Neo4j Agent Memory docs](https://neo4j.com/labs/agent-memory/)
- [`@neo4j-labs/nams-ai-provider`](https://www.npmjs.com/package/@neo4j-labs/nams-ai-provider) — the provider and middleware this workshop uses
- [`@neo4j-labs/agent-memory`](https://www.npmjs.com/package/@neo4j-labs/agent-memory) — the client underneath it
- Built after [neo4j-labs/neo4j-agent-integrations/vercel-agent](https://github.com/neo4j-labs/neo4j-agent-integrations/tree/main/vercel-agent)
