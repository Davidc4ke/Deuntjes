import Link from 'next/link';
import type { ReactNode } from 'react';

export function AppBar({
  title,
  back,
  right,
}: {
  title: ReactNode;
  back?: string;
  right?: ReactNode;
}) {
  return (
    <header className="app-bar">
      {back ? (
        <Link href={back} aria-label="Back" style={{ fontSize: 20 }}>
          ←
        </Link>
      ) : null}
      <h1>{title}</h1>
      {right ? <div style={{ display: 'flex', gap: 8 }}>{right}</div> : null}
    </header>
  );
}
