import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/db/client';
import { mixSelections, mixes, songVersions } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getMixWithVersion } from '@/lib/takeQueries';
import { validateSelections, type SelectionInput } from '@/lib/mixValidate';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { id } = await params;
  const ctx = await getMixWithVersion(id);
  if (!ctx) return NextResponse.json({ error: 'not found' }, { status: 404 });
  const sels = await db.select().from(mixSelections).where(eq(mixSelections.mixId, id));
  return NextResponse.json({
    mix: {
      id: ctx.mix.id,
      name: ctx.mix.name,
      versionId: ctx.mix.songVersionId,
      createdAt: ctx.mix.createdAt,
      selections: sels.map((s) => ({
        slotId: s.slotId,
        sectionId: s.sectionId,
        takeId: s.takeId,
      })),
    },
  });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { id } = await params;
  const ctx = await getMixWithVersion(id);
  if (!ctx) return NextResponse.json({ error: 'not found' }, { status: 404 });

  const body = (await req.json().catch(() => null)) as
    | { name?: string; selections?: SelectionInput[] }
    | null;
  if (!body) return NextResponse.json({ error: 'invalid body' }, { status: 400 });

  let nameUpdate: string | null = null;
  if (typeof body.name === 'string') {
    const trimmed = body.name.trim();
    if (!trimmed) return NextResponse.json({ error: 'name required' }, { status: 400 });
    nameUpdate = trimmed;
  }

  let validation: { rows: { slotId: string; sectionId: string | null; takeId: string }[] } | null =
    null;
  if (Array.isArray(body.selections)) {
    const r = await validateSelections(ctx.mix.songVersionId, body.selections);
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });
    validation = { rows: r.rows };
  }

  if (nameUpdate === null && validation === null) {
    return NextResponse.json({ error: 'nothing to update' }, { status: 400 });
  }

  await db.transaction(async (tx) => {
    if (nameUpdate !== null) {
      await tx.update(mixes).set({ name: nameUpdate }).where(eq(mixes.id, id));
    }
    if (validation !== null) {
      await tx.delete(mixSelections).where(eq(mixSelections.mixId, id));
      if (validation.rows.length > 0) {
        await tx.insert(mixSelections).values(
          validation.rows.map((r) => ({
            mixId: id,
            slotId: r.slotId,
            sectionId: r.sectionId,
            takeId: r.takeId,
          })),
        );
      }
    }
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { id } = await params;
  const ctx = await getMixWithVersion(id);
  if (!ctx) return NextResponse.json({ error: 'not found' }, { status: 404 });

  await db.transaction(async (tx) => {
    if (ctx.version.activeMixId === id) {
      await tx
        .update(songVersions)
        .set({ activeMixId: null })
        .where(eq(songVersions.id, ctx.version.id));
    }
    await tx.delete(mixes).where(eq(mixes.id, id));
  });

  return NextResponse.json({ ok: true });
}
