import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";

test("imports, solves, preserves, finishes, and exports a session", async ({ page }) => {
  await page.goto("/import");
  await expect(page.getByText("Imported code runs on this computer")).toBeVisible();
  await page.getByLabel(/I trust this assessment source/).check();
  await page.getByLabel("Upload JSON file").setInputFiles(
    resolve("fixtures/assessments/valid-gca.json"),
  );
  await expect(page.getByText("Loaded valid-gca.json")).toBeVisible();
  await expect(page.getByText("Assessment is ready")).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "Start GCA Assessment" }).click();

  await expect(page.getByText("Array Total").first()).toBeVisible();
  await page.getByLabel("Programming language").selectOption("python");
  await expect(page.getByLabel("python code editor")).toBeVisible();
  await page.locator(".monaco-editor .view-lines").click();
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.type("def solution(numbers):\n    return sum(numbers)");

  await page.getByRole("button", { name: "Run visible tests" }).click();
  await expect(page.getByText(/1\/1 passed/)).toBeVisible();
  await page.getByRole("button", { name: "Submit" }).click();
  await expect(page.getByText(/2\/2 passed/)).toBeVisible();

  await page.getByRole("button", { name: /Question 2:/ }).click();
  await page.getByLabel("Programming language").selectOption("python");
  await page.getByRole("button", { name: /Question 1:/ }).click();
  await expect(page.locator(".monaco-editor .view-lines")).toContainText("sum(numbers)");

  await page.getByRole("button", { name: "Finish session" }).click();
  await expect(page.getByText(/Assessment complete/)).toBeVisible({ timeout: 60_000 });

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("link", { name: "Export analysis JSON" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/readiness-analysis\.json$/);
  const path = await download.path();
  expect(path).not.toBeNull();
  const exported = JSON.parse(await readFile(path!, "utf8")) as {
    privacy: {
      hiddenTestDetailsIncluded: boolean;
      referenceSolutionsIncluded: boolean;
      excluded: string[];
    };
    assessment: {
      problems: Array<{ finalCode: { source: string } | null }>;
    };
  };
  expect(exported.privacy.hiddenTestDetailsIncluded).toBe(false);
  expect(exported.privacy.referenceSolutionsIncluded).toBe(false);
  expect(exported.privacy.excluded).toEqual(expect.arrayContaining([
    "hidden test inputs",
    "hidden expected outputs",
    "reference solutions",
  ]));
  expect(exported.assessment.problems[0]?.finalCode?.source).toContain("sum(numbers)");

  await page.getByRole("button", { name: "Redo this assessment" }).click();
  await expect(page).toHaveURL(/\/assessment\/[^/]+$/);
  await expect(page.getByText("Array Total").first()).toBeVisible();
  await expect(page.locator(".monaco-editor .view-lines")).not.toContainText("sum(numbers)");
});

test("completes the two-question Roblox preset workflow", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Roblox Coding Assessment" })).toBeVisible();
  await expect(page.getByText("2 Questions · 50 Minutes")).toBeVisible();
  await page.getByRole("link", { name: /Practice Roblox/ }).click();

  await expect(page).toHaveURL(/\/import\?preset=roblox$/);
  await expect(page.getByRole("heading", { name: "New Roblox Practice." })).toBeVisible();
  await expect(page.getByText(/2 questions · 50 minutes/)).toBeVisible();
  await page.getByLabel(/I trust this assessment source/).check();
  await page.getByLabel("Upload JSON file").setInputFiles(
    resolve("fixtures/assessments/valid-roblox.json"),
  );
  await expect(page.getByText("Assessment is ready")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/2-problem Roblox semantics/)).toBeVisible();
  await page.getByRole("button", { name: "Start Roblox Assessment" }).click();

  await expect(page.locator(".assessment-brand")).toContainText("Roblox Practice");
  await expect(page.getByRole("button", { name: /Question 1:/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Question 2:/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Question 3:/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Question 4:/ })).toHaveCount(0);
  await expect(page.getByLabel("Time remaining")).toHaveText(/^(?:50:00|49:[0-5]\d)$/);

  await page.getByLabel("Programming language").selectOption("python");
  await page.locator(".monaco-editor .view-lines").click();
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.type(
    "def solution(grid):\n    return [list(row) for row in zip(*[([0] * (len(grid) - len([value for value in column if value != 0])) + [value for value in column if value != 0]) for column in zip(*grid)])]",
  );

  await page.getByRole("button", { name: "Run visible tests" }).click();
  await expect(page.getByText(/2\/2 passed/)).toBeVisible();
  await page.getByRole("button", { name: "Submit" }).click();
  await expect(page.getByText(/5\/5 passed/)).toBeVisible();
  await page.getByRole("button", { name: /Question 2:/ }).click();
  await expect(page.getByText("Best Square Zone").first()).toBeVisible();
  await page.getByRole("button", { name: /Question 1:/ }).click();

  await page.getByRole("button", { name: "Finish session" }).click();
  await expect(page.getByText(/Assessment complete/)).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText("Roblox Coding Practice Fixture")).toBeVisible();
  await expect(page.getByText("1 / 2")).toBeVisible();
  await expect(page.locator(".problem-result-row")).toHaveCount(2);

  await page.getByRole("link", { name: "View history" }).click();
  const completedRow = page.locator(".history-row--completed").filter({
    hasText: "Roblox Coding Practice Fixture",
  }).first();
  await expect(completedRow).toContainText("Roblox");
});
