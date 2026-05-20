import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/db/client';
import { sections as sectionsTable, takes } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { storage } from '@/storage';
import { resolveSlotContext, listTakesForSlot } from '@/lib/takeQueries';
import { emitTakeAdded } from '@/lib/activity';

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
  if (!ct.includes('multipart/form-data')) {
    return NextResponse.json({ error: 'expected multipart/form-data' }, { status: 400 });
  }

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
  const notes = String(form.get('notes') ?? '').trim() || null;
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
      notes,
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
