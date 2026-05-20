import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/db/client';
import { drumKitPads, drumKits, songVersions } from '@/db/schema';
import { asc, eq } from 'drizzle-orm';
import { countDrumTakesInVersion } from '@/lib/versionOps';

type PadInput = { label: string; midiNote: number };

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ versionId: string }> },
) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { versionId } = await params;
  const [kit] = await db
    .select()
    .from(drumKits)
    .where(eq(drumKits.songVersionId, versionId))
    .limit(1);
  if (!kit) return NextResponse.json({ error: 'not found' }, { status: 404 });

  const pads = await db
    .select()
    .from(drumKitPads)
    .where(eq(drumKitPads.drumKitId, kit.id))
    .orderBy(asc(drumKitPads.orderIdx));

  return NextResponse.json({ id: kit.id, pads });
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ versionId: string }> },
) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { versionId } = await params;
  const body = (await req.json().catch(() => null)) as { pads?: PadInput[] } | null;
  if (!body?.pads || !Array.isArray(body.pads))
    return NextResponse.json({ error: 'pads required' }, { status: 400 });

  for (const p of body.pads) {
    if (!p.label || !String(p.label).trim())
      return NextResponse.json({ error: 'pad label required' }, { status: 400 });
    if (!Number.isInteger(p.midiNote) || p.midiNote < 0 || p.midiNote > 127)
      return NextResponse.json({ error: 'midi note out of range' }, { status: 400 });
  }
  if (body.pads.length === 0)
    return NextResponse.json({ error: 'at least one pad required' }, { status: 400 });

  const [version] = await db
    .select()
    .from(songVersions)
    .where(eq(songVersions.id, versionId))
    .limit(1);
  if (!version) return NextResponse.json({ error: 'not found' }, { status: 404 });

  const drumTakes = await countDrumTakesInVersion(versionId);
  if (drumTakes > 0) {
    return NextResponse.json(
      {
        error: 'drum takes exist — fork to change kit',
        reason: 'has_drum_takes',
        drumTakesCount: drumTakes,
      },
      { status: 409 },
    );
  }

  const [kit] = await db
    .select()
    .from(drumKits)
    .where(eq(drumKits.songVersionId, versionId))
    .limit(1);
  if (!kit) return NextResponse.json({ error: 'drum kit missing' }, { status: 404 });

  await db.transaction(async (tx) => {
    await tx.delete(drumKitPads).where(eq(drumKitPads.drumKitId, kit.id));
    await tx.insert(drumKitPads).values(
      body.pads!.map((p, idx) => ({
        drumKitId: kit.id,
        label: String(p.label).trim(),
        midiNote: p.midiNote,
        orderIdx: idx,
      })),
    );
  });

  return NextResponse.json({ ok: true });
}
