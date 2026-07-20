import { notFound, redirect } from 'next/navigation';
import { requireUser } from '@/components/shared/AuthGate';
import { db } from '@/db/client';
import { games, gameRooms, songs, users } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { normalizeSequencerState } from '@/lib/sequencerState';
import { isRingState, normalizeRingState } from '@/lib/ringState';
import { curseById } from '@/lib/curses';
import { CHANNEL_NAMES, playerForRoom } from '@/lib/gameLogic';
import { GameRoomClient } from './GameRoomClient';

export const dynamic = 'force-dynamic';

export default async function GameRoomPage({ params }: { params: Promise<{ id: string }> }) {
  const { userId } = await requireUser();
  const { id } = await params;

  const [game] = await db.select().from(games).where(eq(games.id, id)).limit(1);
  if (!game) notFound();
  if (game.status !== 'active') redirect(`/games/${id}`);

  const [room] = await db
    .select()
    .from(gameRooms)
    .where(and(eq(gameRooms.gameId, id), eq(gameRooms.status, 'current')))
    .limit(1);
  // Only the current room's player may enter; everyone else watches the map.
  if (!room || room.playerId !== userId) redirect(`/games/${id}`);

  const [song] = await db
    .select({ sequencerData: songs.sequencerData })
    .from(songs)
    .where(eq(songs.id, game.songId))
    .limit(1);
  if (!song) notFound();

  const curse = curseById(room.curseId);
  if (!curse) redirect(`/games/${id}`); // current room must have a dealt curse

  const playerOrder = game.playerOrder as string[];
  let nextPlayer: { displayName: string; avatarEmoji: string } | null = null;
  if (room.roomIndex + 1 < game.roomCount) {
    const nextId = playerForRoom(room.roomIndex + 1, playerOrder);
    const [np] = await db
      .select({ displayName: users.displayName, avatarEmoji: users.avatarEmoji })
      .from(users)
      .where(eq(users.id, nextId))
      .limit(1);
    nextPlayer = np ?? null;
  }

  return (
    <GameRoomClient
      gameId={game.id}
      gameTitle={game.title}
      roomIndex={room.roomIndex}
      roomCount={game.roomCount}
      channelId={room.channelId}
      channelName={CHANNEL_NAMES[room.channelId] ?? `Channel ${room.channelId}`}
      curse={curse}
      initialState={
        isRingState(song.sequencerData)
          ? normalizeRingState(song.sequencerData)
          : normalizeSequencerState(song.sequencerData)
      }
      nextPlayer={nextPlayer}
    />
  );
}
