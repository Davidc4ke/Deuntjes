import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/db/client';
import { sections as sectionsTable, takes } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { storage } from '@/storage';
import { resolveSlotContext, listTakesForSlot } from '@/lib/takeQueries';
import { emitTakeAdded } from '@/lib/activity';
import { renderChordPayload, validateChordPayload } from '@/lib/render/chordTake';
import { renderTrackerPayload, validateTrackerPayload } from '@/lib/render/trackerTake';
import { buildNativeMidi, midiToBuffer } from '@/lib/render/nativeMidi';
import type { SlotKind } from '@/db/schema';

const MAX_MIDI_BYTES = 2 * 1024 * 1024; // 2 MB

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { id } = await params;
  const slotCtx = await resolveSlotContext(id);
  if (!slotCtx) return NextResponse.json({ error: 'slot not found' }, { status: 404 });

  const list = await listTakesForSlot(id);
  return NextResponse.json({
    takes: list.map((t) => ({
      id: t.id,
      name: t.name,
      notes: t.notes,
      source: t.source,
      sectionId: t.sectionId,
      parentTakeId: t.parentTakeId,
      createdAt: t.createdAt,
      createdBy: t.createdBy,
    })),
  });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { id: slotId } = await params;
  const slotCtx = await resolveSlotContext(slotId);
  if (!slotCtx) return NextResponse.json({ error: 'slot not found' }, { status: 404 });

  const ct = req.headers.get('content-type') ?? '';
  if (ct.includes('application/json')) {
    return handleNativeTake(req, { slotId, slotCtx, userId });
  }
  if (ct.includes('multipart/form-data')) {
    return handleUploadedTake(req, { slotId, slotCtx, userId });
  }
  return NextResponse.json(
    { error: 'expected multipart/form-data or application/json' },
    { status: 400 },
  );
}

type SlotCtx = NonNullable<Awaited<ReturnType<typeof resolveSlotContext>>>;

async function handleNativeTake(
  req: Request,
  { slotId, slotCtx, userId }: { slotId: string; slotCtx: SlotCtx; userId: string },
) {
  const slotKind = slotCtx.slot.kind as SlotKind;
  if (slotKind !== 'chords' && slotKind !== 'melody' && slotKind !== 'bass') {
    return NextResponse.json(
      { error: `native takes for ${slotKind} are not supported yet` },
      { status: 400 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  const name = String(body.name ?? '').trim() || 'Untitled';
  const notes = typeof body.notes === 'string' ? body.notes.trim() || null : null;
  const parentTakeId =
    typeof body.parent_take_id === 'string' && body.parent_take_id.length > 0
      ? body.parent_take_id
      : null;

  const sectionInfo = await resolveSection(body.section_id, slotCtx);
  if ('error' in sectionInfo) {
    return NextResponse.json({ error: sectionInfo.error }, { status: 400 });
  }
  const { sectionId, sectionName, scopedBars } = sectionInfo;

  const payloadRaw = body.payload_json;
  if (slotKind === 'chords') {
    const v = validateChordPayload(payloadRaw, {
      timeSigNum: slotCtx.version.timeSigNum,
      timeSigDen: slotCtx.version.timeSigDen,
      totalBars: scopedBars,
    });
    if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });

    const notesEv = renderChordPayload(v.payload, slotCtx.version.timeSigNum, slotCtx.version.timeSigDen);
    const midi = buildNativeMidi({
      slot: 'chords',
      notes: notesEv,
      tempoBpm: slotCtx.version.tempoBpm,
      timeSigNum: slotCtx.version.timeSigNum,
      timeSigDen: slotCtx.version.timeSigDen,
    });

    return await persistNativeTake({
      slotId,
      slotCtx,
      userId,
      name,
      notes,
      parentTakeId,
      sectionId,
      sectionName,
      payloadJson: v.payload as unknown as Record<string, unknown>,
      granularity: null,
      midiBytes: midiToBuffer(midi),
      slotKind,
    });
  }

  // melody / bass tracker take
  const v = validateTrackerPayload(payloadRaw, {
    timeSigNum: slotCtx.version.timeSigNum,
    timeSigDen: slotCtx.version.timeSigDen,
    totalBars: scopedBars,
  });
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });

  const notesEv = renderTrackerPayload(v.payload, slotCtx.version.timeSigNum, slotCtx.version.timeSigDen);
  const midi = buildNativeMidi({
    slot: slotKind,
    notes: notesEv,
    tempoBpm: slotCtx.version.tempoBpm,
    timeSigNum: slotCtx.version.timeSigNum,
    timeSigDen: slotCtx.version.timeSigDen,
  });

  return await persistNativeTake({
    slotId,
    slotCtx,
    userId,
    name,
    notes,
    parentTakeId,
    sectionId,
    sectionName,
    payloadJson: v.payload as unknown as Record<string, unknown>,
    granularity: v.payload.granularity,
    midiBytes: midiToBuffer(midi),
    slotKind,
  });
}

async function persistNativeTake(opts: {
  slotId: string;
  slotCtx: SlotCtx;
  userId: string;
  name: string;
  notes: string | null;
  parentTakeId: string | null;
  sectionId: string | null;
  sectionName: string | null;
  payloadJson: Record<string, unknown>;
  granularity: number | null;
  midiBytes: Buffer;
  slotKind: SlotKind;
}) {
  const [take] = await db
    .insert(takes)
    .values({
      slotId: opts.slotId,
      sectionId: opts.sectionId,
      parentTakeId: opts.parentTakeId,
      name: opts.name,
      notes: opts.notes,
      source: 'native',
      granularity: opts.granularity,
      payloadJson: opts.payloadJson,
      createdBy: opts.userId,
    })
    .returning();

  const midiPath = `midi/${opts.slotCtx.song.id}/${opts.slotCtx.version.id}/${take.id}.mid`;
  await storage.put(midiPath, opts.midiBytes);
  await db.update(takes).set({ midiPath }).where(eq(takes.id, take.id));

  await emitTakeAdded({
    songId: opts.slotCtx.song.id,
    songVersionId: opts.slotCtx.version.id,
    userId: opts.userId,
    targetId: take.id,
    slotId: opts.slotId,
    takeName: opts.name,
    slotKind: opts.slotKind,
    sectionId: opts.sectionId,
    sectionName: opts.sectionName,
  });

  return NextResponse.json({ takeId: take.id, midiPath }, { status: 201 });
}

async function resolveSection(
  raw: unknown,
  slotCtx: SlotCtx,
): Promise<
  | { sectionId: string | null; sectionName: string | null; scopedBars: number }
  | { error: string }
> {
  if (typeof raw !== 'string' || !raw.trim()) {
    return { sectionId: null, sectionName: null, scopedBars: slotCtx.version.barCount };
  }
  const sectionId = raw.trim();
  const [section] = await db
    .select()
    .from(sectionsTable)
    .where(
      and(eq(sectionsTable.id, sectionId), eq(sectionsTable.songVersionId, slotCtx.version.id)),
    )
    .limit(1);
  if (!section) return { error: 'section does not belong to this version' };
  return { sectionId: section.id, sectionName: section.name, scopedBars: section.lengthBars };
}

async function handleUploadedTake(
  req: Request,
  { slotId, slotCtx, userId }: { slotId: string; slotCtx: SlotCtx; userId: string },
) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: 'invalid form' }, { status: 400 });
  }

  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'file required' }, { status: 400 });
  }
  if (file.size === 0) {
    return NextResponse.json({ error: 'empty file' }, { status: 400 });
  }
  if (file.size > MAX_MIDI_BYTES) {
    return NextResponse.json({ error: 'file too large' }, { status: 413 });
  }
  const fileName = file.name ?? '';
  if (!/\.(mid|midi)$/i.test(fileName)) {
    return NextResponse.json({ error: 'expected .mid file' }, { status: 400 });
  }

  const name = String(form.get('name') ?? '').trim() || fileName.replace(/\.(mid|midi)$/i, '');
  const notesField = String(form.get('notes') ?? '').trim() || null;
  const sectionIdRaw = form.get('section_id');
  let sectionId: string | null = null;
  let sectionName: string | null = null;
  if (typeof sectionIdRaw === 'string' && sectionIdRaw.trim()) {
    sectionId = sectionIdRaw.trim();
    const [section] = await db
      .select()
      .from(sectionsTable)
      .where(
        and(
          eq(sectionsTable.id, sectionId),
          eq(sectionsTable.songVersionId, slotCtx.version.id),
        ),
      )
      .limit(1);
    if (!section) {
      return NextResponse.json({ error: 'section does not belong to this version' }, { status: 400 });
    }
    sectionName = section.name;
  }

  const buf = Buffer.from(await file.arrayBuffer());

  // Quick MIDI sniff (header "MThd"). Reject non-MIDI uploads early.
  if (buf.length < 4 || buf.slice(0, 4).toString('ascii') !== 'MThd') {
    return NextResponse.json({ error: 'not a MIDI file' }, { status: 400 });
  }

  const [take] = await db
    .insert(takes)
    .values({
      slotId,
      sectionId,
      name,
      notes: notesField,
      source: 'uploaded',
      createdBy: userId,
    })
    .returning();

  const midiPath = `uploads/${slotCtx.song.id}/${slotCtx.version.id}/${take.id}.mid`;
  await storage.put(midiPath, buf);

  await db.update(takes).set({ midiPath }).where(eq(takes.id, take.id));

  await emitTakeAdded({
    songId: slotCtx.song.id,
    songVersionId: slotCtx.version.id,
    userId,
    targetId: take.id,
    slotId,
    takeName: name,
    slotKind: slotCtx.slot.kind,
    sectionId,
    sectionName,
  });

  return NextResponse.json({ takeId: take.id, midiPath }, { status: 201 });
}
