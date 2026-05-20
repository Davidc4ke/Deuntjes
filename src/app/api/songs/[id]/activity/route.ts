import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/db/client';
import { songs } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { applyRollups, lastSeenAtFor, listActivityForSong } from '@/lib/activity';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { id: songId } = await params;
  const [song] = await db.select().from(songs).where(eq(songs.id, songId)).limit(1);
  if (!song) return NextResponse.json({ error: 'song not found' }, { status: 404 });

  const url = new URL(req.url);
  const sinceParam = url.searchParams.get('since');
  let since: Date | null = null;
  if (sinceParam) {
    const d = new Date(sinceParam);
    if (Number.isNaN(d.getTime())) {
      return NextResponse.json({ error: 'invalid since' }, { status: 400 });
    }
    since = d;
  } else {
    since = await lastSeenAtFor({ userId, songId });
  }

  const rows = await listActivityForSong({ songId, since });
  const items = applyRollups(rows);
  return NextResponse.json({
    items,
    since: since?.toISOString() ?? null,
  });
}
