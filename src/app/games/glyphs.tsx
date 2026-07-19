// Woodcut SVG glyphs + small helpers shared by the dungeon screens.
// All monochrome + blood, matching public/mockups/game-flow.html.

export function toRoman(n: number): string {
  const m: Array<[number, string]> = [[10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
  let out = '';
  for (const [v, s] of m) {
    while (n >= v) {
      out += s;
      n -= v;
    }
  }
  return out;
}

// channelId -> woodcut hatch class (channel identity without colour)
export const CHANNEL_PATTERNS: Record<number, string> = {
  1: 'pat-bass',
  2: 'pat-drum',
  3: 'pat-lead',
  4: 'pat-chord',
};

export function SkullGlyph({ size = 16, stroke = 'currentColor', eyes = 'currentColor' }: { size?: number; stroke?: string; eyes?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 2C7 2 4 5.5 4 10c0 2.4 1.1 3.9 2 4.8V18a2 2 0 0 0 2 2h.5v-2.2h1.3V20h4.4v-2.2h1.3V20H16a2 2 0 0 0 2-2v-3.2c.9-.9 2-2.4 2-4.8 0-4.5-3-8-8-8Z"
        stroke={stroke}
        strokeWidth="1.4"
      />
      <circle cx="9" cy="11" r="1.8" fill={eyes} />
      <circle cx="15" cy="11" r="1.8" fill={eyes} />
      <path d="M11 14.6 12 13.4 13 14.6" stroke={stroke} strokeWidth="1.1" />
    </svg>
  );
}

export function D20Glyph({ size = 16, stroke = 'currentColor' }: { size?: number; stroke?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 1.8 21 7v10l-9 5.2L3 17V7Z" stroke={stroke} strokeWidth="1.3" />
      <path d="M12 5.6 17.9 15.8H6.1Z" stroke={stroke} strokeWidth="1.1" />
      <path d="M12 1.8v3.8M21 7l-3.1 8.8M3 7l3.1 8.8M12 22.2l-5.9-6.4M12 22.2l5.9-6.4" stroke={stroke} strokeWidth="0.9" />
    </svg>
  );
}

export function LockGlyph({ size = 24, stroke = 'currentColor', open = false }: { size?: number; stroke?: string; open?: boolean }) {
  return (
    <svg className="lockicon" width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="5" y="11" width="14" height="9.5" rx="1.5" stroke={stroke} strokeWidth="1.4" />
      {open ? (
        <path d="M8 11V8a4 4 0 0 1 7.6-1.7" stroke={stroke} strokeWidth="1.4" />
      ) : (
        <path d="M8 11V8a4 4 0 0 1 8 0v3" stroke={stroke} strokeWidth="1.4" />
      )}
      <circle cx="12" cy="15" r="1.5" fill={stroke} />
      <path d="M12 16.3v2" stroke={stroke} strokeWidth="1.4" />
    </svg>
  );
}

export function SwordsGlyph({ size = 20, stroke = 'currentColor' }: { size?: number; stroke?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4.5 19.5 18 6l1.5-3.5L16 4 4.5 17.5" stroke={stroke} strokeWidth="1.4" />
      <path d="M19.5 19.5 6 6 4.5 2.5 8 4l11.5 13.5" stroke={stroke} strokeWidth="1.4" />
      <path d="M6.8 15.4 8.6 17.2M17.2 15.4 15.4 17.2" stroke={stroke} strokeWidth="1.6" />
      <circle cx="4.6" cy="19.6" r="1.3" fill={stroke} />
      <circle cx="19.4" cy="19.6" r="1.3" fill={stroke} />
    </svg>
  );
}

export function LuteGlyph({ size = 40, stroke = 'currentColor' }: { size?: number; stroke?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <ellipse cx="11" cy="15.5" rx="6" ry="6.6" stroke={stroke} strokeWidth="1.4" />
      <circle cx="11" cy="15.5" r="1.9" stroke={stroke} strokeWidth="1.1" />
      <path d="M14.5 10.5 20 4.2M20 4.2l1.4 1.2-1.9.5M9.6 15.5h2.8" stroke={stroke} strokeWidth="1.3" />
    </svg>
  );
}

// Initial medallion text for a player (e.g. "Da" for David, "B" for Bolbo
// when unambiguous). Keep it simple: first two letters, capitalized.
export function initials(displayName: string): string {
  const t = displayName.trim();
  if (!t) return '?';
  return t.length === 1 ? t.toUpperCase() : t[0].toUpperCase() + t[1].toLowerCase();
}
