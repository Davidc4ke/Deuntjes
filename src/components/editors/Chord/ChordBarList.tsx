'use client';
import { useRef } from 'react';
import { formatChord } from './chordOptions';
import type { BarChord, BarsState } from './types';

export function ChordBarList({
  bars,
  onTapBar,
  onDeleteBar,
  startBar,
}: {
  bars: BarsState;
  onTapBar: (barIdx: number) => void;
  onDeleteBar: (barIdx: number) => void;
  startBar: number;
}) {
  return (
    <div className="stack" style={{ marginTop: 0 }}>
      {bars.map((chord, i) => (
        <BarCard
          key={i}
          barNumber={startBar + i + 1}
          chord={chord}
          onTap={() => onTapBar(i)}
          onLongPress={() => onDeleteBar(i)}
        />
      ))}
    </div>
  );
}

function BarCard({
  barNumber,
  chord,
  onTap,
  onLongPress,
}: {
  barNumber: number;
  chord: BarChord | null;
  onTap: () => void;
  onLongPress: () => void;
}) {
  const longPressTimer = useRef<number | null>(null);
  const longPressed = useRef(false);

  function startPress() {
    longPressed.current = false;
    longPressTimer.current = window.setTimeout(() => {
      longPressed.current = true;
      onLongPress();
    }, 550);
  }
  function endPress() {
    if (longPressTimer.current) window.clearTimeout(longPressTimer.current);
    longPressTimer.current = null;
  }
  function handleClick() {
    if (longPressed.current) return;
    onTap();
  }

  const display = chord ? formatChord(chord) : 'Tap to add chord';

  return (
    <button
      type="button"
      className="card"
      onClick={handleClick}
      onPointerDown={startPress}
      onPointerUp={endPress}
      onPointerLeave={endPress}
      onPointerCancel={endPress}
      onContextMenu={(e) => {
        e.preventDefault();
        if (chord) onLongPress();
      }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        cursor: 'pointer',
        textAlign: 'left',
        background: chord ? 'var(--bg-elev)' : 'transparent',
        borderStyle: chord ? 'solid' : 'dashed',
        width: '100%',
      }}
    >
      <div className="muted" style={{ fontSize: 12, minWidth: 48 }}>
        Bar {barNumber}
      </div>
      <div
        style={{
          flex: 1,
          fontSize: chord ? 22 : 14,
          fontWeight: chord ? 700 : 400,
          color: chord ? 'var(--fg)' : 'var(--fg-dim)',
        }}
      >
        {display}
      </div>
      {chord ? (
        <div className="muted" style={{ fontSize: 12 }}>
          long-press to clear
        </div>
      ) : null}
    </button>
  );
}
