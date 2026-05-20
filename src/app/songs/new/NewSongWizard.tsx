'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { KEY_MODES, KEY_ROOTS, defaultSections } from '@/lib/musicDefaults';
import { SectionTimeline, type SectionDraft } from '@/components/song/SectionTimeline';

type Step = 0 | 1 | 2 | 3 | 4;
const STEP_COUNT = 5;

export function NewSongWizard() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(0);
  const [title, setTitle] = useState('');
  const [tempoBpm, setTempoBpm] = useState(100);
  const [timeSigNum, setTimeSigNum] = useState(4);
  const [timeSigDen, setTimeSigDen] = useState(4);
  const [keyRoot, setKeyRoot] = useState<string>('C');
  const [keyMode, setKeyMode] = useState<string>('major');
  const [barCount, setBarCount] = useState(16);
  const [sections, setSections] = useState<SectionDraft[]>(defaultSections(16));
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function next() {
    setError(null);
    if (step === 0 && !title.trim()) {
      setError('Give the song a title.');
      return;
    }
    if (step === 4) {
      submit();
      return;
    }
    setStep(((step + 1) as Step) <= 4 ? ((step + 1) as Step) : 4);
  }

  function back() {
    setError(null);
    if (step > 0) setStep(((step - 1) as Step) >= 0 ? ((step - 1) as Step) : 0);
  }

  function updateBarCount(bc: number) {
    const clamped = Math.max(1, Math.min(999, Math.round(bc)));
    setBarCount(clamped);
    setSections(defaultSections(clamped));
  }

  async function submit() {
    setError(null);
    const totalBars = sections.reduce((m, s) => m + s.lengthBars, 0);
    if (totalBars !== barCount) {
      setError(`Sections total ${totalBars} bars but song is ${barCount}.`);
      return;
    }
    start(async () => {
      const res = await fetch('/api/songs', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          tempoBpm,
          keyRoot,
          keyMode,
          timeSigNum,
          timeSigDen,
          barCount,
          sections,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error ?? 'Failed to create song.');
        return;
      }
      const { songId, versionId } = await res.json();
      router.replace(`/songs/${songId}/v/${versionId}`);
      router.refresh();
    });
  }

  return (
    <div className="card">
      <div className="wizard-steps" aria-hidden>
        {Array.from({ length: STEP_COUNT }).map((_, i) => (
          <div key={i} className={i <= step ? 'active' : ''} />
        ))}
      </div>

      {step === 0 ? (
        <div className="stack">
          <h2 style={{ marginTop: 0 }}>Title</h2>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Late Night Jam"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') next();
            }}
          />
        </div>
      ) : null}

      {step === 1 ? (
        <div className="stack">
          <h2 style={{ marginTop: 0 }}>Tempo</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <input
              type="number"
              min={20}
              max={300}
              value={tempoBpm}
              onChange={(e) => setTempoBpm(Math.round(Number(e.target.value) || 0))}
              style={{ width: 100 }}
            />
            <span className="muted">bpm</span>
          </div>
          <input
            type="range"
            min={40}
            max={220}
            value={tempoBpm}
            onChange={(e) => setTempoBpm(Number(e.target.value))}
          />
        </div>
      ) : null}

      {step === 2 ? (
        <div className="stack">
          <h2 style={{ marginTop: 0 }}>Time signature & key</h2>
          <div style={{ display: 'flex', gap: 8 }}>
            <label style={{ flex: 1 }}>
              <div className="muted" style={{ marginBottom: 6 }}>
                Beats per bar
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
          <div style={{ display: 'flex', gap: 8 }}>
            <label style={{ flex: 1 }}>
              <div className="muted" style={{ marginBottom: 6 }}>
                Key root
              </div>
              <select value={keyRoot} onChange={(e) => setKeyRoot(e.target.value)}>
                {KEY_ROOTS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </label>
            <label style={{ flex: 1 }}>
              <div className="muted" style={{ marginBottom: 6 }}>
                Mode
              </div>
              <select value={keyMode} onChange={(e) => setKeyMode(e.target.value)}>
                {KEY_MODES.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
      ) : null}

      {step === 3 ? (
        <div className="stack">
          <h2 style={{ marginTop: 0 }}>Total bars</h2>
          <p className="muted">How long is the whole song?</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <input
              type="number"
              min={1}
              max={999}
              value={barCount}
              onChange={(e) => updateBarCount(Number(e.target.value) || 1)}
              style={{ width: 120 }}
            />
            <span className="muted">bars</span>
          </div>
        </div>
      ) : null}

      {step === 4 ? (
        <div className="stack">
          <h2 style={{ marginTop: 0 }}>Sections</h2>
          <p className="muted">
            Tap a section to edit. Add or remove to shape the song. Sections fill the {barCount} bars.
          </p>
          <SectionTimeline
            sections={sections}
            editable
            barCount={barCount}
            onChange={setSections}
          />
        </div>
      ) : null}

      {error ? (
        <div style={{ color: 'var(--danger)', marginTop: 12 }}>{error}</div>
      ) : null}

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16, gap: 8 }}>
        <button type="button" onClick={back} disabled={step === 0 || pending}>
          Back
        </button>
        <button
          type="button"
          onClick={next}
          disabled={pending}
          style={{ background: 'var(--accent)', color: '#1a1024', borderColor: 'transparent' }}
        >
          {step === 4 ? (pending ? 'Creating…' : 'Create song') : 'Next'}
        </button>
      </div>
    </div>
  );
}
