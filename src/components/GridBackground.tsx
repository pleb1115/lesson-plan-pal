export const GridBackground = ({ className = "" }: { className?: string }) => (
  <div
    aria-hidden
    className={`pointer-events-none absolute inset-0 grid-bg opacity-60 ${className}`}
  />
);
