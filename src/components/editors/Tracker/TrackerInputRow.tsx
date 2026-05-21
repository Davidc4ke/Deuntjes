'use client';
import { useTrackerStore } from './useTrackerStore';
import { pitchName, PitchSelector } from './PitchSelector';

export function TrackerInputRow({
  onUndo,
  canUndo,
  onSave,
  saving,
  saveLabel,
}: {
  onUndo: () => void;
  canUndo: boolean;
  onSave: () => void;
  saving: boolean;
  saveLabel: string;
}) {
  const currentPitch = useTrackerStore((s) => s.currentPitch);
  const currentVelocity = useTrackerStore((s) => s.currentVelocity);
  const currentLengthSteps = useTrackerStore((s) => s.currentLengthSteps);
  const selectedStep = useTrackerStore((s) => s.selectedStep);
  const setCurrentPitch = useTrackerStore((s) => s.setCurrentPitch);
  const setCurrentVelocity = useTrackerStore((s) => s.setCurrentVelocity);
  const setCurrentLengthSteps = useTrackerStore((s) => s.setCurrentLengthSteps);
  const bumpOctave = useTrackerStore((s) => s.bumpOctave);

  return (
    <div className="stack" style={{ gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div
          style={{
            background: 'var(--bg-elev-2)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: '6px 10px',
            fontWeight: 700,
            minWidth: 56,
            textAlign: 'center',
          }}
        >
          {pitchName(currentPitch)}
        </div>
        <button type="button" onClick={() => bumpOctave(-1)} aria-label="Octave down">
          ↓ Oct
        </button>
        <button type="button" onClick={() => bumpOctave(1)} aria-label="Octave up">
          ↑ Oct
        </button>
        <div style={{ flex: 1 }} />
        <label
          style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}
          className="muted"
        >
          Len
          <input
            type="number"
            min={1}
            max={32}
            value={currentLengthSteps}
            onChange={(e) => setCurrentLengthSteps(Number(e.target.value))}
            style={{ width: 56, padding: '4px 6px' }}
          />
        </label>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span className="muted" style={{ fontSize: 12, minWidth: 32 }}>
          Vel
        </span>
        <input
          type="range"
          min={1}
          max={127}
          value={currentVelocity}
          onChange={(e) => setCurrentVelocity(Number(e.target.value))}
          style={{ flex: 1, width: '100%' }}
        />
        <span style={{ fontSize: 12, minWidth: 32, textAlign: 'right' }}>
          {currentVelocity}
        </span>
      </div>

      <PitchSelector currentPitch={currentPitch} onPick={setCurrentPitch} />

      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <button
          type="button"
          onClick={onUndo}
          disabled={!canUndo}
          aria-label="Undo"
          style={{ minWidth: 64 }}
        >
          ↶ Undo
        </button>
        <div className="muted" style={{ fontSize: 12, flex: 1 }}>
          {selectedStep == null ? 'Tap a step to place a note' : `Selected step ${selectedStep + 1}`}
        </div>
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          style={{ background: 'var(--accent)', color: '#1a1024', borderColor: 'transparent' }}
        >
          {saving ? 'Saving…' : saveLabel}
        </button>
      </div>
    </div>
  );
}
