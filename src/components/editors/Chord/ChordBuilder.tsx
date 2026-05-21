'use client';
import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { BottomSheet } from '@/components/app/BottomSheet';
import { ContextBar } from '@/components/app/ContextBar';
import { EditorPreview } from '@/components/editors/shared/EditorPreview';
import { renderChordPayload, type ChordPayload } from '@/lib/render/chordTake';
import type { SlotKind } from '@/db/schema';
import { ChordBarList } from './ChordBarList';
import { ChordPicker } from './ChordPicker';
import { useChordEditorStore } from './useChordEditorStore';
import type { BarChord, BarsState } from './types';

export type ChordBuilderInitial = {
  bars: BarsState;
  voicingOctave: number;
  name: string;
  notes: string;
};

export function ChordBuilder({
  songId,
  versionId,
  slotId,
  slotKind,
  sectionId,
  sectionName,
  scopedBars,
  startBar,
  tempoBpm,
  keyRoot,
  keyMode,
  timeSigNum,
  timeSigDen,
  initial,
  parentTakeId,
}: {
  songId: string;
  versionId: string;
  slotId: string;
  slotKind: SlotKind;
  sectionId: string | null;
  sectionName: string | null;
  scopedBars: number;
  startBar: number;
  tempoBpm: number;
  keyRoot: string;
  keyMode: 'major' | 'minor';
  timeSigNum: number;
  timeSigDen: number;
  initial?: ChordBuilderInitial;
  parentTakeId?: string | null;
}) {
  const router = useRouter();
  const bars = useChordEditorStore((s) => s.bars);
  const voicingOctave = useChordEditorStore((s) => s.voicingOctave);
  const historyLen = useChordEditorStore((s) => s.history.length);
  const init = useChordEditorStore((s) => s.init);
  const setChord = useChordEditorStore((s) => s.setChord);
  const clearChord = useChordEditorStore((s) => s.clearChord);
  const setVoicingOctave = useChordEditorStore((s) => s.setVoicingOctave);
  const undo = useChordEditorStore((s) => s.undo);

  const [pickingBar, setPickingBar] = useState<number | null>(null);
  const [name, setName] = useState(initial?.name ?? '');
  const [takeNotes, setTakeNotes] = useState(initial?.notes ?? '');
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  // Initialize store once. Re-runs only if scopedBars changes (e.g. switching
  // section). Edits live in the store, not local state.
  useEffect(() => {
    if (initial) {
      const filled: BarsState = new Array(scopedBars).fill(null);
      initial.bars.forEach((b, i) => {
        if (i < scopedBars) filled[i] = b;
      });
      init(filled, initial.voicingOctave);
    } else {
      init(new Array(scopedBars).fill(null), 4);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopedBars, sectionId]);

  const payload: ChordPayload = useMemo(() => {
    return {
      version: 1,
      voicing_octave: voicingOctave,
      chords: bars
        .map((b, i) =>
          b ? { start_bar: i, length_beats: timeSigNum, root: b.root, quality: b.quality } : null,
        )
        .filter((c): c is NonNullable<typeof c> => c !== null),
    };
  }, [bars, voicingOctave, timeSigNum]);

  const previewNotes = useMemo(() => {
    return renderChordPayload(payload, timeSigNum, timeSigDen);
  }, [payload, timeSigNum, timeSigDen]);

  function save() {
    if (payload.chords.length === 0) {
      setErr('Add at least one chord');
      return;
    }
    const body = {
      name: name.trim() || `Chords ${new Date().toLocaleString()}`,
      notes: takeNotes.trim() || null,
      section_id: sectionId,
      parent_take_id: parentTakeId ?? null,
      payload_json: payload,
    };
    start(async () => {
      setErr(null);
      const res = await fetch(`/api/slots/${slotId}/takes`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setErr(j.error ?? `Save failed (${res.status})`);
        return;
      }
      const { takeId } = await res.json();
      router.replace(`/songs/${songId}/v/${versionId}/slots/${slotId}/takes/${takeId}`);
      router.refresh();
    });
  }

  const currentChord = pickingBar !== null ? bars[pickingBar] : null;

  return (
    <>
      <div className="stack">
        <div className="card stack">
          <div className="muted" style={{ fontSize: 12, marginTop: 0 }}>
            Scope: {sectionName ? `Section "${sectionName}"` : 'Whole song'} · {scopedBars}{' '}
            {scopedBars === 1 ? 'bar' : 'bars'} · {keyRoot} {keyMode}
          </div>
          <label className="stack">
            <div className="muted" style={{ marginBottom: 6 }}>
              Take name
            </div>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Jazz progression"
            />
          </label>
          <label className="stack">
            <div className="muted" style={{ marginBottom: 6 }}>
              Notes (optional)
            </div>
            <textarea
              value={takeNotes}
              onChange={(e) => setTakeNotes(e.target.value)}
              rows={2}
              placeholder="Anything the others should know"
            />
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div className="muted" style={{ flex: 1 }}>
              Voicing octave
            </div>
            <button
              type="button"
              onClick={() => setVoicingOctave(voicingOctave - 1)}
              aria-label="Lower octave"
              disabled={voicingOctave <= 1}
            >
              −
            </button>
            <div style={{ minWidth: 32, textAlign: 'center', fontWeight: 700 }}>
              {voicingOctave}
            </div>
            <button
              type="button"
              onClick={() => setVoicingOctave(voicingOctave + 1)}
              aria-label="Raise octave"
              disabled={voicingOctave >= 7}
            >
              +
            </button>
          </div>
        </div>

        <ChordBarList
          bars={bars}
          onTapBar={(i) => setPickingBar(i)}
          onDeleteBar={(i) => clearChord(i)}
          startBar={startBar}
        />

        {err ? (
          <div className="card" style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }}>
            {err}
          </div>
        ) : null}
      </div>

      <BottomSheet open={pickingBar !== null} onClose={() => setPickingBar(null)}>
        {pickingBar !== null ? (
          <ChordPicker
            barNumber={startBar + pickingBar + 1}
            keyRoot={keyRoot}
            keyMode={keyMode}
            current={currentChord}
            onPick={(c: BarChord) => {
              setChord(pickingBar, c);
              setPickingBar(null);
            }}
            onClear={() => {
              clearChord(pickingBar);
              setPickingBar(null);
            }}
          />
        ) : null}
      </BottomSheet>

      <ContextBar>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            type="button"
            onClick={undo}
            disabled={historyLen === 0 || pending}
            aria-label="Undo"
            style={{ minWidth: 64 }}
          >
            ↶ Undo
          </button>
          <div style={{ flex: 1 }} />
          <button
            type="button"
            onClick={save}
            disabled={pending}
            style={{ background: 'var(--accent)', color: '#1a1024', borderColor: 'transparent' }}
          >
            {pending ? 'Saving…' : parentTakeId ? 'Save fork' : 'Save take'}
          </button>
        </div>
      </ContextBar>

      <EditorPreview
        slotKind={slotKind}
        notes={previewNotes}
        tempoBpm={tempoBpm}
        timeSigNum={timeSigNum}
        timeSigDen={timeSigDen}
        totalBars={scopedBars}
      />
    </>
  );
}
