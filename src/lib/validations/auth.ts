import { z } from "zod";
import { isPasswordValid, PASSWORD_POLICY, USERNAME_REGEX } from "@/lib/constants";

export const loginSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

export const signupSchema = z
  .object({
    email: z.string().email("Enter a valid email address"),
    username: z
      .string()
      .regex(USERNAME_REGEX, "Username must be 3–30 characters: letters, numbers, underscore"),
    password: z.string().refine(isPasswordValid, PASSWORD_POLICY.description),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const forgotPasswordSchema = z.object({
  email: z.string().email("Enter a valid email address"),
});

export const resetPasswordSchema = z
  .object({
    password: z.string().refine(isPasswordValid, PASSWORD_POLICY.description),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type LoginInput = z.infer<typeof loginSchema>;
export type SignupInput = z.infer<typeof signupSchema>;
