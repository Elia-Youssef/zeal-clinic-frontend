import { describe, expect, it } from "vitest";
import { documentTitle } from "@/lib/stores/title-store";

describe("documentTitle", () => {
  it("puts the most specific part first and the app name last", () => {
    expect(documentTitle("Allergies", "Patients")).toBe("Allergies · Patients · Zeal Clinic");
    expect(documentTitle("Sign in")).toBe("Sign in · Zeal Clinic");
  });

  it("skips empty parts and a tab named like its section", () => {
    expect(documentTitle("", "Invoice")).toBe("Invoice · Zeal Clinic");
    expect(documentTitle("Patients", "Patients")).toBe("Patients · Zeal Clinic");
    expect(documentTitle("", "")).toBe("Zeal Clinic");
  });
});
