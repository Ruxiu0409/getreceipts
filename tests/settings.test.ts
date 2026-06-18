import { describe, it, expect } from "vitest";
import { addStopHook, hasGetreceiptsHook } from "../src/settings";

describe("addStopHook", () => {
  it("adds a Stop hook to empty settings", () => {
    const out = addStopHook({});
    expect(hasGetreceiptsHook(out)).toBe(true);
    expect(out.hooks?.Stop).toHaveLength(1);
  });

  it("is idempotent — calling twice does not duplicate the hook", () => {
    const out = addStopHook(addStopHook({}));
    expect(out.hooks?.Stop).toHaveLength(1);
  });

  it("preserves existing unrelated hooks", () => {
    const existing = {
      hooks: {
        Stop: [{ hooks: [{ type: "command", command: "echo other" }] }],
        PostToolUse: [{ matcher: "Edit", hooks: [{ type: "command", command: "prettier" }] }],
      },
    };
    const out = addStopHook(existing);
    expect(out.hooks?.Stop).toHaveLength(2); // existing + ours
    expect(out.hooks?.PostToolUse).toHaveLength(1); // untouched
  });

  it("does not mutate the input object", () => {
    const input = {};
    addStopHook(input);
    expect(input).toEqual({});
  });
});
