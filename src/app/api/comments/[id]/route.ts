import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/db/client';
import { comments, slots as slotsTable, songVersions, songs, takes } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { id } = await params;
  // Resolve comment + the song's owner in one shot.
  const [row] = await db
    .select({
      commentUserId: comments.userId,
      songOwnerId: songs.createdBy,
    })
    .from(comments)
    .innerJoin(takes, eq(takes.id, comments.takeId))
    .innerJoin(slotsTable, eq(slotsTable.id, takes.slotId))
    .innerJoin(songVersions, eq(songVersions.id, slotsTable.songVersionId))
    .innerJoin(songs, eq(songs.id, songVersions.songId))
    .where(eq(comments.id, id))
    .limit(1);

  if (!row) return NextResponse.json({ error: 'not found' }, { status: 404 });

  const allowed = row.commentUserId === userId || row.songOwnerId === userId;
  if (!allowed) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  await db.delete(comments).where(eq(comments.id, id));
  return NextResponse.json({ ok: true });
}
