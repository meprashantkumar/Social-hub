import { Router } from "express";
import { asyncHandler } from "../../lib/asyncHandler";
import { requireAuth } from "../../middleware/requireAuth";
import * as ctrl from "./billing.controller";

export const billingRouter = Router();

// Current plan + limits + plan catalog for the signed-in user.
billingRouter.get("/", requireAuth, asyncHandler(ctrl.status));

// Start a checkout (create a Razorpay order) and verify the completed payment.
billingRouter.post("/order", requireAuth, asyncHandler(ctrl.createOrder));
billingRouter.post("/verify", requireAuth, asyncHandler(ctrl.verify));
