import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireUser } from '@/components/shared/AuthGate';
import { db } from '@/db/client';
import { games, gameRooms, users } from '@/db/schema';
import { asc, eq, inArray } from 'drizzle-orm';
import { curseById } from '@/lib/curses';
import { CHANNEL_NAMES } from '@/lib/gameLogic';
import { CHANNEL_PATTERNS, initials, LockGlyph, SkullGlyph, SwordsGlyph, toRoman } from '../glyphs';

export const dynamic = 'force-dynamic';

export default async function GameMapPage({ params }: { params: Promise<{ id: string }> }) {
  const { userId } = await requireUser();
  const { id } = await params;

  const [game] = await db.select().from(games).where(eq(games.id, id)).limit(1);
  if (!game) notFound();

  const rooms = await db
    .select()
    .from(gameRooms)
    .where(eq(gameRooms.gameId, id))
    .orderBy(asc(gameRooms.roomIndex));

  const playerOrder = game.playerOrder as string[];
  const players = await db
    .select({ id: users.id, displayName: users.displayName, avatarEmoji: users.avatarEmoji })
    .from(users)
    .where(inArray(users.id, playerOrder));
  const byId = new Map(players.map((p) => [p.id, p]));

  const complete = game.status === 'complete';
  const currentRoom = rooms.find((r) => r.status === 'current') ?? null;
  const yourTurn = !complete && currentRoom?.playerId === userId;
  const currentPlayer = currentRoom ? byId.get(currentRoom.playerId) : null;

  return (
    <main className="grim-page">
      <div className="grim-bar">
        <Link href="/" className="grim-back">‹</Link>
        <span className="grim-title">{game.title}</span>
        <span className="grim-crumb">
          {complete ? 'Complete' : `Room ${toRoman((currentRoom?.roomIndex ?? 0) + 1)} · ${toRoman(game.roomCount)}`}
        </span>
      </div>

      {complete ? (
        <>
          <div className="banner">
            <div className="k">✦ The dungeon is cleared ✦</div>
            <div className="v">
              Song complete
              <small>
                {game.roomCount} layers, {playerOrder.length} bards, one cursed groove
              </small>
            </div>
          </div>
          <Link href={`/songs/${game.songId}`} className="gbtn rite">
            ▶︎ Hear the finished song
          </Link>
        </>
      ) : yourTurn ? (
        <>
          <div className="banner">
            <div className="k">✦ It is your turn ✦</div>
            <div className="v">
              Enter Room {toRoman((currentRoom?.roomIndex ?? 0) + 1)}
              <small>Descend into the crypt and face what it deals you</small>
            </div>
          </div>
          <Link href={`/games/${game.id}/room`} className="gbtn rite">
            <SwordsGlyph size={20} stroke="#f2ede3" /> Enter the Room
          </Link>
        </>
      ) : (
        <div className="banner">
          <div className="k">✦ The crypt waits ✦</div>
          <div className="v">
            {currentPlayer ? `${currentPlayer.displayName}'s turn` : 'Awaiting a bard'}
            <small>Room {toRoman((currentRoom?.roomIndex ?? 0) + 1)} of {toRoman(game.roomCount)} — you will be summoned</small>
          </div>
        </div>
      )}

      <div className="ornament" />
      <div className="section-label">
        The Dungeon · <b>{toRoman(game.roomCount)}</b> Rooms
      </div>

      {rooms.map((r) => {
        const p = byId.get(r.playerId);
        const roman = toRoman(r.roomIndex + 1);
        const curse = curseById(r.curseId);
        const isYou = r.playerId === userId;
        return (
          <div key={r.id} className={`room ${r.status}`}>
            <div className="arch">
              <span className={`roman${roman.length > 2 ? ' long' : ''}`}>{roman}</span>
            </div>
            <div className="body">
              <div className="rm-title">Room {roman}</div>
              <div className="rm-sub">
                {r.status === 'pending' ? (
                  <span>
                    Awaiting {p?.displayName ?? '?'}
                    {isYou ? ' (you)' : ''} · fate unrevealed…
                  </span>
                ) : r.status === 'current' ? (
                  // What the room dealt stays hidden until it's locked —
                  // the reveal belongs to the player inside the room.
                  <span className="who">
                    <span className="med">{initials(p?.displayName ?? '?')}</span> {p?.displayName ?? '?'}
                    {isYou ? ' — your turn · the Room holds its secrets' : ' is inside · fate undisclosed…'}
                  </span>
                ) : (
                  <>
                    <span className="who">
                      <span className="med">{initials(p?.displayName ?? '?')}</span> {p?.displayName ?? '?'}
                    </span>
                    <span className="chip">
                      <i className={`sw ${CHANNEL_PATTERNS[r.channelId] ?? ''}`} />
                      {CHANNEL_NAMES[r.channelId] ?? `Ch ${r.channelId}`}
                    </span>
                    {curse && (
                      <span className="chip curse">
                        <SkullGlyph size={11} /> {curse.name}
                      </span>
                    )}
                  </>
                )}
              </div>
            </div>
            {r.status === 'locked' && <LockGlyph size={24} stroke="rgba(242,237,227,.75)" />}
            {r.status === 'current' && <LockGlyph size={24} stroke="#f2ede3" open />}
          </div>
        );
      })}
    </main>
  );
}
