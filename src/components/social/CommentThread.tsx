'use client';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { useState } from 'react';

type CommentDTO = {
  id: string;
  body: string;
  createdAt: string;
  user: { id: string; displayName: string; avatarEmoji: string };
};

async function fetchJSON<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(j.error ?? `request failed (${res.status})`);
  }
  return (await res.json()) as T;
}

export function CommentThread({
  takeId,
  meId,
  initialComments,
  canModerate,
}: {
  takeId: string;
  meId: string;
  initialComments?: CommentDTO[];
  // true when the viewer is the song owner — lets them delete others' comments
  canModerate: boolean;
}) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState('');

  const { data } = useQuery<{ comments: CommentDTO[] }>({
    queryKey: ['comments', takeId],
    queryFn: () => fetchJSON<{ comments: CommentDTO[] }>(`/api/takes/${takeId}/comments`),
    initialData: initialComments ? { comments: initialComments } : undefined,
    refetchOnWindowFocus: true,
    refetchInterval: 30_000,
  });

  const post = useMutation({
    mutationFn: (body: string) =>
      fetchJSON<{ commentId: string }>(`/api/takes/${takeId}/comments`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ body }),
      }),
    onSuccess: () => {
      setDraft('');
      qc.invalidateQueries({ queryKey: ['comments', takeId] });
    },
  });

  const del = useMutation({
    mutationFn: (id: string) => fetchJSON<{ ok: true }>(`/api/comments/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['comments', takeId] }),
  });

  function submit() {
    const text = draft.trim();
    if (!text) return;
    post.mutate(text);
  }

  const comments = data?.comments ?? [];

  return (
    <div className="stack" style={{ gap: 10 }}>
      <h4 style={{ margin: 0, fontSize: 14 }} className="muted">
        💬 Comments ({comments.length})
      </h4>
      {comments.length === 0 ? (
        <p className="muted" style={{ margin: 0, fontSize: 13 }}>
          No comments yet — say something.
        </p>
      ) : (
        <div className="stack" style={{ gap: 8 }}>
          {comments.map((c) => {
            const canDelete = c.user.id === meId || canModerate;
            return (
              <div
                key={c.id}
                className="card"
                style={{ padding: 10, display: 'flex', gap: 10, alignItems: 'flex-start' }}
              >
                <div style={{ fontSize: 22 }} aria-hidden>
                  {c.user.avatarEmoji}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="muted" style={{ fontSize: 12 }}>
                    <strong style={{ color: 'var(--fg)' }}>{c.user.displayName}</strong> ·{' '}
                    {new Date(c.createdAt).toLocaleString()}
                  </div>
                  <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{c.body}</div>
                </div>
                {canDelete ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm('Delete this comment?')) del.mutate(c.id);
                    }}
                    disabled={del.isPending}
                    style={{ color: 'var(--danger)', padding: '4px 8px', fontSize: 12 }}
                    aria-label="Delete comment"
                  >
                    Delete
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      <div className="stack" style={{ gap: 6 }}>
        <textarea
          rows={2}
          placeholder="add a comment…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={2000}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit();
          }}
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          {post.error ? (
            <span className="muted" style={{ color: 'var(--danger)', fontSize: 12, flex: 1 }}>
              {(post.error as Error).message}
            </span>
          ) : null}
          <button
            type="button"
            onClick={submit}
            disabled={post.isPending || !draft.trim()}
            style={{ background: 'var(--accent)', color: '#1a1024', borderColor: 'transparent' }}
          >
            Post
          </button>
        </div>
      </div>
    </div>
  );
}
