'use client';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import type { ActivityItem } from '@/lib/activity';

const SLOT_LABELS: Record<string, string> = {
  chords: 'chords',
  melody: 'melody',
  bass: 'bass',
  drums: 'drums',
  lyrics: 'lyrics',
};

function timeAgo(iso: string): string {
  const t = new Date(iso).getTime();
  const diff = Date.now() - t;
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function slotLabel(kind: string): string {
  return SLOT_LABELS[kind] ?? kind;
}

function takeHref(
  songId: string,
  versionId: string,
  slotId: string | null,
  takeId: string,
) {
  if (slotId && takeId) {
    return `/songs/${songId}/v/${versionId}/slots/${slotId}/takes/${takeId}`;
  }
  return `/songs/${songId}/v/${versionId}`;
}

export function ActivityFeed({
  songId,
  versionId,
  initialItems,
  since,
}: {
  songId: string;
  versionId: string;
  initialItems?: ActivityItem[];
  since: string | null;
}) {
  const { data } = useQuery<{ items: ActivityItem[]; since: string | null }>({
    queryKey: ['activity', songId, since],
    queryFn: async () => {
      const qs = since ? `?since=${encodeURIComponent(since)}` : '';
      const res = await fetch(`/api/songs/${songId}/activity${qs}`);
      if (!res.ok) throw new Error('failed');
      return (await res.json()) as { items: ActivityItem[]; since: string | null };
    },
    initialData: initialItems ? { items: initialItems, since } : undefined,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });

  const items = data?.items ?? [];

  if (items.length === 0) {
    return <p className="muted">Nothing new yet.</p>;
  }

  return (
    <div className="stack" style={{ gap: 8 }}>
      {items.map((item) => (
        <ActivityRow key={item.id} item={item} songId={songId} versionId={versionId} />
      ))}
    </div>
  );
}

function ActivityRow({
  item,
  songId,
  versionId,
}: {
  item: ActivityItem;
  songId: string;
  versionId: string;
}) {
  const actor = item.actor;
  return (
    <Link
      href={hrefFor(item, songId, versionId)}
      className="card"
      style={{
        padding: 12,
        display: 'flex',
        gap: 10,
        alignItems: 'flex-start',
        textDecoration: 'none',
        color: 'inherit',
      }}
    >
      <div style={{ fontSize: 22 }} aria-hidden>
        {actor.avatarEmoji}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14 }}>
          <strong>{actor.displayName}</strong> {describe(item)}
        </div>
        <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
          {timeAgo(item.createdAt)}
        </div>
      </div>
    </Link>
  );
}

function describe(item: ActivityItem): React.ReactNode {
  switch (item.kind) {
    case 'take_added':
      return (
        <>
          uploaded a <em>{slotLabel(item.slotKind)}</em> take —{' '}
          <strong>{item.takeName}</strong>
          {item.sectionName ? <> ({item.sectionName})</> : null}
        </>
      );
    case 'take_added_rollup':
      return (
        <>
          added <strong>{item.count}</strong> <em>{slotLabel(item.slotKind)}</em> takes
        </>
      );
    case 'take_forked':
      return (
        <>
          forked <em>{slotLabel(item.slotKind)}</em> take{' '}
          <strong>{item.parentName}</strong> → {item.childName}
        </>
      );
    case 'comment':
      return (
        <>
          commented on <strong>{item.takeName}</strong>:{' '}
          <span className="muted">“{truncate(item.body, 80)}”</span>
        </>
      );
    case 'reaction':
      return (
        <>
          reacted {item.emojis.join(' ')} on <strong>{item.takeName}</strong>
        </>
      );
    case 'mix_saved':
      return (
        <>
          saved mix <strong>{item.mixName}</strong>
        </>
      );
    case 'mix_activated':
      return (
        <>
          made <strong>{item.mixName}</strong> the active mix
        </>
      );
    case 'version_forked':
      return (
        <>
          forked v{item.parentVersionNumber} → <strong>v{item.versionNumber}</strong>
          {item.label ? <> ({item.label})</> : null}
        </>
      );
  }
}

function truncate(s: string, n: number) {
  if (s.length <= n) return s;
  return s.slice(0, n - 1) + '…';
}

function hrefFor(item: ActivityItem, songId: string, versionId: string): string {
  switch (item.kind) {
    case 'take_added':
    case 'take_forked':
    case 'reaction':
    case 'comment':
      return takeHref(songId, versionId, item.slotId, item.takeId);
    case 'take_added_rollup':
      return `/songs/${songId}/v/${versionId}`;
    case 'mix_saved':
    case 'mix_activated':
      return `/songs/${songId}/v/${versionId}`;
    case 'version_forked':
      return item.versionId
        ? `/songs/${songId}/v/${item.versionId}`
        : `/songs/${songId}/v/${versionId}`;
  }
}
