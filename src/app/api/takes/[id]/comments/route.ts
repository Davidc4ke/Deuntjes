import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/db/client';
import { comments } from '@/db/schema';
import { resolveTakeContext } from '@/lib/takeQueries';
import { listCommentsForTake } from '@/lib/social';
import { emitComment } from '@/lib/activity';

const MAX_BODY_CHARS = 2000;

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { id: takeId } = await params;
  const list = await listCommentsForTake(takeId);
  return NextResponse.json({ comments: list });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { id: takeId } = await params;
  const ctx = await resolveTakeContext(takeId);
  if (!ctx) return NextResponse.json({ error: 'take not found' }, { status: 404 });

  const body = (await req.json().catch(() => null)) as { body?: string } | null;
  const text = String(body?.body ?? '').trim();
  if (!text) return NextResponse.json({ error: 'comment required' }, { status: 400 });
  if (text.length > MAX_BODY_CHARS) {
    return NextResponse.json({ error: 'comment too long' }, { status: 400 });
  }

  const [row] = await db
    .insert(comments)
    .values({ takeId, userId, body: text })
    .returning();

  await emitComment({
    songId: ctx.song.id,
    songVersionId: ctx.version.id,
    userId,
    targetId: row.id,
    slotId: ctx.slot.id,
    takeId,
    takeName: ctx.take.name,
    body: text,
  });

  return NextResponse.json({ commentId: row.id }, { status: 201 });
}
