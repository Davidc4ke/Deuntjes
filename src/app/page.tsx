import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireUser } from '@/components/shared/AuthGate';
import { AppBar } from '@/components/app/AppBar';
import { signOut } from '@/auth';
import { db } from '@/db/client';
import { games, gameRooms, songs, users } from '@/db/schema';
import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { defaultSequencerState } from '@/lib/sequencerState';

export const dynamic = 'force-dynamic';

async function createSongAction() {
  'use server';
  const { userId } = await requireUser();
  const [row] = await db
    .insert(songs)
    .values({ title: 'Untitled song', createdBy: userId, sequencerData: defaultSequencerState() })
    .returning({ id: songs.id });
  redirect(`/songs/${row.id}`);
}

export default async function HomePage() {
  const { userId, session } = await requireUser();
  const name = session.user?.name ?? 'friend';
  const avatar = (session.user as { avatar?: string }).avatar ?? '🎵';

  // Game-backed songs are reachable through their dungeon card, not the
  // songs list — the left-join/isNull filters them out.
  const rows = await db
    .select({
      id: songs.id,
      title: songs.title,
      createdAt: songs.createdAt,
      updatedAt: songs.updatedAt,
      createdBy: songs.createdBy,
      creatorName: users.displayName,
      creatorAvatar: users.avatarEmoji,
    })
    .from(songs)
    .innerJoin(users, eq(users.id, songs.createdBy))
    .leftJoin(games, eq(games.songId, songs.id))
    .where(isNull(games.id))
    .orderBy(desc(songs.updatedAt));

  // Dungeons the viewer plays in, newest activity first. "Your turn" is the
  // v1 notification: a badge here on the home screen.
  const myGames = await db
    .select()
    .from(games)
    .where(sql`${games.playerOrder} @> ${JSON.stringify([userId])}::jsonb`)
    .orderBy(desc(games.updatedAt));
  const currentRooms = myGames.length
    ? await db
        .select({ gameId: gameRooms.gameId, playerId: gameRooms.playerId, roomIndex: gameRooms.roomIndex })
        .from(gameRooms)
        .where(and(inArray(gameRooms.gameId, myGames.map((g) => g.id)), eq(gameRooms.status, 'current')))
    : [];
  const currentByGame = new Map(currentRooms.map((r) => [r.gameId, r]));

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
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginBottom: 12 }}>
          <Link
            href="/games/new"
            className="primary"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '8px 14px',
              background: '#a01818',
              color: '#f2ede3',
              borderRadius: 8,
              textDecoration: 'none',
              fontWeight: 600,
            }}
          >
            ☠︎ New dungeon
          </Link>
          <form action={createSongAction}>
            <button type="submit" className="primary">
              + New song
            </button>
          </form>
        </div>

        {myGames.length > 0 && (
          <section style={{ marginBottom: 20 }}>
            <h2 style={{ fontSize: 14, letterSpacing: '0.08em', textTransform: 'uppercase', opacity: 0.7, margin: '0 0 8px' }}>
              Dungeons
            </h2>
            {myGames.map((g) => {
              const current = currentByGame.get(g.id);
              const yourTurn = g.status === 'active' && current?.playerId === userId;
              return (
                <Link key={g.id} href={`/games/${g.id}`} className="song-card">
                  <span style={{ fontSize: 22 }}>{g.status === 'complete' ? '🏆' : '⚔️'}</span>
                  <div className="song-card-meta">
                    <div className="song-card-title">{g.title}</div>
                    <div className="song-card-sub">
                      {g.status === 'complete'
                        ? 'Song complete — listen'
                        : `Room ${(current?.roomIndex ?? 0) + 1} of ${g.roomCount}`}
                    </div>
                  </div>
                  {yourTurn && (
                    <span
                      style={{
                        background: '#a01818',
                        color: '#f2ede3',
                        fontSize: 11,
                        fontWeight: 700,
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                        padding: '4px 9px',
                        borderRadius: 999,
                        flexShrink: 0,
                      }}
                    >
                      Your turn
                    </span>
                  )}
                </Link>
              );
            })}
          </section>
        )}
        {rows.length === 0 ? (
          <div className="card">
            <h2 style={{ marginTop: 0 }}>No songs yet</h2>
            <p className="muted">Tap “New song” to start your first sequencer.</p>
          </div>
        ) : (
          <div>
            {rows.map((r) => (
              <Link key={r.id} href={`/songs/${r.id}`} className="song-card">
                <span style={{ fontSize: 22 }}>{r.creatorAvatar}</span>
                <div className="song-card-meta">
                  <div className="song-card-title">{r.title}</div>
                  <div className="song-card-sub">
                    {r.creatorName}
                    {r.createdBy === userId ? ' · you' : ''}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
