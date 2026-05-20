import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/db/client';
import { songVersions, songs, users } from '@/db/schema';
import { asc, eq } from 'drizzle-orm';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { id } = await params;
  const [song] = await db
    .select({
      id: songs.id,
      title: songs.title,
      createdAt: songs.createdAt,
      createdBy: songs.createdBy,
      creatorName: users.displayName,
      creatorAvatar: users.avatarEmoji,
    })
    .from(songs)
    .innerJoin(users, eq(users.id, songs.createdBy))
    .where(eq(songs.id, id))
    .limit(1);

  if (!song) return NextResponse.json({ error: 'not found' }, { status: 404 });

  const versions = await db
    .select({
      id: songVersions.id,
      versionNumber: songVersions.versionNumber,
      label: songVersions.label,
      keyRoot: songVersions.keyRoot,
      keyMode: songVersions.keyMode,
      tempoBpm: songVersions.tempoBpm,
      timeSigNum: songVersions.timeSigNum,
      timeSigDen: songVersions.timeSigDen,
      barCount: songVersions.barCount,
      parentVersionId: songVersions.parentVersionId,
      createdAt: songVersions.createdAt,
    })
    .from(songVersions)
    .where(eq(songVersions.songId, id))
    .orderBy(asc(songVersions.versionNumber));

  return NextResponse.json({
    song: {
      id: song.id,
      title: song.title,
      createdAt: song.createdAt,
      createdBy: {
        id: song.createdBy,
        displayName: song.creatorName,
        avatarEmoji: song.creatorAvatar,
      },
    },
    versions,
  });
}
