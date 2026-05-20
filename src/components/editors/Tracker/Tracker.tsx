'use client';
import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { BottomSheet } from '@/components/app/BottomSheet';
import { ContextBar } from '@/components/app/ContextBar';
import { EditorPreview } from '@/components/editors/shared/EditorPreview';
import {
  renderTrackerPayload,
  stepsPerBar,
  type TrackerPayload,
} from '@/lib/render/trackerTake';
import type { SlotKind } from '@/db/schema';
import { TrackerGrid } from './TrackerGrid';
import { TrackerInputRow } from './TrackerInputRow';
import { useTrackerStore } from './useTrackerStore';
import { GRANULARITY_LABELS, type Granularity, type TrackerNote } from './types';

export type TrackerInitial = {
  notes: TrackerNote[];
  granularity: Granularity;
  name: string;
  notesText: string;
};

const DEFAULT_PITCH_BY_SLOT: Record<'melody' | 'bass', number> = {
  melody: 60, // C4
  bass: 36, // C2
};

export function Tracker({
  songId,
  versionId,
  slotId,
  slotKind,
  sectionId,
  sectionName,
  scopedBars,
  startBar,
  tempoBpm,
  timeSigNum,
  timeSigDen,
  initial,
  parentTakeId,
}: {
  songId: string;
  versionId: string;
  slotId: string;
  slotKind: 'melody' | 'bass';
  sectionId: string | null;
  sectionName: string | null;
  scopedBars: number;
  startBar: number;
  tempoBpm: number;
  timeSigNum: number;
  timeSigDen: number;
  initial?: TrackerInitial;
  parentTakeId?: string | null;
}) {
  const router = useRouter();
  const init = useTrackerStore((s) => s.init);
  const notes = useTrackerStore((s) => s.notes);
  const granularity = useTrackerStore((s) => s.granularity);
  const selectedStep = useTrackerStore((s) => s.selectedStep);
  const historyLen = useTrackerStore((s) => s.history.length);
  const placeAt = useTrackerStore((s) => s.placeAt);
  const selectAt = useTrackerStore((s) => s.selectAt);
  const deleteSelected = useTrackerStore((s) => s.deleteSelected);
  const setSelectedLength = useTrackerStore((s) => s.setSelectedLength);
  const setSelectedVelocity = useTrackerStore((s) => s.setSelectedVelocity);
  const setGranularity = useTrackerStore((s) => s.setGranularity);
  const undo = useTrackerStore((s) => s.undo);

  const [name, setName] = useState(initial?.name ?? '');
  const [takeNotes, setTakeNotes] = useState(initial?.notesText ?? '');
  const [pendingGranularity, setPendingGranularity] = useState<Granularity | null>(null);
  const [actionsForStep, setActionsForStep] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    init({
      notes: initial?.notes ?? [],
      granularity: initial?.granularity ?? 16,
      timeSigNum,
      timeSigDen,
      totalBars: scopedBars,
      defaultPitch: DEFAULT_PITCH_BY_SLOT[slotKind],
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopedBars, sectionId, timeSigNum, timeSigDen]);

  const selectedNote = useMemo(() => {
    if (selectedStep == null) return null;
    return notes.find((n) => n.step === selectedStep) ?? null;
  }, [notes, selectedStep]);

  const payload: TrackerPayload = useMemo(
    () => ({ version: 1, granularity, notes }),
    [granularity, notes],
  );
  const previewNotes = useMemo(
    () => renderTrackerPayload(payload, timeSigNum, timeSigDen),
    [payload, timeSigNum, timeSigDen],
  );

  function handleTapStep(step: number) {
    const existing = notes.find((n) => n.step === step);
    if (existing) {
      selectAt(step);
    } else {
      placeAt(step);
    }
  }

  function handleLongPress(step: number) {
    selectAt(step);
    setActionsForStep(step);
  }

  function save() {
    if (notes.length === 0) {
      setErr('Add at least one note');
      return;
    }
    const body = {
      name: name.trim() || `${slotKind === 'melody' ? 'Melody' : 'Bass'} take`,
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

  const totalSteps = stepsPerBar(granularity, timeSigNum, timeSigDen) * scopedBars;

  return (
    <>
      <div className="stack" style={{ paddingBottom: 280 }}>
        <div className="card stack">
          <div className="muted" style={{ fontSize: 12, marginTop: 0 }}>
            Scope: {sectionName ? `Section "${sectionName}"` : 'Whole song'} · {scopedBars}{' '}
            {scopedBars === 1 ? 'bar' : 'bars'} · {totalSteps} steps
          </div>
          <label className="stack">
            <div className="muted" style={{ marginBottom: 6 }}>
              Take name
            </div>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Sleepy hook"
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span className="muted" style={{ fontSize: 12, flex: 1 }}>
              Granularity
            </span>
            {(Object.keys(GRANULARITY_LABELS) as unknown as Granularity[]).map((g) => {
              const gnum = Number(g) as Granularity;
              const active = gnum === granularity;
              return (
                <button
                  type="button"
                  key={gnum}
                  onClick={() => {
                    if (gnum === granularity) return;
                    if (notes.length > 0) {
                      setPendingGranularity(gnum);
                    } else {
                      setGranularity(gnum);
                    }
                  }}
                  style={{
                    padding: '6px 10px',
                    ...(active
                      ? {
                          background: 'var(--accent)',
                          color: '#1a1024',
                          borderColor: 'transparent',
                        }
                      : {}),
                  }}
                >
                  {GRANULARITY_LABELS[gnum]}
                </button>
              );
            })}
          </div>
        </div>

        <TrackerGrid
          notes={notes}
          selectedStep={selectedStep}
          granularity={granularity}
          timeSigNum={timeSigNum}
          timeSigDen={timeSigDen}
          totalBars={scopedBars}
          startBar={startBar}
          onTapStep={handleTapStep}
          onLongPressNote={handleLongPress}
        />

        {err ? (
          <div className="card" style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }}>
            {err}
          </div>
        ) : null}
      </div>

      <BottomSheet
        open={actionsForStep !== null}
        onClose={() => setActionsForStep(null)}
      >
        {actionsForStep !== null && selectedNote ? (
          <NoteActions
            note={selectedNote}
            maxLength={totalSteps - selectedNote.step}
            onDelete={() => {
              deleteSelected();
              setActionsForStep(null);
            }}
            onLength={(len) => setSelectedLength(len)}
            onVelocity={(v) => setSelectedVelocity(v)}
            onClose={() => setActionsForStep(null)}
          />
        ) : null}
      </BottomSheet>

      <BottomSheet
        open={pendingGranularity !== null}
        onClose={() => setPendingGranularity(null)}
      >
        {pendingGranularity !== null ? (
          <div className="stack">
            <strong>Change granularity to {GRANULARITY_LABELS[pendingGranularity]}?</strong>
            <p className="muted" style={{ marginTop: 0 }}>
              Existing notes will re-quantize to the nearest step. Two notes that land on the
              same step after re-quantizing will collapse to one.
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" onClick={() => setPendingGranularity(null)}>
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (pendingGranularity !== null) setGranularity(pendingGranularity);
                  setPendingGranularity(null);
                }}
                style={{
                  background: 'var(--accent)',
                  color: '#1a1024',
                  borderColor: 'transparent',
                }}
              >
                Re-quantize
              </button>
            </div>
          </div>
        ) : null}
      </BottomSheet>

      <ContextBar>
        <TrackerInputRow
          onUndo={undo}
          canUndo={historyLen > 0}
          onSave={save}
          saving={pending}
          saveLabel={parentTakeId ? 'Save fork' : 'Save take'}
        />
      </ContextBar>

      <EditorPreview
        slotKind={slotKind as SlotKind}
        notes={previewNotes}
        tempoBpm={tempoBpm}
        timeSigNum={timeSigNum}
        timeSigDen={timeSigDen}
        totalBars={scopedBars}
      />
    </>
  );
}

function NoteActions({
  note,
  maxLength,
  onDelete,
  onLength,
  onVelocity,
  onClose,
}: {
  note: TrackerNote;
  maxLength: number;
  onDelete: () => void;
  onLength: (len: number) => void;
  onVelocity: (v: number) => void;
  onClose: () => void;
}) {
  return (
    <div className="stack">
      <strong>Note at step {note.step + 1}</strong>
      <div className="muted" style={{ marginTop: 0 }}>
        Pitch fixed for this note — to change pitch, delete and re-place.
      </div>
      <label className="stack">
        <div className="muted" style={{ marginBottom: 4, fontSize: 12 }}>
          Length (steps)
        </div>
        <input
          type="number"
          min={1}
          max={maxLength}
          value={note.length_steps}
          onChange={(e) => onLength(Number(e.target.value))}
        />
      </label>
      <label className="stack">
        <div
          className="muted"
          style={{ marginBottom: 4, fontSize: 12, display: 'flex', justifyContent: 'space-between' }}
        >
          <span>Velocity</span>
          <span>{note.velocity}</span>
        </div>
        <input
          type="range"
          min={1}
          max={127}
          value={note.velocity}
          onChange={(e) => onVelocity(Number(e.target.value))}
        />
      </label>
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" onClick={onClose}>
          Close
        </button>
        <button
          type="button"
          onClick={onDelete}
          style={{ color: 'var(--danger)' }}
        >
          Delete note
        </button>
      </div>
    </div>
  );
}
