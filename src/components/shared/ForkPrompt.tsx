'use client';
import { useState } from 'react';
import { BottomSheet } from '@/components/app/BottomSheet';

export function ForkPrompt({
  open,
  onClose,
  onConfirm,
  trigger,
  pending,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (label: string) => void;
  trigger: string;
  pending?: boolean;
}) {
  const [label, setLabel] = useState('');
  const submit = () => {
    const trimmed = label.trim();
    if (!trimmed) return;
    onConfirm(trimmed);
  };
  return (
    <BottomSheet open={open} onClose={onClose}>
      <h3 style={{ marginTop: 0 }}>Fork to a new version?</h3>
      <p>
        Changing <strong>{trigger}</strong> would break the existing takes. We&apos;ll create a new
        version and leave the old one alone.
      </p>
      <div className="stack">
        <label>
          <div className="muted" style={{ marginBottom: 6 }}>
            Label (one line, required)
          </div>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. minor key try"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') submit();
            }}
          />
        </label>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" onClick={onClose} disabled={pending}>
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!label.trim() || pending}
            style={{ background: 'var(--accent)', color: '#1a1024', borderColor: 'transparent' }}
          >
            {pending ? 'Forking…' : 'Fork'}
          </button>
        </div>
      </div>
    </BottomSheet>
  );
}
