import { db } from '@/db/client';
import { comments, reactions, users } from '@/db/schema';
import { asc, eq, inArray } from 'drizzle-orm';

export type ReactionDTO = {
  id: string;
  emoji: string;
  userId: string;
  user: { id: string; displayName: string; avatarEmoji: string };
  createdAt: string;
};

export type ReactionSummary = {
  emoji: string;
  count: number;
  users: string[]; // displayNames, for tooltip
  mine: boolean;
};

export type CommentDTO = {
  id: string;
  body: string;
  createdAt: string;
  user: { id: string; displayName: string; avatarEmoji: string };
};

export async function listReactionsForTake(takeId: string): Promise<ReactionDTO[]> {
  const rows = await db
    .select({
      id: reactions.id,
      emoji: reactions.emoji,
      userId: reactions.userId,
      createdAt: reactions.createdAt,
      authorName: users.displayName,
      authorEmoji: users.avatarEmoji,
    })
    .from(reactions)
    .innerJoin(users, eq(users.id, reactions.userId))
    .where(eq(reactions.takeId, takeId))
    .orderBy(asc(reactions.createdAt));
  return rows.map((r) => ({
    id: r.id,
    emoji: r.emoji,
    userId: r.userId,
    user: { id: r.userId, displayName: r.authorName, avatarEmoji: r.authorEmoji },
    createdAt: r.createdAt.toISOString(),
  }));
}

export function summarizeReactions(
  list: ReactionDTO[],
  meId: string | null,
): ReactionSummary[] {
  const by = new Map<string, ReactionSummary>();
  for (const r of list) {
    const cur = by.get(r.emoji);
    if (cur) {
      cur.count += 1;
      cur.users.push(r.user.displayName);
      if (meId && r.userId === meId) cur.mine = true;
    } else {
      by.set(r.emoji, {
        emoji: r.emoji,
        count: 1,
        users: [r.user.displayName],
        mine: meId !== null && r.userId === meId,
      });
    }
  }
  return Array.from(by.values());
}

export async function listCommentsForTake(takeId: string): Promise<CommentDTO[]> {
  const rows = await db
    .select({
      id: comments.id,
      body: comments.body,
      createdAt: comments.createdAt,
      userId: comments.userId,
      authorName: users.displayName,
      authorEmoji: users.avatarEmoji,
    })
    .from(comments)
    .innerJoin(users, eq(users.id, comments.userId))
    .where(eq(comments.takeId, takeId))
    .orderBy(asc(comments.createdAt));
  return rows.map((r) => ({
    id: r.id,
    body: r.body,
    createdAt: r.createdAt.toISOString(),
    user: { id: r.userId, displayName: r.authorName, avatarEmoji: r.authorEmoji },
  }));
}

/**
 * Bulk-load reaction summaries + comment counts for a set of takes, keyed by
 * take id. Used by the song version page to render inline counts on TakeCards.
 */
export async function bulkSocialForTakes(opts: {
  takeIds: string[];
  meId: string | null;
}): Promise<
  Map<string, { reactions: ReactionSummary[]; commentCount: number }>
> {
  const out = new Map<string, { reactions: ReactionSummary[]; commentCount: number }>();
  for (const id of opts.takeIds) out.set(id, { reactions: [], commentCount: 0 });
  if (opts.takeIds.length === 0) return out;

  const rxRows = await db
    .select({
      id: reactions.id,
      takeId: reactions.takeId,
      emoji: reactions.emoji,
      userId: reactions.userId,
      authorName: users.displayName,
      authorEmoji: users.avatarEmoji,
      createdAt: reactions.createdAt,
    })
    .from(reactions)
    .innerJoin(users, eq(users.id, reactions.userId))
    .where(inArray(reactions.takeId, opts.takeIds));

  const byTake = new Map<string, ReactionDTO[]>();
  for (const r of rxRows) {
    const arr = byTake.get(r.takeId) ?? [];
    arr.push({
      id: r.id,
      emoji: r.emoji,
      userId: r.userId,
      user: { id: r.userId, displayName: r.authorName, avatarEmoji: r.authorEmoji },
      createdAt: r.createdAt.toISOString(),
    });
    byTake.set(r.takeId, arr);
  }
  for (const [takeId, list] of byTake) {
    const entry = out.get(takeId);
    if (entry) entry.reactions = summarizeReactions(list, opts.meId);
  }

  const cmtRows = await db
    .select({ takeId: comments.takeId, id: comments.id })
    .from(comments)
    .where(inArray(comments.takeId, opts.takeIds));
  for (const c of cmtRows) {
    const entry = out.get(c.takeId);
    if (entry) entry.commentCount += 1;
  }
  return out;
}
