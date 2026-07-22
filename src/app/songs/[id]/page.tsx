import { notFound } from 'next/navigation';
import { requireUser } from '@/components/shared/AuthGate';
import { db } from '@/db/client';
import { games, gameRooms, songs, users } from '@/db/schema';
import { asc, eq, inArray } from 'drizzle-orm';
import { SongPageClient } from './SongPageClient';
import { RingSongView } from './RingSongView';
import { normalizeSequencerState } from '@/lib/sequencerState';
import { isRingState, normalizeRingState } from '@/lib/ringState';
import { curseById } from '@/lib/curses';
import { CHANNEL_NAMES } from '@/lib/gameLogic';
import { toRoman } from '../../games/glyphs';

export const dynamic = 'force-dynamic';

export default async function SongPage({ params }: { params: Promise<{ id: string }> }) {
  const { userId } = await requireUser();
  const { id } = await params;
  const [row] = await db
    .select({
      id: songs.id,
      title: songs.title,
      sequencerData: songs.sequencerData,
      createdBy: songs.createdBy,
      creatorName: users.displayName,
      creatorAvatar: users.avatarEmoji,
    })
    .from(songs)
    .innerJoin(users, eq(users.id, songs.createdBy))
    .where(eq(songs.id, id))
    .limit(1);
  if (!row) notFound();

  // A game-backed song is read-only for EVERYONE here, owner included — the
  // only write path is the game's turn API. Without this the owner's autosave
  // would hammer the song PATCH's 409 guard in a retry loop.
  const [game] = await db.select({ id: games.id }).from(games).where(eq(games.songId, id)).limit(1);
  const isOwner = !game && row.createdBy === userId;

  // Dungeon songs composed in the Ritual Ring get the ring listen-view; the
  // only write path for them is the game's turn API, so it's always read-only.
  if (isRingState(row.sequencerData)) {
    // The chronicle: who forged which layer under which curse. Only SEALED
    // rooms are credited — an in-progress room's cards stay secret, exactly
    // as on the map.
    let credits: Array<{
      roman: string;
      player: string;
      avatar: string;
      track: string;
      curse: string | null;
      rule: string | null;
    }> = [];
    if (game) {
      const roomsList = await db
        .select()
        .from(gameRooms)
        .where(eq(gameRooms.gameId, game.id))
        .orderBy(asc(gameRooms.roomIndex));
      const locked = roomsList.filter((r) => r.status === 'locked');
      const ids = [...new Set(locked.map((r) => r.playerId))];
      const players = ids.length
        ? await db
            .select({ id: users.id, displayName: users.displayName, avatarEmoji: users.avatarEmoji })
            .from(users)
            .where(inArray(users.id, ids))
        : [];
      const byId = new Map(players.map((p) => [p.id, p]));
      credits = locked.map((r) => {
        const p = byId.get(r.playerId);
        const c = curseById(r.curseId);
        return {
          roman: toRoman(r.roomIndex + 1),
          player: p?.displayName ?? '?',
          avatar: p?.avatarEmoji ?? '',
          track: CHANNEL_NAMES[r.channelId] ?? `Ch ${r.channelId}`,
          curse: c?.name ?? null,
          rule: c?.rule ?? null,
        };
      });
    }
    return (
      <RingSongView
        title={row.title}
        initialState={normalizeRingState(row.sequencerData)}
        creator={{ displayName: row.creatorName, avatarEmoji: row.creatorAvatar }}
        credits={credits}
      />
    );
  }

  return (
    <SongPageClient
      songId={row.id}
      title={row.title}
      initialState={normalizeSequencerState(row.sequencerData)}
      isOwner={isOwner}
      creator={{ displayName: row.creatorName, avatarEmoji: row.creatorAvatar }}
    />
  );
}
