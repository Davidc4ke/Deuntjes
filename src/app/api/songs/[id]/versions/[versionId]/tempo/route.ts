import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/db/client';
import { songVersions } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; versionId: string }> },
) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { id, versionId } = await params;
  const body = (await req.json().catch(() => null)) as { tempoBpm?: number } | null;
  const tempoBpm = Number(body?.tempoBpm);
  if (!Number.isFinite(tempoBpm) || tempoBpm < 20 || tempoBpm > 300) {
    return NextResponse.json({ error: 'tempo out of range' }, { status: 400 });
  }

  const [version] = await db
    .select()
    .from(songVersions)
    .where(eq(songVersions.id, versionId))
    .limit(1);
  if (!version || version.songId !== id)
    return NextResponse.json({ error: 'not found' }, { status: 404 });

  await db
    .update(songVersions)
    .set({ tempoBpm: Math.round(tempoBpm) })
    .where(eq(songVersions.id, versionId));
  return NextResponse.json({ ok: true, tempoBpm: Math.round(tempoBpm) });
}
