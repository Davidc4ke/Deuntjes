'use client';

import { useFormStatus } from 'react-dom';

// Submit button for server-action forms that shows a spinner + label while
// the action runs (useFormStatus reads the enclosing <form>'s pending
// state). Works without any per-page wiring — just drop it in the form.
export function SubmitButton({
  children,
  pendingLabel,
  className,
  style,
}: {
  children: React.ReactNode;
  pendingLabel: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className={className}
      style={style}
      disabled={pending}
      aria-busy={pending}
    >
      {pending ? (
        <>
          <span className="gspin" aria-hidden="true" />
          {pendingLabel}
        </>
      ) : (
        children
      )}
    </button>
  );
}
