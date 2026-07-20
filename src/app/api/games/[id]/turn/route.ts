import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/db/client';
import { games, gameRooms, songs } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { normalizeSequencerState } from '@/lib/sequencerState';
import { isRingState } from '@/lib/ringState';
import { CHANNEL_ALLOWED_PRESETS, validateRingTurnSave, validateTurnSave } from '@/lib/gameLogic';

// Debounced autosave target for the current player's turn. Mirrors the song
// PATCH contract ({ sequencerData } -> { ok }), but authorizes by "you are
// the current room's player" instead of song ownership, and rejects edits
// that touch any channel other than the dealt one.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
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
  if (!body || body.sequencerData === undefined) {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  }

  const [song] = await db
    .select({ sequencerData: songs.sequencerData })
    .from(songs)
    .where(eq(songs.id, game.songId))
    .limit(1);
  if (!song) return NextResponse.json({ error: 'song not found' }, { status: 404 });

  // Ring-format songs (all new dungeons) validate through the ring rules;
  // legacy grid songs keep the original validator.
  const verdict = isRingState(song.sequencerData)
    ? validateRingTurnSave(song.sequencerData, body.sequencerData, room.channelId)
    : validateTurnSave(
        normalizeSequencerState(song.sequencerData),
        body.sequencerData,
        room.channelId,
        CHANNEL_ALLOWED_PRESETS[room.channelId],
      );
  if (!verdict.ok) return NextResponse.json({ error: verdict.error }, { status: 400 });

  const now = new Date();
  await db.update(songs).set({ sequencerData: verdict.state, updatedAt: now }).where(eq(songs.id, game.songId));
  await db.update(games).set({ updatedAt: now }).where(eq(games.id, id));
  return NextResponse.json({ ok: true });
}

// navigator.sendBeacon (the unload-flush path) can only POST.
export { PATCH as POST };
