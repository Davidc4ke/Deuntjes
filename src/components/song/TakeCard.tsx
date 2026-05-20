'use client';
import type { Take } from './types';

export function TakeCard({
  take,
  selected,
  onSelect,
  onOpen,
}: {
  take: Take;
  selected: boolean;
  onSelect?: () => void;
  onOpen?: () => void;
}) {
  return (
    <div
      className="card"
      style={{
        display: 'flex',
        gap: 10,
        padding: 10,
        alignItems: 'center',
        outline: selected ? '2px solid var(--accent)' : undefined,
      }}
    >
      <div style={{ fontSize: 22 }} aria-hidden>
        {take.createdBy.avatarEmoji}
      </div>
      <button
        type="button"
        onClick={onOpen}
        className="card"
        style={{
          flex: 1,
          background: 'transparent',
          border: 'none',
          padding: 0,
          textAlign: 'left',
          cursor: 'pointer',
        }}
      >
        <div style={{ fontWeight: 600 }}>{take.name}</div>
        <div className="muted" style={{ fontSize: 12 }}>
          {take.createdBy.displayName} · {new Date(take.createdAt).toLocaleDateString()} ·{' '}
          {take.source === 'uploaded' ? 'upload' : 'native'}
        </div>
        <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
          🔥 0 · 💬 0 <span style={{ opacity: 0.6 }}>(social lands in #4)</span>
        </div>
      </button>
      {onSelect ? (
        <button
          type="button"
          onClick={onSelect}
          aria-pressed={selected}
          style={{
            background: selected ? 'var(--accent)' : 'var(--bg-elev-2)',
            color: selected ? '#1a1024' : 'var(--fg)',
            borderColor: 'transparent',
            padding: '8px 12px',
          }}
        >
          {selected ? 'Selected' : 'Pick'}
        </button>
      ) : null}
    </div>
  );
}
