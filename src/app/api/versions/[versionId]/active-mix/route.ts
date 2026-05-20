import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/db/client';
import { mixes, songVersions } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { emitMixActivated } from '@/lib/activity';

export async function POST(req: Request, { params }: { params: Promise<{ versionId: string }> }) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { versionId } = await params;
  const body = (await req.json().catch(() => null)) as { mixId?: string | null } | null;
  if (!body) return NextResponse.json({ error: 'invalid body' }, { status: 400 });

  const mixId = body.mixId ?? null;
  let mixName: string | null = null;
  if (mixId !== null) {
    const [mix] = await db
      .select()
      .from(mixes)
      .where(and(eq(mixes.id, mixId), eq(mixes.songVersionId, versionId)))
      .limit(1);
    if (!mix) {
      return NextResponse.json({ error: 'mix does not belong to version' }, { status: 400 });
    }
    mixName = mix.name;
  }

  const result = await db
    .update(songVersions)
    .set({ activeMixId: mixId })
    .where(eq(songVersions.id, versionId))
    .returning();
  if (result.length === 0) {
    return NextResponse.json({ error: 'version not found' }, { status: 404 });
  }

  if (mixId !== null && mixName !== null) {
    await emitMixActivated({
      songId: result[0].songId,
      songVersionId: versionId,
      userId,
      targetId: mixId,
      mixName,
    });
  }

  return NextResponse.json({ ok: true, activeMixId: mixId });
}
