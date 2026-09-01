export const AGENT_NAME = 'eve + Neo4j memory';

export const DEFAULT_SUGGESTIONS = [
  "Hi! I'm Ananya, I'm doing my final year project on drone navigation with my friend Rohit.",
  'What am I working on?',
  'Remember that I prefer short, technical answers.',
  'How does your memory actually work?',
];

export const MEMORY_MODES = {
  provider: { detail: 'createNamsProvider() · agent/lib/model.ts', tone: 'success' },
  middleware: { detail: 'createNams().wrap() · agent/lib/model.ts', tone: 'success' },
  mcp: { detail: 'NAMS memory MCP · agent/connections/nams.ts', tone: 'info' },
  off: { detail: 'no memory', tone: 'warning' },
} as const;

export const MEMORY_TABS = [
  { id: 'recent', label: 'recent' },
  { id: 'observations', label: 'observations' },
  { id: 'insights', label: 'insights' },
  { id: 'entities', label: 'entities' },
] as const;
