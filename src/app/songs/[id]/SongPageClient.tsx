'use client';

import { useCallback, useEffect, useRef } from 'react';
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
  // Last title the server accepted. The sequencer owns the live input; we
  // just hold the canonical value so a failed PATCH can revert.
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
    pendingRef.current = null;
    const useKeepalive = opts?.keepalive === true;
    let body: string;
    try {
      body = JSON.stringify({ sequencerData: data });
    } catch {
      return;
    }
    if (useKeepalive && body.length > KEEPALIVE_MAX_BYTES) {
      try {
        const blob = new Blob([body], { type: 'application/json' });
        navigator.sendBeacon(`/api/songs/${songId}`, blob);
        return;
      } catch {
        // fall through to fetch
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
      if (pendingRef.current === null) pendingRef.current = data;
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

  // Owner renames are fire-and-forget; the editor passes the trimmed value
  // and falls back to the previous title on error.
  const handleRenameTitle = useCallback(
    async (newTitle: string) => {
      if (!isOwner) return;
      try {
        const res = await fetch(`/api/songs/${songId}`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ title: newTitle }),
        });
        if (res.ok) {
          lastSavedTitleRef.current = newTitle;
        }
        // On failure we don't currently surface anything — the next blur
        // will re-attempt with whatever the user types. Logging only.
      } catch {
        /* ignore */
      }
    },
    [isOwner, songId],
  );

  const handleCopy = useCallback(async () => {
    const res = await fetch(`/api/songs/${songId}/copy`, { method: 'POST' });
    if (!res.ok) return;
    const { id } = (await res.json()) as { id: string };
    router.push(`/songs/${id}`);
  }, [router, songId]);

  const handleBack = useCallback(() => {
    router.push('/');
  }, [router]);

  return (
    <div className="song-shell">
      <SequencerEditor
        initialState={initialState}
        onChange={handleChange}
        readOnly={!isOwner}
        onBack={handleBack}
        songTitle={title}
        onRenameTitle={handleRenameTitle}
        isOwner={isOwner}
        creatorDisplay={`${creator.avatarEmoji} ${creator.displayName}`}
        onCopy={handleCopy}
      />
    </div>
  );
}
