import { describe, it, expect } from "vitest";
import { TibaTechPlugin } from "../src/tibatech-plugin";

describe("TibaTechPlugin", () => {
  it("should have the correct name", () => {
    const plugin = new TibaTechPlugin();
    expect(plugin.name).toBe("tibatech-integration");
  });

  it("should be instantiated with default config", () => {
    const plugin = new TibaTechPlugin();
    expect(plugin).toBeDefined();
  });
});