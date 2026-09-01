import { namsConfig, namsClient, namsScope } from '@/agent/lib/nams';
import { findExistingConversation } from '@neo4j-labs/nams-ai-provider';
import type { MemoryHit, MemorySnapshot, MemoryTab } from '@/types';
import { emptySnapshot } from '@/utils/message';

export const dynamic = 'force-dynamic';

const RECENT_LIMIT = 8;
const ENTITY_LIMIT = 8;

export async function GET(request: Request): Promise<Response> {
  const query = new URL(request.url).searchParams.get('q')?.trim() ?? '';

  if (!process.env.MEMORY_API_KEY) {
    return Response.json(
      { error: 'MEMORY_API_KEY is not set. Copy .env.example to .env.local and paste your key.' },
      { status: 503 },
    );
  }

  try {
    const client = namsClient();
    const conversationId = await findExistingConversation(client, namsConfig(), namsScope());

    const [context, entities] = await Promise.all([
      conversationId ? client.shortTerm.getContext(conversationId) : null,
      query ? client.longTerm.searchEntities(query, { limit: ENTITY_LIMIT }) : [],
    ]);

    const snapshot = emptySnapshot();

    snapshot.items.recent = asRows(context?.recentMessages)
      .slice(-RECENT_LIMIT)
      .map((row) => ({ content: textOf(row), label: labelOf(row, 'message') }));

    snapshot.items.observations = asRows(context?.observations).map((row) => ({
      content: textOf(row),
      label: 'observation',
    }));

    snapshot.items.insights = asRows(context?.reflections).map((row) => ({
      content: textOf(row),
      label: 'reflection',
    }));

    snapshot.items.entities = asRows(entities).map((row) => {
      const entity = row as { name?: string; type?: string; description?: string };
      return {
        content: entity.description
          ? `${entity.name ?? 'Unnamed'} — ${entity.description}`
          : (entity.name ?? 'Unnamed'),
        label: entity.type ?? 'entity',
      };
    });

    for (const tab of Object.keys(snapshot.items) as MemoryTab[]) {
      snapshot.items[tab] = snapshot.items[tab].filter((hit: MemoryHit) => hit.content.trim());
      snapshot.counts[tab] = snapshot.items[tab].length;
    }

    return Response.json(snapshot satisfies MemorySnapshot);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return Response.json({ error: `Neo4j Agent Memory did not answer: ${detail}` }, { status: 502 });
  }
}

function asRows(value: unknown): readonly unknown[] {
  return Array.isArray(value) ? value : [];
}

function textOf(row: unknown): string {
  if (typeof row === 'string') return row;
  if (!row || typeof row !== 'object') return '';
  const record = row as Record<string, unknown>;
  for (const key of ['content', 'text', 'summary', 'description']) {
    if (typeof record[key] === 'string') return record[key];
  }
  return '';
}

function labelOf(row: unknown, fallback: string): string {
  if (!row || typeof row !== 'object') return fallback;
  const role = (row as Record<string, unknown>).role;
  return typeof role === 'string' ? role : fallback;
}
