import { notFound } from 'next/navigation';
import { requireUser } from '@/components/shared/AuthGate';
import { AppBar } from '@/components/app/AppBar';
import { db } from '@/db/client';
import {
  sections as sectionsTable,
  slots as slotsTable,
  songs,
  songVersions,
  takes,
  users,
} from '@/db/schema';
import { eq } from 'drizzle-orm';
import { TakeDetailClient } from './TakeDetailClient';
import { SLOT_LABELS } from '@/components/song/types';
import type { SlotKind } from '@/db/schema';

export const dynamic = 'force-dynamic';

export default async function TakeDetailPage({
  params,
}: {
  params: Promise<{ id: string; versionId: string; slotId: string; takeId: string }>;
}) {
  await requireUser();
  const { id, versionId, slotId, takeId } = await params;

  const [row] = await db
    .select({
      take: takes,
      slot: slotsTable,
      version: songVersions,
      song: songs,
      authorId: users.id,
      authorName: users.displayName,
      authorEmoji: users.avatarEmoji,
    })
    .from(takes)
    .innerJoin(slotsTable, eq(slotsTable.id, takes.slotId))
    .innerJoin(songVersions, eq(songVersions.id, slotsTable.songVersionId))
    .innerJoin(songs, eq(songs.id, songVersions.songId))
    .innerJoin(users, eq(users.id, takes.createdBy))
    .where(eq(takes.id, takeId))
    .limit(1);
  if (!row || row.song.id !== id || row.version.id !== versionId || row.slot.id !== slotId) {
    notFound();
  }

  const section =
    row.take.sectionId !== null
      ? (
          await db
            .select()
            .from(sectionsTable)
            .where(eq(sectionsTable.id, row.take.sectionId))
            .limit(1)
        )[0] ?? null
      : null;

  return (
    <>
      <AppBar
        back={`/songs/${id}/v/${versionId}`}
        title={
          <span>
            <span style={{ marginRight: 6 }} aria-hidden>
              {row.authorEmoji}
            </span>
            {SLOT_LABELS[row.slot.kind as SlotKind]} take
          </span>
        }
      />
      <main className="page">
        <TakeDetailClient
          songId={id}
          versionId={versionId}
          slotId={slotId}
          take={{
            id: row.take.id,
            name: row.take.name,
            notes: row.take.notes,
            source: row.take.source,
            createdAt: row.take.createdAt.toISOString(),
            sectionName: section?.name ?? null,
            authorName: row.authorName,
            authorEmoji: row.authorEmoji,
          }}
          version={{
            tempoBpm: row.version.tempoBpm,
            timeSigNum: row.version.timeSigNum,
            timeSigDen: row.version.timeSigDen,
            barCount: row.version.barCount,
          }}
          slotKind={row.slot.kind as SlotKind}
        />
      </main>
    </>
  );
}
