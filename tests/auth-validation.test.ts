import { describe, expect, it } from "vitest";
import { isPasswordValid } from "@/lib/constants";
import {
  loginSchema,
  signupSchema,
  forgotPasswordSchema,
} from "@/lib/validations/auth";

describe("auth validation", () => {
  it("rejects invalid login emails", () => {
    expect(loginSchema.safeParse({ email: "bad", password: "x" }).success).toBe(
      false,
    );
  });

  it("accepts valid login input", () => {
    expect(
      loginSchema.safeParse({
        email: "user@company.com",
        password: "secret",
      }).success,
    ).toBe(true);
  });

  it("enforces password policy", () => {
    expect(isPasswordValid("short")).toBe(false);
    expect(isPasswordValid("password")).toBe(false);
    expect(isPasswordValid("password1")).toBe(true);
  });

  it("requires matching passwords on signup", () => {
    const result = signupSchema.safeParse({
      email: "a@b.com",
      username: "traveler",
      password: "password1",
      confirmPassword: "password2",
    });
    expect(result.success).toBe(false);
  });

  it("validates forgot password email", () => {
    expect(forgotPasswordSchema.safeParse({ email: "a@b.com" }).success).toBe(
      true,
    );
  });
});
