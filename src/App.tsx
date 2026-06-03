import {
  BrowserRouter,
  Navigate,
  Outlet,
  Route,
  Routes,
} from "react-router-dom";

import Home from "@/pages/login";
import AuthenticatedLayout from "@/pages/layouts/authenticated-layout";
import DashboardPage from "@/pages/dashboard";
import ProfilePage from "@/pages/profile";
import PatientsTabsLayout from "@/pages/layouts/patients-tabs-layout";
import PatientsListPage from "@/pages/patients/list";
import PatientsAllergiesPage from "@/pages/patients/allergies";
import PatientsMedicinesPage from "@/pages/patients/medicines";
import PatientDetailPage from "@/pages/patients/patient-detail";
import ScheduleTabsLayout from "@/pages/layouts/schedule-tabs-layout";
import ScheduleCalendarPage from "@/pages/schedule/calendar";
import ScheduleRoomsPage from "@/pages/schedule/rooms";
import ReportsPage from "@/pages/reports";
import InventoryTabsLayout from "@/pages/layouts/inventory-tabs-layout";
import InventoryProductsPage from "@/pages/inventory/products";
import InventoryCategoriesPage from "@/pages/inventory/categories";
import ProductDetailPage from "@/pages/inventory/product-detail";
import SuppliersPage from "@/pages/suppliers/list";
import SupplierDetailPage from "@/pages/suppliers/supplier-detail";
import FinancialsTabsLayout from "@/pages/layouts/financials-tabs-layout";
import FinancialsInvoicesPage from "@/pages/financials/invoices";
import FinancialsExpensesPage from "@/pages/financials/expenses";
import FinancialsDiscountsPage from "@/pages/financials/discounts";
import FinancialsCurrenciesPage from "@/pages/financials/currencies";
import InvoiceDetailPage from "@/pages/financials/invoice-detail";
import ExpenseDetailPage from "@/pages/financials/expense-detail";
import DiscountDetailPage from "@/pages/financials/discount-detail";
import ServicesTabsLayout from "@/pages/layouts/services-tabs-layout";
import ServicesProceduresPage from "@/pages/services/procedures";
import ServicesTypesPage from "@/pages/services/types";
import ServicesCategoriesPage from "@/pages/services/categories";
import ProcedureDetailPage from "@/pages/services/procedure-detail";
import TeamPage from "@/pages/team/list";
import TeamHolidaysPage from "@/pages/team/holidays";
import TeamDetailPage from "@/pages/team/team-member-detail";
import TeamTabsLayout from "@/pages/layouts/team-tabs-layout";
import SettingsTabsLayout from "@/pages/layouts/settings-tabs-layout";
import SettingsRolesPage from "@/pages/settings/roles";
import SettingsRoleDetailPage from "@/pages/settings/role-detail";
import SettingsStaffPage from "@/pages/settings/users";
import SettingsAuditLogPage from "@/pages/settings/audit-log";
import SettingsAboutPage from "@/pages/settings/about";
import SettingsConnectionPage from "@/pages/settings/connection";
import StaffDetailPage from "@/pages/settings/user-detail";
import { LoadingOverlay } from "@/components/shared/loading-overlay";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { RequireScopes, ScopeRedirect } from "@/components/shared/scope-guard";
import "@/lib/stores/ui-store";

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
