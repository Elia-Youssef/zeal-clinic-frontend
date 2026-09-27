import { Suspense } from "react";
import {
  BrowserRouter,
  Navigate,
  Outlet,
  Route,
  Routes,
} from "react-router-dom";

import Home from "@/pages/login";
import AuthenticatedLayout from "@/pages/layouts/authenticated-layout";
import PatientsTabsLayout from "@/pages/layouts/patients-tabs-layout";
import ScheduleTabsLayout from "@/pages/layouts/schedule-tabs-layout";
import InventoryTabsLayout from "@/pages/layouts/inventory-tabs-layout";
import FinancialsTabsLayout from "@/pages/layouts/financials-tabs-layout";
import ServicesTabsLayout from "@/pages/layouts/services-tabs-layout";
import TeamTabsLayout from "@/pages/layouts/team-tabs-layout";
import SettingsTabsLayout from "@/pages/layouts/settings-tabs-layout";
import { LoadingOverlay } from "@/components/shared/loading-overlay";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { RequireScopes, ScopeRedirect } from "@/components/shared/scope-guard";
import { lazyPage } from "@/lib/lazy-page";
import "@/lib/stores/ui-store";

// The sign-in page and the layouts ship with the app; every other page is its
// own chunk, fetched on first visit (see lib/lazy-page.ts).
const DashboardPage = lazyPage(() => import("@/pages/dashboard"));
const ProfilePage = lazyPage(() => import("@/pages/profile"));
const PatientsListPage = lazyPage(() => import("@/pages/patients/list"));
const PatientsAllergiesPage = lazyPage(
  () => import("@/pages/patients/allergies"),
);
const PatientsMedicinesPage = lazyPage(
  () => import("@/pages/patients/medicines"),
);
const PatientDetailPage = lazyPage(
  () => import("@/pages/patients/patient-detail"),
);
const ScheduleCalendarPage = lazyPage(() => import("@/pages/schedule/calendar"));
const ScheduleRoomsPage = lazyPage(() => import("@/pages/schedule/rooms"));
const ReportsPage = lazyPage(() => import("@/pages/reports"));
const InventoryProductsPage = lazyPage(
  () => import("@/pages/inventory/products"),
);
const InventoryCategoriesPage = lazyPage(
  () => import("@/pages/inventory/categories"),
);
const ProductDetailPage = lazyPage(
  () => import("@/pages/inventory/product-detail"),
);
const SuppliersPage = lazyPage(() => import("@/pages/suppliers/list"));
const SupplierDetailPage = lazyPage(
  () => import("@/pages/suppliers/supplier-detail"),
);
const FinancialsInvoicesPage = lazyPage(
  () => import("@/pages/financials/invoices"),
);
const FinancialsExpensesPage = lazyPage(
  () => import("@/pages/financials/expenses"),
);
const FinancialsDiscountsPage = lazyPage(
  () => import("@/pages/financials/discounts"),
);
const FinancialsCurrenciesPage = lazyPage(
  () => import("@/pages/financials/currencies"),
);
const InvoiceDetailPage = lazyPage(
  () => import("@/pages/financials/invoice-detail"),
);
const ExpenseDetailPage = lazyPage(
  () => import("@/pages/financials/expense-detail"),
);
const DiscountDetailPage = lazyPage(
  () => import("@/pages/financials/discount-detail"),
);
const ServicesProceduresPage = lazyPage(
  () => import("@/pages/services/procedures"),
);
const ServicesTypesPage = lazyPage(() => import("@/pages/services/types"));
const ServicesCategoriesPage = lazyPage(
  () => import("@/pages/services/categories"),
);
const ProcedureDetailPage = lazyPage(
  () => import("@/pages/services/procedure-detail"),
);
const TeamPage = lazyPage(() => import("@/pages/team/list"));
const TeamHolidaysPage = lazyPage(() => import("@/pages/team/holidays"));
const TeamDetailPage = lazyPage(() => import("@/pages/team/team-member-detail"));
const SettingsRolesPage = lazyPage(() => import("@/pages/settings/roles"));
const SettingsRoleDetailPage = lazyPage(
  () => import("@/pages/settings/role-detail"),
);
const SettingsStaffPage = lazyPage(() => import("@/pages/settings/users"));
const SettingsAuditLogPage = lazyPage(
  () => import("@/pages/settings/audit-log"),
);
const SettingsAboutPage = lazyPage(() => import("@/pages/settings/about"));
const SettingsConnectionPage = lazyPage(
  () => import("@/pages/settings/connection"),
);
const StaffDetailPage = lazyPage(() => import("@/pages/settings/user-detail"));

// A page chunk that is still loading keeps the layout (shell or tabs) in
// place and leaves its content area empty until it arrives.
function LayoutRoute({
  layout: Layout,
}: {
  layout: React.ComponentType<{ children: React.ReactNode }>;
}) {
  return (
    <Layout>
      <Suspense fallback={null}>
        <Outlet />
      </Suspense>
    </Layout>
  );
}

function App() {
  return (
    <>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route element={<LayoutRoute layout={AuthenticatedLayout} />}>
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="profile" element={<ProfilePage />} />

            <Route
              path="patients"
              element={
                <ScopeRedirect
                  targets={[
                    { to: "/patients/list", scopes: ["patients:read"] },
                  ]}
                />
              }
            />
            <Route element={<LayoutRoute layout={PatientsTabsLayout} />}>
              <Route
                path="patients/list"
                element={
                  <RequireScopes scopes={["patients:read"]}>
                    <PatientsListPage />
                  </RequireScopes>
                }
              />
              <Route
                path="patients/allergies"
                element={
                  <RequireScopes scopes={["allergies:read"]}>
                    <PatientsAllergiesPage />
                  </RequireScopes>
                }
              />
              <Route
                path="patients/medicines"
                element={
                  <RequireScopes scopes={["medicines:read"]}>
                    <PatientsMedicinesPage />
                  </RequireScopes>
                }
              />
            </Route>
            <Route
              path="patients/:id"
              element={
                <RequireScopes scopes={["patients:read"]}>
                  <PatientDetailPage />
                </RequireScopes>
              }
            />

            <Route
              path="schedule"
              element={
                <ScopeRedirect
                  targets={[
                    { to: "/schedule/calendar", scopes: ["appointments:read"] },
                    { to: "/schedule/rooms", scopes: ["rooms:read"] },
                  ]}
                />
              }
            />
            <Route element={<LayoutRoute layout={ScheduleTabsLayout} />}>
              <Route
                path="schedule/calendar"
                element={
                  <RequireScopes scopes={["appointments:read"]}>
                    <ScheduleCalendarPage />
                  </RequireScopes>
                }
              />
              <Route
                path="schedule/rooms"
                element={
                  <RequireScopes scopes={["rooms:read"]}>
                    <ScheduleRoomsPage />
                  </RequireScopes>
                }
              />
            </Route>

            <Route
              path="reports"
              element={
                <RequireScopes scopes={["reports:read"]}>
                  <ReportsPage />
                </RequireScopes>
              }
            />
            <Route path="connection" element={<SettingsConnectionPage />} />

            <Route
              path="inventory"
              element={
                <ScopeRedirect
                  targets={[
                    { to: "/inventory/products", scopes: ["products:read"] },
                    {
                      to: "/inventory/categories",
                      scopes: ["product-categories:read"],
                    },
                  ]}
                />
              }
            />
            <Route element={<LayoutRoute layout={InventoryTabsLayout} />}>
              <Route
                path="inventory/products"
                element={
                  <RequireScopes scopes={["products:read"]}>
                    <InventoryProductsPage />
                  </RequireScopes>
                }
              />
              <Route
                path="inventory/categories"
                element={
                  <RequireScopes scopes={["product-categories:read"]}>
                    <InventoryCategoriesPage />
                  </RequireScopes>
                }
              />
            </Route>
            <Route
              path="inventory/products/:id"
              element={
                <RequireScopes scopes={["products:read"]}>
                  <ProductDetailPage />
                </RequireScopes>
              }
            />

            <Route
              path="suppliers"
              element={
                <RequireScopes scopes={["suppliers:read"]}>
                  <SuppliersPage />
                </RequireScopes>
              }
            />
            <Route
              path="suppliers/:id"
              element={
                <RequireScopes scopes={["suppliers:read"]}>
                  <SupplierDetailPage />
                </RequireScopes>
              }
            />

            <Route
              path="financials"
              element={
                <ScopeRedirect
                  targets={[
                    {
                      to: "/financials/invoices",
                      scopes: ["invoices:read"],
                    },
                    { to: "/financials/expenses", scopes: ["expenses:read"] },
                    { to: "/financials/discounts", scopes: ["discounts:read"] },
                    {
                      to: "/financials/currencies",
                      scopes: ["currencies:read"],
                    },
                  ]}
                />
              }
            />
            <Route element={<LayoutRoute layout={FinancialsTabsLayout} />}>
              <Route
                path="financials/invoices"
                element={
                  <RequireScopes scopes={["invoices:read"]}>
                    <FinancialsInvoicesPage />
                  </RequireScopes>
                }
              />
              <Route
                path="financials/expenses"
                element={
                  <RequireScopes scopes={["expenses:read"]}>
                    <FinancialsExpensesPage />
                  </RequireScopes>
                }
              />
              <Route
                path="financials/discounts"
                element={
                  <RequireScopes scopes={["discounts:read"]}>
                    <FinancialsDiscountsPage />
                  </RequireScopes>
                }
              />
              <Route
                path="financials/currencies"
                element={
                  <RequireScopes scopes={["currencies:read"]}>
                    <FinancialsCurrenciesPage />
                  </RequireScopes>
                }
              />
            </Route>
            <Route
              path="financials/invoices/:id"
              element={
                <RequireScopes scopes={["invoices:read"]}>
                  <InvoiceDetailPage />
                </RequireScopes>
              }
            />
            <Route
              path="financials/expenses/:id"
              element={
                <RequireScopes scopes={["expenses:read"]}>
                  <ExpenseDetailPage />
                </RequireScopes>
              }
            />
            <Route
              path="financials/discounts/:id"
              element={
                <RequireScopes scopes={["discounts:read"]}>
                  <DiscountDetailPage />
                </RequireScopes>
              }
            />

            <Route
              path="services"
              element={
                <ScopeRedirect
                  targets={[
                    { to: "/services/procedures", scopes: ["procedures:read"] },
                    { to: "/services/types", scopes: ["procedure-types:read"] },
                    {
                      to: "/services/categories",
                      scopes: ["procedure-categories:read"],
                    },
                  ]}
                />
              }
            />
            <Route element={<LayoutRoute layout={ServicesTabsLayout} />}>
              <Route
                path="services/procedures"
                element={
                  <RequireScopes scopes={["procedures:read"]}>
                    <ServicesProceduresPage />
                  </RequireScopes>
                }
              />
              <Route
                path="services/types"
                element={
                  <RequireScopes scopes={["procedure-types:read"]}>
                    <ServicesTypesPage />
                  </RequireScopes>
                }
              />
              <Route
                path="services/categories"
                element={
                  <RequireScopes scopes={["procedure-categories:read"]}>
                    <ServicesCategoriesPage />
                  </RequireScopes>
                }
              />
            </Route>
            <Route
              path="services/procedures/:id"
              element={
                <RequireScopes scopes={["procedures:read"]}>
                  <ProcedureDetailPage />
                </RequireScopes>
              }
            />

            <Route
              path="team"
              element={
                <ScopeRedirect
                  targets={[
                    { to: "/team/employees", scopes: ["employees:read"] },
                    { to: "/team/holidays", scopes: ["hr:read"] },
                  ]}
                />
              }
            />
            <Route element={<LayoutRoute layout={TeamTabsLayout} />}>
              <Route
                path="team/employees"
                element={
                  <RequireScopes scopes={["employees:read"]}>
                    <TeamPage />
                  </RequireScopes>
                }
              />
              <Route
                path="team/holidays"
                element={
                  <RequireScopes scopes={["hr:read"]}>
                    <TeamHolidaysPage />
                  </RequireScopes>
                }
              />
            </Route>
            <Route
              path="team/:id"
              element={
                <RequireScopes scopes={["employees:read"]}>
                  <TeamDetailPage />
                </RequireScopes>
              }
            />

            <Route
              path="settings"
              element={
                <ScopeRedirect
                  targets={[
                    { to: "/settings/staff", scopes: ["users:read"] },
                    { to: "/settings/roles", scopes: ["roles:read"] },
                    {
                      to: "/settings/audit-log",
                      scopes: ["audit:read"],
                    },
                    { to: "/settings/about", scopes: ["update:read"] },
                  ]}
                />
              }
            />
            <Route element={<LayoutRoute layout={SettingsTabsLayout} />}>
              <Route
                path="settings/roles"
                element={
                  <RequireScopes scopes={["roles:read"]}>
                    <SettingsRolesPage />
                  </RequireScopes>
                }
              />
              <Route
                path="settings/staff"
                element={
                  <RequireScopes scopes={["users:read"]}>
                    <SettingsStaffPage />
                  </RequireScopes>
                }
              />
              <Route
                path="settings/audit-log"
                element={
                  <RequireScopes scopes={["audit:read"]}>
                    <SettingsAuditLogPage />
                  </RequireScopes>
                }
              />
              <Route
                path="settings/about"
                element={
                  <RequireScopes scopes={["update:read"]}>
                    <SettingsAboutPage />
                  </RequireScopes>
                }
              />
            </Route>
            <Route
              path="settings/roles/:name"
              element={
                <RequireScopes scopes={["roles:read"]}>
                  <SettingsRoleDetailPage />
                </RequireScopes>
              }
            />
            <Route
              path="settings/staff/:id"
              element={
                <RequireScopes scopes={["users:read"]}>
                  <StaffDetailPage />
                </RequireScopes>
              }
            />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
      <LoadingOverlay />
      <ConfirmDialog />
    </>
  );
}

export default App;
