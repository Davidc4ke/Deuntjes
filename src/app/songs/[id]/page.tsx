import { notFound } from 'next/navigation';
import { requireUser } from '@/components/shared/AuthGate';
import { db } from '@/db/client';
import { games, songs, users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { SongPageClient } from './SongPageClient';
import { normalizeSequencerState } from '@/lib/sequencerState';

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
