'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { SectionTimeline, type SectionDraft } from '@/components/song/SectionTimeline';
import { ForkPrompt } from '@/components/shared/ForkPrompt';

export function EditStructureForm({
  songId,
  versionId,
  versionLabel,
  initialBarCount,
  initialTimeSigNum,
  initialTimeSigDen,
  initialSections,
  hasTakes,
  takesCount,
}: {
  songId: string;
  versionId: string;
  versionLabel: string;
  initialBarCount: number;
  initialTimeSigNum: number;
  initialTimeSigDen: number;
  initialSections: SectionDraft[];
  hasTakes: boolean;
  takesCount: number;
}) {
  const router = useRouter();
  const [barCount, setBarCount] = useState(initialBarCount);
  const [timeSigNum, setTimeSigNum] = useState(initialTimeSigNum);
  const [timeSigDen, setTimeSigDen] = useState(initialTimeSigDen);
  const [sections, setSections] = useState<SectionDraft[]>(initialSections);
  const [error, setError] = useState<string | null>(null);
  const [forkOpen, setForkOpen] = useState(false);
  const [pending, start] = useTransition();

  const timeSigChanged =
    timeSigNum !== initialTimeSigNum || timeSigDen !== initialTimeSigDen;

  const totalBars = sections.reduce((m, s) => m + s.lengthBars, 0);

  function applyBarCount(next: number) {
    const clamped = Math.max(1, Math.min(999, Math.round(next)));
    setBarCount(clamped);
    if (sections.length === 0) return;
    const delta = clamped - sections.reduce((m, s) => m + s.lengthBars, 0);
    if (delta === 0) return;
    const last = sections[sections.length - 1];
    const newLast = Math.max(1, last.lengthBars + delta);
    setSections(
      sections.map((s, i) => (i === sections.length - 1 ? { ...s, lengthBars: newLast } : s)),
    );
  }

  async function save() {
    setError(null);
    if (totalBars !== barCount) {
      setError(`Sections total ${totalBars} bars but version is ${barCount}.`);
      return;
    }
    if (timeSigChanged) {
      // Time sig changes always require fork (re-aligns ticks).
      setForkOpen(true);
      return;
    }
    start(async () => {
      const res = await fetch(`/api/versions/${versionId}/sections`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sections, barCount }),
      });
      if (res.status === 409) {
        setForkOpen(true);
        return;
      }
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error ?? 'Save failed');
        return;
      }
      router.replace(`/songs/${songId}/v/${versionId}`);
      router.refresh();
    });
  }

  function doFork(label: string) {
    start(async () => {
      const res = await fetch(`/api/songs/${songId}/versions/${versionId}/fork`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          label,
          overrides: { sections, barCount, timeSigNum, timeSigDen },
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error ?? 'Fork failed');
        return;
      }
      const { versionId: newId } = await res.json();
      router.replace(`/songs/${songId}/v/${newId}`);
      router.refresh();
    });
  }

  return (
    <div className="stack">
      <div className="card">
        <div className="muted" style={{ fontSize: 13 }}>
          {versionLabel}
        </div>
        {hasTakes ? (
          <p style={{ marginTop: 6 }}>
            This version has <strong>{takesCount}</strong> take
            {takesCount === 1 ? '' : 's'}. Saving structure changes will fork to a new version
            — you&apos;ll be asked for a label.
          </p>
        ) : null}
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <label style={{ flex: 1 }}>
            <div className="muted" style={{ marginBottom: 6 }}>
              Total bars
            </div>
            <input
              type="number"
              min={1}
              max={999}
              value={barCount}
              onChange={(e) => applyBarCount(Number(e.target.value) || 1)}
            />
          </label>
          <label style={{ flex: 1 }}>
            <div className="muted" style={{ marginBottom: 6 }}>
              Beats / bar
            </div>
            <input
              type="number"
              min={1}
              max={32}
              value={timeSigNum}
              onChange={(e) => setTimeSigNum(Math.max(1, Number(e.target.value) || 1))}
            />
          </label>
          <label style={{ flex: 1 }}>
            <div className="muted" style={{ marginBottom: 6 }}>
              Beat unit
            </div>
            <select
              value={timeSigDen}
              onChange={(e) => setTimeSigDen(Number(e.target.value))}
            >
              {[2, 4, 8, 16].map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </label>
        </div>
        {timeSigChanged ? (
          <p className="muted" style={{ fontSize: 13, marginTop: 8 }}>
            Time signature changed — saving will fork to a new version.
          </p>
        ) : null}
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Sections</h3>
        <p className="muted" style={{ fontSize: 13 }}>
          Currently filling {totalBars} of {barCount} bars.
        </p>
        <SectionTimeline
          sections={sections}
          editable
          barCount={barCount}
          onChange={setSections}
        />
      </div>

      {error ? <div style={{ color: 'var(--danger)' }}>{error}</div> : null}

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button type="button" onClick={() => router.back()} disabled={pending}>
          Cancel
        </button>
        <button
          type="button"
          onClick={save}
          disabled={pending}
          style={{ background: 'var(--accent)', color: '#1a1024', borderColor: 'transparent' }}
        >
          {pending ? 'Saving…' : 'Save'}
        </button>
      </div>

      <ForkPrompt
        open={forkOpen}
        onClose={() => setForkOpen(false)}
        trigger={timeSigChanged ? 'time signature' : 'sections / bar count'}
        onConfirm={doFork}
        pending={pending}
      />
    </div>
  );
}
