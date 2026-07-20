import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireUser } from '@/components/shared/AuthGate';
import { db } from '@/db/client';
import { games, gameRooms, users } from '@/db/schema';
import { asc, eq, inArray } from 'drizzle-orm';
import { curseById } from '@/lib/curses';
import { CHANNEL_NAMES } from '@/lib/gameLogic';
import { CHANNEL_PATTERNS, initials, LockGlyph, SkullGlyph, SwordsGlyph, toRoman } from '../glyphs';
import { DeleteGameButton } from './DeleteGameButton';

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
      ) : yourTurn && currentRoom ? (
        // The next room and the enter action are ONE element: tap the door.
        <Link href={`/games/${game.id}/room`} className="door enterable">
          <span className="door-label">
            <span className="k">✦ It is your turn ✦</span>
            <span className="v">Room <span className="rn">{toRoman(currentRoom.roomIndex + 1)}</span> awaits</span>
          </span>
          <span className="door-frame">
            <span className={`door-numeral${toRoman(currentRoom.roomIndex + 1).length > 2 ? ' long' : ''}`}>
              {toRoman(currentRoom.roomIndex + 1)}
            </span>
            <span className="door-keeper">the Room holds its secrets</span>
          </span>
          <span className="door-plate">
            <SwordsGlyph size={18} stroke="#f2ede3" /> Enter the Room
          </span>
        </Link>
      ) : currentRoom ? (
        <div className="door">
          <span className="door-label">
            <span className="k">✦ The crypt is occupied ✦</span>
            <span className="v">Room <span className="rn">{toRoman(currentRoom.roomIndex + 1)}</span></span>
            <small>
              {currentPlayer ? `${currentPlayer.displayName} is inside — you will be summoned` : 'Awaiting a bard'}
            </small>
          </span>
          <span className="door-frame">
            <span className={`door-numeral${toRoman(currentRoom.roomIndex + 1).length > 2 ? ' long' : ''}`}>
              {toRoman(currentRoom.roomIndex + 1)}
            </span>
            <span className="door-keeper">
              {currentPlayer && <span className="med">{initials(currentPlayer.displayName)}</span>}
              fate undisclosed…
            </span>
          </span>
        </div>
      ) : null}

      <div className="ornament" />
      <div className="section-label">
        The Dungeon · <b>{toRoman(game.roomCount)}</b> Rooms
      </div>

      {rooms.filter((r) => complete || r.status !== 'current').map((r) => {
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

      {game.createdBy === userId && <DeleteGameButton gameId={game.id} />}
    </main>
  );
}
