import { describe, it, expect } from "vitest";
import { TibaTechPlugin } from "../src/tibatech-plugin";

describe("TibaTechPlugin", () => {
  it("should have the correct name", () => {
    expect(TibaTechPlugin.name).toBe("tibatech-integration");
  });

  it("should setup successfully", () => {
    expect(() => TibaTechPlugin.setup()).not.toThrow();
  });
});