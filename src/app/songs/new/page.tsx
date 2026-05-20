import { requireUser } from '@/components/shared/AuthGate';
import { AppBar } from '@/components/app/AppBar';
import { NewSongWizard } from './NewSongWizard';

export default async function NewSongPage() {
  await requireUser();
  return (
    <>
      <AppBar title="New song" back="/" />
      <main className="page">
        <NewSongWizard />
      </main>
    </>
  );
}
