// Themed route-loading fallback. Next renders the nearest loading.tsx
// instantly when navigating into an async segment, so every link into a
// slow page (room editor, dungeon map, song) shows this at once.
// `standalone` adds the .grim theme wrapper for routes not already inside
// the games layout (home, songs).
export function GrimLoading({ label, standalone = false }: { label: string; standalone?: boolean }) {
  const body = (
    <div className="grim-loading">
      <span className="gspin" aria-hidden="true" />
      <div className="txt">{label}</div>
    </div>
  );
  if (!standalone) return body;
  return (
    <div className="grim">
      <div className="grim-grain" aria-hidden="true" />
      {body}
    </div>
  );
}
