import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { permitFormSchema } from "../lib/schemas";

const VALID_ADDRESS = "0x" + "a".repeat(40);

describe("permitFormSchema — deadline validation", () => {
  const FIXED_NOW_S = 1_800_000_000; // arbitrary fixed unix time used for deterministic tests
  const FIXED_NOW_MS = FIXED_NOW_S * 1000;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(FIXED_NOW_MS));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("accepts a deadline strictly in the future", () => {
    const result = permitFormSchema.safeParse({
      spender: VALID_ADDRESS,
      value: "100",
      deadline: String(FIXED_NOW_S + 3600),
    });
    expect(result.success).toBe(true);
  });

  it("rejects a deadline equal to the current time", () => {
    const result = permitFormSchema.safeParse({
      spender: VALID_ADDRESS,
      value: "100",
      deadline: String(FIXED_NOW_S),
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/future/i);
    }
  });

  it("rejects a deadline in the past", () => {
    const result = permitFormSchema.safeParse({
      spender: VALID_ADDRESS,
      value: "100",
      deadline: String(FIXED_NOW_S - 1),
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/future/i);
    }
  });

  it("rejects a non-numeric deadline", () => {
    const result = permitFormSchema.safeParse({
      spender: VALID_ADDRESS,
      value: "100",
      deadline: "not-a-timestamp",
    });
    expect(result.success).toBe(false);
  });
});

describe("permitFormSchema — value & spender validation", () => {
  it("accepts value = 0 (permit revocation)", () => {
    const result = permitFormSchema.safeParse({
      spender: VALID_ADDRESS,
      value: "0",
      deadline: String(Math.floor(Date.now() / 1000) + 3600),
    });
    expect(result.success).toBe(true);
  });

  it("rejects malformed spender address", () => {
    const result = permitFormSchema.safeParse({
      spender: "0xnotanaddress",
      value: "1",
      deadline: String(Math.floor(Date.now() / 1000) + 3600),
    });
    expect(result.success).toBe(false);
  });

  it("rejects negative value", () => {
    const result = permitFormSchema.safeParse({
      spender: VALID_ADDRESS,
      value: "-1",
      deadline: String(Math.floor(Date.now() / 1000) + 3600),
    });
    expect(result.success).toBe(false);
  });
});
