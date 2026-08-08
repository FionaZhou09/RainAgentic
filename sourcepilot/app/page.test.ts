import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const redirect = vi.fn();

vi.mock("next/navigation", () => ({ redirect }));

describe("root route", () => {
  beforeEach(() => redirect.mockClear());

  it("redirects to the comparison screen without rendering an independent product screen", async () => {
    const source = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");
    expect(source).toContain('redirect("/compare")');

    const { default: Home } = await import("./page");
    expect(Home()).toBeUndefined();
    expect(redirect).toHaveBeenCalledOnce();
    expect(redirect).toHaveBeenCalledWith("/compare");
  });

  it("contains no default UI or client/meta redirect", () => {
    const source = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");

    expect(source).not.toMatch(/Create Next App|Vercel|next\.svg|vercel\.svg/);
    expect(source).not.toMatch(/["']use client["']|window\.location|router\.push|router\.replace|http-equiv|httpEquiv/i);
    expect(source).not.toContain("return (");
  });
});
