import { notFound } from 'next/navigation';
import { requireUser } from '@/components/shared/AuthGate';
import { AppBar } from '@/components/app/AppBar';
import { VersionPicker } from '@/components/app/VersionPicker';
import { SongClient } from '@/components/song/SongClient';
import { db } from '@/db/client';
import {
  drumKitPads,
  drumKits,
  mixSelections,
  mixes,
  sections as sectionsTable,
  slots as slotsTable,
  songVersions,
  songs,
  takes,
  users,
} from '@/db/schema';
import { asc, eq, inArray } from 'drizzle-orm';
import type { SongData, Take } from '@/components/song/types';
import type { SlotKind } from '@/db/schema';

export const dynamic = 'force-dynamic';

export default async function SongVersionView({
  params,
}: {
  params: Promise<{ id: string; versionId: string }>;
}) {
  await requireUser();
  const { id, versionId } = await params;

  const [song] = await db.select().from(songs).where(eq(songs.id, id)).limit(1);
  if (!song) notFound();

  const versions = await db
    .select({
      id: songVersions.id,
      versionNumber: songVersions.versionNumber,
      label: songVersions.label,
      tempoBpm: songVersions.tempoBpm,
      keyRoot: songVersions.keyRoot,
      keyMode: songVersions.keyMode,
      timeSigNum: songVersions.timeSigNum,
      timeSigDen: songVersions.timeSigDen,
      barCount: songVersions.barCount,
      activeMixId: songVersions.activeMixId,
      songId: songVersions.songId,
    })
    .from(songVersions)
    .where(eq(songVersions.songId, id))
    .orderBy(asc(songVersions.versionNumber));

  const current = versions.find((v) => v.id === versionId);
  if (!current) notFound();

  const sectionRows = await db
    .select()
    .from(sectionsTable)
    .where(eq(sectionsTable.songVersionId, versionId))
    .orderBy(asc(sectionsTable.orderIdx));

  const slotRows = await db
    .select()
    .from(slotsTable)
    .where(eq(slotsTable.songVersionId, versionId));

  const slotIds = slotRows.map((s) => s.id);

  const takeRows =
    slotIds.length === 0
      ? []
      : await db
          .select({
            id: takes.id,
            slotId: takes.slotId,
            sectionId: takes.sectionId,
            parentTakeId: takes.parentTakeId,
            name: takes.name,
            notes: takes.notes,
            source: takes.source,
            createdAt: takes.createdAt,
            authorId: users.id,
            authorName: users.displayName,
            authorEmoji: users.avatarEmoji,
          })
          .from(takes)
          .innerJoin(users, eq(users.id, takes.createdBy))
          .where(inArray(takes.slotId, slotIds))
          .orderBy(asc(takes.createdAt));

  const mixRows = await db
    .select()
    .from(mixes)
    .where(eq(mixes.songVersionId, versionId))
    .orderBy(asc(mixes.createdAt));

  const mixSelectionRows =
    mixRows.length === 0
      ? []
      : await db
          .select()
          .from(mixSelections)
          .where(
            inArray(
              mixSelections.mixId,
              mixRows.map((m) => m.id),
            ),
          );

  const [kit] = await db
    .select()
    .from(drumKits)
    .where(eq(drumKits.songVersionId, versionId))
    .limit(1);
  const pads = kit
    ? await db
        .select()
        .from(drumKitPads)
        .where(eq(drumKitPads.drumKitId, kit.id))
        .orderBy(asc(drumKitPads.orderIdx))
    : [];

  const takeList: Take[] = takeRows.map((r) => ({
    id: r.id,
    slotId: r.slotId,
    sectionId: r.sectionId,
    parentTakeId: r.parentTakeId,
    name: r.name,
    notes: r.notes,
    source: r.source,
    createdAt: r.createdAt.toISOString(),
    createdBy: {
      id: r.authorId,
      displayName: r.authorName,
      avatarEmoji: r.authorEmoji,
    },
  }));

  const data: SongData = {
    song: { id: song.id, title: song.title },
    version: {
      id: current.id,
      versionNumber: current.versionNumber,
      label: current.label,
      tempoBpm: current.tempoBpm,
      keyRoot: current.keyRoot,
      keyMode: current.keyMode,
      timeSigNum: current.timeSigNum,
      timeSigDen: current.timeSigDen,
      barCount: current.barCount,
      activeMixId: current.activeMixId,
    },
    sections: sectionRows.map((s) => ({
      id: s.id,
      name: s.name,
      startBar: s.startBar,
      lengthBars: s.lengthBars,
      orderIdx: s.orderIdx,
    })),
    slots: slotRows.map((s) => ({ id: s.id, kind: s.kind as SlotKind })),
    takes: takeList,
    mixes: mixRows.map((m) => ({
      id: m.id,
      name: m.name,
      selections: mixSelectionRows
        .filter((s) => s.mixId === m.id)
        .map((s) => ({ slotId: s.slotId, sectionId: s.sectionId, takeId: s.takeId })),
    })),
    drumPads: pads.map((p) => ({ midiNote: p.midiNote, label: p.label })),
  };

  return (
    <>
      <AppBar
        back="/"
        title={
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              minWidth: 0,
              flex: 1,
            }}
          >
            <span
              style={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                maxWidth: 160,
              }}
            >
              {song.title}
            </span>
            <VersionPicker
              songId={id}
              currentId={versionId}
              versions={versions.map((v) => ({
                id: v.id,
                versionNumber: v.versionNumber,
                label: v.label,
              }))}
            />
          </span>
        }
      />
      <main className="page">
        <SongClient data={data} canDelete={versions.length > 1} />
      </main>
    </>
  );
}
