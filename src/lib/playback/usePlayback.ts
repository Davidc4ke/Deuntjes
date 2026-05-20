'use client';
import { useCallback, useEffect, useMemo } from 'react';
import { getEngine, type EngineInput, type EngineSelection, type EngineSection } from './engine';
import { usePlaybackStore } from './store';
import type { SlotKind } from '@/db/schema';

export type UsePlaybackInput = {
  versionId: string;
  tempoBpm: number;
  timeSigNum: number;
  timeSigDen: number;
  barCount: number;
  sections: EngineSection[];
  selections: EngineSelection[];
  drumPads: { midiNote: number }[];
};

// Stable signature for the current set of selections + structure. Engine
// reloads only when this changes.
function signatureFor(input: EngineInput): string {
  return JSON.stringify({
    v: input.versionId,
    t: input.timeSigNum,
    d: input.timeSigDen,
    b: input.barCount,
    s: input.sections.map((s) => [s.id, s.startBar, s.lengthBars]),
    sel: input.selections
      .map((s) => `${s.slotKind}|${s.sectionId ?? ''}|${s.takeId}`)
      .sort(),
  });
}

// Tracks the most-recently-loaded selection signature. When stop() runs (either
// user-initiated or end-of-song) we invalidate so the next play() rebuilds the
// scheduled events — Tone.Part events don't re-fire once the transport passes
// them, so we can't just rewind and play again.
let lastSignature = '';

function invalidateSignature() {
  lastSignature = '';
}

export function usePlayback(input: UsePlaybackInput) {
  const status = usePlaybackStore((s) => s.status);
  const positionBar = usePlaybackStore((s) => s.positionBar);
  const totalBars = usePlaybackStore((s) => s.totalBars);
  const muted = usePlaybackStore((s) => s.muted);
  const setStatus = usePlaybackStore((s) => s.setStatus);
  const setError = usePlaybackStore((s) => s.setError);

  const signature = useMemo(() => signatureFor(input), [input]);

  useEffect(() => {
    return () => {
      // Stop on unmount, but don't dispose — engine is a singleton.
      getEngine().stop();
      invalidateSignature();
    };
  }, []);

  // Engine's internal stop (end-of-song) sets status to 'stopped'. Invalidate
  // so the next play rebuilds the schedule.
  useEffect(() => {
    if (status === 'stopped') invalidateSignature();
  }, [status]);

  const ensureLoaded = useCallback(async () => {
    if (lastSignature === signature) return;
    setStatus('loading');
    try {
      await getEngine().load(input);
      lastSignature = signature;
      setStatus('stopped');
    } catch (e) {
      console.error(e);
      setError((e as Error)?.message ?? 'load failed');
      setStatus('idle');
    }
  }, [signature, input, setStatus, setError]);

  const play = useCallback(async () => {
    await ensureLoaded();
    await getEngine().play();
  }, [ensureLoaded]);

  const stop = useCallback(() => {
    getEngine().stop();
    invalidateSignature();
  }, []);

  useEffect(() => {
    getEngine().setMuted(muted);
  }, [muted]);

  useEffect(() => {
    getEngine().setTempo(input.tempoBpm);
  }, [input.tempoBpm]);

  return {
    status,
    positionBar,
    totalBars,
    play,
    stop,
    muted,
    toggleMute: (slot: SlotKind) => usePlaybackStore.getState().toggleMute(slot),
  };
}
