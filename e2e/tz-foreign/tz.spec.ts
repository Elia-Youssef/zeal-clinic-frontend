import type { Page } from "@playwright/test";
import { expect, test } from "../support/fixtures";
import { addDays, clinicDay, clinicTime, formatDay } from "../support/time";
import { dialog, input, pickDate } from "../support/ui";

// Beirut's clock changes: back at midnight on 2026-10-25 (23:00-23:59 on the 24th happens twice),
// forward at midnight on 2027-03-28 (00:00-00:59 doesn't exist).
const FALL_BACK_EVE = "2026-10-24";
const FALL_BACK_DAY = "2026-10-25";
const SPRING_FORWARD_DAY = "2027-03-28";

/** The day header of the calendar, e.g. "Friday 25 Sep". */
const dayHeading = (day: string) => formatDay(day, "EEEE d MMM");

const gridCard = (page: Page, patientName: string) =>
  page.locator('[data-slot="hover-card-trigger"]').filter({ hasText: patientName });

for (const zone of ["America/New_York", "Pacific/Kiritimati"]) {
  test.describe(`browser in ${zone}`, () => {
    test.use({ role: "admin", timezoneId: zone });

    test("the calendar opens on the clinic's today and shows clinic times", async ({ page, scenario }) => {
      const day = addDays(clinicDay(), 1);
      const [room, patient, procedure] = await Promise.all([scenario.room(), scenario.patient(), scenario.procedure()]);
      await scenario.appointment({
        patientId: patient.id,
        roomId: room.id,
        procedureIds: [procedure.id],
        startTime: clinicTime(day, "10:00"),
        endTime: clinicTime(day, "11:00"),
      });
      expect(await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone)).toBe(zone);

      await page.goto("/schedule/calendar");
      await expect(page.getByRole("heading", { level: 2 })).toHaveText(dayHeading(clinicDay()));
      await page.getByRole("button", { name: "Next day" }).click();
      await expect(page.getByRole("heading", { level: 2 })).toHaveText(dayHeading(day));
      await expect(gridCard(page, patient.fullName)).toContainText("10:00 AM - 11:00 AM");
    });

    test("appointments on the days the clock changes render in clinic time", async ({ page, scenario }) => {
      const [room, patient, procedure] = await Promise.all([scenario.room(), scenario.patient(), scenario.procedure()]);
      for (const day of [FALL_BACK_EVE, FALL_BACK_DAY, SPRING_FORWARD_DAY]) {
        await scenario.appointment({
          patientId: patient.id,
          roomId: room.id,
          procedureIds: [procedure.id],
          startTime: clinicTime(day, "10:00"),
          endTime: clinicTime(day, "11:30"),
        });
      }
      // The offsets differ across the change: UTC+3 before it, UTC+2 after, UTC+3 again in spring.
      expect(clinicTime(FALL_BACK_EVE, "10:00")).toBe(`${FALL_BACK_EVE}T07:00:00.000Z`);
      expect(clinicTime(FALL_BACK_DAY, "10:00")).toBe(`${FALL_BACK_DAY}T08:00:00.000Z`);
      expect(clinicTime(SPRING_FORWARD_DAY, "10:00")).toBe(`${SPRING_FORWARD_DAY}T07:00:00.000Z`);

      for (const day of [FALL_BACK_EVE, FALL_BACK_DAY, SPRING_FORWARD_DAY]) {
        await page.goto(`/schedule/calendar?date=${day}`);
        await expect(page.getByRole("heading", { level: 2 })).toHaveText(dayHeading(day));
        await expect(gridCard(page, patient.fullName)).toContainText("10:00 AM - 11:30 AM");
      }
    });

    test("times that don't exist or happen twice in Beirut are refused", async ({ page }) => {
      await page.goto("/schedule/calendar");
      await page.getByRole("button", { name: "Quick Action" }).click();
      await page.getByRole("menuitem", { name: "New Appointment" }).click();
      const form = dialog(page, "New Appointment");

      await pickDate(form, "Date", SPRING_FORWARD_DAY);
      await input(form, "Start Time").fill("00:30");
      await input(form, "End Time").fill("01:30");
      await expect(form).toContainText(
        "The selected start time does not exist in Beirut because of a daylight-saving transition. Choose another time.",
      );
      await expect(form.getByRole("button", { name: "Create", exact: true })).toBeDisabled();

      await pickDate(form, "Date", FALL_BACK_EVE);
      await input(form, "Start Time").fill("23:15");
      await input(form, "End Time").fill("23:45");
      await expect(form).toContainText(
        "The selected start time occurs twice in Beirut because of a daylight-saving transition. Choose another time.",
      );

      await input(form, "Start Time").fill("22:00");
      await input(form, "End Time").fill("22:30");
      await expect(form).not.toContainText("daylight-saving");
    });
  });
}
