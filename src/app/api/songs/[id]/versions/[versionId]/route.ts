import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/db/client';
import {
  drumKitPads,
  drumKits,
  sections as sectionsTable,
  slots as slotsTable,
  songVersions,
} from '@/db/schema';
import { asc, eq } from 'drizzle-orm';
import { countTakesInVersion } from '@/lib/versionOps';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; versionId: string }> },
) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { id, versionId } = await params;
  const [version] = await db
    .select()
    .from(songVersions)
    .where(eq(songVersions.id, versionId))
    .limit(1);
  if (!version || version.songId !== id)
    return NextResponse.json({ error: 'not found' }, { status: 404 });

  const sections = await db
    .select()
    .from(sectionsTable)
    .where(eq(sectionsTable.songVersionId, versionId))
    .orderBy(asc(sectionsTable.orderIdx));

  const slots = await db
    .select()
    .from(slotsTable)
    .where(eq(slotsTable.songVersionId, versionId));

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

  return NextResponse.json({
    version,
    sections,
    slots,
    drumKit: kit ? { id: kit.id, pads } : null,
    mixes: [],
  });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; versionId: string }> },
) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { id, versionId } = await params;
  const body = (await req.json().catch(() => null)) as { label?: string | null } | null;
  if (!body) return NextResponse.json({ error: 'invalid body' }, { status: 400 });

  const [version] = await db
    .select()
    .from(songVersions)
    .where(eq(songVersions.id, versionId))
    .limit(1);
  if (!version || version.songId !== id)
    return NextResponse.json({ error: 'not found' }, { status: 404 });

  const label = body.label === null ? null : String(body.label ?? '').trim() || null;
  await db.update(songVersions).set({ label }).where(eq(songVersions.id, versionId));
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; versionId: string }> },
) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { id, versionId } = await params;
  const [version] = await db
    .select()
    .from(songVersions)
    .where(eq(songVersions.id, versionId))
    .limit(1);
  if (!version || version.songId !== id)
    return NextResponse.json({ error: 'not found' }, { status: 404 });

  const others = await db
    .select({ id: songVersions.id })
    .from(songVersions)
    .where(eq(songVersions.songId, id));
  if (others.length <= 1) {
    return NextResponse.json(
      { error: 'cannot delete the only version of a song' },
      { status: 409 },
    );
  }

  const takesCount = await countTakesInVersion(versionId);
  if (takesCount > 0) {
    return NextResponse.json(
      { error: 'version has takes', takesCount },
      { status: 409 },
    );
  }

  await db.delete(songVersions).where(eq(songVersions.id, versionId));
  return NextResponse.json({ ok: true });
}
