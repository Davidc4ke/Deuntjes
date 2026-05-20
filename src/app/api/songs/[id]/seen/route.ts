import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/db/client';
import { readState, songs } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { id: songId } = await params;
  const [song] = await db.select().from(songs).where(eq(songs.id, songId)).limit(1);
  if (!song) return NextResponse.json({ error: 'song not found' }, { status: 404 });

  const now = new Date();
  await db
    .insert(readState)
    .values({ userId, songId, lastSeenAt: now })
    .onConflictDoUpdate({
      target: [readState.userId, readState.songId],
      set: { lastSeenAt: now },
    });

  return NextResponse.json({ ok: true, lastSeenAt: now.toISOString() });
}
