import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/db/client';
import { takes } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { storage } from '@/storage';
import { resolveTakeContext } from '@/lib/takeQueries';
import { emitTakeForked } from '@/lib/activity';
import { renderChordPayload } from '@/lib/render/chordTake';
import { renderTrackerPayload } from '@/lib/render/trackerTake';
import { buildNativeMidi, midiToBuffer } from '@/lib/render/nativeMidi';
import type { SlotKind } from '@/db/schema';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { id } = await params;
  const ctx = await resolveTakeContext(id);
  if (!ctx) return NextResponse.json({ error: 'not found' }, { status: 404 });
  const parent = ctx.take;

  const body = (await req.json().catch(() => ({}))) as { name?: string; notes?: string | null };
  const name = (body.name ?? `${parent.name} (fork)`).trim() || `${parent.name} (fork)`;
  const notes = body.notes === undefined ? parent.notes : body.notes;

  const [child] = await db
    .insert(takes)
    .values({
      slotId: parent.slotId,
      sectionId: parent.sectionId,
      parentTakeId: parent.id,
      name,
      notes: notes ?? null,
      source: parent.source,
      granularity: parent.granularity,
      payloadJson: parent.payloadJson,
      createdBy: userId,
    })
    .returning();

  let newMidiPath: string | null = null;
  if (parent.source === 'uploaded' && parent.midiPath) {
    newMidiPath = `uploads/${ctx.song.id}/${ctx.version.id}/${child.id}.mid`;
    try {
      const buf = await storage.get(parent.midiPath);
      await storage.put(newMidiPath, buf);
    } catch {
      newMidiPath = null;
    }
  } else if (parent.source === 'native' && parent.payloadJson) {
    // Re-render MIDI for the cloned payload so the fork is playable / exportable.
    const slotKind = ctx.slot.kind as SlotKind;
    try {
      const notesEv =
        slotKind === 'chords'
          ? renderChordPayload(
              parent.payloadJson as Parameters<typeof renderChordPayload>[0],
              ctx.version.timeSigNum,
              ctx.version.timeSigDen,
            )
          : renderTrackerPayload(
              parent.payloadJson as Parameters<typeof renderTrackerPayload>[0],
              ctx.version.timeSigNum,
              ctx.version.timeSigDen,
            );
      const midi = buildNativeMidi({
        slot: slotKind,
        notes: notesEv,
        tempoBpm: ctx.version.tempoBpm,
        timeSigNum: ctx.version.timeSigNum,
        timeSigDen: ctx.version.timeSigDen,
      });
      newMidiPath = `midi/${ctx.song.id}/${ctx.version.id}/${child.id}.mid`;
      await storage.put(newMidiPath, midiToBuffer(midi));
    } catch {
      newMidiPath = null;
    }
  }
  if (newMidiPath) {
    await db.update(takes).set({ midiPath: newMidiPath }).where(eq(takes.id, child.id));
  }

  await emitTakeForked({
    songId: ctx.song.id,
    songVersionId: ctx.version.id,
    userId,
    targetId: child.id,
    slotId: ctx.slot.id,
    childName: name,
    parentName: parent.name,
    slotKind: ctx.slot.kind,
  });

  return NextResponse.json({ takeId: child.id, midiPath: newMidiPath }, { status: 201 });
}
