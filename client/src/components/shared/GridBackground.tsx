/** Fixed backdrop: a fine grid texture with two soft, static glows. Kept
 *  deliberately restrained so content — not the background — leads. */
export function GridBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-canvas">
      <div className="bg-grid bg-grid-fade absolute inset-0 opacity-50" />
      <div className="absolute left-1/2 top-[-20%] h-[420px] w-[720px] -translate-x-1/2 rounded-full bg-violet-600/10 blur-[150px]" />
      <div className="absolute bottom-[-16%] right-[-6%] h-[360px] w-[440px] rounded-full bg-indigo-600/[0.08] blur-[160px]" />
    </div>
  );
}
