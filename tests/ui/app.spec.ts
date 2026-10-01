import { test, expect } from "@playwright/test";
test("onboarding, real GLB rendering, navigation, themes and safe browser boundary", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "I’ll explore first" }).click();
  await expect(
    page.getByRole("heading", {
      name: "A little presence. A lot of possibility.",
    }),
  ).toBeVisible();
  await expect(page.locator('.pet-canvas[data-loaded="true"]')).toBeVisible({
    timeout: 20000,
  });
  await page.screenshot({
    path: "docs/evidence/duby-home.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Make sense of a file" }).click();
  await expect(
    page.getByRole("textbox", { name: "Ask Duby to help" }),
  ).toHaveValue(/Summarize/);
  await page.getByRole("button", { name: "Send task" }).click();
  await expect(
    page.getByRole("heading", { name: "Your AI connection" }),
  ).toBeVisible();
  await page.getByLabel("Model ID").fill("qwen3:8b");
  await page.getByRole("button", { name: "Connect runtime" }).click();
  await expect(page.getByRole("status")).toContainText("desktop app");
  await page
    .getByRole("button", { name: "Toggle light or dark theme" })
    .click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByRole("button", { name: "Meet Duby", exact: true }).click();
  await page.getByRole("button", { name: "Greeting" }).click();
  await expect(page.locator(".gallery-caption")).toContainText("greeting");
  await page.screenshot({
    path: "docs/evidence/duby-gallery-dark.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Access & privacy", exact: true })
    .click();
  await expect(
    page.getByText("No folders are shared with Duby."),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Share a folder · read only" })
    .click();
  await expect(page.getByRole("status")).toContainText("desktop app");
  expect(errors).toEqual([]);
});
test("keyboard navigation, reduced motion and responsive layout", async ({
  page,
}) => {
  await page.addInitScript(() => localStorage.setItem("duby.onboarded", "1"));
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(
    page.getByRole("textbox", { name: "Ask Duby to help" }),
  ).toBeVisible();
  await page.keyboard.press("Control+k");
  await expect(
    page.getByRole("textbox", { name: "Ask Duby to help" }),
  ).toBeFocused();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(
    page.getByRole("checkbox", { name: "Reduced motion" }),
  ).toBeChecked();
  await page.setViewportSize({ width: 740, height: 740 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
