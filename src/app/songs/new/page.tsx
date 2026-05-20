import { requireUser } from '@/components/shared/AuthGate';
import { AppBar } from '@/components/app/AppBar';

export default async function NewSongStub() {
  await requireUser();
  return (
    <>
      <AppBar title="New song" back="/" />
      <main className="page">
        <div className="card">
          <p className="muted">
            The create-song wizard (title → tempo → key → time sig → bar count → sections) is
            ticket #2.
          </p>
        </div>
      </main>
    </>
  );
}
