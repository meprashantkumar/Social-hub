import cookieParser from "cookie-parser";
import cors from "cors";
import express, { type Express } from "express";
import helmet from "helmet";
import { env } from "./config/env";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";
import { authRouter } from "./modules/auth/auth.routes";
import { analyticsRouter } from "./modules/analytics/analytics.routes";
import { billingRouter } from "./modules/billing/billing.routes";
import { connectionsRouter } from "./modules/connections/connections.routes";
import { mediaRouter } from "./modules/media/media.routes";
import { postsRouter } from "./modules/posts/posts.routes";
import { invitationRouter, workspaceRouter } from "./modules/workspace/workspace.routes";

export const createApp = (): Express => {
  const app = express();

  // Trust the first proxy hop so req.ip and secure cookies work behind a
  // reverse proxy (nginx / cloud load balancer) in production.
  app.set("trust proxy", 1);

  app.use(helmet());
  app.use(
    cors({
      origin: env.CLIENT_ORIGIN,
      credentials: true, // allow the refresh-token cookie
    })
  );
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", service: "social-hub-api" });
  });

  app.use("/api/auth", authRouter);
  app.use("/api/workspaces", workspaceRouter);
  app.use("/api/invitations", invitationRouter);
  app.use("/api/connections", connectionsRouter);
  app.use("/api/media", mediaRouter);
  app.use("/api/posts", postsRouter);
  app.use("/api/analytics", analyticsRouter);
  app.use("/api/billing", billingRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};
