import type { Locator, Page } from "@playwright/test";
import { ApiError } from "../support/api";
import { expect, test } from "../support/fixtures";
import { capturePdf, expectPdf } from "../support/pdf";
import type { Scenario } from "../support/scenario";
import { addDays, clinicDay, clinicTime, formatDay } from "../support/time";
import { choose, chooseIn, dialog, expectToast, field, input, pickDate, rows, trigger } from "../support/ui";

test.use({ role: "admin" });

/** DD/MM/YYYY, the way the PDFs print a date. */
const printed = (day: string) => day.split("-").reverse().join("/");

/** An appointment card on the day grid. */
const gridCard = (page: Page, patientName: string) =>
  page.locator('[data-slot="hover-card-trigger"]').filter({ hasText: patientName });

async function openDay(page: Page, day: string): Promise<void> {
  await page.goto(`/schedule/calendar?date=${day}`);
  await expect(page.getByRole("button", { name: "Day actions" })).toBeVisible();
}

/** One room, one patient and one procedure of its own, plus an appointment tomorrow if times are given. */
async function booking(scenario: Scenario, times?: [string, string]) {
  const day = addDays(clinicDay(), 1);
  const [room, patient, procedure] = await Promise.all([scenario.room(), scenario.patient(), scenario.procedure()]);
  const appointment = times
    ? await scenario.appointment({
        patientId: patient.id,
        roomId: room.id,
        procedureIds: [procedure.id],
        startTime: clinicTime(day, times[0]),
        endTime: clinicTime(day, times[1]),
      })
    : null;
  return { day, room, patient, procedure, appointment };
}

async function openNewAppointment(page: Page): Promise<Locator> {
  await page.getByRole("button", { name: "Quick Action" }).click();
  await page.getByRole("menuitem", { name: "New Appointment" }).click();
  return dialog(page, "New Appointment");
}

/** Presses on (x, y), moves by dy in small steps, and releases unless told not to. */
async function drag(page: Page, x: number, y: number, dy: number, release = true): Promise<void> {
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x, y + dy / 2, { steps: 6 });
  await page.mouse.move(x, y + dy, { steps: 6 });
  if (release) await page.mouse.up();
}

test("creates an appointment with two procedures and an employee on each", async ({ page, scenario }) => {
  const { day, room, patient, procedure } = await booking(scenario);
  const second = await scenario.procedure();
  const [nurse, doctor] = await Promise.all([scenario.employee(), scenario.employee({ role: "Doctor" })]);

  await openDay(page, day);
  const form = await openNewAppointment(page);
  await choose(form, "Patient", patient.fullName, patient.fullName);
  await choose(form, "Room", room.name, room.name);
  const procedures = field(form, "Procedures");
  const addProcedure = procedures.locator('[data-slot="popover-trigger"]', { hasText: "Add a procedure…" });
  await chooseIn(addProcedure, procedure.name, procedure.name);
  await chooseIn(addProcedure, second.name, second.name);
  const rowOf = (name: string) =>
    procedures.locator("div").filter({ has: page.getByRole("button", { name: `Remove ${name}` }) }).last();
  await chooseIn(rowOf(procedure.name).locator('[data-slot="popover-trigger"]'), nurse.fullName, nurse.fullName);
  await chooseIn(rowOf(second.name).locator('[data-slot="popover-trigger"]'), doctor.fullName, doctor.fullName);
  await pickDate(form, "Date", day);
  await input(form, "Start Time").fill("09:00");
  await input(form, "End Time").fill("10:00");
  await input(form, "Notes").fill("First visit");
  await form.getByRole("button", { name: "Create", exact: true }).click();
  await expectToast(page, "Appointment created.");

  // The header's quick action doesn't refresh the calendar behind it.
  await expect(gridCard(page, patient.fullName)).toHaveCount(0);
  await page.reload();
  await expect(gridCard(page, patient.fullName)).toContainText("9:00 AM - 10:00 AM");
  await page.getByRole("button", { name: "Table", exact: true }).click();
  const row = rows(page, patient.fullName);
  await expect(row).toContainText(room.name);
  await expect(row).toContainText(procedure.name);
  await expect(row).toContainText(second.name);
  await expect(row).toContainText("Scheduled");

  const saved = await scenario.get<{ items: { patientId: string; appointmentProcedures: { procedureId: string; assignedToId: string }[] }[] }>(
    `/appointments?date=${day}`,
  );
  const mine = saved.items.find((a) => a.patientId === patient.id);
  expect(mine?.appointmentProcedures.map((p) => [p.procedureId, p.assignedToId]).sort()).toEqual(
    [
      [procedure.id, nurse.id],
      [second.id, doctor.id],
    ].sort(),
  );
});

test("an appointment must last at least 15 minutes", async ({ page, scenario }) => {
  const { day, room, patient, procedure } = await booking(scenario);
  await openDay(page, day);
  const form = await openNewAppointment(page);
  await choose(form, "Patient", patient.fullName, patient.fullName);
  await choose(form, "Room", room.name, room.name);
  await chooseIn(field(form, "Procedures").locator('[data-slot="popover-trigger"]').last(), procedure.name, procedure.name);
  await pickDate(form, "Date", day);
  await input(form, "Start Time").fill("10:00");
  await input(form, "End Time").fill("10:10");
  await expect(form.getByText("Appointment duration must be at least 15 minutes.")).toBeVisible();
  await expect(form.getByRole("button", { name: "Create", exact: true })).toBeDisabled();
  await input(form, "End Time").fill("10:15");
  await expect(form.getByText("Appointment duration must be at least 15 minutes.")).toHaveCount(0);
  await expect(form.getByRole("button", { name: "Create", exact: true })).toBeEnabled();
});

test("moving into a booked slot is refused; creating one answers with a server error", async ({ page, guards, scenario }) => {
  const { day, room, patient, procedure } = await booking(scenario, ["11:00", "12:00"]);
  const other = await scenario.patient();
  await scenario.appointment({
    patientId: other.id,
    roomId: room.id,
    procedureIds: [procedure.id],
    startTime: clinicTime(day, "13:00"),
    endTime: clinicTime(day, "14:00"),
  });

  // Today's behavior: the API creates nothing, but reports the clash as a 500.
  const clash = await scenario
    .appointment({ patientId: other.id, roomId: room.id, procedureIds: [procedure.id], startTime: clinicTime(day, "11:30"), endTime: clinicTime(day, "12:30") })
    .catch((e: ApiError) => e);
  expect(clash).toBeInstanceOf(ApiError);
  expect((clash as ApiError).status).toBe(500);
  expect((clash as ApiError).serverMessage).toBe("Couldn't create appointment");

  guards.expectError("409 PUT /api/appointments/:id");
  await openDay(page, day);
  const form = dialog(page, "Edit Appointment");
  // Opened one after the other, each appointment shows its own values.
  await gridCard(page, patient.fullName).click();
  await expect(trigger(form, "Patient")).toContainText(patient.fullName);
  await expect(input(form, "Start Time")).toHaveValue("11:00");
  await form.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(form).toBeHidden();
  await gridCard(page, other.fullName).click();
  await expect(trigger(form, "Patient")).toContainText(other.fullName);
  await expect(input(form, "Start Time")).toHaveValue("13:00");

  await input(form, "Start Time").fill("11:30");
  await input(form, "End Time").fill("12:30");
  await form.getByRole("button", { name: "Update", exact: true }).click();
  await expectToast(page, "This room is already booked for that time");
  await expect(gridCard(page, patient.fullName)).toContainText("11:00 AM - 12:00 PM");
});

test("drags on the day grid: moving and stretching snap to 15 minutes, Esc cancels, Save and Reschedule", async ({ page, scenario }) => {
  const { day, patient, appointment } = await booking(scenario, ["08:30", "09:30"]);
  await openDay(page, day);
  const card = gridCard(page, patient.fullName);
  await expect(card).toContainText("8:30 AM - 9:30 AM");
  // The grid is 7.5rem per hour: 120 px per hour at the default 16 px root size, so 2 px per minute.
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).fontSize)).toBe("16px");

  let box = (await card.boundingBox())!;
  await drag(page, box.x + box.width / 2, box.y + box.height / 2, 62, false);
  await page.keyboard.press("Escape");
  await page.mouse.up();
  await expect(page.getByRole("button", { name: "Save", exact: true })).toHaveCount(0);
  await expect(card).toContainText("8:30 AM - 9:30 AM");

  // A drop swallows the next click for 300 ms.
  box = (await card.boundingBox())!;
  await drag(page, box.x + box.width / 2, box.y + box.height / 2, 62);
  await page.waitForTimeout(400);
  await expect(page.getByRole("button", { name: "Reschedule", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expectToast(page, "Appointment updated.");
  await expect(card).toContainText("9:00 AM - 10:00 AM");

  box = (await card.boundingBox())!;
  await drag(page, box.x + box.width / 2, box.y + box.height - 2, 32);
  await page.waitForTimeout(400);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(card).toContainText("9:00 AM - 10:15 AM");

  box = (await card.boundingBox())!;
  await drag(page, box.x + box.width / 2, box.y + box.height / 2, 62);
  await page.waitForTimeout(400);
  await page.getByRole("button", { name: "Reschedule", exact: true }).click();
  await page.getByPlaceholder("Reason for rescheduling…").fill("Patient asked for later");
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  await expectToast(page, "Appointment rescheduled.");
  await expect(card).toContainText("9:30 AM - 10:45 AM");

  const listed = await scenario.get<{ items: { id: string; patientId: string; status: string; rescheduledFrom?: string }[] }>(
    `/appointments?date=${day}`,
  );
  const mine = listed.items.filter((a) => a.patientId === patient.id);
  expect(mine).toHaveLength(1);
  expect(mine[0].id).not.toBe(appointment!.id);
  expect(mine[0].rescheduledFrom).toBe(appointment!.id);
  expect(mine[0].status).toBe("Scheduled");
});

test("reschedule from the form creates a linked appointment", async ({ page, scenario }) => {
  const { day, patient, appointment } = await booking(scenario, ["15:00", "16:00"]);
  await openDay(page, day);
  await gridCard(page, patient.fullName).click();
  const form = dialog(page, "Edit Appointment");
  await input(form, "Start Time").fill("16:00");
  await input(form, "End Time").fill("17:00");
  await form.getByRole("button", { name: "Reschedule", exact: true }).click();
  await expect(form).toContainText("Provide a reason for rescheduling this appointment.");
  await input(form, "Reschedule Reason").fill("Room needed earlier");
  await form.getByRole("button", { name: "Confirm Reschedule", exact: true }).click();
  await expectToast(page, "Appointment rescheduled.");
  await expect(gridCard(page, patient.fullName)).toContainText("4:00 PM - 5:00 PM");

  const listed = await scenario.get<{ items: { patientId: string; rescheduledFrom?: string }[] }>(`/appointments?date=${day}`);
  expect(listed.items.filter((a) => a.patientId === patient.id).map((a) => a.rescheduledFrom)).toEqual([appointment!.id]);
});

test("status moves: in-progress, cancelled, back to scheduled", async ({ page, scenario }) => {
  const { day, patient, procedure } = await booking(scenario, ["12:00", "13:00"]);
  const employee = await scenario.employee();
  await openDay(page, day);

  await gridCard(page, patient.fullName).click();
  let form = dialog(page, "Edit Appointment");
  await form.getByRole("button", { name: "Scheduled", exact: true }).click();
  await page.getByRole("menuitem", { name: "In-Progress" }).click();
  form = dialog(page, "Mark In-Progress");
  await expect(form).toContainText("Assign an employee to each procedure before starting this appointment.");
  await expect(form.getByRole("button", { name: "Confirm", exact: true })).toBeDisabled();
  await chooseIn(form.locator('[data-slot="popover-trigger"]', { hasText: "Assign employee…" }), employee.fullName, employee.fullName);
  await form.getByRole("button", { name: "Confirm", exact: true }).click();
  await expectToast(page, "Appointment marked in-progress.");

  await gridCard(page, patient.fullName).click();
  form = dialog(page, "Edit Appointment");
  await form.getByRole("button", { name: "In-Progress", exact: true }).click();
  await page.getByRole("menuitem", { name: "Cancelled" }).click();
  form = dialog(page, "Cancel Appointment");
  await expect(form).toContainText("Are you sure you want to cancel this appointment?");
  await input(form, "Cancellation Reason").fill("Patient unwell");
  await form.getByRole("button", { name: "Confirm Cancellation", exact: true }).click();
  await expectToast(page, "Appointment cancelled.");
  await expect(gridCard(page, patient.fullName)).toHaveCount(0);

  await page.getByRole("button", { name: "Table", exact: true }).click();
  const row = rows(page, patient.fullName);
  await expect(row).toContainText("Cancelled");
  await expect(row).toContainText(procedure.name);
  await row.click();
  form = dialog(page, "Edit Appointment");
  await form.getByRole("button", { name: "Cancelled", exact: true }).click();
  await page.getByRole("menuitem", { name: "Scheduled" }).click();
  form = dialog(page, "Return to Scheduled");
  await expect(form).toContainText("Cancelled appointments don't hold their slot on the calendar");
  await form.getByRole("button", { name: "Confirm", exact: true }).click();
  await expectToast(page, "Appointment returned to scheduled.");
  await expect(rows(page, patient.fullName)).toContainText("Scheduled");
});

test("week view counts, holidays and the day and week PDFs", async ({ page, scenario }) => {
  const { day, room, patient } = await booking(scenario, ["14:00", "15:00"]);
  const holidayDay = addDays(clinicDay(), 150);
  const holiday = await scenario.holiday(holidayDay);

  await openDay(page, day);
  const dayPdf = await capturePdf(page, async () => {
    await page.getByRole("button", { name: "Day actions" }).click();
    await page.getByRole("menuitem", { name: "Print" }).click();
  });
  expectPdf(dayPdf, ["Appointments", `Date: ${printed(day)}`, patient.fullName, "2:00 PM - 3:00 PM"]);

  await page.getByRole("button", { name: "Week", exact: true }).click();
  // The week grid: a header row of rooms, then one row per day starting with its label; the counts
  // arrive after the grid is drawn.
  const weekCount = () =>
    page
      .locator("h2")
      .filter({ hasText: " - " })
      .locator("xpath=../..")
      .evaluate(
        (view, target) => {
          const cells = [...view.querySelectorAll("div")];
          const header = cells.find((c) => c.children.length === 2 && c.firstElementChild?.textContent === target.room);
          if (!header?.parentElement) return null;
          const column = [...header.parentElement.children].indexOf(header);
          const rowStart = cells.find((c) => c.children[1]?.textContent === target.label);
          return rowStart?.parentElement?.children[column]?.textContent ?? null;
        },
        { room: room.name, label: formatDay(day, "d MMM") },
      );
  await expect.poll(weekCount).toBe("1");
  const weekPdf = await capturePdf(page, () => page.getByRole("button", { name: "Print week schedule" }).click());
  expectPdf(weekPdf, ["Appointments", patient.fullName]);

  await openDay(page, holidayDay);
  await expect(page.getByText(holiday.name, { exact: true })).toBeVisible();
});
