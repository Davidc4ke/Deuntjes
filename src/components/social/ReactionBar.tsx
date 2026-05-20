'use client';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { useState } from 'react';

const QUICK_PICKS = ['🔥', '❤️', '🤯', '😂', '🎯', '👀'];

type Summary = {
  emoji: string;
  count: number;
  users: string[];
  mine: boolean;
};

type ReactionDTO = {
  id: string;
  emoji: string;
  userId: string;
  user: { displayName: string };
  createdAt: string;
};

type Resp = { reactions: ReactionDTO[]; summary: Summary[] };

async function fetchJSON<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(j.error ?? `request failed (${res.status})`);
  }
  return (await res.json()) as T;
}

export function ReactionBar({
  takeId,
  initialSummary,
  initialReactions,
  meId,
  compact = false,
}: {
  takeId: string;
  initialSummary?: Summary[];
  initialReactions?: ReactionDTO[];
  meId: string;
  compact?: boolean;
}) {
  const qc = useQueryClient();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [customEmoji, setCustomEmoji] = useState('');

  const { data } = useQuery<Resp>({
    queryKey: ['reactions', takeId],
    queryFn: () => fetchJSON<Resp>(`/api/takes/${takeId}/reactions`),
    initialData:
      initialSummary && initialReactions
        ? { summary: initialSummary, reactions: initialReactions }
        : undefined,
    refetchOnWindowFocus: true,
    refetchInterval: 30_000,
  });

  const summary = data?.summary ?? [];
  const reactions = data?.reactions ?? [];

  const addMutation = useMutation({
    mutationFn: (emoji: string) =>
      fetchJSON<{ summary: Summary[] }>(`/api/takes/${takeId}/reactions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ emoji }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reactions', takeId] }),
  });

  const removeMutation = useMutation({
    mutationFn: (reactionId: string) =>
      fetchJSON<{ summary: Summary[] }>(`/api/takes/${takeId}/reactions/${reactionId}`, {
        method: 'DELETE',
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reactions', takeId] }),
  });

  function findMine(emoji: string): string | null {
    const mine = reactions.find((r) => r.userId === meId && r.emoji === emoji);
    return mine?.id ?? null;
  }

  function toggle(emoji: string) {
    const myId = findMine(emoji);
    if (myId) removeMutation.mutate(myId);
    else addMutation.mutate(emoji);
  }

  function submitCustom() {
    const trimmed = customEmoji.trim();
    if (!trimmed) return;
    addMutation.mutate(trimmed);
    setCustomEmoji('');
    setPickerOpen(false);
  }

  if (compact) {
    // Inline read-only counts on TakeCard
    if (summary.length === 0) return null;
    return (
      <span style={{ fontSize: 12 }} className="muted">
        {summary
          .map((s) => `${s.emoji}${s.count > 1 ? ` ${s.count}` : ''}`)
          .join(' · ')}
      </span>
    );
  }

  const busy = addMutation.isPending || removeMutation.isPending;
  return (
    <div className="stack" style={{ gap: 8 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {summary.map((s) => (
          <button
            key={s.emoji}
            type="button"
            disabled={busy}
            onClick={() => toggle(s.emoji)}
            aria-pressed={s.mine}
            title={s.users.join(', ')}
            style={{
              padding: '6px 10px',
              fontSize: 14,
              background: s.mine ? 'var(--accent)' : 'var(--bg-elev-2)',
              color: s.mine ? '#1a1024' : 'var(--fg)',
              borderColor: 'transparent',
            }}
          >
            <span aria-hidden style={{ marginRight: 4 }}>
              {s.emoji}
            </span>
            {s.count}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setPickerOpen((p) => !p)}
          disabled={busy}
          aria-label="Add reaction"
          style={{ padding: '6px 10px', fontSize: 14 }}
        >
          +
        </button>
      </div>
      {pickerOpen ? (
        <div className="card" style={{ padding: 10, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {QUICK_PICKS.map((e) => (
            <button
              key={e}
              type="button"
              disabled={busy}
              onClick={() => {
                toggle(e);
                setPickerOpen(false);
              }}
              style={{ fontSize: 18, padding: '6px 10px' }}
              aria-label={`React with ${e}`}
            >
              {e}
            </button>
          ))}
          <div style={{ display: 'flex', gap: 4, flex: '1 0 100%', marginTop: 4 }}>
            <input
              placeholder="custom emoji"
              value={customEmoji}
              onChange={(e) => setCustomEmoji(e.target.value)}
              maxLength={8}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submitCustom();
              }}
            />
            <button
              type="button"
              onClick={submitCustom}
              disabled={busy || !customEmoji.trim()}
              style={{ background: 'var(--accent)', color: '#1a1024', borderColor: 'transparent' }}
            >
              Add
            </button>
          </div>
        </div>
      ) : null}
      {addMutation.error || removeMutation.error ? (
        <div className="muted" style={{ color: 'var(--danger)', fontSize: 12 }}>
          {(addMutation.error || removeMutation.error)?.message}
        </div>
      ) : null}
    </div>
  );
}
