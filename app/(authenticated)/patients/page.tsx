"use client";

import { redirect } from "next/navigation";

export default function PatientsIndex() {
  redirect("/patients/list");
}
