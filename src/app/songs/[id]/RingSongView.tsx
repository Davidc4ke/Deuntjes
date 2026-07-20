'use client';

import { useRouter } from 'next/navigation';
import { RingSequencer } from '@/components/ring/RingSequencer';
import type { RingSongState } from '@/lib/ringState';

// Read-only listen page for a ring-format (dungeon) song: a slim header over
// the full ring. Every lane is locked; play, seek, lane-switching and the
// eye toggles still work, so the finished song can be explored and heard.
export function RingSongView({
  title,
  initialState,
  creator,
}: {
  title: string;
  initialState: RingSongState;
  creator: { displayName: string; avatarEmoji: string };
}) {
  const router = useRouter();
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        background: '#050505',
        color: '#f2ede3',
      }}
    >
      <div
        style={{
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: 'calc(6px + env(safe-area-inset-top)) 12px 6px',
          fontFamily: '"IM Fell English", Georgia, serif',
        }}
      >
        <button
          onClick={() => router.push('/')}
          style={{
            background: 'none',
            border: '1px solid rgba(242,237,227,.25)',
            borderRadius: 3,
            color: '#f2ede3',
            fontSize: 18,
            lineHeight: 1,
            padding: '4px 10px',
            cursor: 'pointer',
          }}
        >
          ‹
        </button>
        <span
          style={{
            fontFamily: '"UnifrakturCook", "Pirata One", serif',
            fontSize: 18,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            flex: 1,
          }}
        >
          {title}
        </span>
        <span style={{ fontSize: 12, fontStyle: 'italic', color: '#7d7768', flexShrink: 0 }}>
          {creator.avatarEmoji} {creator.displayName}
        </span>
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>
        <RingSequencer initialState={initialState} readOnly />
      </div>
    </div>
  );
}
