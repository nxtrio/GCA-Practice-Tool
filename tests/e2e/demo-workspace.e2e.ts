import { expect, test } from "@playwright/test";

test("finishing or leaving the demo closes its timer and a new visit starts fresh", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => {
    localStorage.setItem(
      "gca-practice:demo-session:expires-at",
      new Date(Date.now() + 10 * 60 * 1_000).toISOString(),
    );
  });

  await page.getByRole("link", { name: "Open demo workspace" }).click();
  await expect(page).toHaveURL(/\/assessment\/demo$/);
  await expect(page.getByLabel("Time remaining")).toHaveText(
    /^1:(?:10:00|09:[0-5]\d)$/,
  );

  await page.getByRole("button", { name: "Finish session" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByLabel("Time remaining")).toHaveCount(0);

  await page.getByRole("link", { name: "Open demo workspace" }).click();
  await expect(page.getByLabel("Time remaining")).toHaveText(
    /^1:(?:10:00|09:[0-5]\d)$/,
  );
  await page.goBack();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByLabel("Time remaining")).toHaveCount(0);

  await page.getByRole("link", { name: "Open demo workspace" }).click();
  await expect(page.getByLabel("Time remaining")).toHaveText(
    /^1:(?:10:00|09:[0-5]\d)$/,
  );
});
