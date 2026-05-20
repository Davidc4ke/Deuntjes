import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/db/client';
import { takes } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { storage } from '@/storage';
import { resolveTakeContext } from '@/lib/takeQueries';

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
      await db.update(takes).set({ midiPath: newMidiPath }).where(eq(takes.id, child.id));
    } catch {
      newMidiPath = null;
    }
  }

  return NextResponse.json({ takeId: child.id, midiPath: newMidiPath }, { status: 201 });
}
