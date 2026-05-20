import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/db/client';
import { songVersions, songs, users } from '@/db/schema';
import { desc, eq, sql } from 'drizzle-orm';
import { createSongWithV1, validateSections, type SectionInput } from '@/lib/versionOps';
import { defaultSections } from '@/lib/musicDefaults';

export async function GET() {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const latestVersion = db
    .select({
      songId: songVersions.songId,
      versionNumber: sql<number>`max(${songVersions.versionNumber})`.as('vmax'),
    })
    .from(songVersions)
    .groupBy(songVersions.songId)
    .as('lv');

  const rows = await db
    .select({
      id: songs.id,
      title: songs.title,
      createdAt: songs.createdAt,
      createdBy: songs.createdBy,
      creatorName: users.displayName,
      creatorAvatar: users.avatarEmoji,
      latestVersionNumber: latestVersion.versionNumber,
    })
    .from(songs)
    .innerJoin(users, eq(users.id, songs.createdBy))
    .leftJoin(latestVersion, eq(latestVersion.songId, songs.id))
    .orderBy(desc(songs.createdAt));

  return NextResponse.json({
    songs: rows.map((r) => ({
      id: r.id,
      title: r.title,
      createdAt: r.createdAt,
      createdBy: {
        id: r.createdBy,
        displayName: r.creatorName,
        avatarEmoji: r.creatorAvatar,
      },
      latestVersionNumber: r.latestVersionNumber ?? 1,
      unreadCount: 0,
    })),
  });
}

export async function POST(req: Request) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = (await req.json().catch(() => null)) as
    | {
        title?: string;
        tempoBpm?: number;
        keyRoot?: string;
        keyMode?: string;
        timeSigNum?: number;
        timeSigDen?: number;
        barCount?: number;
        sections?: SectionInput[];
      }
    | null;
  if (!body) return NextResponse.json({ error: 'invalid body' }, { status: 400 });

  const title = String(body.title ?? '').trim();
  if (!title) return NextResponse.json({ error: 'title required' }, { status: 400 });
  const tempoBpm = Number(body.tempoBpm);
  if (!Number.isFinite(tempoBpm) || tempoBpm < 20 || tempoBpm > 300) {
    return NextResponse.json({ error: 'tempo out of range' }, { status: 400 });
  }
  const keyRoot = String(body.keyRoot ?? 'C');
  const keyMode = String(body.keyMode ?? 'major');
  const timeSigNum = Number(body.timeSigNum ?? 4);
  const timeSigDen = Number(body.timeSigDen ?? 4);
  const barCount = Number(body.barCount ?? 16);
  if (!Number.isInteger(barCount) || barCount < 1 || barCount > 999) {
    return NextResponse.json({ error: 'bar count out of range' }, { status: 400 });
  }
  if (!Number.isInteger(timeSigNum) || timeSigNum < 1 || timeSigNum > 32) {
    return NextResponse.json({ error: 'time sig num invalid' }, { status: 400 });
  }
  if (![2, 4, 8, 16].includes(timeSigDen)) {
    return NextResponse.json({ error: 'time sig den invalid' }, { status: 400 });
  }

  const sections =
    body.sections && body.sections.length > 0 ? body.sections : defaultSections(barCount);
  const sectionsError = validateSections(sections, barCount);
  if (sectionsError) return NextResponse.json({ error: sectionsError }, { status: 400 });

  const { song, version } = await createSongWithV1({
    title,
    createdBy: userId,
    tempoBpm,
    keyRoot,
    keyMode,
    timeSigNum,
    timeSigDen,
    barCount,
    sections,
  });

  return NextResponse.json({ songId: song.id, versionId: version.id }, { status: 201 });
}
