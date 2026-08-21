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
    "def solution(grid):\n    return [list(row) for row in zip(*(sorted(column, key=lambda value: value != 0) for column in zip(*grid)))]",
  );
  await expect(page.locator(".monaco-editor .view-lines")).toContainText(
    "sorted(column",
  );

  await page.getByRole("button", { name: "Run visible tests" }).click();
  await expect(page.getByText(/2\/2 passed/)).toBeVisible({ timeout: 30_000 });
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

test("completes the unofficial two-question IMC SWE workflow", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "IMC Software Engineering Assessment" })).toBeVisible();
  await expect(page.getByText("2 Questions · 120 Minutes")).toBeVisible();
  await page.getByRole("link", { name: /Practice IMC/ }).click();

  await expect(page).toHaveURL(/\/import\?preset=imc$/);
  await expect(page.getByRole("heading", { name: "New IMC SWE Practice." })).toBeVisible();
  await expect(page.getByText(/2 questions · 120 minutes/)).toBeVisible();
  await expect(page.getByText(/Unofficial HackerRank-style SWE simulation/)).toBeVisible();
  await page.getByLabel(/I trust this assessment source/).check();
  await page.getByLabel("Upload JSON file").setInputFiles(
    resolve("fixtures/assessments/valid-imc.json"),
  );
  await expect(page.getByText("Assessment is ready")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/2-problem IMC semantics/)).toBeVisible();
  await page.getByRole("button", { name: "Start IMC Assessment" }).click();

  await expect(page.locator(".assessment-brand")).toContainText("IMC SWE Practice");
  await expect(page.getByRole("button", { name: /Question 1:/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Question 2:/ })).toBeVisible();
  await expect(page.getByText("Not Attempted")).toHaveCount(2);
  await expect(page.getByRole("button", { name: /Question 3:/ })).toHaveCount(0);
  await expect(page.getByLabel("Time remaining")).toHaveText(/^(?:2:00:00|1:59:[0-5]\d)$/);
  await expect(page.getByRole("button", { name: "Run Code" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Submit Code" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Finish Test" })).toBeVisible();

  await page.getByLabel("Programming language").selectOption("python");
  await page.locator(".monaco-editor .view-lines").click();
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.type(
    "def solution(starts, durations): return max(sum(1 for s, d in zip(starts, durations) if s <= t < s + d) for t in starts)",
  );
  await expect(page.getByText("Attempted", { exact: true })).toBeVisible();

  await page.getByText("Custom Input", { exact: true }).click();
  await page.getByLabel("Arguments JSON").fill("[[0,0],[2,3]]");
  await page.getByLabel("Expected JSON").fill("2");
  await page.getByRole("button", { name: "Test against custom input" }).click();
  await expect(page.getByText("Custom test")).toBeVisible({ timeout: 30_000 });

  await page.getByRole("button", { name: "Run Code" }).click();
  await expect(page.getByText(/3\/3 passed/)).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "Submit Code" }).click();
  await expect(page.getByText(/6\/6 passed/)).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("Submitted")).toBeVisible();

  await page.locator(".monaco-editor .view-lines").click();
  await page.keyboard.press("ControlOrMeta+End");
  await page.keyboard.type("\n");
  await page.getByRole("button", { name: "Submit Code" }).click();
  await expect(page.getByText(/6\/6 passed/)).toBeVisible({ timeout: 30_000 });

  await page.getByRole("button", { name: /Question 2:/ }).click();
  await expect(page.getByText("Dispatch Batch Ceiling").first()).toBeVisible();
  await page.getByRole("button", { name: /Question 1:/ }).click();
  await expect(page.locator(".monaco-editor .view-lines")).toContainText("zip(starts");

  await page.reload();
  await expect(page.locator(".assessment-brand")).toContainText("IMC SWE Practice");
  await expect(page.getByText("Submitted")).toBeVisible();

  await page.getByRole("button", { name: "Finish Test" }).click();
  await expect(page.getByText(/Assessment complete/)).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText("IMC SWE Practice Fixture")).toBeVisible();
  await expect(page.getByText("1 / 2")).toBeVisible();
  await expect(page.locator(".problem-result-row")).toHaveCount(2);

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("link", { name: "Export analysis JSON" }).click();
  const download = await downloadPromise;
  const path = await download.path();
  const exported = JSON.parse(await readFile(path!, "utf8")) as {
    kind: string;
    assessment: { preset: string };
  };
  expect(exported.kind).toBe("imc_practice_readiness_analysis");
  expect(exported.assessment.preset).toBe("imc");

  await page.getByRole("link", { name: "View history" }).click();
  const completedRow = page.locator(".history-row--completed").filter({
    hasText: "IMC SWE Practice Fixture",
  }).first();
  await expect(completedRow).toContainText("IMC");
});

test("completes the unofficial three-question CTC SWE workflow", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "CTC Software Engineering Assessment" })).toBeVisible();
  await expect(page.getByText("3 Questions · 180 Minutes")).toBeVisible();
  await page.getByRole("link", { name: /Practice CTC/ }).click();

  await expect(page).toHaveURL(/\/import\?preset=ctc$/);
  await expect(page.getByRole("heading", { name: "New CTC SWE Practice." })).toBeVisible();
  await expect(page.getByText(/3 questions · 180 minutes/)).toBeVisible();
  await expect(page.getByText(/Unofficial Codility-style SWE simulation/)).toBeVisible();
  await page.getByLabel(/I trust this assessment source/).check();
  await page.getByLabel("Upload JSON file").setInputFiles(
    resolve("fixtures/assessments/valid-ctc.json"),
  );
  await expect(page.getByText("Assessment is ready")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/3-problem CTC semantics/)).toBeVisible();
  await page.getByRole("button", { name: "Start CTC Assessment" }).click();

  await expect(page.locator(".assessment-brand")).toContainText("CTC SWE Practice");
  await expect(page.getByRole("button", { name: /Question 1:/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Question 2:/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Question 3:/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Question 4:/ })).toHaveCount(0);
  await expect(page.getByLabel("Time remaining")).toHaveText(/^(?:3:00:00|2:59:[0-5]\d)$/);

  await page.getByLabel("Programming language").selectOption("python");
  await page.locator(".monaco-editor .view-lines").click();
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.type(
    "def solution(keys, changes, threshold): return [key for i, key in enumerate(keys) if sum(changes[j] for j in range(i + 1) if keys[j] == key) >= threshold and all(sum(changes[j] for j in range(k + 1) if keys[j] == key) < threshold for k in range(i))]",
  );
  await page.getByRole("button", { name: "Run visible tests" }).click();
  await expect(page.getByText(/2\/2 passed/)).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "Submit" }).click();
  await expect(page.getByText(/6\/6 passed/)).toBeVisible({ timeout: 30_000 });

  await page.getByRole("button", { name: /Question 2:/ }).click();
  await expect(page.getByText("Capacity Ledger").first()).toBeVisible();
  await page.getByRole("button", { name: /Question 3:/ }).click();
  await expect(page.getByText("Stable Window Coverage").first()).toBeVisible();
  await page.getByRole("button", { name: /Question 1:/ }).click();
  await expect(page.locator(".monaco-editor .view-lines")).toContainText("enumerate(keys)");

  await page.getByRole("button", { name: "Finish session" }).click();
  await expect(page.getByText(/Assessment complete/)).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText("CTC SWE Practice Fixture")).toBeVisible();
  await expect(page.getByText("1 / 3")).toBeVisible();
  await expect(page.locator(".problem-result-row")).toHaveCount(3);

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("link", { name: "Export analysis JSON" }).click();
  const download = await downloadPromise;
  const path = await download.path();
  const exported = JSON.parse(await readFile(path!, "utf8")) as {
    kind: string;
    assessment: { preset: string };
  };
  expect(exported.kind).toBe("ctc_practice_readiness_analysis");
  expect(exported.assessment.preset).toBe("ctc");

  await page.getByRole("link", { name: "View history" }).click();
  const completedRow = page.locator(".history-row--completed").filter({
    hasText: "CTC SWE Practice Fixture",
  }).first();
  await expect(completedRow).toContainText("CTC");
});
