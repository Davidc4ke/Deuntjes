import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireUser } from '@/components/shared/AuthGate';
import { db } from '@/db/client';
import { games, gameRooms, songs, users } from '@/db/schema';
import { asc } from 'drizzle-orm';
import { defaultRingSongState } from '@/lib/ringState';
import { channelForRoom, playerForRoom } from '@/lib/gameLogic';
import { dealCurse } from '@/lib/curses';
import { initials, SkullGlyph } from '../glyphs';

export const dynamic = 'force-dynamic';

const ROOM_CHOICES = [4, 8, 12, 16];

async function createGameAction(formData: FormData) {
  'use server';
  const { userId } = await requireUser();

  const title = String(formData.get('title') ?? '').trim() || 'Untitled dungeon';
  const roomCountRaw = Number(formData.get('roomCount'));
  const roomCount = ROOM_CHOICES.includes(roomCountRaw) ? roomCountRaw : 8;

  const roster = await db.select({ id: users.id }).from(users);
  const validIds = new Set(roster.map((u) => u.id));
  const picked = formData
    .getAll('players')
    .map(String)
    .filter((id) => validIds.has(id));
  // Creator always plays, and goes first.
  const playerOrder = [userId, ...picked.filter((id) => id !== userId)];
  if (playerOrder.length < 2) {
    redirect('/games/new?error=players');
  }

  const [song] = await db
    .insert(songs)
    // New dungeons compose in the Ritual Ring; the blob's format field is
    // what routes the room to the ring editor and the ring validator.
    .values({ title, createdBy: userId, sequencerData: defaultRingSongState() })
    .returning({ id: songs.id });

  const [game] = await db
    .insert(games)
    .values({ title, songId: song.id, createdBy: userId, playerOrder, roomCount })
    .returning({ id: games.id });

  await db.insert(gameRooms).values(
    Array.from({ length: roomCount }, (_, i) => ({
      gameId: game.id,
      roomIndex: i,
      playerId: playerForRoom(i, playerOrder),
      channelId: channelForRoom(i),
      // Room 0 is dealt (and playable) immediately; later rooms get their
      // curse when they become current.
      curseId: i === 0 ? dealCurse().id : null,
      status: i === 0 ? 'current' : 'pending',
    })),
  );

  redirect(`/games/${game.id}`);
}

export default async function NewGamePage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { userId } = await requireUser();
  const { error } = await searchParams;
  const roster = await db
    .select({ id: users.id, displayName: users.displayName, avatarEmoji: users.avatarEmoji })
    .from(users)
    .orderBy(asc(users.displayName));

  return (
    <main className="grim-page">
      <div className="grim-bar">
        <Link href="/" className="grim-back">‹</Link>
        <span className="grim-title">Raise a Dungeon</span>
      </div>

      <p className="deal-intro">
        Choose your fellow bards. You go first; the rest follow in turn, room by room,
        each dealt a track and a curse.
      </p>

      {error === 'players' && (
        <p className="deal-intro" style={{ color: 'var(--blood-lit)' }}>
          A dungeon needs at least two bards — pick a companion.
        </p>
      )}

      <form action={createGameAction} className="gform">
        <label className="f-label" htmlFor="title">Name of the dungeon</label>
        <input id="title" name="title" type="text" placeholder="The Crypt of Grooves" maxLength={80} />

        <label className="f-label">The circle of bards</label>
        {roster.map((u) => (
          <label key={u.id} className="player-pick">
            <input
              type="checkbox"
              name="players"
              value={u.id}
              defaultChecked={u.id === userId}
              disabled={u.id === userId}
            />
            <span className="med">{initials(u.displayName)}</span>
            <span className="pname">
              {u.avatarEmoji} {u.displayName}
            </span>
            {u.id === userId && <span className="pyou">you — first into the dark</span>}
          </label>
        ))}
        {/* disabled checkboxes don't submit; the action always includes the creator */}

        <label className="f-label" htmlFor="roomCount">Rooms in the dungeon</label>
        <select id="roomCount" name="roomCount" defaultValue="8">
          {ROOM_CHOICES.map((n) => (
            <option key={n} value={n}>
              {n} rooms
            </option>
          ))}
        </select>
        <p className="hint">Each room is one turn: one track, one curse, one bard.</p>

        <div style={{ marginTop: 26 }}>
          <button type="submit" className="gbtn rite">
            <SkullGlyph size={18} stroke="#f2ede3" eyes="#f2ede3" /> Open the gates
          </button>
          <Link href="/" className="gbtn ghost">‹ Retreat home</Link>
        </div>
      </form>
    </main>
  );
}
