import { db } from '@/db/client';
import {
  mixSelections,
  mixes,
  sections as sectionsTable,
  slots as slotsTable,
  songVersions,
  songs,
  takes,
  users,
} from '@/db/schema';
import { and, asc, eq } from 'drizzle-orm';

export type TakeRow = {
  id: string;
  slotId: string;
  sectionId: string | null;
  parentTakeId: string | null;
  name: string;
  notes: string | null;
  source: 'native' | 'uploaded';
  midiPath: string | null;
  createdAt: Date;
  createdBy: {
    id: string;
    displayName: string;
    avatarEmoji: string;
  };
};

export async function getTakeWithAuthor(takeId: string): Promise<TakeRow | null> {
  const [row] = await db
    .select({
      id: takes.id,
      slotId: takes.slotId,
      sectionId: takes.sectionId,
      parentTakeId: takes.parentTakeId,
      name: takes.name,
      notes: takes.notes,
      source: takes.source,
      midiPath: takes.midiPath,
      createdAt: takes.createdAt,
      authorId: users.id,
      authorName: users.displayName,
      authorEmoji: users.avatarEmoji,
    })
    .from(takes)
    .innerJoin(users, eq(users.id, takes.createdBy))
    .where(eq(takes.id, takeId))
    .limit(1);
  if (!row) return null;
  return {
    id: row.id,
    slotId: row.slotId,
    sectionId: row.sectionId,
    parentTakeId: row.parentTakeId,
    name: row.name,
    notes: row.notes,
    source: row.source,
    midiPath: row.midiPath,
    createdAt: row.createdAt,
    createdBy: {
      id: row.authorId,
      displayName: row.authorName,
      avatarEmoji: row.authorEmoji,
    },
  };
}

export async function resolveTakeContext(takeId: string) {
  const [row] = await db
    .select({
      take: takes,
      slot: slotsTable,
      version: songVersions,
      song: songs,
    })
    .from(takes)
    .innerJoin(slotsTable, eq(slotsTable.id, takes.slotId))
    .innerJoin(songVersions, eq(songVersions.id, slotsTable.songVersionId))
    .innerJoin(songs, eq(songs.id, songVersions.songId))
    .where(eq(takes.id, takeId))
    .limit(1);
  return row ?? null;
}

export async function resolveSlotContext(slotId: string) {
  const [row] = await db
    .select({
      slot: slotsTable,
      version: songVersions,
      song: songs,
    })
    .from(slotsTable)
    .innerJoin(songVersions, eq(songVersions.id, slotsTable.songVersionId))
    .innerJoin(songs, eq(songs.id, songVersions.songId))
    .where(eq(slotsTable.id, slotId))
    .limit(1);
  return row ?? null;
}

export async function listTakesForSlot(slotId: string): Promise<TakeRow[]> {
  const rows = await db
    .select({
      id: takes.id,
      slotId: takes.slotId,
      sectionId: takes.sectionId,
      parentTakeId: takes.parentTakeId,
      name: takes.name,
      notes: takes.notes,
      source: takes.source,
      midiPath: takes.midiPath,
      createdAt: takes.createdAt,
      authorId: users.id,
      authorName: users.displayName,
      authorEmoji: users.avatarEmoji,
    })
    .from(takes)
    .innerJoin(users, eq(users.id, takes.createdBy))
    .where(eq(takes.slotId, slotId))
    .orderBy(asc(takes.createdAt));
  return rows.map((row) => ({
    id: row.id,
    slotId: row.slotId,
    sectionId: row.sectionId,
    parentTakeId: row.parentTakeId,
    name: row.name,
    notes: row.notes,
    source: row.source,
    midiPath: row.midiPath,
    createdAt: row.createdAt,
    createdBy: {
      id: row.authorId,
      displayName: row.authorName,
      avatarEmoji: row.authorEmoji,
    },
  }));
}

/**
 * Count how many mix_selections reference this take.
 */
export async function countMixReferences(takeId: string): Promise<number> {
  const rows = await db
    .select({ mixId: mixSelections.mixId })
    .from(mixSelections)
    .where(eq(mixSelections.takeId, takeId));
  return rows.length;
}

export async function getActiveMixIdForVersion(versionId: string): Promise<string | null> {
  const [v] = await db
    .select({ activeMixId: songVersions.activeMixId })
    .from(songVersions)
    .where(eq(songVersions.id, versionId))
    .limit(1);
  return v?.activeMixId ?? null;
}

export async function listMixSelections(mixId: string) {
  return db.select().from(mixSelections).where(eq(mixSelections.mixId, mixId));
}

export async function listMixesForVersion(versionId: string) {
  return db
    .select({
      id: mixes.id,
      name: mixes.name,
      createdAt: mixes.createdAt,
      createdBy: mixes.createdBy,
    })
    .from(mixes)
    .where(eq(mixes.songVersionId, versionId))
    .orderBy(asc(mixes.createdAt));
}

export async function listSectionsForVersion(versionId: string) {
  return db
    .select()
    .from(sectionsTable)
    .where(eq(sectionsTable.songVersionId, versionId))
    .orderBy(asc(sectionsTable.orderIdx));
}

export async function listSlotsForVersion(versionId: string) {
  return db.select().from(slotsTable).where(eq(slotsTable.songVersionId, versionId));
}

export async function upsertActiveMix(versionId: string, mixId: string | null) {
  await db
    .update(songVersions)
    .set({ activeMixId: mixId })
    .where(eq(songVersions.id, versionId));
}

export async function getMixWithVersion(mixId: string) {
  const [row] = await db
    .select({ mix: mixes, version: songVersions, song: songs })
    .from(mixes)
    .innerJoin(songVersions, eq(songVersions.id, mixes.songVersionId))
    .innerJoin(songs, eq(songs.id, songVersions.songId))
    .where(eq(mixes.id, mixId))
    .limit(1);
  return row ?? null;
}

export async function findSlotByKindAndVersion(versionId: string, kind: string) {
  const [row] = await db
    .select()
    .from(slotsTable)
    .where(and(eq(slotsTable.songVersionId, versionId), eq(slotsTable.kind, kind as never)))
    .limit(1);
  return row ?? null;
}
