import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/db/client';
import { takes } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { storage } from '@/storage';
import { countMixReferences, getTakeWithAuthor } from '@/lib/takeQueries';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { id } = await params;
  const take = await getTakeWithAuthor(id);
  if (!take) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json({ take });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { id } = await params;
  const take = await getTakeWithAuthor(id);
  if (!take) return NextResponse.json({ error: 'not found' }, { status: 404 });

  const body = (await req.json().catch(() => null)) as
    | { name?: string; notes?: string | null }
    | null;
  if (!body) return NextResponse.json({ error: 'invalid body' }, { status: 400 });

  const patch: { name?: string; notes?: string | null } = {};
  if (typeof body.name === 'string') {
    const trimmed = body.name.trim();
    if (!trimmed) return NextResponse.json({ error: 'name required' }, { status: 400 });
    patch.name = trimmed;
  }
  if ('notes' in body) {
    if (body.notes === null) {
      patch.notes = null;
    } else if (typeof body.notes === 'string') {
      patch.notes = body.notes.trim() || null;
    }
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'nothing to update' }, { status: 400 });
  }

  await db.update(takes).set(patch).where(eq(takes.id, id));
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { id } = await params;
  const take = await getTakeWithAuthor(id);
  if (!take) return NextResponse.json({ error: 'not found' }, { status: 404 });

  const refs = await countMixReferences(id);
  if (refs > 0) {
    return NextResponse.json(
      { error: `take is in ${refs} mix${refs === 1 ? '' : 'es'}; remove it first` },
      { status: 409 },
    );
  }

  if (take.midiPath) {
    await storage.delete(take.midiPath).catch(() => {});
  }
  await db.delete(takes).where(eq(takes.id, id));
  return NextResponse.json({ ok: true });
}
