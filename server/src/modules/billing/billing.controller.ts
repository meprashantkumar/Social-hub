import type { Request, Response } from "express";
import { z } from "zod";
import { badRequest } from "../../lib/errors";
import * as service from "./billing.service";

export const status = async (req: Request, res: Response): Promise<void> => {
  res.json(await service.getBillingStatus(req.userId!));
};

const orderSchema = z.object({
  plan: z.enum(["monthly", "half_yearly", "yearly"]),
});

export const createOrder = async (req: Request, res: Response): Promise<void> => {
  const parsed = orderSchema.safeParse(req.body);
  if (!parsed.success) throw badRequest("Pick a valid plan", "INVALID_PLAN");
  res.json(await service.createOrder(req.userId!, parsed.data.plan));
};

const verifySchema = z.object({
  razorpay_order_id: z.string().min(1),
  razorpay_payment_id: z.string().min(1),
  razorpay_signature: z.string().min(1),
});

export const verify = async (req: Request, res: Response): Promise<void> => {
  const parsed = verifySchema.safeParse(req.body);
  if (!parsed.success) throw badRequest("Missing payment details", "INVALID_PAYMENT");
  const result = await service.verifyPayment(req.userId!, {
    razorpayOrderId: parsed.data.razorpay_order_id,
    razorpayPaymentId: parsed.data.razorpay_payment_id,
    razorpaySignature: parsed.data.razorpay_signature,
  });
  res.json(result);
};
