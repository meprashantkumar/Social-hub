/** Fixed dark backdrop: grid texture + drifting radial glows. Sits behind all pages. */
export function GridBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-canvas">
      <div className="bg-grid bg-grid-fade absolute inset-0 opacity-70" />
      <div className="animate-drift absolute left-1/2 top-[-12%] h-[520px] w-[820px] -translate-x-1/2 rounded-full bg-violet-600/20 blur-[130px]" />
      <div className="absolute bottom-[-10%] right-[6%] h-[420px] w-[520px] rounded-full bg-indigo-700/15 blur-[130px]" />
      <div className="absolute left-[4%] top-[30%] h-[320px] w-[320px] rounded-full bg-fuchsia-700/10 blur-[130px]" />
    </div>
  );
}
