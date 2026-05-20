import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/db/client';
import { sections as sectionsTable, songVersions } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { countTakesInVersion, validateSections, type SectionInput } from '@/lib/versionOps';

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ versionId: string }> },
) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { versionId } = await params;
  const body = (await req.json().catch(() => null)) as
    | { sections?: SectionInput[]; barCount?: number }
    | null;
  if (!body?.sections)
    return NextResponse.json({ error: 'sections required' }, { status: 400 });

  const [version] = await db
    .select()
    .from(songVersions)
    .where(eq(songVersions.id, versionId))
    .limit(1);
  if (!version) return NextResponse.json({ error: 'not found' }, { status: 404 });

  const barCount = body.barCount ?? version.barCount;
  const err = validateSections(body.sections, barCount);
  if (err) return NextResponse.json({ error: err }, { status: 400 });

  const takesCount = await countTakesInVersion(versionId);
  if (takesCount > 0) {
    return NextResponse.json(
      {
        error: 'version has takes — fork to change structure',
        reason: 'has_takes',
        takesCount,
      },
      { status: 409 },
    );
  }

  await db.transaction(async (tx) => {
    if (barCount !== version.barCount) {
      await tx.update(songVersions).set({ barCount }).where(eq(songVersions.id, versionId));
    }
    await tx.delete(sectionsTable).where(eq(sectionsTable.songVersionId, versionId));
    await tx.insert(sectionsTable).values(
      body.sections!.map((s, idx) => ({
        songVersionId: versionId,
        name: s.name,
        startBar: s.startBar,
        lengthBars: s.lengthBars,
        orderIdx: idx,
      })),
    );
  });

  return NextResponse.json({ ok: true });
}
