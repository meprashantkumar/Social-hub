import { createApp } from "./app";
import { env } from "./config/env";
import { pool } from "./db";
import { startScheduler, stopScheduler } from "./modules/posts/scheduler";

const app = createApp();

const server = app.listen(env.PORT, () => {
  console.log(`🚀 SocialHub API running at http://localhost:${env.PORT}`);
  console.log(`   Health: http://localhost:${env.PORT}/api/health`);
  startScheduler();
});

const shutdown = (signal: string): void => {
  console.log(`\n${signal} received — shutting down gracefully...`);
  stopScheduler();
  server.close(() => {
    void pool.end().finally(() => process.exit(0));
  });
  // Force-exit if connections don't drain in time.
  setTimeout(() => process.exit(1), 10_000).unref();
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
