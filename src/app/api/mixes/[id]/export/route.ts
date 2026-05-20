import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/db/client';
import {
  drumKitPads,
  drumKits,
  mixSelections,
  sections as sectionsTable,
  slots as slotsTable,
  takes,
  users,
} from '@/db/schema';
import { asc, eq, inArray } from 'drizzle-orm';
import { storage } from '@/storage';
import { buildMixExportZip, type ExportSelection } from '@/lib/mixExport';
import { getMixWithVersion } from '@/lib/takeQueries';
import type { SlotKind } from '@/db/schema';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return new NextResponse('unauthorized', { status: 401 });

  const { id } = await params;
  const ctx = await getMixWithVersion(id);
  if (!ctx) return new NextResponse('not found', { status: 404 });

  const sections = await db
    .select()
    .from(sectionsTable)
    .where(eq(sectionsTable.songVersionId, ctx.version.id))
    .orderBy(asc(sectionsTable.orderIdx));

  const slots = await db
    .select()
    .from(slotsTable)
    .where(eq(slotsTable.songVersionId, ctx.version.id));
  const slotsById = new Map(slots.map((s) => [s.id, s]));

  const [kit] = await db
    .select()
    .from(drumKits)
    .where(eq(drumKits.songVersionId, ctx.version.id))
    .limit(1);
  const pads = kit
    ? await db
        .select()
        .from(drumKitPads)
        .where(eq(drumKitPads.drumKitId, kit.id))
        .orderBy(asc(drumKitPads.orderIdx))
    : [];

  const selectionRows = await db
    .select()
    .from(mixSelections)
    .where(eq(mixSelections.mixId, id));

  const takeIds = Array.from(new Set(selectionRows.map((s) => s.takeId)));
  const takeRows =
    takeIds.length === 0
      ? []
      : await db
          .select({
            id: takes.id,
            slotId: takes.slotId,
            sectionId: takes.sectionId,
            name: takes.name,
            notes: takes.notes,
            source: takes.source,
            payloadJson: takes.payloadJson,
            midiPath: takes.midiPath,
            authorName: users.displayName,
          })
          .from(takes)
          .innerJoin(users, eq(users.id, takes.createdBy))
          .where(inArray(takes.id, takeIds));
  const takesById = new Map(takeRows.map((t) => [t.id, t]));

  const selectionsBySlot: Partial<Record<SlotKind, Map<string | null, ExportSelection>>> = {};
  const lyricsBySectionId = new Map<string | null, string>();

  for (const sel of selectionRows) {
    const slot = slotsById.get(sel.slotId);
    const take = takesById.get(sel.takeId);
    if (!slot || !take) continue;
    if (slot.kind === 'lyrics') {
      const payload = take.payloadJson as
        | { sections?: { section_name?: string; text?: string }[] }
        | null
        | undefined;
      if (payload?.sections) {
        for (const s of payload.sections) {
          if (s.text) lyricsBySectionId.set(sel.sectionId, s.text);
        }
      }
      continue;
    }
    let midiBuf: Buffer | null = null;
    if (take.source === 'uploaded' && take.midiPath) {
      try {
        midiBuf = await storage.get(take.midiPath);
      } catch {
        midiBuf = null;
      }
    }
    if (!midiBuf) continue;
    const bucket = (selectionsBySlot[slot.kind] ??= new Map());
    bucket.set(sel.sectionId, {
      slotKind: slot.kind,
      sectionId: sel.sectionId,
      takeMidi: midiBuf,
      takeName: take.name,
      authorName: take.authorName,
      takeNotes: take.notes,
    });
  }

  const { zip, fileName } = await buildMixExportZip({
    songTitle: ctx.song.title,
    versionNumber: ctx.version.versionNumber,
    versionLabel: ctx.version.label,
    mixName: ctx.mix.name,
    tempoBpm: ctx.version.tempoBpm,
    keyRoot: ctx.version.keyRoot,
    keyMode: ctx.version.keyMode,
    timeSigNum: ctx.version.timeSigNum,
    timeSigDen: ctx.version.timeSigDen,
    barCount: ctx.version.barCount,
    sections: sections.map((s) => ({
      id: s.id,
      name: s.name,
      startBar: s.startBar,
      lengthBars: s.lengthBars,
      orderIdx: s.orderIdx,
    })),
    drumKit: pads.map((p) => ({ label: p.label, midiNote: p.midiNote })),
    selectionsBySlot,
    lyricsBySectionId,
  });

  return new NextResponse(new Uint8Array(zip), {
    status: 200,
    headers: {
      'content-type': 'application/zip',
      'content-disposition': `attachment; filename="${fileName}"`,
      'cache-control': 'private, no-store',
    },
  });
}
