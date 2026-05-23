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
  // Integration hooks rendered into the sequencer's own chrome (back button +
  // keyboard popup). They let us drop the React app-bar entirely.
  onBack: () => void;
  songTitle: string;
  onRenameTitle: (title: string) => void;
  isOwner: boolean;
  creatorDisplay?: string;
  onCopy?: () => void;
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

export function SequencerEditor({
  initialState,
  onChange,
  readOnly,
  onBack,
  songTitle,
  onRenameTitle,
  isOwner,
  creatorDisplay,
  onCopy,
}: SequencerEditorProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  // Stash callbacks in refs so the imperative mount function — which captures
  // them once — always invokes the current ones.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;
  const onRenameRef = useRef(onRenameTitle);
  onRenameRef.current = onRenameTitle;
  const onCopyRef = useRef(onCopy);
  onCopyRef.current = onCopy;

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    ensureStylesInjected();
    root.innerHTML = sequencerHtml;
    const destroy = mountSequencer(root, {
      initialState,
      onChange: (state) => onChangeRef.current(state as SequencerState),
      readOnly,
      onBack: () => onBackRef.current(),
      songTitle,
      onRenameTitle: (t) => onRenameRef.current(t),
      isOwner,
      creatorDisplay,
      onCopy: () => onCopyRef.current?.(),
    });
    return destroy;
    // Mount once; everything else flows through refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={rootRef} className="sequencer-app" />;
}
