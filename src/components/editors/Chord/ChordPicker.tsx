'use client';
import { useState } from 'react';
import {
  diatonicRomanOptions,
  RAW_QUALITIES,
  RAW_ROOTS,
  formatChord,
  type RomanOption,
} from './chordOptions';
import type { BarChord } from './types';

type Tab = 'roman' | 'raw';

export function ChordPicker({
  barNumber,
  keyRoot,
  keyMode,
  current,
  onPick,
  onClear,
}: {
  barNumber: number;
  keyRoot: string;
  keyMode: 'major' | 'minor';
  current: BarChord | null;
  onPick: (chord: BarChord) => void;
  onClear: () => void;
}) {
  const [tab, setTab] = useState<Tab>('roman');
  const [pendingRoot, setPendingRoot] = useState<string>(current?.root ?? keyRoot);

  const romanOpts = diatonicRomanOptions(keyRoot, keyMode);

  return (
    <div className="stack">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <strong style={{ flex: 1 }}>
          Bar {barNumber} chord
        </strong>
        {current ? (
          <button type="button" onClick={onClear}>
            Clear
          </button>
        ) : null}
      </div>

      <div style={{ display: 'flex', gap: 6 }}>
        <TabBtn active={tab === 'roman'} onClick={() => setTab('roman')}>
          Roman numerals
        </TabBtn>
        <TabBtn active={tab === 'raw'} onClick={() => setTab('raw')}>
          Raw names
        </TabBtn>
      </div>

      {tab === 'roman' ? (
        <RomanGrid options={romanOpts} current={current} onPick={onPick} />
      ) : (
        <RawGrid
          pendingRoot={pendingRoot}
          onRoot={setPendingRoot}
          current={current}
          onPick={onPick}
        />
      )}

      <div className="muted" style={{ fontSize: 12 }}>
        Key: {keyRoot} {keyMode}
      </div>
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={
        active
          ? { background: 'var(--accent)', color: '#1a1024', borderColor: 'transparent', flex: 1 }
          : { flex: 1 }
      }
    >
      {children}
    </button>
  );
}

function RomanGrid({
  options,
  current,
  onPick,
}: {
  options: RomanOption[];
  current: BarChord | null;
  onPick: (chord: BarChord) => void;
}) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))',
        gap: 8,
      }}
    >
      {options.map((opt) => {
        const isCurrent = !!current && current.root === opt.root && current.quality === opt.quality;
        return (
          <button
            type="button"
            key={opt.label}
            onClick={() => onPick({ root: opt.root, quality: opt.quality })}
            style={{
              padding: '12px 10px',
              ...(isCurrent
                ? { background: 'var(--accent)', color: '#1a1024', borderColor: 'transparent' }
                : {}),
            }}
          >
            <div style={{ fontWeight: 700, fontSize: 16 }}>{opt.label}</div>
            <div style={{ fontSize: 12, opacity: 0.7 }}>{opt.display}</div>
          </button>
        );
      })}
    </div>
  );
}

function RawGrid({
  pendingRoot,
  onRoot,
  current,
  onPick,
}: {
  pendingRoot: string;
  onRoot: (r: string) => void;
  current: BarChord | null;
  onPick: (chord: BarChord) => void;
}) {
  return (
    <div className="stack">
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(6, 1fr)',
          gap: 6,
        }}
      >
        {RAW_ROOTS.map((r) => (
          <button
            type="button"
            key={r}
            onClick={() => onRoot(r)}
            style={
              pendingRoot === r
                ? { background: 'var(--accent)', color: '#1a1024', borderColor: 'transparent' }
                : undefined
            }
          >
            {r}
          </button>
        ))}
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))',
          gap: 6,
        }}
      >
        {RAW_QUALITIES.map((q) => {
          const c: BarChord = { root: pendingRoot, quality: q.quality };
          const isCurrent =
            !!current && current.root === c.root && current.quality === c.quality;
          return (
            <button
              type="button"
              key={q.label}
              onClick={() => onPick(c)}
              style={
                isCurrent
                  ? {
                      background: 'var(--accent)',
                      color: '#1a1024',
                      borderColor: 'transparent',
                      padding: '10px 8px',
                    }
                  : { padding: '10px 8px' }
              }
            >
              <div style={{ fontWeight: 600 }}>{q.label}</div>
              <div style={{ fontSize: 11, opacity: 0.7 }}>{formatChord(c)}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
