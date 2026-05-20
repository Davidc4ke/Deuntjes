import { requireUser } from '@/components/shared/AuthGate';
import { AppBar } from '@/components/app/AppBar';
import { signOut } from '@/auth';
import Link from 'next/link';
import { db } from '@/db/client';
import { songVersions, songs, users } from '@/db/schema';
import { desc, eq, sql } from 'drizzle-orm';
import { SongCard } from '@/components/song/SongCard';
import { unreadCountsForUser } from '@/lib/activity';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const { session, userId } = await requireUser();
  const name = session.user?.name ?? 'friend';
  const avatar = (session.user as { avatar?: string }).avatar ?? '🎵';

  const latestVersion = db
    .select({
      songId: songVersions.songId,
      versionNumber: sql<number>`max(${songVersions.versionNumber})`.as('vmax'),
    })
    .from(songVersions)
    .groupBy(songVersions.songId)
    .as('lv');

  const rows = await db
    .select({
      id: songs.id,
      title: songs.title,
      createdAt: songs.createdAt,
      createdBy: songs.createdBy,
      creatorName: users.displayName,
      creatorAvatar: users.avatarEmoji,
      latestVersionNumber: latestVersion.versionNumber,
    })
    .from(songs)
    .innerJoin(users, eq(users.id, songs.createdBy))
    .leftJoin(latestVersion, eq(latestVersion.songId, songs.id))
    .orderBy(desc(songs.createdAt));

  const unread = await unreadCountsForUser({ userId, songIds: rows.map((r) => r.id) });

  return (
    <>
      <AppBar
        title={
          <span>
            {avatar} {name}
          </span>
        }
        right={
          <form
            action={async () => {
              'use server';
              await signOut({ redirectTo: '/login' });
            }}
          >
            <button type="submit" style={{ padding: '6px 10px' }}>
              Sign out
            </button>
          </form>
        }
      />
      <main className="page">
        {rows.length === 0 ? (
          <div className="card">
            <h2 style={{ marginTop: 0 }}>No songs yet</h2>
            <p className="muted">Be the first — start a song from your phone.</p>
            <Link href="/songs/new" style={{ display: 'inline-block', marginTop: 12 }}>
              <button>+ New song</button>
            </Link>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
              <Link href="/songs/new">
                <button
                  style={{
                    background: 'var(--accent)',
                    color: '#1a1024',
                    borderColor: 'transparent',
                  }}
                >
                  + New song
                </button>
              </Link>
            </div>
            <div>
              {rows.map((r) => (
                <SongCard
                  key={r.id}
                  song={{
                    id: r.id,
                    title: r.title,
                    createdBy: {
                      displayName: r.creatorName,
                      avatarEmoji: r.creatorAvatar,
                    },
                    latestVersionNumber: r.latestVersionNumber ?? 1,
                    unreadCount: unread.get(r.id) ?? 0,
                  }}
                />
              ))}
            </div>
          </>
        )}
      </main>
    </>
  );
}
