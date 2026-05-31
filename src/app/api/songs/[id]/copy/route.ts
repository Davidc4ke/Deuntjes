import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/db/client';
import { songs } from '@/db/schema';
import { eq } from 'drizzle-orm';

// Anyone logged in can copy any song they can view. Creates a new row owned
// by the requester with the source song's sequencer state intact. Used by
// non-owners as their "fork to edit" path.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { id } = await params;
  const [src] = await db
    .select({ title: songs.title, sequencerData: songs.sequencerData })
    .from(songs)
    .where(eq(songs.id, id))
    .limit(1);
  if (!src) return NextResponse.json({ error: 'not found' }, { status: 404 });

  const [row] = await db
    .insert(songs)
    .values({
      title: `${src.title} (copy)`,
      createdBy: userId,
      sequencerData: src.sequencerData,
    })
    .returning({ id: songs.id });

  return NextResponse.json({ id: row.id }, { status: 201 });
}
