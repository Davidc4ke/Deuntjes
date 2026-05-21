'use client';
import { useMemo, useRef } from 'react';
import { stepsPerBar } from '@/lib/render/trackerTake';
import type { Granularity, TrackerNote } from './types';
import { pitchName } from './PitchSelector';

const ROW_HEIGHT = 32;
const BAR_HEADER_HEIGHT = 22;

export function TrackerGrid({
  notes,
  selectedStep,
  granularity,
  timeSigNum,
  timeSigDen,
  totalBars,
  startBar,
  onTapStep,
  onLongPressNote,
}: {
  notes: TrackerNote[];
  selectedStep: number | null;
  granularity: Granularity;
  timeSigNum: number;
  timeSigDen: number;
  totalBars: number;
  startBar: number;
  onTapStep: (step: number) => void;
  onLongPressNote: (step: number) => void;
}) {
  const spb = stepsPerBar(granularity, timeSigNum, timeSigDen);
  const stepsPerBeat = spb / timeSigNum;

  // Map by leading step for O(1) cell lookup, plus a "covered" set for
  // visualizing sustain over multi-step notes.
  const noteByStep = useMemo(() => {
    const m = new Map<number, TrackerNote>();
    for (const n of notes) m.set(n.step, n);
    return m;
  }, [notes]);

  const sustained = useMemo(() => {
    const s = new Set<number>();
    for (const n of notes) {
      for (let i = 1; i < n.length_steps; i++) s.add(n.step + i);
    }
    return s;
  }, [notes]);

  return (
    <div className="stack" style={{ marginTop: 0 }}>
      {Array.from({ length: totalBars }).map((_, bar) => (
        <div
          key={bar}
          style={{
            border: '1px solid var(--border)',
            borderRadius: 10,
            overflow: 'hidden',
            background: 'var(--bg-elev)',
          }}
        >
          <div
            style={{
              height: BAR_HEADER_HEIGHT,
              padding: '0 10px',
              display: 'flex',
              alignItems: 'center',
              fontSize: 12,
              color: 'var(--fg-dim)',
              background: 'var(--bg-elev-2)',
              borderBottom: '1px solid var(--border)',
            }}
          >
            Bar {startBar + bar + 1}
          </div>
          {Array.from({ length: spb }).map((_, sib) => {
            const stepIdx = bar * spb + sib;
            const note = noteByStep.get(stepIdx) ?? null;
            const isCovered = !note && sustained.has(stepIdx);
            const isBeatStart = sib % stepsPerBeat === 0;
            const isSelected = selectedStep === stepIdx;
            return (
              <StepCell
                key={stepIdx}
                stepIdx={stepIdx}
                note={note}
                covered={isCovered}
                selected={isSelected}
                isBeatStart={isBeatStart}
                beatNumber={Math.floor(sib / stepsPerBeat) + 1}
                onTap={onTapStep}
                onLongPress={onLongPressNote}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}

function StepCell({
  stepIdx,
  note,
  covered,
  selected,
  isBeatStart,
  beatNumber,
  onTap,
  onLongPress,
}: {
  stepIdx: number;
  note: TrackerNote | null;
  covered: boolean;
  selected: boolean;
  isBeatStart: boolean;
  beatNumber: number;
  onTap: (step: number) => void;
  onLongPress: (step: number) => void;
}) {
  const timer = useRef<number | null>(null);
  const longPressed = useRef(false);

  function startPress() {
    longPressed.current = false;
    timer.current = window.setTimeout(() => {
      longPressed.current = true;
      if (note) onLongPress(stepIdx);
    }, 500);
  }
  function endPress() {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = null;
  }
  function handleClick() {
    if (longPressed.current) return;
    onTap(stepIdx);
  }

  let bg = 'transparent';
  if (selected) bg = 'rgba(167, 139, 250, 0.25)';
  else if (note) bg = 'rgba(167, 139, 250, 0.18)';
  else if (covered) bg = 'rgba(167, 139, 250, 0.08)';

  return (
    <button
      type="button"
      onPointerDown={startPress}
      onPointerUp={endPress}
      onPointerLeave={endPress}
      onPointerCancel={endPress}
      onClick={handleClick}
      onContextMenu={(e) => {
        e.preventDefault();
        if (note) onLongPress(stepIdx);
      }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        height: ROW_HEIGHT,
        width: '100%',
        padding: '0 10px',
        background: bg,
        border: 'none',
        borderTop: isBeatStart ? '1px solid var(--border)' : '1px solid transparent',
        borderRadius: 0,
        textAlign: 'left',
        color: 'inherit',
        cursor: 'pointer',
      }}
    >
      <span
        className="muted"
        style={{ fontSize: 10, minWidth: 22, opacity: isBeatStart ? 1 : 0.4 }}
      >
        {isBeatStart ? `b${beatNumber}` : '·'}
      </span>
      {note ? (
        <span style={{ fontWeight: 700, color: 'var(--fg)' }}>
          {pitchName(note.pitch)}
          <span className="muted" style={{ marginLeft: 6, fontSize: 11, fontWeight: 400 }}>
            len {note.length_steps} · v{note.velocity}
          </span>
        </span>
      ) : covered ? (
        <span className="muted" style={{ fontSize: 11 }}>
          ║
        </span>
      ) : null}
    </button>
  );
}
