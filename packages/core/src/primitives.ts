import { z } from "zod";

/** US phone number in E.164 format, e.g. +13125550123. */
export const UsPhoneE164Schema = z
  .string()
  .regex(/^\+1[2-9]\d{2}[2-9]\d{6}$/, "Use a US phone number in E.164 format, e.g. +13125550123");

/** Money is always stored as whole cents (integer) to avoid floating-point errors. */
export const MoneyCentsSchema = z.number().int().nonnegative();

export const LatLngSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});
export type LatLng = z.infer<typeof LatLngSchema>;
