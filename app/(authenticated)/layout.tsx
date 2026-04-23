"use client";

import { DashboardWrapper } from "@/components/dashboard-wrapper";

export default function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <DashboardWrapper>{children}</DashboardWrapper>;
}
