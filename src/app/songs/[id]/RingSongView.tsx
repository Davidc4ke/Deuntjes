'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { RingSequencer } from '@/components/ring/RingSequencer';
import type { RingSongState } from '@/lib/ringState';

type Credit = {
  roman: string;
  player: string;
  avatar: string;
  track: string;
  curse: string | null;
  rule: string | null;
};

// Read-only listen page for a ring-format (dungeon) song: a slim header over
// the full ring. Every lane is locked; play, seek, lane-switching and the
// eye toggles still work. A "chronicle" button opens an overlay crediting
// who forged each layer and under which curse — it's position:fixed, so it
// never affects the ring's size.
export function RingSongView({
  title,
  initialState,
  creator,
  credits = [],
}: {
  title: string;
  initialState: RingSongState;
  creator: { displayName: string; avatarEmoji: string };
  credits?: Credit[];
}) {
  const router = useRouter();
  const [chronicle, setChronicle] = useState(false);

  const gothic = '"Pirata One", serif';
  const display = '"UnifrakturCook", "Pirata One", serif';
  const body = '"IM Fell English", Georgia, serif';

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
          fontFamily: body,
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
            fontFamily: display,
            fontSize: 18,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            flex: 1,
          }}
        >
          {title}
        </span>
        {credits.length > 0 && (
          <button
            onClick={() => setChronicle(true)}
            aria-label="Who built this song"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: 'linear-gradient(180deg,#f4efe2,#ddd5c2)',
              color: '#151210',
              border: '1px solid #000',
              borderRadius: 3,
              fontFamily: gothic,
              fontSize: 13,
              letterSpacing: '.03em',
              padding: '5px 10px',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            <ScrollGlyph /> Chronicle
          </button>
        )}
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>
        <RingSequencer initialState={initialState} readOnly />
      </div>

      {chronicle && (
        <div
          onClick={() => setChronicle(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 50,
            background: 'rgba(3,3,3,.82)',
            backdropFilter: 'blur(2px)',
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 520,
              maxHeight: '82vh',
              overflowY: 'auto',
              background: 'radial-gradient(120% 80% at 50% 0%, #171310, #0a0908 70%)',
              borderTop: '2px solid var(--blood-dark, #5c0d0d)',
              borderTopLeftRadius: 10,
              borderTopRightRadius: 10,
              padding: 'calc(14px) 14px calc(20px + env(safe-area-inset-bottom))',
              fontFamily: body,
              boxShadow: '0 -14px 40px rgba(0,0,0,.7)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 12,
              }}
            >
              <span style={{ fontFamily: display, fontSize: 22, color: '#f2ede3' }}>
                The Chronicle
              </span>
              <button
                onClick={() => setChronicle(false)}
                aria-label="Close"
                style={{
                  background: 'none',
                  border: '1px solid rgba(242,237,227,.25)',
                  borderRadius: 3,
                  color: '#f2ede3',
                  fontSize: 15,
                  lineHeight: 1,
                  padding: '5px 10px',
                  cursor: 'pointer',
                }}
              >
                ✕
              </button>
            </div>
            <p style={{ margin: '0 0 14px', fontStyle: 'italic', fontSize: 12.5, color: '#7d7768' }}>
              Every layer, the bard who forged it, and the curse they carved under.
            </p>
            {credits.map((c, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  gap: 11,
                  alignItems: 'flex-start',
                  padding: '11px 4px',
                  borderTop: i === 0 ? 'none' : '1px solid rgba(242,237,227,.08)',
                }}
              >
                <span
                  style={{
                    flexShrink: 0,
                    minWidth: 34,
                    textAlign: 'center',
                    fontFamily: body,
                    fontSize: 17,
                    color: '#b3ac9d',
                    paddingTop: 2,
                  }}
                >
                  {c.roman}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: '#f2ede3', fontSize: 15 }}>
                      <span style={{ fontSize: 17 }}>{c.avatar}</span> {c.player}
                    </span>
                    <span style={chip}>{c.track} layer</span>
                    {c.curse && <span style={{ ...chip, opacity: 0.92 }}>☠&#xFE0E; {c.curse}</span>}
                  </div>
                  {c.rule && (
                    <div style={{ marginTop: 5, fontStyle: 'italic', fontSize: 12.5, color: '#7d7768' }}>
                      {c.rule}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const chip: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 5,
  fontSize: 11.5,
  padding: '2.5px 8px',
  borderRadius: 2,
  border: '1px solid rgba(242,237,227,.28)',
  color: '#b3ac9d',
  fontFamily: '"Pirata One", serif',
  letterSpacing: '.02em',
};

function ScrollGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M6 3h9a3 3 0 0 1 3 3v12M6 3a3 3 0 0 0-3 3v1h3M6 3a3 3 0 0 1 3 3v12a3 3 0 0 0 3 3H6a3 3 0 0 1-3-3V7" />
      <path d="M18 18a3 3 0 0 0 3 3H12" strokeLinecap="round" />
    </svg>
  );
}
