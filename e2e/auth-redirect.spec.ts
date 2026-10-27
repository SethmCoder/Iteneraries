import { test, expect } from "@playwright/test";

test.describe("protected routes", () => {
  test("unauthenticated users are sent to login", async ({ page }) => {
    test.skip(
      !process.env.NEXT_PUBLIC_SUPABASE_URL,
      "Requires Supabase env for middleware session checks",
    );
    await page.goto("/trips");
    await expect(page).toHaveURL(/\/login/);
  });

  test("login page renders", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Log In" })).toBeVisible();
  });
});
