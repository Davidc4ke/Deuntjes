import { notFound } from 'next/navigation';
import { requireUser } from '@/components/shared/AuthGate';
import { AppBar } from '@/components/app/AppBar';
import { db } from '@/db/client';
import { songVersions, songs } from '@/db/schema';
import { desc, eq } from 'drizzle-orm';
import {
  applyRollups,
  lastSeenAtFor,
  listActivityForSong,
} from '@/lib/activity';
import { ActivityFeed } from '@/components/social/ActivityFeed';

export const dynamic = 'force-dynamic';

export default async function ActivityPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ since?: string }>;
}) {
  const { userId } = await requireUser();
  const { id } = await params;
  const { since: sinceParam } = await searchParams;
  const [song] = await db.select().from(songs).where(eq(songs.id, id)).limit(1);
  if (!song) notFound();

  const [latest] = await db
    .select({ id: songVersions.id })
    .from(songVersions)
    .where(eq(songVersions.songId, id))
    .orderBy(desc(songVersions.versionNumber))
    .limit(1);

  let cutoff: Date | null = null;
  if (sinceParam) {
    const d = new Date(sinceParam);
    if (!Number.isNaN(d.getTime())) cutoff = d;
  }
  if (!cutoff) {
    cutoff = await lastSeenAtFor({ userId, songId: id });
  }

  const rows = await listActivityForSong({
    songId: id,
    since: cutoff,
    limit: 200,
  });
  const items = applyRollups(rows);

  return (
    <>
      <AppBar back={`/songs/${id}`} title={<span>Activity · {song.title}</span>} />
      <main className="page">
        {items.length === 0 ? (
          <div className="card stack">
            <p className="muted" style={{ margin: 0 }}>
              No new activity since your last visit.
            </p>
            <p className="muted" style={{ fontSize: 13, margin: 0 }}>
              Showing items newer than your last seen marker. Reload the page after
              someone reacts or comments to see updates.
            </p>
          </div>
        ) : (
          <ActivityFeed
            songId={id}
            versionId={latest?.id ?? ''}
            initialItems={items}
            since={cutoff?.toISOString() ?? null}
          />
        )}
      </main>
    </>
  );
}
