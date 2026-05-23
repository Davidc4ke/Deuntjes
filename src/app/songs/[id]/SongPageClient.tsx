'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { SequencerEditor } from '@/components/sequencer/SequencerEditor';
import type { SequencerState } from '@/lib/sequencerState';

// Debounce window for autosave. Long enough that rapid edits coalesce into a
// single request; short enough that closing the tab loses ≤1s of work.
const AUTOSAVE_MS = 800;
// Backoff for retries after a failed PATCH. We don't escalate — every edit
// already armed a fresh timer, so this is the fallback when the user stops
// editing mid-failure.
const RETRY_MS = 3000;
// `keepalive: true` caps the request body at 64 KiB per browser policy. We
// only need that semantic at unload time, and even then we have to guard the
// size or the request is rejected outright.
const KEEPALIVE_MAX_BYTES = 60 * 1024;

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
  // Last title the server accepted. Used to revert the input if the owner
  // tries to blur with an empty value (the server rejects blanks anyway).
  const lastSavedTitleRef = useRef(title);

  // Pending state to save. The debounce timer reads this; flush clears it
  // when a request actually starts.
  const pendingRef = useRef<SequencerState | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // flush is referenced from setTimeout, pagehide, and visibilitychange. We
  // route through a ref so each call site reaches the latest closure even
  // though we (deliberately) only set listeners up once.
  const flushRef = useRef<(opts?: { keepalive?: boolean }) => Promise<void>>(async () => {});

  flushRef.current = async (opts) => {
    const data = pendingRef.current;
    if (!data) return;
    // Take ownership of this snapshot. If the request fails, we'll only
    // restore it when nothing newer has arrived.
    pendingRef.current = null;
    const useKeepalive = opts?.keepalive === true;
    let body: string;
    try {
      body = JSON.stringify({ sequencerData: data });
    } catch {
      return; // unserializable state — drop rather than crash
    }
    // Browsers reject keepalive requests > 64 KiB outright. If we're past
    // the safe size on an unload path, fall back to navigator.sendBeacon —
    // same byte limit, but it accepts a Blob and lets the agent batch it.
    if (useKeepalive && body.length > KEEPALIVE_MAX_BYTES) {
      try {
        const blob = new Blob([body], { type: 'application/json' });
        navigator.sendBeacon(`/api/songs/${songId}`, blob);
        return;
      } catch {
        // fall through to fetch; it'll likely fail too but at least the
        // restore-on-error path will keep the data around.
      }
    }
    try {
      const res = await fetch(`/api/songs/${songId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body,
        keepalive: useKeepalive,
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
    } catch {
      // Restore only if no newer edit has landed in the meantime — otherwise
      // we'd clobber a fresher snapshot with this stale one.
      if (pendingRef.current === null) pendingRef.current = data;
      // Arm a retry so the failure doesn't strand the data until the user's
      // next edit. handleChange will preempt this timer if the user resumes
      // editing first, which is the desired behavior.
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => void flushRef.current(), RETRY_MS);
    }
  };

  const handleChange = useCallback(
    (next: SequencerState) => {
      if (!isOwner) return; // non-owners never trigger PATCH (server would 403 anyway)
      pendingRef.current = next;
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => void flushRef.current(), AUTOSAVE_MS);
    },
    [isOwner],
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
      void flushRef.current({ keepalive: true });
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') trigger();
    };
    window.addEventListener('pagehide', trigger);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('pagehide', trigger);
      document.removeEventListener('visibilitychange', onVisibility);
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isOwner]);

  const handleTitleBlur = async () => {
    if (!isOwner) return;
    const trimmed = songTitle.trim();
    if (!trimmed) {
      // Server rejects blank titles; revert the input rather than silently
      // diverging from server state.
      setSongTitle(lastSavedTitleRef.current);
      return;
    }
    if (trimmed === lastSavedTitleRef.current) return;
    try {
      const res = await fetch(`/api/songs/${songId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: trimmed }),
      });
      if (res.ok) {
        lastSavedTitleRef.current = trimmed;
        if (trimmed !== songTitle) setSongTitle(trimmed);
      } else {
        setSongTitle(lastSavedTitleRef.current);
      }
    } catch {
      setSongTitle(lastSavedTitleRef.current);
    }
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
