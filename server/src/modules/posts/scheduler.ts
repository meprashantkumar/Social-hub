import { env } from "../../config/env";
import { runDuePublishes } from "./posts.service";

/**
 * Simple in-process scheduler: every SCHEDULER_INTERVAL_SECONDS it publishes any
 * due scheduled posts (and reaps crashed publishes). A single `running` guard
 * prevents overlapping ticks; the DB claim in runDuePublishes makes it safe even
 * if multiple server instances run this.
 */
let timer: NodeJS.Timeout | null = null;
let running = false;

async function tick(): Promise<void> {
  if (running) return; // don't overlap a slow upload with the next tick
  running = true;
  try {
    const count = await runDuePublishes();
    if (count > 0) console.log(`[scheduler] published ${count} due post(s)`);
  } catch (err) {
    console.error("[scheduler] tick failed:", err);
  } finally {
    running = false;
  }
}

export function startScheduler(): void {
  const seconds = env.SCHEDULER_INTERVAL_SECONDS;
  if (seconds <= 0) {
    console.log("[scheduler] disabled (SCHEDULER_INTERVAL_SECONDS=0)");
    return;
  }
  timer = setInterval(() => void tick(), seconds * 1000);
  timer.unref(); // don't keep the process alive just for the poller
  console.log(`[scheduler] polling every ${seconds}s for due posts`);
}

export function stopScheduler(): void {
  if (timer) clearInterval(timer);
  timer = null;
}
