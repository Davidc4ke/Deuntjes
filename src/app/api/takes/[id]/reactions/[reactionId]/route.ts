import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/db/client';
import { reactions } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { resolveTakeContext } from '@/lib/takeQueries';
import { listReactionsForTake, summarizeReactions } from '@/lib/social';
import { refreshOrClearReactionActivity } from '@/lib/activity';

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; reactionId: string }> },
) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { id: takeId, reactionId } = await params;
  const ctx = await resolveTakeContext(takeId);
  if (!ctx) return NextResponse.json({ error: 'take not found' }, { status: 404 });

  const [row] = await db
    .select()
    .from(reactions)
    .where(eq(reactions.id, reactionId))
    .limit(1);
  if (!row || row.takeId !== takeId) {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }
  // Only own reactions can be removed.
  if (row.userId !== userId) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  await db
    .delete(reactions)
    .where(and(eq(reactions.id, reactionId), eq(reactions.userId, userId)));

  await refreshOrClearReactionActivity({
    userId,
    slotId: ctx.slot.id,
    takeId,
    takeName: ctx.take.name,
  });

  const list = await listReactionsForTake(takeId);
  return NextResponse.json({ ok: true, summary: summarizeReactions(list, userId) });
}
