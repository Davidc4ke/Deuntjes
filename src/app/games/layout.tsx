import './games.css';

// Everything under /games lives in the woodcut-nightmare theme: strict
// monochrome + blood red, scoped under .grim so the rest of the app keeps
// its cassette-futurism look.
export default function GamesLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grim">
      <div className="grim-grain" aria-hidden="true" />
      {children}
    </div>
  );
}
