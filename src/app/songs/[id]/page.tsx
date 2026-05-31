import { notFound } from 'next/navigation';
import { requireUser } from '@/components/shared/AuthGate';
import { db } from '@/db/client';
import { songs, users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { SongPageClient } from './SongPageClient';
import { defaultSequencerState, type SequencerState } from '@/lib/sequencerState';

function normalize(raw: unknown): SequencerState {
  // Songs predating the sequencer rewrite have empty / partial blobs. Fill in
  // missing fields from the default so the editor always boots cleanly.
  const base = defaultSequencerState();
  if (!raw || typeof raw !== 'object') return base;
  const r = raw as Partial<SequencerState>;
  return {
    steps: r.steps ?? base.steps,
    notes: Array.isArray(r.notes) ? r.notes : base.notes,
    channels: Array.isArray(r.channels) && r.channels.length > 0 ? r.channels : base.channels,
    activeChannelId: r.activeChannelId ?? base.activeChannelId,
    nextChannelId: r.nextChannelId ?? base.nextChannelId,
    nextId: r.nextId ?? base.nextId,
  };
}

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

  return (
    <SongPageClient
      songId={row.id}
      title={row.title}
      initialState={normalize(row.sequencerData)}
      isOwner={row.createdBy === userId}
      creator={{ displayName: row.creatorName, avatarEmoji: row.creatorAvatar }}
    />
  );
}
