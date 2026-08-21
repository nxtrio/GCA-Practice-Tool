// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ImportWorkflowClient } from "../src/api/importClient.ts";
import { HomePage } from "../src/pages/HomePage.tsx";

afterEach(() => cleanup());

describe("HomePage assessment presets", () => {
  it("offers GCA, Roblox, IMC, and unofficial CTC SWE practice", async () => {
    const client = {
      history: vi.fn(async () => ({ unfinished: [], completed: [] })),
      environment: vi.fn(async () => ({
        java: { available: true, version: "21" },
        cpp: { available: true, version: "clang 18" },
        python: { available: true, version: "3.13" },
      })),
    } as unknown as ImportWorkflowClient;

    render(<MemoryRouter><HomePage client={client} /></MemoryRouter>);

    expect(screen.getByRole("heading", { name: "General Coding Assessment" })).toBeDefined();
    expect(screen.getByRole("heading", { name: "Roblox Coding Assessment" })).toBeDefined();
    expect(screen.getByRole("heading", { name: "IMC Software Engineering Assessment" })).toBeDefined();
    expect(screen.getByRole("heading", { name: "CTC Software Engineering Assessment" })).toBeDefined();
    expect(screen.getByText("2 Questions · 120 Minutes")).toBeDefined();
    expect(screen.getByText("3 Questions · 180 Minutes")).toBeDefined();
    expect(screen.getByText(/Unofficial HackerRank-style algorithms/)).toBeDefined();
    expect(screen.getByRole("link", { name: /Practice IMC/ }).getAttribute("href")).toBe("/import?preset=imc");
    expect(screen.getByRole("link", { name: /Practice CTC/ }).getAttribute("href")).toBe("/import?preset=ctc");
  });
});
