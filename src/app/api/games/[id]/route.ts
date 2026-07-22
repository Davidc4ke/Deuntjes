import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/db/client';
import { games, songs } from '@/db/schema';
import { eq } from 'drizzle-orm';

// Raze a dungeon. Creator-only, any status. The game's song exists solely as
// the game's canvas, so it burns too: deleting the song row cascades the game
// (games.songId ON DELETE CASCADE) which in turn cascades its rooms.
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { id } = await params;
  const [game] = await db.select().from(games).where(eq(games.id, id)).limit(1);
  if (!game) return NextResponse.json({ error: 'not found' }, { status: 404 });
  if (game.createdBy !== userId) {
    return NextResponse.json({ error: 'only the dungeon keeper may raze it' }, { status: 403 });
  }

  await db.delete(songs).where(eq(songs.id, game.songId));
  return NextResponse.json({ ok: true });
}
