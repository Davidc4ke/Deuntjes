'use client';

import { useEffect, useRef } from 'react';
import { sequencerHtml } from './markup';
import { sequencerCss } from './styles';
import { mountSequencer } from './setup';
import type { SequencerState } from '@/lib/sequencerState';

export interface SequencerEditorProps {
  initialState: SequencerState;
  // Fires after every undo-snapshot — i.e. every committed edit. Use to feed
  // the autosave debouncer in the parent page.
  onChange: (state: SequencerState) => void;
  // When true, edits are visually possible but won't be saved (the parent
  // doesn't wire onChange to the API). The editor itself doesn't block input;
  // we just don't persist it. Used for the read-only view non-owners get.
  readOnly?: boolean;
}

// Inject the sequencer CSS into <head> exactly once across the app. The CSS
// is keyed by an id so React Strict-Mode double-mounts don't duplicate it.
function ensureStylesInjected() {
  if (typeof document === 'undefined') return;
  if (document.getElementById('sequencer-app-styles')) return;
  const style = document.createElement('style');
  style.id = 'sequencer-app-styles';
  style.textContent = sequencerCss;
  document.head.appendChild(style);
}

export function SequencerEditor({ initialState, onChange, readOnly }: SequencerEditorProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  // Store the latest onChange in a ref so the imperative mount function — which
  // captures the callback once at mount time — always calls the current one.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    ensureStylesInjected();
    root.innerHTML = sequencerHtml;
    const destroy = mountSequencer(root, {
      initialState,
      onChange: (state) => onChangeRef.current(state as SequencerState),
      readOnly,
    });
    return destroy;
    // Intentionally only mount once. State drift between server-snapshot and
    // editor-local state is handled by debounced PATCHes, not re-mounts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={rootRef} className="sequencer-app" />;
}
