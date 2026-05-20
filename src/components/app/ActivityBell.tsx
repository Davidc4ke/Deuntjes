'use client';
import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import type { ActivityItem } from '@/lib/activity';

/**
 * The bell on the song AppBar. Anchored to the user's *prior* last_seen_at
 * for the duration of the session, so:
 *   - opening the song marks it seen (clearing the home page badge), but
 *   - the bell still shows "you had X unread when you arrived, and Y new
 *     items have come in since."
 *
 * On the next visit, the anchor resets.
 */
export function ActivityBell({
  songId,
  priorLastSeenAt,
  initialUnread,
  meId,
}: {
  songId: string;
  priorLastSeenAt: string | null;
  initialUnread: number;
  meId: string;
}) {
  const router = useRouter();
  const seenSentRef = useRef(false);

  useEffect(() => {
    if (seenSentRef.current) return;
    seenSentRef.current = true;
    void fetch(`/api/songs/${songId}/seen`, { method: 'POST' });
  }, [songId]);

  const { data } = useQuery<{ items: ActivityItem[]; since: string | null }>({
    queryKey: ['activity-bell', songId, priorLastSeenAt],
    queryFn: async () => {
      const qs = priorLastSeenAt ? `?since=${encodeURIComponent(priorLastSeenAt)}` : '';
      const res = await fetch(`/api/songs/${songId}/activity${qs}`);
      if (!res.ok) throw new Error('failed');
      return (await res.json()) as { items: ActivityItem[]; since: string | null };
    },
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });

  const unread = data
    ? data.items.reduce((n, item) => {
        if (item.actor.id === meId) return n;
        return n + (item.kind === 'take_added_rollup' ? item.count : 1);
      }, 0)
    : initialUnread;

  // When new items appear, refresh the route so newly uploaded takes etc.
  // appear in the song view.
  const lastSeenLocal = useRef<number>(initialUnread);
  useEffect(() => {
    if (unread > lastSeenLocal.current) {
      router.refresh();
    }
    lastSeenLocal.current = unread;
  }, [unread, router]);

  const href = priorLastSeenAt
    ? `/songs/${songId}/activity?since=${encodeURIComponent(priorLastSeenAt)}`
    : `/songs/${songId}/activity`;
  return (
    <Link
      href={href}
      aria-label={unread > 0 ? `Activity feed (${unread} new)` : 'Activity feed'}
      style={{ position: 'relative', padding: '6px 8px', display: 'inline-block' }}
    >
      <span style={{ fontSize: 18 }} aria-hidden>
        🔔
      </span>
      {unread > 0 ? (
        <span
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            minWidth: 16,
            height: 16,
            padding: '0 4px',
            borderRadius: 8,
            background: 'var(--accent-2)',
            color: '#1a1024',
            fontSize: 10,
            fontWeight: 700,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {unread > 99 ? '99+' : unread}
        </span>
      ) : null}
    </Link>
  );
}
