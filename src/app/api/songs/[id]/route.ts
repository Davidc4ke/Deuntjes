import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/db/client';
import { games, songs, users } from '@/db/schema';
import { eq } from 'drizzle-orm';

// A song that belongs to a dungeon game may only be written through the
// game's turn/lock API — even by its owner. Blocking DELETE also stops the
// cascade FK from silently killing the game.
async function songGameId(songId: string): Promise<string | null> {
  const [g] = await db.select({ id: games.id }).from(games).where(eq(games.songId, songId)).limit(1);
  return g?.id ?? null;
}

async function loadSong(id: string) {
  const [row] = await db
    .select({
      id: songs.id,
      title: songs.title,
      sequencerData: songs.sequencerData,
      createdBy: songs.createdBy,
      createdAt: songs.createdAt,
      updatedAt: songs.updatedAt,
      creatorName: users.displayName,
      creatorAvatar: users.avatarEmoji,
    })
    .from(songs)
    .innerJoin(users, eq(users.id, songs.createdBy))
    .where(eq(songs.id, id))
    .limit(1);
  return row;
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { id } = await params;
  const row = await loadSong(id);
  if (!row) return NextResponse.json({ error: 'not found' }, { status: 404 });

  return NextResponse.json({
    song: {
      id: row.id,
      title: row.title,
      sequencerData: row.sequencerData,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      createdBy: { id: row.createdBy, displayName: row.creatorName, avatarEmoji: row.creatorAvatar },
      isOwner: row.createdBy === userId,
    },
  });
}

// Owner-only update for the song title and/or sequencer blob. Last-write-wins
// — debounced autosave from the client sends the full state every time and
// we trust it. Non-owners get 403 (they need to copy the song first).
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { id } = await params;
  const row = await loadSong(id);
  if (!row) return NextResponse.json({ error: 'not found' }, { status: 404 });
  if (row.createdBy !== userId) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  if (await songGameId(id)) return NextResponse.json({ error: 'song belongs to a game' }, { status: 409 });

  const body = (await req.json().catch(() => null)) as
    | { title?: string; sequencerData?: unknown }
    | null;
  if (!body) return NextResponse.json({ error: 'invalid body' }, { status: 400 });

  const patch: { title?: string; sequencerData?: unknown; updatedAt: Date } = { updatedAt: new Date() };
  if (body.title !== undefined) {
    if (typeof body.title !== 'string') {
      return NextResponse.json({ error: 'title must be a string' }, { status: 400 });
    }
    const t = body.title.trim();
    if (!t) return NextResponse.json({ error: 'title cannot be blank' }, { status: 400 });
    patch.title = t;
  }
  if (body.sequencerData !== undefined) {
    if (typeof body.sequencerData !== 'object' || body.sequencerData === null) {
      return NextResponse.json({ error: 'sequencerData must be an object' }, { status: 400 });
    }
    patch.sequencerData = body.sequencerData;
  }
  if (patch.title === undefined && patch.sequencerData === undefined) {
    return NextResponse.json({ error: 'nothing to update' }, { status: 400 });
  }

  await db.update(songs).set(patch).where(eq(songs.id, id));
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { id } = await params;
  const row = await loadSong(id);
  if (!row) return NextResponse.json({ error: 'not found' }, { status: 404 });
  if (row.createdBy !== userId) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  if (await songGameId(id)) return NextResponse.json({ error: 'song belongs to a game' }, { status: 409 });

  await db.delete(songs).where(eq(songs.id, id));
  return NextResponse.json({ ok: true });
}
