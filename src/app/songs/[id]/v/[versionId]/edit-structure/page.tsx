import { notFound } from 'next/navigation';
import { requireUser } from '@/components/shared/AuthGate';
import { AppBar } from '@/components/app/AppBar';
import { db } from '@/db/client';
import { sections as sectionsTable, songVersions } from '@/db/schema';
import { asc, eq } from 'drizzle-orm';
import { EditStructureForm } from './EditStructureForm';
import { countTakesInVersion } from '@/lib/versionOps';

export default async function EditStructurePage({
  params,
}: {
  params: Promise<{ id: string; versionId: string }>;
}) {
  await requireUser();
  const { id, versionId } = await params;
  const [version] = await db
    .select()
    .from(songVersions)
    .where(eq(songVersions.id, versionId))
    .limit(1);
  if (!version || version.songId !== id) notFound();
  const sections = await db
    .select()
    .from(sectionsTable)
    .where(eq(sectionsTable.songVersionId, versionId))
    .orderBy(asc(sectionsTable.orderIdx));
  const takesCount = await countTakesInVersion(versionId);
  return (
    <>
      <AppBar title="Edit structure" back={`/songs/${id}/v/${versionId}`} />
      <main className="page">
        <EditStructureForm
          songId={id}
          versionId={versionId}
          versionLabel={
            version.label ? `v${version.versionNumber} · ${version.label}` : `v${version.versionNumber}`
          }
          initialBarCount={version.barCount}
          initialTimeSigNum={version.timeSigNum}
          initialTimeSigDen={version.timeSigDen}
          initialSections={sections.map((s) => ({
            name: s.name,
            startBar: s.startBar,
            lengthBars: s.lengthBars,
          }))}
          hasTakes={takesCount > 0}
          takesCount={takesCount}
        />
      </main>
    </>
  );
}
