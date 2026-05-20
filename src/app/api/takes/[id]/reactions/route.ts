import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/db/client';
import { reactions } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { resolveTakeContext } from '@/lib/takeQueries';
import { listReactionsForTake, summarizeReactions } from '@/lib/social';
import { emitOrUpdateReaction } from '@/lib/activity';

const MAX_EMOJI_LEN = 8;

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const meId = (session?.user as { id?: string } | undefined)?.id ?? null;
  if (!meId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { id: takeId } = await params;
  const list = await listReactionsForTake(takeId);
  return NextResponse.json({
    reactions: list,
    summary: summarizeReactions(list, meId),
  });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { id: takeId } = await params;
  const ctx = await resolveTakeContext(takeId);
  if (!ctx) return NextResponse.json({ error: 'take not found' }, { status: 404 });

  const body = (await req.json().catch(() => null)) as { emoji?: string } | null;
  const raw = String(body?.emoji ?? '').trim();
  if (!raw) return NextResponse.json({ error: 'emoji required' }, { status: 400 });
  // Length in JS code units. Most emojis use surrogate pairs (2 units).
  if (raw.length > MAX_EMOJI_LEN) {
    return NextResponse.json({ error: 'emoji too long' }, { status: 400 });
  }

  // Insert; the unique (take_id, user_id, emoji) constraint means a duplicate
  // is silently ignored.
  let inserted: { id: string } | undefined;
  try {
    const rows = await db
      .insert(reactions)
      .values({ takeId, userId, emoji: raw })
      .onConflictDoNothing()
      .returning({ id: reactions.id });
    inserted = rows[0];
  } catch {
    return NextResponse.json({ error: 'could not add reaction' }, { status: 500 });
  }

  // Recompute all my emojis on this take to keep the rollup activity in sync.
  const myEmojis = (
    await db
      .select({ emoji: reactions.emoji })
      .from(reactions)
      .where(and(eq(reactions.takeId, takeId), eq(reactions.userId, userId)))
  ).map((r) => r.emoji);

  await emitOrUpdateReaction({
    songId: ctx.song.id,
    songVersionId: ctx.version.id,
    userId,
    slotId: ctx.slot.id,
    takeId,
    takeName: ctx.take.name,
    emojis: myEmojis,
  });

  const list = await listReactionsForTake(takeId);
  const summary = summarizeReactions(list, userId);
  const reactionId =
    inserted?.id ??
    (
      await db
        .select({ id: reactions.id })
        .from(reactions)
        .where(
          and(
            eq(reactions.takeId, takeId),
            eq(reactions.userId, userId),
            eq(reactions.emoji, raw),
          ),
        )
        .limit(1)
    )[0]?.id;

  return NextResponse.json({ reactionId, summary }, { status: 201 });
}
