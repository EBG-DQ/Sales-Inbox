import { describe, expect, it } from "vitest";
import { chooseRandomSalesperson } from "../src/inngest/functions";

const salespeople = [
  { id: "sales-1", name: "Alex Morgan" },
  { id: "sales-2", name: "Jamie Lee" },
  { id: "sales-3", name: "Taylor Kim" },
];

describe("chooseRandomSalesperson", () => {
  it("selects the first salesperson when the random value is zero", () => {
    expect(chooseRandomSalesperson(salespeople, () => 0)).toEqual(salespeople[0]);
  });

  it("selects the last salesperson when the random value is near one", () => {
    expect(chooseRandomSalesperson(salespeople, () => 0.999)).toEqual(
      salespeople[2],
    );
  });

  it("throws when there are no salespeople", () => {
    expect(() => chooseRandomSalesperson([], () => 0)).toThrow(
      "Cannot assign lead: no salespeople exist",
    );
  });
});