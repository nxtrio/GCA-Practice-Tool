import { expect, test } from "@playwright/test";

test("finishing or leaving the demo closes its timer and a new visit starts fresh", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => {
    localStorage.setItem(
      "gca-practice:demo-session:expires-at",
      new Date(Date.now() + 10 * 60 * 1_000).toISOString(),
    );
    localStorage.setItem(
      "gca-practice:code:demo-session:p1:java",
      "LEGACY DEMO SOURCE",
    );
  });

  await page.getByRole("link", { name: "Open demo workspace" }).click();
  await expect(page).toHaveURL(/\/assessment\/demo$/);
  await expect(page.getByLabel("Time remaining")).toHaveText(
    /^1:(?:10:00|09:[0-5]\d)$/,
  );
  await expect(page.locator(".monaco-editor .view-lines")).not.toContainText(
    "LEGACY DEMO SOURCE",
  );
  expect(await page.evaluate(() => ({
    code: localStorage.getItem("gca-practice:code:demo-session:p1:java"),
    timer: localStorage.getItem("gca-practice:demo-session:expires-at"),
  }))).toEqual({ code: null, timer: null });
  await page.locator(".monaco-editor .view-lines").click();
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.type("FIRST DEMO DRAFT");

  await page.getByRole("button", { name: "Finish session" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByLabel("Time remaining")).toHaveCount(0);

  await page.getByRole("link", { name: "Open demo workspace" }).click();
  await expect(page.getByLabel("Time remaining")).toHaveText(
    /^1:(?:10:00|09:[0-5]\d)$/,
  );
  await expect(page.locator(".monaco-editor .view-lines")).not.toContainText(
    "FIRST DEMO DRAFT",
  );
  await page.locator(".monaco-editor .view-lines").click();
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.type("SECOND DEMO DRAFT");
  await page.goBack();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByLabel("Time remaining")).toHaveCount(0);

  await page.getByRole("link", { name: "Open demo workspace" }).click();
  await expect(page.getByLabel("Time remaining")).toHaveText(
    /^1:(?:10:00|09:[0-5]\d)$/,
  );
  await expect(page.locator(".monaco-editor .view-lines")).not.toContainText(
    "SECOND DEMO DRAFT",
  );
});
