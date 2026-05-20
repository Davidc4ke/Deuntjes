'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { BottomSheet } from '@/components/app/BottomSheet';
import type { Mix } from './types';

export function MixPicker({
  versionId,
  mixes,
  activeMixId,
  dirty,
  onSaveCurrent,
}: {
  versionId: string;
  mixes: Mix[];
  activeMixId: string | null;
  dirty: boolean;
  onSaveCurrent: (name: string) => Promise<void>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [name, setName] = useState('');
  const [pending, start] = useTransition();
  const [toast, setToast] = useState<string | null>(null);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2000);
  }

  const active = mixes.find((m) => m.id === activeMixId) ?? null;

  function pickMix(id: string | null) {
    start(async () => {
      const res = await fetch(`/api/versions/${versionId}/active-mix`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ mixId: id }),
      });
      if (!res.ok) {
        showToast('Could not change mix');
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  function deleteMix(id: string) {
    if (!confirm('Delete this mix?')) return;
    start(async () => {
      const res = await fetch(`/api/mixes/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        showToast('Delete failed');
        return;
      }
      router.refresh();
    });
  }

  function submitSave() {
    const trimmed = name.trim();
    if (!trimmed) return;
    start(async () => {
      try {
        await onSaveCurrent(trimmed);
        setSaveOpen(false);
        setName('');
        showToast('Mix saved');
      } catch (e) {
        showToast((e as Error)?.message ?? 'Save failed');
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          flex: 1,
          textAlign: 'left',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        Mix:{' '}
        <strong>
          {active ? active.name : 'unsaved'}
          {dirty ? ' •' : ''}
        </strong>{' '}
        ▾
      </button>
      <BottomSheet open={open} onClose={() => setOpen(false)}>
        <h3 style={{ marginTop: 0 }}>Mixes</h3>
        <div className="stack">
          {mixes.length === 0 ? (
            <p className="muted">No mixes yet — pick takes and save your first mix.</p>
          ) : (
            mixes.map((m) => (
              <div
                key={m.id}
                className="card"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: 10,
                  outline: m.id === activeMixId ? '2px solid var(--accent)' : undefined,
                }}
              >
                <button
                  type="button"
                  onClick={() => pickMix(m.id)}
                  disabled={pending}
                  style={{
                    flex: 1,
                    textAlign: 'left',
                    background: 'transparent',
                    border: 'none',
                    padding: 0,
                  }}
                >
                  <strong>{m.name}</strong>
                  <div className="muted" style={{ fontSize: 12 }}>
                    {m.selections.length} selection{m.selections.length === 1 ? '' : 's'}
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => deleteMix(m.id)}
                  disabled={pending}
                  style={{ color: 'var(--danger)' }}
                  aria-label="Delete mix"
                >
                  Delete
                </button>
              </div>
            ))
          )}
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              setSaveOpen(true);
            }}
            style={{
              background: 'var(--accent)',
              color: '#1a1024',
              borderColor: 'transparent',
            }}
            disabled={pending}
          >
            + Save current selections as a mix
          </button>
        </div>
      </BottomSheet>

      <BottomSheet open={saveOpen} onClose={() => setSaveOpen(false)}>
        <h3 style={{ marginTop: 0 }}>Save mix</h3>
        <div className="stack">
          <input
            placeholder="e.g. Marco's pick"
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submitSave();
            }}
          />
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button type="button" onClick={() => setSaveOpen(false)} disabled={pending}>
              Cancel
            </button>
            <button
              type="button"
              onClick={submitSave}
              disabled={pending || !name.trim()}
              style={{ background: 'var(--accent)', color: '#1a1024', borderColor: 'transparent' }}
            >
              Save
            </button>
          </div>
        </div>
      </BottomSheet>

      {toast ? <div className="toast">{toast}</div> : null}
    </>
  );
}
