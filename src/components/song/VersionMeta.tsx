'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { BottomSheet } from '@/components/app/BottomSheet';
import { ForkPrompt } from '@/components/shared/ForkPrompt';
import { KEY_MODES, KEY_ROOTS } from '@/lib/musicDefaults';

type Version = {
  id: string;
  versionNumber: number;
  label: string | null;
  tempoBpm: number;
  keyRoot: string;
  keyMode: string;
  timeSigNum: number;
  timeSigDen: number;
  barCount: number;
};

export function VersionMeta({
  songId,
  version,
  canDelete,
}: {
  songId: string;
  version: Version;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [tempo, setTempo] = useState(version.tempoBpm);
  const [editingTempo, setEditingTempo] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [forkOpen, setForkOpen] = useState(false);
  const [forkTrigger, setForkTrigger] = useState('this version');
  const [forkOverrides, setForkOverrides] = useState<Record<string, unknown>>({});
  const [labelDraft, setLabelDraft] = useState(version.label ?? '');
  const [keyRoot, setKeyRoot] = useState(version.keyRoot);
  const [keyMode, setKeyMode] = useState(version.keyMode);
  const [pending, start] = useTransition();

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  }

  function saveTempo() {
    if (tempo === version.tempoBpm) {
      setEditingTempo(false);
      return;
    }
    start(async () => {
      const res = await fetch(`/api/songs/${songId}/versions/${version.id}/tempo`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ tempoBpm: tempo }),
      });
      if (!res.ok) {
        showToast('Tempo update failed');
        setTempo(version.tempoBpm);
      } else {
        showToast('Tempo updated — takes will re-stretch on playback');
        router.refresh();
      }
      setEditingTempo(false);
    });
  }

  function openKeyFork() {
    setForkOverrides({ keyRoot, keyMode });
    setForkTrigger(`key (${keyRoot} ${keyMode})`);
    setForkOpen(true);
    setMenuOpen(false);
  }

  function submitFork(label: string) {
    start(async () => {
      try {
        const res = await fetch(`/api/songs/${songId}/versions/${version.id}/fork`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ label, overrides: forkOverrides }),
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
          showToast(parsed.error ?? `Fork failed (${res.status})`);
          return;
        }
        setForkOpen(false);
        router.replace(`/songs/${songId}/v/${parsed.versionId}`);
        router.refresh();
      } catch (err) {
        console.error('fork threw', err);
        showToast(err instanceof Error ? err.message : 'Fork failed');
      }
    });
  }

  function saveLabel() {
    const next = labelDraft.trim();
    start(async () => {
      const res = await fetch(`/api/songs/${songId}/versions/${version.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ label: next || null }),
      });
      if (!res.ok) {
        showToast('Rename failed');
        return;
      }
      setRenameOpen(false);
      router.refresh();
    });
  }

  function deleteVersion() {
    if (!confirm(`Delete v${version.versionNumber}? This cannot be undone.`)) return;
    start(async () => {
      const res = await fetch(`/api/songs/${songId}/versions/${version.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        showToast(j.error ?? 'Delete failed');
        return;
      }
      router.replace(`/songs/${songId}`);
      router.refresh();
    });
  }

  return (
    <>
      <div
        className="card"
        style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 10 }}
      >
        <div style={{ flex: 1, fontSize: 13 }}>
          <div>
            <strong>{version.keyRoot}</strong> {version.keyMode} ·{' '}
            <strong>
              {version.timeSigNum}/{version.timeSigDen}
            </strong>{' '}
            · <strong>{version.barCount}</strong> bars
          </div>
          <div className="muted" style={{ marginTop: 2 }}>
            {editingTempo ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <input
                  type="number"
                  min={20}
                  max={300}
                  value={tempo}
                  onChange={(e) => setTempo(Math.round(Number(e.target.value) || 0))}
                  style={{ width: 70, padding: '4px 8px' }}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveTempo();
                    if (e.key === 'Escape') {
                      setTempo(version.tempoBpm);
                      setEditingTempo(false);
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={saveTempo}
                  disabled={pending}
                  style={{ padding: '4px 10px' }}
                >
                  Save
                </button>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setEditingTempo(true)}
                style={{ padding: '2px 8px', fontSize: 13 }}
                aria-label="Edit tempo"
              >
                {version.tempoBpm} bpm
              </button>
            )}
          </div>
        </div>
        <button type="button" onClick={() => setMenuOpen(true)} aria-label="Version actions">
          ⋯
        </button>
      </div>

      <BottomSheet open={menuOpen} onClose={() => setMenuOpen(false)}>
        <h3 style={{ marginTop: 0 }}>
          v{version.versionNumber}
          {version.label ? ` · ${version.label}` : ''}
        </h3>
        <div className="stack">
          <button
            type="button"
            onClick={() => {
              setMenuOpen(false);
              router.push(`/songs/${songId}/v/${version.id}/edit-structure`);
            }}
          >
            Edit sections / bar count
          </button>
          <button
            type="button"
            onClick={() => {
              setMenuOpen(false);
              router.push(`/songs/${songId}/v/${version.id}/edit-drum-kit`);
            }}
          >
            Edit drum kit
          </button>
          <button
            type="button"
            onClick={() => {
              setLabelDraft(version.label ?? '');
              setMenuOpen(false);
              setRenameOpen(true);
            }}
          >
            Rename version
          </button>
          <div className="card" style={{ background: 'var(--bg-elev-2)' }}>
            <div className="muted" style={{ marginBottom: 8, fontSize: 13 }}>
              Fork by changing key
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <select
                value={keyRoot}
                onChange={(e) => setKeyRoot(e.target.value)}
                style={{ flex: 1 }}
              >
                {KEY_ROOTS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
              <select
                value={keyMode}
                onChange={(e) => setKeyMode(e.target.value)}
                style={{ flex: 1 }}
              >
                {KEY_MODES.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={openKeyFork}
                disabled={keyRoot === version.keyRoot && keyMode === version.keyMode}
              >
                Fork
              </button>
            </div>
          </div>
          {canDelete ? (
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                deleteVersion();
              }}
              style={{ color: 'var(--danger)' }}
              disabled={pending}
            >
              Delete this version
            </button>
          ) : null}
        </div>
      </BottomSheet>

      <BottomSheet open={renameOpen} onClose={() => setRenameOpen(false)}>
        <h3 style={{ marginTop: 0 }}>Rename v{version.versionNumber}</h3>
        <div className="stack">
          <input
            value={labelDraft}
            onChange={(e) => setLabelDraft(e.target.value)}
            placeholder="e.g. slower take"
            autoFocus
          />
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button type="button" onClick={() => setRenameOpen(false)} disabled={pending}>
              Cancel
            </button>
            <button
              type="button"
              onClick={saveLabel}
              disabled={pending}
              style={{
                background: 'var(--accent)',
                color: '#1a1024',
                borderColor: 'transparent',
              }}
            >
              Save
            </button>
          </div>
        </div>
      </BottomSheet>

      <ForkPrompt
        open={forkOpen}
        onClose={() => setForkOpen(false)}
        trigger={forkTrigger}
        onConfirm={submitFork}
        pending={pending}
      />

      {toast ? <div className="toast">{toast}</div> : null}
    </>
  );
}
