import { BrowserRouter, Navigate, Outlet, Route, Routes } from "react-router-dom";

import Home from "@/pages/login";
import AuthenticatedLayout from "@/pages/layouts/authenticated-layout";
import DashboardPage from "@/pages/dashboard";
import PatientsTabsLayout from "@/pages/layouts/patients-tabs-layout";
import PatientsListPage from "@/pages/patients/list";
import PatientsAllergiesPage from "@/pages/patients/allergies";
import PatientsMedicinesPage from "@/pages/patients/medicines";
import PatientDetailPage from "@/pages/patients/patient-detail";
import ScheduleTabsLayout from "@/pages/layouts/schedule-tabs-layout";
import ScheduleCalendarPage from "@/pages/schedule/calendar";
import ScheduleRoomsPage from "@/pages/schedule/rooms";
import ReportsTabsLayout from "@/pages/layouts/reports-tabs-layout";
import ReportsForecastPage from "@/pages/reports/forecast";
import ReportsProfitLossPage from "@/pages/reports/profit-loss";
import InventoryTabsLayout from "@/pages/layouts/inventory-tabs-layout";
import InventoryProductsPage from "@/pages/inventory/products";
import InventoryCategoriesPage from "@/pages/inventory/categories";
import ProductDetailPage from "@/pages/inventory/product-detail";
import SuppliersPage from "@/pages/suppliers/list";
import SupplierDetailPage from "@/pages/suppliers/supplier-detail";
import FinancialsTabsLayout from "@/pages/layouts/financials-tabs-layout";
import FinancialsInvoicesPage from "@/pages/financials/invoices";
import FinancialsBalancesPage from "@/pages/financials/balances";
import FinancialsAdjustmentsPage from "@/pages/financials/adjustments";
import FinancialsDiscountsPage from "@/pages/financials/discounts";
import FinancialsCurrenciesPage from "@/pages/financials/currencies";
import InvoiceDetailPage from "@/pages/financials/invoice-detail";
import DiscountDetailPage from "@/pages/financials/discount-detail";
import ServicesTabsLayout from "@/pages/layouts/services-tabs-layout";
import ServicesProceduresPage from "@/pages/services/procedures";
import ServicesTypesPage from "@/pages/services/types";
import ServicesCategoriesPage from "@/pages/services/categories";
import ProcedureDetailPage from "@/pages/services/procedure-detail";
import TeamPage from "@/pages/team/list";
import TeamDetailPage from "@/pages/team/team-member-detail";
import SettingsTabsLayout from "@/pages/layouts/settings-tabs-layout";
import SettingsRolesPage from "@/pages/settings/roles";
import SettingsUsersPage from "@/pages/settings/users";
import SettingsAuditLogPage from "@/pages/settings/audit-log";
import UserDetailPage from "@/pages/settings/user-detail";
import { LoadingOverlay } from "@/components/shared/loading-overlay";
import { ThemeProvider } from "@/contexts/theme-context";

function LayoutRoute({
  layout: Layout,
}: {
  layout: React.ComponentType<{ children: React.ReactNode }>;
}) {
  return (
    <Layout>
      <Outlet />
    </Layout>
  );
}

function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route element={<LayoutRoute layout={AuthenticatedLayout} />}>
            <Route path="dashboard" element={<DashboardPage />} />

            <Route path="patients" element={<Navigate to="/patients/list" replace />} />
            <Route element={<LayoutRoute layout={PatientsTabsLayout} />}>
              <Route path="patients/list" element={<PatientsListPage />} />
              <Route path="patients/allergies" element={<PatientsAllergiesPage />} />
              <Route path="patients/medicines" element={<PatientsMedicinesPage />} />
            </Route>
            <Route path="patients/:id" element={<PatientDetailPage />} />

            <Route path="schedule" element={<Navigate to="/schedule/calendar" replace />} />
            <Route element={<LayoutRoute layout={ScheduleTabsLayout} />}>
              <Route path="schedule/calendar" element={<ScheduleCalendarPage />} />
              <Route path="schedule/rooms" element={<ScheduleRoomsPage />} />
            </Route>

            <Route path="reports" element={<Navigate to="/reports/forecast" replace />} />
            <Route element={<LayoutRoute layout={ReportsTabsLayout} />}>
              <Route path="reports/forecast" element={<ReportsForecastPage />} />
              <Route path="reports/profit-loss" element={<ReportsProfitLossPage />} />
            </Route>

            <Route path="inventory" element={<Navigate to="/inventory/products" replace />} />
            <Route element={<LayoutRoute layout={InventoryTabsLayout} />}>
              <Route path="inventory/products" element={<InventoryProductsPage />} />
              <Route path="inventory/categories" element={<InventoryCategoriesPage />} />
            </Route>
            <Route path="inventory/products/:id" element={<ProductDetailPage />} />

            <Route path="suppliers" element={<SuppliersPage />} />
            <Route path="suppliers/:id" element={<SupplierDetailPage />} />

            <Route path="financials" element={<Navigate to="/financials/invoices" replace />} />
            <Route element={<LayoutRoute layout={FinancialsTabsLayout} />}>
              <Route path="financials/invoices" element={<FinancialsInvoicesPage />} />
              <Route path="financials/balances" element={<FinancialsBalancesPage />} />
              <Route path="financials/adjustments" element={<FinancialsAdjustmentsPage />} />
              <Route path="financials/discounts" element={<FinancialsDiscountsPage />} />
              <Route path="financials/currencies" element={<FinancialsCurrenciesPage />} />
            </Route>
            <Route path="financials/invoices/:id" element={<InvoiceDetailPage />} />
            <Route path="financials/discounts/:id" element={<DiscountDetailPage />} />

            <Route path="services" element={<Navigate to="/services/procedures" replace />} />
            <Route element={<LayoutRoute layout={ServicesTabsLayout} />}>
              <Route path="services/procedures" element={<ServicesProceduresPage />} />
              <Route path="services/types" element={<ServicesTypesPage />} />
              <Route path="services/categories" element={<ServicesCategoriesPage />} />
            </Route>
            <Route path="services/procedures/:id" element={<ProcedureDetailPage />} />

            <Route path="team" element={<TeamPage />} />
            <Route path="team/:id" element={<TeamDetailPage />} />

            <Route path="settings" element={<Navigate to="/settings/roles" replace />} />
            <Route element={<LayoutRoute layout={SettingsTabsLayout} />}>
              <Route path="settings/roles" element={<SettingsRolesPage />} />
              <Route path="settings/users" element={<SettingsUsersPage />} />
              <Route path="settings/audit-log" element={<SettingsAuditLogPage />} />
            </Route>
            <Route path="settings/users/:id" element={<UserDetailPage />} />

            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
      <LoadingOverlay />
    </ThemeProvider>
  );
}

export default App;
