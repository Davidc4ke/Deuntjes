import { db } from '@/db/client';
import {
  drumKitPads,
  drumKits,
  sections as sectionsTable,
  slots as slotsTable,
  songVersions,
  songs,
  takes,
  SLOT_KINDS,
} from '@/db/schema';
import { and, count, eq, inArray } from 'drizzle-orm';
import { GM_DRUM_PADS } from './gmDrums';

export type SectionInput = { name: string; startBar: number; lengthBars: number };

export function validateSections(sections: SectionInput[], barCount: number): string | null {
  if (sections.length === 0) return 'sections required';
  let cursor = 0;
  for (const s of sections) {
    if (!s.name || !s.name.trim()) return 'section name required';
    if (!Number.isInteger(s.startBar) || s.startBar !== cursor)
      return 'sections must be contiguous starting at bar 0';
    if (!Number.isInteger(s.lengthBars) || s.lengthBars < 1)
      return 'section length must be >= 1';
    cursor += s.lengthBars;
  }
  if (cursor !== barCount) return `sections must total ${barCount} bars (got ${cursor})`;
  return null;
}

export type CreateSongInput = {
  title: string;
  createdBy: string;
  tempoBpm: number;
  keyRoot: string;
  keyMode: string;
  timeSigNum: number;
  timeSigDen: number;
  barCount: number;
  sections: SectionInput[];
};

export async function createSongWithV1(input: CreateSongInput) {
  return db.transaction(async (tx) => {
    const [song] = await tx
      .insert(songs)
      .values({ title: input.title, createdBy: input.createdBy })
      .returning();

    const [version] = await tx
      .insert(songVersions)
      .values({
        songId: song.id,
        versionNumber: 1,
        label: 'initial',
        tempoBpm: input.tempoBpm,
        keyRoot: input.keyRoot,
        keyMode: input.keyMode,
        timeSigNum: input.timeSigNum,
        timeSigDen: input.timeSigDen,
        barCount: input.barCount,
        createdBy: input.createdBy,
      })
      .returning();

    if (input.sections.length > 0) {
      await tx.insert(sectionsTable).values(
        input.sections.map((s, idx) => ({
          songVersionId: version.id,
          name: s.name,
          startBar: s.startBar,
          lengthBars: s.lengthBars,
          orderIdx: idx,
        })),
      );
    }

    await tx
      .insert(slotsTable)
      .values(SLOT_KINDS.map((kind) => ({ songVersionId: version.id, kind })));

    const [kit] = await tx
      .insert(drumKits)
      .values({ songVersionId: version.id })
      .returning();

    await tx.insert(drumKitPads).values(
      GM_DRUM_PADS.map((p, idx) => ({
        drumKitId: kit.id,
        label: p.label,
        midiNote: p.midiNote,
        orderIdx: idx,
      })),
    );

    return { song, version };
  });
}

export type ForkOverrides = {
  keyRoot?: string;
  keyMode?: string;
  timeSigNum?: number;
  timeSigDen?: number;
  barCount?: number;
  sections?: SectionInput[];
};

export async function forkVersion(opts: {
  fromVersionId: string;
  songId: string;
  label: string;
  overrides: ForkOverrides;
  createdBy: string;
}) {
  return db.transaction(async (tx) => {
    const [parent] = await tx
      .select()
      .from(songVersions)
      .where(eq(songVersions.id, opts.fromVersionId))
      .limit(1);
    if (!parent || parent.songId !== opts.songId) {
      throw new Error('version not found');
    }

    const existingVersions = await tx
      .select({ n: songVersions.versionNumber })
      .from(songVersions)
      .where(eq(songVersions.songId, opts.songId));
    const nextNumber =
      existingVersions.reduce((m, v) => (v.n > m ? v.n : m), 0) + 1;

    const [child] = await tx
      .insert(songVersions)
      .values({
        songId: opts.songId,
        versionNumber: nextNumber,
        parentVersionId: parent.id,
        label: opts.label,
        tempoBpm: parent.tempoBpm,
        keyRoot: opts.overrides.keyRoot ?? parent.keyRoot,
        keyMode: opts.overrides.keyMode ?? parent.keyMode,
        timeSigNum: opts.overrides.timeSigNum ?? parent.timeSigNum,
        timeSigDen: opts.overrides.timeSigDen ?? parent.timeSigDen,
        barCount: opts.overrides.barCount ?? parent.barCount,
        createdBy: opts.createdBy,
      })
      .returning();

    const nextSections =
      opts.overrides.sections ??
      (
        await tx
          .select()
          .from(sectionsTable)
          .where(eq(sectionsTable.songVersionId, parent.id))
          .orderBy(sectionsTable.orderIdx)
      ).map((s) => ({ name: s.name, startBar: s.startBar, lengthBars: s.lengthBars }));

    if (nextSections.length > 0) {
      await tx.insert(sectionsTable).values(
        nextSections.map((s, idx) => ({
          songVersionId: child.id,
          name: s.name,
          startBar: s.startBar,
          lengthBars: s.lengthBars,
          orderIdx: idx,
        })),
      );
    }

    await tx
      .insert(slotsTable)
      .values(SLOT_KINDS.map((kind) => ({ songVersionId: child.id, kind })));

    const parentKit = await tx
      .select()
      .from(drumKits)
      .where(eq(drumKits.songVersionId, parent.id))
      .limit(1);

    const [newKit] = await tx
      .insert(drumKits)
      .values({ songVersionId: child.id })
      .returning();

    let padsToCopy: { label: string; midiNote: number }[] = GM_DRUM_PADS.map((p) => ({
      label: p.label,
      midiNote: p.midiNote,
    }));
    if (parentKit[0]) {
      const parentPads = await tx
        .select()
        .from(drumKitPads)
        .where(eq(drumKitPads.drumKitId, parentKit[0].id))
        .orderBy(drumKitPads.orderIdx);
      if (parentPads.length > 0) {
        padsToCopy = parentPads.map((p) => ({ label: p.label, midiNote: p.midiNote }));
      }
    }

    await tx.insert(drumKitPads).values(
      padsToCopy.map((p, idx) => ({
        drumKitId: newKit.id,
        label: p.label,
        midiNote: p.midiNote,
        orderIdx: idx,
      })),
    );

    return child;
  });
}

export async function countTakesInVersion(versionId: string) {
  const slotIds = await db
    .select({ id: slotsTable.id })
    .from(slotsTable)
    .where(eq(slotsTable.songVersionId, versionId));
  if (slotIds.length === 0) return 0;
  const [row] = await db
    .select({ c: count() })
    .from(takes)
    .where(
      inArray(
        takes.slotId,
        slotIds.map((s) => s.id),
      ),
    );
  return row?.c ?? 0;
}

export async function countDrumTakesInVersion(versionId: string) {
  const drumSlot = await db
    .select({ id: slotsTable.id })
    .from(slotsTable)
    .where(and(eq(slotsTable.songVersionId, versionId), eq(slotsTable.kind, 'drums')))
    .limit(1);
  if (drumSlot.length === 0) return 0;
  const [row] = await db
    .select({ c: count() })
    .from(takes)
    .where(eq(takes.slotId, drumSlot[0].id));
  return row?.c ?? 0;
}
