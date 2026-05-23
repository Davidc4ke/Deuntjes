import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/db/client';
import { songs, users } from '@/db/schema';
import { desc, eq } from 'drizzle-orm';
import { defaultSequencerState } from '@/lib/sequencerState';

export async function GET() {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const rows = await db
    .select({
      id: songs.id,
      title: songs.title,
      createdAt: songs.createdAt,
      updatedAt: songs.updatedAt,
      createdBy: songs.createdBy,
      creatorName: users.displayName,
      creatorAvatar: users.avatarEmoji,
    })
    .from(songs)
    .innerJoin(users, eq(users.id, songs.createdBy))
    .orderBy(desc(songs.updatedAt));

  return NextResponse.json({
    songs: rows.map((r) => ({
      id: r.id,
      title: r.title,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      createdBy: { id: r.createdBy, displayName: r.creatorName, avatarEmoji: r.creatorAvatar },
      isOwner: r.createdBy === userId,
    })),
  });
}

export async function POST(req: Request) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { title?: string };
  const title = String(body.title ?? '').trim() || 'Untitled song';

  const [row] = await db
    .insert(songs)
    .values({ title, createdBy: userId, sequencerData: defaultSequencerState() })
    .returning({ id: songs.id });

  return NextResponse.json({ id: row.id }, { status: 201 });
}
