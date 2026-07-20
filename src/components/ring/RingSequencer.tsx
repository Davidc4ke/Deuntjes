'use client';

import { useEffect, useRef } from 'react';
import type { RingSongState } from '@/lib/ringState';
import { mountRing, type RingHandle } from './ringCore';
import './ring.css';

// Thin React shell over the vanilla ring engine. Mounts once; the engine owns
// all DOM below the host div. onChange is routed through a ref so the engine
// always reaches the latest callback without remounting.
export function RingSequencer({
  initialState,
  onChange,
  editableChannelId,
  readOnly,
}: {
  initialState: RingSongState;
  onChange?: (state: RingSongState) => void;
  editableChannelId?: number | null;
  readOnly?: boolean;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<RingHandle | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!hostRef.current) return;
    const handle = mountRing(hostRef.current, {
      initialState,
      onChange: (s) => onChangeRef.current?.(s),
      editableChannelId,
      readOnly,
    });
    handleRef.current = handle;
    return () => {
      handleRef.current = null;
      handle.destroy();
    };
    // Mount exactly once — the engine owns its state after that; prop changes
    // to initialState after mount are deliberately ignored (same contract as
    // the legacy SequencerEditor).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={hostRef} className="ring-host" />;
}
