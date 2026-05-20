'use client';
import type { Take } from './types';

export function TakeCard({
  take,
  selected,
  onSelect,
  onOpen,
  isNew = false,
}: {
  take: Take;
  selected: boolean;
  onSelect?: () => void;
  onOpen?: () => void;
  isNew?: boolean;
}) {
  const reactionLabel = take.reactions
    .map((r) => `${r.emoji}${r.count > 1 ? ` ${r.count}` : ''}`)
    .join(' · ');
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ fontWeight: 600 }}>{take.name}</div>
          {isNew ? (
            <span
              aria-label="new since last visit"
              style={{
                background: 'var(--accent-2)',
                color: '#1a1024',
                borderRadius: 6,
                padding: '0 6px',
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: 0.4,
              }}
            >
              NEW
            </span>
          ) : null}
        </div>
        <div className="muted" style={{ fontSize: 12 }}>
          {take.createdBy.displayName} · {new Date(take.createdAt).toLocaleDateString()} ·{' '}
          {take.source === 'uploaded' ? 'upload' : 'native'}
        </div>
        {reactionLabel || take.commentCount > 0 ? (
          <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
            {reactionLabel || null}
            {reactionLabel && take.commentCount > 0 ? ' · ' : null}
            {take.commentCount > 0 ? `💬 ${take.commentCount}` : null}
          </div>
        ) : null}
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
