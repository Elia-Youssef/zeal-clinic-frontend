import { describe, expect, it } from "vitest";
import { resourceLabel } from "@/lib/scopes";

describe("resourceLabel", () => {
  it("labels abbreviation resources as the app writes them", () => {
    expect(resourceLabel("hr")).toBe("HR");
  });

  it("capitalises plain-word resources word by word", () => {
    expect(resourceLabel("patients")).toBe("Patients");
    expect(resourceLabel("cloud-restore")).toBe("Cloud Restore");
    expect(resourceLabel("procedure-allergy-conflicts")).toBe(
      "Procedure Allergy Conflicts",
    );
  });
});
