import { describe, expect, it } from "vitest";
import { auditActionStyles } from "@/lib/constants";

// The actions the server's audit log stores for a POST, a PUT or PATCH, and a DELETE.
const STORED_ACTIONS = ["create", "update", "delete"] as const;

describe("auditActionStyles", () => {
  it("colours each action the server stores, and nothing else", () => {
    expect(Object.keys(auditActionStyles).sort()).toEqual([...STORED_ACTIONS].sort());
    for (const action of STORED_ACTIONS) {
      expect(auditActionStyles[action]).toMatch(/^bg-\S+ text-\S+ border-\S+$/);
    }
  });
});
