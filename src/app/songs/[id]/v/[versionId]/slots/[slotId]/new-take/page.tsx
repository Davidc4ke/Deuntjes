import { notFound } from 'next/navigation';
import { requireUser } from '@/components/shared/AuthGate';
import { AppBar } from '@/components/app/AppBar';
import { db } from '@/db/client';
import { sections as sectionsTable, slots as slotsTable, songs } from '@/db/schema';
import { asc, eq } from 'drizzle-orm';
import { NewTakeForm } from './NewTakeForm';
import { SLOT_LABELS } from '@/components/song/types';
import type { SlotKind } from '@/db/schema';

export const dynamic = 'force-dynamic';

export default async function NewTakePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; versionId: string; slotId: string }>;
  searchParams: Promise<{ sectionId?: string }>;
}) {
  await requireUser();
  const { id, versionId, slotId } = await params;
  const { sectionId: initialSectionId } = await searchParams;

  const [song] = await db.select().from(songs).where(eq(songs.id, id)).limit(1);
  if (!song) notFound();

  const [slot] = await db
    .select()
    .from(slotsTable)
    .where(eq(slotsTable.id, slotId))
    .limit(1);
  if (!slot || slot.songVersionId !== versionId) notFound();

  const sectionRows = await db
    .select()
    .from(sectionsTable)
    .where(eq(sectionsTable.songVersionId, versionId))
    .orderBy(asc(sectionsTable.orderIdx));

  return (
    <>
      <AppBar
        back={`/songs/${id}/v/${versionId}`}
        title={`+ ${SLOT_LABELS[slot.kind as SlotKind]} take`}
      />
      <main className="page">
        <NewTakeForm
          songId={id}
          versionId={versionId}
          slotId={slotId}
          slotKind={slot.kind as SlotKind}
          sections={sectionRows.map((s) => ({
            id: s.id,
            name: s.name,
            startBar: s.startBar,
            lengthBars: s.lengthBars,
          }))}
          initialSectionId={initialSectionId ?? null}
        />
      </main>
    </>
  );
}
