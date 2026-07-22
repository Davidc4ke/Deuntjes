// The hand-authored Curse deck. Shared by server (dealing, display) and
// client (cards, curse pin). Curse compliance is honor-system in v1 — no
// automatic validation of the rules.

export type Curse = {
  id: string;
  name: string;
  rule: string;
  flavor: string;
};

export const CURSES: Curse[] = [
  { id: 'sparse-soul',       name: 'Sparse Soul',       rule: 'Use at most 4 notes.',                        flavor: 'Silence is a note too.' },
  { id: 'off-the-grid',      name: 'Off the Grid',      rule: 'No notes on the downbeat (steps 1·5·9·13).',  flavor: 'Never where they expect you.' },
  { id: 'minor-key',         name: 'Minor Key',         rule: 'Only notes from a minor scale.',              flavor: 'A little darkness suits the crypt.' },
  { id: 'echo-the-past',     name: 'Echo the Past',     rule: 'Match the rhythm of the previous layer.',     flavor: 'The dungeon remembers.' },
  { id: 'ghost-notes',       name: 'Ghost Notes',       rule: 'Your track stays muted until you lock it.',   flavor: 'Compose blind. Trust the bones.' },
  { id: 'one-octave-prison', name: 'One Octave Prison', rule: 'Keep every note within a single octave.',     flavor: 'The walls are close.' },
  { id: 'call-and-response', name: 'Call & Response',   rule: 'First 8 steps and last 8 steps must differ.', flavor: 'Ask, then answer.' },
];

export function curseById(id: string | null | undefined): Curse | null {
  if (!id) return null;
  return CURSES.find((c) => c.id === id) ?? null;
}

// Random draw that never repeats the previous room's curse.
export function dealCurse(excludeId?: string | null): Curse {
  const pool = CURSES.filter((c) => c.id !== excludeId);
  return pool[Math.floor(Math.random() * pool.length)];
}
