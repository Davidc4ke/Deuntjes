import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/db/client';
import { mixSelections, mixes, songVersions } from '@/db/schema';
import { eq, inArray } from 'drizzle-orm';
import { validateSelections, type SelectionInput } from '@/lib/mixValidate';
import { emitMixSaved } from '@/lib/activity';

export async function GET(_req: Request, { params }: { params: Promise<{ versionId: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { versionId } = await params;
  const rows = await db
    .select()
    .from(mixes)
    .where(eq(mixes.songVersionId, versionId))
    .orderBy(mixes.createdAt);

  const sels =
    rows.length === 0
      ? []
      : await db
          .select()
          .from(mixSelections)
          .where(
            inArray(
              mixSelections.mixId,
              rows.map((r) => r.id),
            ),
          );

  return NextResponse.json({
    mixes: rows.map((m) => ({
      id: m.id,
      name: m.name,
      createdAt: m.createdAt,
      selections: sels
        .filter((s) => s.mixId === m.id)
        .map((s) => ({
          slotId: s.slotId,
          sectionId: s.sectionId,
          takeId: s.takeId,
        })),
    })),
  });
}

export async function POST(req: Request, { params }: { params: Promise<{ versionId: string }> }) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { versionId } = await params;

  const body = (await req.json().catch(() => null)) as
    | { name?: string; selections?: SelectionInput[] }
    | null;
  if (!body) return NextResponse.json({ error: 'invalid body' }, { status: 400 });

  const name = String(body.name ?? '').trim();
  if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 });

  const rawSelections = Array.isArray(body.selections) ? body.selections : [];
  const validation = await validateSelections(versionId, rawSelections);
  if (!validation.ok) return NextResponse.json({ error: validation.error }, { status: 400 });

  const result = await db.transaction(async (tx) => {
    const [mix] = await tx
      .insert(mixes)
      .values({ songVersionId: versionId, name, createdBy: userId })
      .returning();
    if (validation.rows.length > 0) {
      await tx.insert(mixSelections).values(
        validation.rows.map((r) => ({
          mixId: mix.id,
          slotId: r.slotId,
          sectionId: r.sectionId,
          takeId: r.takeId,
        })),
      );
    }
    return mix;
  });

  const [version] = await db
    .select({ songId: songVersions.songId })
    .from(songVersions)
    .where(eq(songVersions.id, versionId))
    .limit(1);
  if (version) {
    await emitMixSaved({
      songId: version.songId,
      songVersionId: versionId,
      userId,
      targetId: result.id,
      mixName: name,
    });
  }

  return NextResponse.json({ mixId: result.id }, { status: 201 });
}
