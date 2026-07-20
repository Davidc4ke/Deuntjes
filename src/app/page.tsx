import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireUser } from '@/components/shared/AuthGate';
import { signOut } from '@/auth';
import { db } from '@/db/client';
import { games, gameRooms, songs, users } from '@/db/schema';
import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { defaultSequencerState } from '@/lib/sequencerState';
import { initials, SkullGlyph, SwordsGlyph, toRoman } from './games/glyphs';

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
    <div className="grim">
      <div className="grim-grain" aria-hidden="true" />
      <main className="grim-page">
        <div className="grim-bar">
          <span className="grim-title">Deuntjes</span>
          <span className="grim-crumb">
            {avatar} {name}
          </span>
          <form
            action={async () => {
              'use server';
              await signOut({ redirectTo: '/login' });
            }}
          >
            <button type="submit" className="gbtn ghost" style={{ width: 'auto', padding: '4px 6px' }}>
              leave
            </button>
          </form>
        </div>

        <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
          <Link href="/games/new" className="gbtn rite" style={{ flex: 1 }}>
            <SkullGlyph size={17} stroke="#f2ede3" eyes="#f2ede3" /> New dungeon
          </Link>
          <form action={createSongAction} style={{ flex: 1, display: 'flex' }}>
            <button type="submit" className="gbtn iron" style={{ flex: 1 }}>
              + New song
            </button>
          </form>
        </div>

        {myGames.length > 0 && (
          <section style={{ marginBottom: 26 }}>
            <div className="section-label">Dungeons</div>
            {myGames.map((g) => {
              const current = currentByGame.get(g.id);
              const yourTurn = g.status === 'active' && current?.playerId === userId;
              const done = g.status === 'complete';
              return (
                <Link key={g.id} href={`/games/${g.id}`} className={`room${yourTurn ? ' current' : ''}`} style={{ opacity: done ? 0.75 : 1 }}>
                  <div className="arch">
                    {done ? '✦' : <SwordsGlyph size={18} stroke="#f2ede3" />}
                  </div>
                  <div className="body">
                    <div className="rm-title">{g.title}</div>
                    <div className="rm-sub">
                      {done ? (
                        <span>The song is complete — listen</span>
                      ) : (
                        <span>
                          Room {toRoman((current?.roomIndex ?? 0) + 1)} of {toRoman(g.roomCount)}
                        </span>
                      )}
                    </div>
                  </div>
                  {yourTurn && <span className="badge-turn">Your turn</span>}
                </Link>
              );
            })}
          </section>
        )}

        <section>
          <div className="section-label">Songbook</div>
          {rows.length === 0 ? (
            <p className="deal-intro" style={{ textAlign: 'left' }}>
              No loose songs yet — raise a dungeon with your friends, or start a song of your own.
            </p>
          ) : (
            rows.map((r) => (
              <Link key={r.id} href={`/songs/${r.id}`} className="room">
                <div className="arch">
                  <span className="med" style={{ border: 'none', fontSize: 15 }}>
                    {r.creatorAvatar}
                  </span>
                </div>
                <div className="body">
                  <div className="rm-title">{r.title}</div>
                  <div className="rm-sub">
                    <span className="who">
                      <span className="med">{initials(r.creatorName)}</span> {r.creatorName}
                      {r.createdBy === userId ? ' · you' : ''}
                    </span>
                  </div>
                </div>
              </Link>
            ))
          )}
        </section>
      </main>
    </div>
  );
}
