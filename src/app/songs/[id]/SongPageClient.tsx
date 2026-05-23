'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { SequencerEditor } from '@/components/sequencer/SequencerEditor';
import type { SequencerState } from '@/lib/sequencerState';

// Debounce window for autosave. Long enough that rapid edits coalesce into
// one request; short enough that closing the tab loses at most ~1s of work.
const AUTOSAVE_MS = 800;

export function SongPageClient({
  songId,
  title,
  initialState,
  isOwner,
  creator,
}: {
  songId: string;
  title: string;
  initialState: SequencerState;
  isOwner: boolean;
  creator: { displayName: string; avatarEmoji: string };
}) {
  const router = useRouter();
  const [songTitle, setSongTitle] = useState(title);

  // Latest state to save lives in a ref so the debounce timer reads the
  // freshest snapshot without re-creating the timer on every keystroke.
  const pendingRef = useRef<SequencerState | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = useCallback(async () => {
    const data = pendingRef.current;
    if (!data) return;
    pendingRef.current = null;
    try {
      await fetch(`/api/songs/${songId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sequencerData: data }),
        keepalive: true,
      });
    } catch {
      // Network blip — keep the pending change so the next edit re-queues.
      pendingRef.current = data;
    }
  }, [songId]);

  const handleChange = useCallback(
    (next: SequencerState) => {
      if (!isOwner) return; // non-owners never trigger PATCH (server would 403 anyway)
      pendingRef.current = next;
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(flush, AUTOSAVE_MS);
    },
    [isOwner, flush],
  );

  // Flush on tab close / app hide — pagehide is more reliable than beforeunload
  // on mobile Safari, and visibilitychange catches background tab switches.
  useEffect(() => {
    if (!isOwner) return;
    const trigger = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      void flush();
    };
    window.addEventListener('pagehide', trigger);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') trigger();
    });
    return () => {
      window.removeEventListener('pagehide', trigger);
    };
  }, [isOwner, flush]);

  // Owner can rename the song inline. We debounce the same way as state.
  const renameTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleTitleBlur = () => {
    if (!isOwner) return;
    if (renameTimerRef.current) clearTimeout(renameTimerRef.current);
    void fetch(`/api/songs/${songId}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: songTitle }),
    });
  };

  const handleCopy = async () => {
    const res = await fetch(`/api/songs/${songId}/copy`, { method: 'POST' });
    if (!res.ok) return;
    const { id } = (await res.json()) as { id: string };
    router.push(`/songs/${id}`);
  };

  return (
    <div className="song-shell">
      <header className="song-shell-bar">
        <button
          type="button"
          className="song-shell-back"
          aria-label="Back"
          onClick={() => router.push('/')}
        >
          ←
        </button>
        {isOwner ? (
          <input
            className="song-shell-title"
            value={songTitle}
            onChange={(e) => setSongTitle(e.target.value)}
            onBlur={handleTitleBlur}
            spellCheck={false}
          />
        ) : (
          <div className="song-shell-title-readonly">
            <span className="song-shell-title-text">{songTitle}</span>
            <span className="song-shell-creator">
              {creator.avatarEmoji} {creator.displayName}
            </span>
          </div>
        )}
        {!isOwner ? (
          <button type="button" className="song-shell-copy" onClick={handleCopy}>
            Copy to edit
          </button>
        ) : null}
      </header>
      <div className="song-shell-editor">
        <SequencerEditor initialState={initialState} onChange={handleChange} readOnly={!isOwner} />
      </div>
    </div>
  );
}
