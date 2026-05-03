// Fixed CRT scanline + vignette overlay. Mount once at root.
export const CRTOverlay = () => (
  <div className="scanlines pointer-events-none fixed inset-0 z-[9997]" aria-hidden />
);
