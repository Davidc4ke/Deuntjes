'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { DrumPadConfig, type PadDraft } from '@/components/editors/Drum/DrumPadConfig';
import { ForkPrompt } from '@/components/shared/ForkPrompt';

export function EditDrumKitForm({
  songId,
  versionId,
  versionLabel,
  initialPads,
  hasDrumTakes,
  drumTakesCount,
}: {
  songId: string;
  versionId: string;
  versionLabel: string;
  initialPads: PadDraft[];
  hasDrumTakes: boolean;
  drumTakesCount: number;
}) {
  const router = useRouter();
  const [pads, setPads] = useState<PadDraft[]>(initialPads);
  const [error, setError] = useState<string | null>(null);
  const [forkOpen, setForkOpen] = useState(false);
  const [pending, start] = useTransition();

  async function save() {
    setError(null);
    if (pads.length === 0) {
      setError('Add at least one pad.');
      return;
    }
    start(async () => {
      const res = await fetch(`/api/versions/${versionId}/drum-kit`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ pads }),
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
      try {
        const res = await fetch(`/api/songs/${songId}/versions/${versionId}/fork`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ label, overrides: {} }),
        });
        const text = await res.text();
        let parsed: { versionId?: string; error?: string } = {};
        try {
          parsed = text ? JSON.parse(text) : {};
        } catch {
          console.error('fork: non-JSON response', res.status, text.slice(0, 200));
        }
        if (!res.ok || !parsed.versionId) {
          console.error('fork failed', res.status, parsed);
          setError(parsed.error ?? `Fork failed (${res.status})`);
          return;
        }
        const drumRes = await fetch(`/api/versions/${parsed.versionId}/drum-kit`, {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ pads }),
        });
        if (!drumRes.ok) {
          const j = await drumRes.json().catch(() => ({}));
          console.error('drum-kit save after fork failed', drumRes.status, j);
          setError(j.error ?? `Saving kit on the fork failed (${drumRes.status})`);
          return;
        }
        router.replace(`/songs/${songId}/v/${parsed.versionId}`);
        router.refresh();
      } catch (err) {
        console.error('fork threw', err);
        setError(err instanceof Error ? err.message : 'Fork failed');
      }
    });
  }

  return (
    <div className="stack">
      <div className="card">
        <div className="muted" style={{ fontSize: 13 }}>
          {versionLabel}
        </div>
        {hasDrumTakes ? (
          <p style={{ marginTop: 6 }}>
            This version already has <strong>{drumTakesCount}</strong> drum take
            {drumTakesCount === 1 ? '' : 's'}. Saving kit changes will fork to a new version.
          </p>
        ) : (
          <p className="muted" style={{ marginTop: 6, fontSize: 13 }}>
            Reorder pads, rename labels, or change MIDI notes. GM defaults are pre-filled.
          </p>
        )}
      </div>

      <div className="card">
        <DrumPadConfig pads={pads} onChange={setPads} />
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
        trigger="drum kit"
        onConfirm={doFork}
        pending={pending}
      />
    </div>
  );
}
