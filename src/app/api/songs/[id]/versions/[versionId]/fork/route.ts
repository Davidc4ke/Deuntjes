import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { forkVersion, validateSections, type ForkOverrides } from '@/lib/versionOps';
import { db } from '@/db/client';
import { songVersions } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; versionId: string }> },
) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { id, versionId } = await params;
  const body = (await req.json().catch(() => null)) as
    | { overrides?: ForkOverrides; label?: string }
    | null;
  if (!body) return NextResponse.json({ error: 'invalid body' }, { status: 400 });

  const label = String(body.label ?? '').trim();
  if (!label)
    return NextResponse.json({ error: 'label required' }, { status: 400 });

  const overrides = body.overrides ?? {};

  const [parent] = await db
    .select()
    .from(songVersions)
    .where(eq(songVersions.id, versionId))
    .limit(1);
  if (!parent || parent.songId !== id)
    return NextResponse.json({ error: 'not found' }, { status: 404 });

  const barCount = overrides.barCount ?? parent.barCount;
  if (!Number.isInteger(barCount) || barCount < 1 || barCount > 999)
    return NextResponse.json({ error: 'bar count out of range' }, { status: 400 });

  if (overrides.sections) {
    const err = validateSections(overrides.sections, barCount);
    if (err) return NextResponse.json({ error: err }, { status: 400 });
  }

  try {
    const child = await forkVersion({
      fromVersionId: versionId,
      songId: id,
      label,
      overrides: { ...overrides, barCount },
      createdBy: userId,
    });
    return NextResponse.json({ versionId: child.id, versionNumber: child.versionNumber });
  } catch (err) {
    console.error('[fork] failed', { songId: id, versionId, overrides, err });
    const msg = err instanceof Error ? err.message : 'fork failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
