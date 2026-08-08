import path from "node:path";
import { describe, expect, it } from "vitest";
import nextConfig from "./next.config";

describe("Next.js deployment configuration", () => {
  it("traces serverless dependencies from the workspace root", () => {
    expect(nextConfig.outputFileTracingRoot).toBe(path.resolve(import.meta.dirname, ".."));
  });
});
