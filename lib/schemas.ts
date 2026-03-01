import { z } from "zod";

const addressSchema = z
  .string()
  .min(1, "Address is required")
  .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address");

export const tokenAddressSchema = z.object({
  tokenAddress: addressSchema,
});

export const permitFormSchema = z.object({
  spender: addressSchema,
  value: z
    .string()
    .min(1, "Value is required")
    .refine((val) => {
      try {
        const num = parseFloat(val);
        return num > 0;
      } catch {
        return false;
      }
    }, "Value must be a positive number"),
  deadline: z
    .string()
    .min(1, "Deadline is required")
    .refine((val) => {
      const num = parseInt(val, 10);
      return !isNaN(num) && num > 0;
    }, "Deadline must be a valid Unix timestamp"),
});

export type TokenAddressInput = z.infer<typeof tokenAddressSchema>;
export type PermitFormInput = z.infer<typeof permitFormSchema>;
