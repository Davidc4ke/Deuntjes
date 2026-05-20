'use client';
import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import * as Tone from 'tone';
import { Midi } from '@tonejs/midi';
import type { SlotKind } from '@/db/schema';
import { ticksPerBar, OUTPUT_PPQ } from '@/lib/midiBars';

type Take = {
  id: string;
  name: string;
  notes: string | null;
  source: 'native' | 'uploaded';
  createdAt: string;
  sectionName: string | null;
  authorName: string;
  authorEmoji: string;
};

type Version = {
  tempoBpm: number;
  timeSigNum: number;
  timeSigDen: number;
  barCount: number;
};

export function TakeDetailClient({
  songId,
  versionId,
  slotId,
  take,
  version,
  slotKind,
}: {
  songId: string;
  versionId: string;
  slotId: string;
  take: Take;
  version: Version;
  slotKind: SlotKind;
}) {
  const router = useRouter();
  const [name, setName] = useState(take.name);
  const [notes, setNotes] = useState(take.notes ?? '');
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();
  const [toast, setToast] = useState<string | null>(null);

  const [playing, setPlaying] = useState(false);
  const [midi, setMidi] = useState<Midi | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);

  useEffect(
    () => () => {
      Tone.Transport.stop();
      Tone.Transport.cancel(0);
    },
    [],
  );

  function showToast(m: string) {
    setToast(m);
    setTimeout(() => setToast(null), 1800);
  }

  async function loadMidiIfNeeded(): Promise<Midi | null> {
    if (midi) return midi;
    try {
      const res = await fetch(`/api/takes/${take.id}/midi`);
      if (!res.ok) {
        setLoadErr(`Could not load MIDI (${res.status})`);
        return null;
      }
      const buf = await res.arrayBuffer();
      const m = new Midi(buf);
      setMidi(m);
      return m;
    } catch (e) {
      setLoadErr((e as Error)?.message ?? 'Failed to load');
      return null;
    }
  }

  async function togglePlay() {
    if (playing) {
      Tone.Transport.stop();
      Tone.Transport.cancel(0);
      setPlaying(false);
      return;
    }
    const m = await loadMidiIfNeeded();
    if (!m) return;
    if (Tone.context.state !== 'running') await Tone.start();
    Tone.Transport.bpm.value = version.tempoBpm;
    Tone.Transport.PPQ = OUTPUT_PPQ;
    Tone.Transport.cancel(0);
    Tone.Transport.position = 0;

    const synth = makeSynth(slotKind);
    const sourcePpq = m.header.ppq;
    const scale = OUTPUT_PPQ / sourcePpq;
    const part = new Tone.Part((time, value) => {
      const v = value as { midi: number; durSec: number; velocity: number };
      synth.trigger(v.midi, v.durSec, time, v.velocity);
    }, m.tracks.flatMap((t) =>
      t.notes.map((n) => [
        `${Math.round(n.ticks * scale)}i`,
        {
          midi: n.midi,
          durSec: Math.max(0.05, n.duration),
          velocity: n.velocity,
        },
      ] as [string, { midi: number; durSec: number; velocity: number }]),
    ));
    part.start(0);

    const endTicks = ticksPerBar(version.timeSigNum, version.timeSigDen, OUTPUT_PPQ) * version.barCount;
    Tone.Transport.scheduleOnce(() => {
      Tone.Transport.stop();
      Tone.Transport.cancel(0);
      synth.dispose();
      setPlaying(false);
    }, `${endTicks}i`);

    Tone.Transport.start();
    setPlaying(true);
  }

  function save() {
    const payload: { name?: string; notes?: string | null } = {};
    if (name.trim() && name.trim() !== take.name) payload.name = name.trim();
    const notesTrim = notes.trim();
    if (notesTrim !== (take.notes ?? '')) payload.notes = notesTrim || null;
    if (Object.keys(payload).length === 0) {
      setEditing(false);
      return;
    }
    start(async () => {
      const res = await fetch(`/api/takes/${take.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        showToast(j.error ?? 'Save failed');
        return;
      }
      setEditing(false);
      router.refresh();
    });
  }

  function doDelete() {
    if (!confirm('Delete this take?')) return;
    start(async () => {
      const res = await fetch(`/api/takes/${take.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        showToast(j.error ?? 'Delete failed');
        return;
      }
      router.replace(`/songs/${songId}/v/${versionId}`);
      router.refresh();
    });
  }

  function fork() {
    start(async () => {
      const res = await fetch(`/api/takes/${take.id}/fork`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}',
      });
      if (!res.ok) {
        showToast('Fork failed');
        return;
      }
      const { takeId } = await res.json();
      router.replace(`/songs/${songId}/v/${versionId}/slots/${slotId}/takes/${takeId}`);
      router.refresh();
    });
  }

  return (
    <div className="stack">
      <div className="card stack">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ fontSize: 28 }} aria-hidden>
            {take.authorEmoji}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            {editing ? (
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
                aria-label="Take name"
              />
            ) : (
              <div style={{ fontWeight: 700, fontSize: 18 }}>{take.name}</div>
            )}
            <div className="muted" style={{ fontSize: 12 }}>
              {take.authorName} ·{' '}
              {take.sectionName ? `Section: ${take.sectionName}` : 'whole song'} ·{' '}
              {new Date(take.createdAt).toLocaleString()}
            </div>
          </div>
          <button
            type="button"
            onClick={togglePlay}
            style={{
              background: 'var(--accent)',
              color: '#1a1024',
              borderColor: 'transparent',
              width: 56,
              height: 56,
              borderRadius: 28,
              fontSize: 22,
            }}
            aria-label={playing ? 'Stop' : 'Play this take'}
          >
            {playing ? '■' : '▶'}
          </button>
        </div>
        {editing ? (
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="notes"
          />
        ) : take.notes ? (
          <p style={{ margin: 0 }}>{take.notes}</p>
        ) : null}
        {loadErr ? (
          <div className="muted" style={{ color: 'var(--danger)' }}>
            {loadErr}
          </div>
        ) : null}
      </div>

      <div className="card">
        <p className="muted" style={{ margin: 0 }}>
          🔥 reactions &amp; 💬 comments slot here — both land in ticket #4.
        </p>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        {editing ? (
          <>
            <button type="button" onClick={() => setEditing(false)} disabled={pending}>
              Cancel
            </button>
            <button
              type="button"
              onClick={save}
              disabled={pending}
              style={{ background: 'var(--accent)', color: '#1a1024', borderColor: 'transparent' }}
            >
              Save
            </button>
          </>
        ) : (
          <>
            <button type="button" onClick={() => setEditing(true)}>
              Rename / edit notes
            </button>
            <button type="button" onClick={fork} disabled={pending}>
              Fork
            </button>
            <button
              type="button"
              onClick={doDelete}
              disabled={pending}
              style={{ color: 'var(--danger)' }}
            >
              Delete
            </button>
          </>
        )}
      </div>

      <a
        href={`/api/takes/${take.id}/midi`}
        download
        className="card"
        style={{ display: 'block', padding: 10, textAlign: 'center' }}
      >
        Download .mid
      </a>

      {toast ? <div className="toast">{toast}</div> : null}
    </div>
  );
}

function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

type SimpleSynth = {
  trigger: (midi: number, durSec: number, time: number, velocity: number) => void;
  dispose: () => void;
};

function makeSynth(slot: SlotKind): SimpleSynth {
  if (slot === 'chords') {
    const s = new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'sawtooth' } }).toDestination();
    s.volume.value = -10;
    return {
      trigger: (m, d, t, v) => s.triggerAttackRelease(midiToFreq(m), Math.max(0.05, d), t, v),
      dispose: () => s.dispose(),
    };
  }
  if (slot === 'bass') {
    const s = new Tone.MonoSynth({ oscillator: { type: 'square' } }).toDestination();
    s.volume.value = -6;
    return {
      trigger: (m, d, t, v) => s.triggerAttackRelease(midiToFreq(m), Math.max(0.05, d), t, v),
      dispose: () => s.dispose(),
    };
  }
  if (slot === 'drums') {
    const kick = new Tone.MembraneSynth().toDestination();
    const snare = new Tone.NoiseSynth().toDestination();
    snare.volume.value = -10;
    const hat = new Tone.MetalSynth({
      envelope: { attack: 0.001, decay: 0.05 },
    }).toDestination();
    hat.volume.value = -22;
    return {
      trigger: (m, _d, t, v) => {
        if (m <= 36) kick.triggerAttackRelease('C2', '8n', t, v);
        else if (m <= 40) snare.triggerAttackRelease('8n', t, v);
        else hat.triggerAttackRelease('32n', t, v);
      },
      dispose: () => {
        kick.dispose();
        snare.dispose();
        hat.dispose();
      },
    };
  }
  // melody / fallback
  const s = new Tone.Synth({ oscillator: { type: 'triangle' } }).toDestination();
  return {
    trigger: (m, d, t, v) => s.triggerAttackRelease(midiToFreq(m), Math.max(0.05, d), t, v),
    dispose: () => s.dispose(),
  };
}
