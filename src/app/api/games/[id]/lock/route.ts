import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/db/client';
import { games, gameRooms, songs } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { normalizeSequencerState } from '@/lib/sequencerState';
import { isRingState } from '@/lib/ringState';
import { CHANNEL_ALLOWED_PRESETS, validateRingTurnSave, validateTurnSave } from '@/lib/gameLogic';
import { dealCurse } from '@/lib/curses';

// Seal the current room: commit the final snapshot (if sent), mark the room
// locked, and either deal the next room or complete the game. The lock body
// carrying the final sequencerData is what closes the "debounced autosave
// still in flight" race — the client sends its latest state here.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { id } = await params;
  const [game] = await db.select().from(games).where(eq(games.id, id)).limit(1);
  if (!game) return NextResponse.json({ error: 'not found' }, { status: 404 });
  if (game.status !== 'active') return NextResponse.json({ error: 'game complete' }, { status: 409 });

  const [room] = await db
    .select()
    .from(gameRooms)
    .where(and(eq(gameRooms.gameId, id), eq(gameRooms.status, 'current')))
    .limit(1);
  if (!room) return NextResponse.json({ error: 'no current room' }, { status: 409 });
  if (room.playerId !== userId) return NextResponse.json({ error: 'not your turn' }, { status: 403 });

  const body = (await req.json().catch(() => null)) as { sequencerData?: unknown } | null;

  if (body?.sequencerData !== undefined) {
    const [song] = await db
      .select({ sequencerData: songs.sequencerData })
      .from(songs)
      .where(eq(songs.id, game.songId))
      .limit(1);
    if (!song) return NextResponse.json({ error: 'song not found' }, { status: 404 });
    const verdict = isRingState(song.sequencerData)
      ? validateRingTurnSave(song.sequencerData, body.sequencerData, room.channelId)
      : validateTurnSave(
          normalizeSequencerState(song.sequencerData),
          body.sequencerData,
          room.channelId,
          CHANNEL_ALLOWED_PRESETS[room.channelId],
        );
    if (!verdict.ok) return NextResponse.json({ error: verdict.error }, { status: 400 });
    await db
      .update(songs)
      .set({ sequencerData: verdict.state, updatedAt: new Date() })
      .where(eq(songs.id, game.songId));
  }

  const nextRoomIndex = room.roomIndex + 1;
  const complete = nextRoomIndex >= game.roomCount;

  const sealed = await db.transaction(async (tx) => {
    // Conditional update is the double-submit guard: a second lock finds the
    // room no longer 'current' and rolls back with 0 rows.
    const lockedRows = await tx
      .update(gameRooms)
      .set({ status: 'locked', lockedAt: new Date() })
      .where(and(eq(gameRooms.id, room.id), eq(gameRooms.status, 'current')))
      .returning({ id: gameRooms.id });
    if (lockedRows.length === 0) return false;

    if (complete) {
      await tx.update(games).set({ status: 'complete', updatedAt: new Date() }).where(eq(games.id, id));
    } else {
      await tx
        .update(gameRooms)
        .set({ status: 'current', curseId: dealCurse(room.curseId).id })
        .where(and(eq(gameRooms.gameId, id), eq(gameRooms.roomIndex, nextRoomIndex)));
      await tx
        .update(games)
        .set({ currentRoomIndex: nextRoomIndex, updatedAt: new Date() })
        .where(eq(games.id, id));
    }
    return true;
  });

  if (!sealed) return NextResponse.json({ error: 'already locked' }, { status: 409 });
  return NextResponse.json({ ok: true, complete, ...(complete ? {} : { nextRoomIndex }) });
}
