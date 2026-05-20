import { notFound } from 'next/navigation';
import { requireUser } from '@/components/shared/AuthGate';
import { AppBar } from '@/components/app/AppBar';
import { db } from '@/db/client';
import { drumKitPads, drumKits, songVersions } from '@/db/schema';
import { asc, eq } from 'drizzle-orm';
import { EditDrumKitForm } from './EditDrumKitForm';
import { countDrumTakesInVersion } from '@/lib/versionOps';

export default async function EditDrumKitPage({
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

  const [kit] = await db
    .select()
    .from(drumKits)
    .where(eq(drumKits.songVersionId, versionId))
    .limit(1);
  if (!kit) notFound();

  const pads = await db
    .select()
    .from(drumKitPads)
    .where(eq(drumKitPads.drumKitId, kit.id))
    .orderBy(asc(drumKitPads.orderIdx));

  const drumTakesCount = await countDrumTakesInVersion(versionId);

  return (
    <>
      <AppBar title="Edit drum kit" back={`/songs/${id}/v/${versionId}`} />
      <main className="page">
        <EditDrumKitForm
          songId={id}
          versionId={versionId}
          versionLabel={
            version.label
              ? `v${version.versionNumber} · ${version.label}`
              : `v${version.versionNumber}`
          }
          initialPads={pads.map((p) => ({ label: p.label, midiNote: p.midiNote }))}
          hasDrumTakes={drumTakesCount > 0}
          drumTakesCount={drumTakesCount}
        />
      </main>
    </>
  );
}
