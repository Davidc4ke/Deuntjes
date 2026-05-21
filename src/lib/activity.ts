import { db, type DB } from '@/db/client';
import { activities, reactions, users } from '@/db/schema';
import { and, desc, eq, gt, gte, sql } from 'drizzle-orm';

export type ActivityKind =
  | 'take_added'
  | 'take_forked'
  | 'comment'
  | 'reaction'
  | 'mix_saved'
  | 'mix_activated'
  | 'version_forked';

export type ActivityActor = {
  id: string;
  displayName: string;
  avatarEmoji: string;
};

type EmitBase = {
  songId: string;
  songVersionId?: string | null;
  userId: string;
  targetId?: string | null;
};

type EmitterClient = DB | Parameters<Parameters<DB['transaction']>[0]>[0];

const REACTION_ROLLUP_WINDOW_MS = 60 * 60 * 1000; // 1h

async function actorInfo(userId: string): Promise<ActivityActor> {
  const [u] = await db
    .select({
      id: users.id,
      displayName: users.displayName,
      avatarEmoji: users.avatarEmoji,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return u ?? { id: userId, displayName: 'unknown', avatarEmoji: '🎵' };
}

async function insertActivity(
  client: EmitterClient,
  row: {
    songId: string;
    songVersionId: string | null;
    userId: string;
    kind: ActivityKind;
    targetId: string | null;
    payloadJson: Record<string, unknown>;
  },
) {
  await client.insert(activities).values({
    songId: row.songId,
    songVersionId: row.songVersionId,
    userId: row.userId,
    kind: row.kind,
    targetId: row.targetId,
    payloadJson: row.payloadJson,
  });
}

export async function emitTakeAdded(
  base: EmitBase & {
    slotId: string;
    takeName: string;
    slotKind: string;
    sectionId: string | null;
    sectionName: string | null;
    client?: EmitterClient;
  },
) {
  const actor = await actorInfo(base.userId);
  await insertActivity(base.client ?? db, {
    songId: base.songId,
    songVersionId: base.songVersionId ?? null,
    userId: base.userId,
    kind: 'take_added',
    targetId: base.targetId ?? null,
    payloadJson: {
      actor,
      slotId: base.slotId,
      takeName: base.takeName,
      slotKind: base.slotKind,
      sectionId: base.sectionId,
      sectionName: base.sectionName,
    },
  });
}

export async function emitTakeForked(
  base: EmitBase & {
    slotId: string;
    childName: string;
    parentName: string;
    slotKind: string;
    client?: EmitterClient;
  },
) {
  const actor = await actorInfo(base.userId);
  await insertActivity(base.client ?? db, {
    songId: base.songId,
    songVersionId: base.songVersionId ?? null,
    userId: base.userId,
    kind: 'take_forked',
    targetId: base.targetId ?? null,
    payloadJson: {
      actor,
      slotId: base.slotId,
      childName: base.childName,
      parentName: base.parentName,
      slotKind: base.slotKind,
    },
  });
}

export async function emitComment(
  base: EmitBase & {
    slotId: string;
    takeId: string;
    takeName: string;
    body: string;
    client?: EmitterClient;
  },
) {
  const actor = await actorInfo(base.userId);
  await insertActivity(base.client ?? db, {
    songId: base.songId,
    songVersionId: base.songVersionId ?? null,
    userId: base.userId,
    kind: 'comment',
    targetId: base.targetId ?? null,
    payloadJson: {
      actor,
      slotId: base.slotId,
      takeId: base.takeId,
      takeName: base.takeName,
      body: base.body,
    },
  });
}

/**
 * Reaction emission collapses repeated reactions by the same user on the same
 * take within a 1h window into one activity row, updating its payload and
 * timestamp instead of inserting a new row. (Risk #3 in architecture.md.)
 */
export async function emitOrUpdateReaction(opts: {
  songId: string;
  songVersionId: string | null;
  userId: string;
  slotId: string;
  takeId: string;
  takeName: string;
  emojis: string[];
}) {
  const actor = await actorInfo(opts.userId);
  const cutoff = new Date(Date.now() - REACTION_ROLLUP_WINDOW_MS);
  const [existing] = await db
    .select({ id: activities.id })
    .from(activities)
    .where(
      and(
        eq(activities.userId, opts.userId),
        eq(activities.kind, 'reaction'),
        eq(activities.targetId, opts.takeId),
        gte(activities.createdAt, cutoff),
      ),
    )
    .orderBy(desc(activities.createdAt))
    .limit(1);

  const payload = {
    actor,
    slotId: opts.slotId,
    takeId: opts.takeId,
    takeName: opts.takeName,
    emojis: opts.emojis,
  };

  if (existing) {
    await db
      .update(activities)
      .set({ payloadJson: payload, createdAt: new Date() })
      .where(eq(activities.id, existing.id));
    return;
  }
  await insertActivity(db, {
    songId: opts.songId,
    songVersionId: opts.songVersionId,
    userId: opts.userId,
    kind: 'reaction',
    targetId: opts.takeId,
    payloadJson: payload,
  });
}

/**
 * After a reaction is removed, recompute the user's remaining emojis on this
 * take. If they're empty, delete the recent reaction activity row so the
 * feed doesn't show a stale "reacted" entry. Otherwise update payload.
 */
export async function refreshOrClearReactionActivity(opts: {
  userId: string;
  slotId: string;
  takeId: string;
  takeName: string;
}) {
  const remaining = await db
    .select({ emoji: reactions.emoji })
    .from(reactions)
    .where(and(eq(reactions.takeId, opts.takeId), eq(reactions.userId, opts.userId)));

  const cutoff = new Date(Date.now() - REACTION_ROLLUP_WINDOW_MS);
  const [existing] = await db
    .select({ id: activities.id })
    .from(activities)
    .where(
      and(
        eq(activities.userId, opts.userId),
        eq(activities.kind, 'reaction'),
        eq(activities.targetId, opts.takeId),
        gte(activities.createdAt, cutoff),
      ),
    )
    .orderBy(desc(activities.createdAt))
    .limit(1);

  if (!existing) return;
  if (remaining.length === 0) {
    await db.delete(activities).where(eq(activities.id, existing.id));
    return;
  }
  const actor = await actorInfo(opts.userId);
  await db
    .update(activities)
    .set({
      payloadJson: {
        actor,
        slotId: opts.slotId,
        takeId: opts.takeId,
        takeName: opts.takeName,
        emojis: remaining.map((r) => r.emoji),
      },
    })
    .where(eq(activities.id, existing.id));
}

export async function emitMixSaved(
  base: EmitBase & { mixName: string; client?: EmitterClient },
) {
  const actor = await actorInfo(base.userId);
  await insertActivity(base.client ?? db, {
    songId: base.songId,
    songVersionId: base.songVersionId ?? null,
    userId: base.userId,
    kind: 'mix_saved',
    targetId: base.targetId ?? null,
    payloadJson: { actor, mixName: base.mixName },
  });
}

export async function emitMixActivated(
  base: EmitBase & { mixName: string; client?: EmitterClient },
) {
  const actor = await actorInfo(base.userId);
  await insertActivity(base.client ?? db, {
    songId: base.songId,
    songVersionId: base.songVersionId ?? null,
    userId: base.userId,
    kind: 'mix_activated',
    targetId: base.targetId ?? null,
    payloadJson: { actor, mixName: base.mixName },
  });
}

export async function emitVersionForked(
  base: EmitBase & {
    versionNumber: number;
    label: string;
    parentVersionNumber: number;
    client?: EmitterClient;
  },
) {
  const actor = await actorInfo(base.userId);
  await insertActivity(base.client ?? db, {
    songId: base.songId,
    songVersionId: base.songVersionId ?? null,
    userId: base.userId,
    kind: 'version_forked',
    targetId: base.targetId ?? null,
    payloadJson: {
      actor,
      versionNumber: base.versionNumber,
      label: base.label,
      parentVersionNumber: base.parentVersionNumber,
    },
  });
}

/**
 * Per-song unread counts for the current user. Excludes the user's own
 * activities; counts items strictly newer than read_state.last_seen_at (or
 * all activities if there's no read_state row yet).
 */
export async function unreadCountsForUser(opts: {
  userId: string;
  songIds: string[];
}): Promise<Map<string, number>> {
  if (opts.songIds.length === 0) return new Map();
  // Bind each song id as its own ::uuid parameter — drizzle's `sql` template
  // spreads JS arrays as separate placeholders, so the previous
  // `ANY($x::uuid[])` form was getting a single uuid bound to a uuid[]
  // parameter and pg rejected it as a malformed array literal.
  const idList = sql.join(
    opts.songIds.map((id) => sql`${id}::uuid`),
    sql`, `,
  );
  const rows = await db.execute<{ song_id: string; n: number }>(sql`
    SELECT a.song_id AS song_id, COUNT(*)::int AS n
    FROM activities a
    LEFT JOIN read_state r
      ON r.user_id = ${opts.userId}::uuid
     AND r.song_id = a.song_id
    WHERE a.song_id IN (${idList})
      AND a.user_id <> ${opts.userId}::uuid
      AND a.created_at > COALESCE(r.last_seen_at, 'epoch'::timestamptz)
    GROUP BY a.song_id
  `);
  const map = new Map<string, number>();
  for (const r of rows.rows) {
    map.set(r.song_id, Number(r.n) || 0);
  }
  return map;
}

export type ActivityItem =
  | {
      id: string;
      kind: 'take_added';
      createdAt: string;
      actor: ActivityActor;
      takeId: string;
      slotId: string | null;
      takeName: string;
      slotKind: string;
      sectionName: string | null;
    }
  | {
      id: string;
      kind: 'take_added_rollup';
      createdAt: string;
      actor: ActivityActor;
      count: number;
      takeIds: string[];
      slotId: string | null;
      slotKind: string;
      lastTakeName: string;
    }
  | {
      id: string;
      kind: 'take_forked';
      createdAt: string;
      actor: ActivityActor;
      takeId: string;
      slotId: string | null;
      childName: string;
      parentName: string;
      slotKind: string;
    }
  | {
      id: string;
      kind: 'comment';
      createdAt: string;
      actor: ActivityActor;
      takeId: string;
      slotId: string | null;
      takeName: string;
      body: string;
    }
  | {
      id: string;
      kind: 'reaction';
      createdAt: string;
      actor: ActivityActor;
      takeId: string;
      slotId: string | null;
      takeName: string;
      emojis: string[];
    }
  | {
      id: string;
      kind: 'mix_saved' | 'mix_activated';
      createdAt: string;
      actor: ActivityActor;
      mixId: string | null;
      mixName: string;
    }
  | {
      id: string;
      kind: 'version_forked';
      createdAt: string;
      actor: ActivityActor;
      versionId: string | null;
      versionNumber: number;
      label: string;
      parentVersionNumber: number;
    };

type RawActivity = {
  id: string;
  songVersionId: string | null;
  userId: string;
  kind: string;
  targetId: string | null;
  payloadJson: Record<string, unknown> | null;
  createdAt: Date;
};

function asActor(payload: Record<string, unknown> | null): ActivityActor {
  const a = (payload?.actor ?? {}) as Partial<ActivityActor>;
  return {
    id: a.id ?? '',
    displayName: a.displayName ?? 'unknown',
    avatarEmoji: a.avatarEmoji ?? '🎵',
  };
}

const TAKE_ROLLUP_WINDOW_MS = 60 * 60 * 1000; // 1h

type PendingRollup = {
  activityIds: string[];
  actor: ActivityActor;
  userId: string;
  slotKind: string;
  slotId: string | null;
  takeIds: string[];
  takeNames: string[];
  newest: Date;
  oldest: Date;
  singletonSectionName: string | null;
};

/**
 * Roll consecutive `take_added` items by the same user on the same song
 * (within a 1h window from newest to oldest) into a single
 * `take_added_rollup` item. The newest createdAt for the group is used; count
 * and take ids are preserved.
 */
export function applyRollups(items: RawActivity[]): ActivityItem[] {
  const out: ActivityItem[] = [];
  let pending: PendingRollup | null = null;

  const flush = () => {
    if (!pending) return;
    if (pending.takeIds.length === 1) {
      out.push({
        id: pending.activityIds[0],
        kind: 'take_added',
        createdAt: pending.newest.toISOString(),
        actor: pending.actor,
        takeId: pending.takeIds[0],
        slotId: pending.slotId,
        takeName: pending.takeNames[0],
        slotKind: pending.slotKind,
        sectionName: pending.singletonSectionName,
      });
    } else {
      out.push({
        id: pending.activityIds[0],
        kind: 'take_added_rollup',
        createdAt: pending.newest.toISOString(),
        actor: pending.actor,
        count: pending.takeIds.length,
        takeIds: pending.takeIds,
        slotId: pending.slotId,
        slotKind: pending.slotKind,
        lastTakeName: pending.takeNames[0],
      });
    }
    pending = null;
  };

  for (const row of items) {
    if (row.kind !== 'take_added') {
      flush();
      out.push(mapNonRollup(row));
      continue;
    }

    const p = row.payloadJson ?? {};
    const slotKind = String(p.slotKind ?? 'take');
    const takeName = String(p.takeName ?? 'a take');
    const sectionName = typeof p.sectionName === 'string' ? p.sectionName : null;
    const slotId = typeof p.slotId === 'string' ? p.slotId : null;
    const actor = asActor(row.payloadJson);
    const takeId = row.targetId ?? '';

    if (
      pending &&
      pending.userId === row.userId &&
      pending.slotKind === slotKind &&
      // Rows are newest-first; allow merging while the whole window <= 1h.
      pending.newest.getTime() - row.createdAt.getTime() <= TAKE_ROLLUP_WINDOW_MS
    ) {
      pending.activityIds.push(row.id);
      pending.takeIds.push(takeId);
      pending.takeNames.push(takeName);
      pending.oldest = row.createdAt;
      continue;
    }

    flush();
    pending = {
      activityIds: [row.id],
      actor,
      userId: row.userId,
      slotKind,
      slotId,
      takeIds: [takeId],
      takeNames: [takeName],
      newest: row.createdAt,
      oldest: row.createdAt,
      singletonSectionName: sectionName,
    };
  }
  flush();
  return out;
}

function mapNonRollup(row: RawActivity): ActivityItem {
  const actor = asActor(row.payloadJson);
  const p = row.payloadJson ?? {};
  const slotId = typeof p.slotId === 'string' ? p.slotId : null;
  switch (row.kind) {
    case 'take_forked':
      return {
        id: row.id,
        kind: 'take_forked',
        createdAt: row.createdAt.toISOString(),
        actor,
        takeId: row.targetId ?? '',
        slotId,
        childName: String(p.childName ?? 'fork'),
        parentName: String(p.parentName ?? 'parent take'),
        slotKind: String(p.slotKind ?? 'take'),
      };
    case 'comment':
      return {
        id: row.id,
        kind: 'comment',
        createdAt: row.createdAt.toISOString(),
        actor,
        takeId: String(p.takeId ?? ''),
        slotId,
        takeName: String(p.takeName ?? 'a take'),
        body: String(p.body ?? ''),
      };
    case 'reaction':
      return {
        id: row.id,
        kind: 'reaction',
        createdAt: row.createdAt.toISOString(),
        actor,
        takeId: String(p.takeId ?? row.targetId ?? ''),
        slotId,
        takeName: String(p.takeName ?? 'a take'),
        emojis: Array.isArray(p.emojis) ? (p.emojis as string[]) : [],
      };
    case 'mix_saved':
    case 'mix_activated':
      return {
        id: row.id,
        kind: row.kind,
        createdAt: row.createdAt.toISOString(),
        actor,
        mixId: row.targetId,
        mixName: String(p.mixName ?? 'a mix'),
      };
    case 'version_forked':
      return {
        id: row.id,
        kind: 'version_forked',
        createdAt: row.createdAt.toISOString(),
        actor,
        versionId: row.targetId,
        versionNumber: Number(p.versionNumber ?? 0),
        label: String(p.label ?? ''),
        parentVersionNumber: Number(p.parentVersionNumber ?? 0),
      };
    default:
      // Treat unknown kinds as a generic take-added so they don't crash the
      // feed; this branch shouldn't fire in practice.
      return {
        id: row.id,
        kind: 'take_added',
        createdAt: row.createdAt.toISOString(),
        actor,
        takeId: row.targetId ?? '',
        slotId,
        takeName: 'event',
        slotKind: 'take',
        sectionName: null,
      };
  }
}

export async function listActivityForSong(opts: {
  songId: string;
  since?: Date | null;
  limit?: number;
}): Promise<RawActivity[]> {
  const limit = Math.min(Math.max(opts.limit ?? 200, 1), 500);
  const whereExpr = opts.since
    ? and(eq(activities.songId, opts.songId), gt(activities.createdAt, opts.since))
    : eq(activities.songId, opts.songId);

  const rows = await db
    .select({
      id: activities.id,
      songVersionId: activities.songVersionId,
      userId: activities.userId,
      kind: activities.kind,
      targetId: activities.targetId,
      payloadJson: activities.payloadJson,
      createdAt: activities.createdAt,
    })
    .from(activities)
    .where(whereExpr)
    .orderBy(desc(activities.createdAt))
    .limit(limit);
  return rows.map((r) => ({
    ...r,
    payloadJson: (r.payloadJson ?? null) as Record<string, unknown> | null,
  }));
}

export async function lastSeenAtFor(opts: {
  userId: string;
  songId: string;
}): Promise<Date | null> {
  const rows = await db.execute<{ last_seen_at: Date }>(sql`
    SELECT last_seen_at FROM read_state
    WHERE user_id = ${opts.userId}::uuid AND song_id = ${opts.songId}::uuid
    LIMIT 1
  `);
  const r = rows.rows[0];
  return r ? new Date(r.last_seen_at) : null;
}

