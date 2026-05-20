'use client';
import { createPortal } from 'react-dom';
import { useEffect, useState } from 'react';
import { BottomSheet } from './BottomSheet';

type TransportState = 'stopped' | 'playing';

export function FloatingTransport({ visible = true }: { visible?: boolean }) {
  const [mounted, setMounted] = useState(false);
  const [state, setState] = useState<TransportState>('stopped');
  const [sheet, setSheet] = useState(false);

  useEffect(() => setMounted(true), []);
  if (!mounted || !visible) return null;

  const target = document.getElementById('transport-portal');
  if (!target) return null;

  const toggle = () => setState((s) => (s === 'playing' ? 'stopped' : 'playing'));

  return createPortal(
    <>
      <button
        className="floating-transport"
        aria-label={state === 'playing' ? 'Stop' : 'Play'}
        onClick={toggle}
        onContextMenu={(e) => {
          e.preventDefault();
          setSheet(true);
        }}
      >
        {state === 'playing' ? '■' : '▶'}
      </button>
      <BottomSheet open={sheet} onClose={() => setSheet(false)}>
        <h3 style={{ marginTop: 0 }}>Transport</h3>
        <p className="muted">Per-slot mute/solo/volume lands in ticket #6.</p>
      </BottomSheet>
    </>,
    target,
  );
}
