import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test("main views pass automated WCAG A/AA checks", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("duby.onboarded", "1"));
  await page.goto("/");
  for (const theme of ["light", "dark"]) {
    await page.evaluate((t) => {
      document.documentElement.dataset.theme = t;
    }, theme);
    for (const name of [
      "Your space",
      "Your memory",
      "Access & privacy",
      "Meet Duby",
      "Settings",
    ]) {
      await page.getByRole("button", { name, exact: true }).first().click();
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze();
      expect(
        results.violations.map((v) => ({
          id: v.id,
          nodes: v.nodes.map((n) => ({
            target: n.target,
            summary: n.failureSummary,
          })),
        })),
        name,
      ).toEqual([]);
    }
  }
});
