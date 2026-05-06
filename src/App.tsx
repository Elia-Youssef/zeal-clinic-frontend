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
import FinancialsBalancesPage from "@/pages/financials/balances";
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
import SettingsUsersPage from "@/pages/settings/users";
import SettingsAuditLogPage from "@/pages/settings/audit-log";
import SettingsConnectionPage from "@/pages/settings/connection";
import UserDetailPage from "@/pages/settings/user-detail";
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
                  <RequireScopes scopes={["patients:read"]}>
                    <PatientsAllergiesPage />
                  </RequireScopes>
                }
              />
              <Route
                path="patients/medicines"
                element={
                  <RequireScopes scopes={["patients:read"]}>
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

            <Route
              path="inventory"
              element={
                <ScopeRedirect
                  targets={[
                    { to: "/inventory/products", scopes: ["inventory:read"] },
                  ]}
                />
              }
            />
            <Route element={<LayoutRoute layout={InventoryTabsLayout} />}>
              <Route
                path="inventory/products"
                element={
                  <RequireScopes scopes={["inventory:read"]}>
                    <InventoryProductsPage />
                  </RequireScopes>
                }
              />
              <Route
                path="inventory/categories"
                element={
                  <RequireScopes scopes={["inventory:read"]}>
                    <InventoryCategoriesPage />
                  </RequireScopes>
                }
              />
            </Route>
            <Route
              path="inventory/products/:id"
              element={
                <RequireScopes scopes={["inventory:read"]}>
                  <ProductDetailPage />
                </RequireScopes>
              }
            />

            <Route
              path="suppliers"
              element={
                <RequireScopes scopes={["inventory:read"]}>
                  <SuppliersPage />
                </RequireScopes>
              }
            />
            <Route
              path="suppliers/:id"
              element={
                <RequireScopes scopes={["inventory:read"]}>
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
                      scopes: ["transactions:read"],
                    },
                    { to: "/financials/discounts", scopes: ["services:read"] },
                  ]}
                />
              }
            />
            <Route element={<LayoutRoute layout={FinancialsTabsLayout} />}>
              <Route
                path="financials/invoices"
                element={
                  <RequireScopes scopes={["transactions:read"]}>
                    <FinancialsInvoicesPage />
                  </RequireScopes>
                }
              />
              <Route
                path="financials/expenses"
                element={
                  <RequireScopes scopes={["transactions:read"]}>
                    <FinancialsExpensesPage />
                  </RequireScopes>
                }
              />
              {/* <Route
                path="financials/balances"
                element={
                  <RequireScopes scopes={["transactions:read"]}>
                    <FinancialsBalancesPage />
                  </RequireScopes>
                }
              /> */}
              <Route
                path="financials/discounts"
                element={
                  <RequireScopes scopes={["services:read"]}>
                    <FinancialsDiscountsPage />
                  </RequireScopes>
                }
              />
              <Route
                path="financials/currencies"
                element={
                  <RequireScopes scopes={["transactions:read"]}>
                    <FinancialsCurrenciesPage />
                  </RequireScopes>
                }
              />
            </Route>
            <Route
              path="financials/invoices/:id"
              element={
                <RequireScopes scopes={["transactions:read"]}>
                  <InvoiceDetailPage />
                </RequireScopes>
              }
            />
            <Route
              path="financials/expenses/:id"
              element={
                <RequireScopes scopes={["transactions:read"]}>
                  <ExpenseDetailPage />
                </RequireScopes>
              }
            />
            <Route
              path="financials/discounts/:id"
              element={
                <RequireScopes scopes={["services:read"]}>
                  <DiscountDetailPage />
                </RequireScopes>
              }
            />

            <Route
              path="services"
              element={
                <ScopeRedirect
                  targets={[
                    { to: "/services/procedures", scopes: ["services:read"] },
                  ]}
                />
              }
            />
            <Route element={<LayoutRoute layout={ServicesTabsLayout} />}>
              <Route
                path="services/procedures"
                element={
                  <RequireScopes scopes={["services:read"]}>
                    <ServicesProceduresPage />
                  </RequireScopes>
                }
              />
              <Route
                path="services/types"
                element={
                  <RequireScopes scopes={["services:read"]}>
                    <ServicesTypesPage />
                  </RequireScopes>
                }
              />
              <Route
                path="services/categories"
                element={
                  <RequireScopes scopes={["services:read"]}>
                    <ServicesCategoriesPage />
                  </RequireScopes>
                }
              />
            </Route>
            <Route
              path="services/procedures/:id"
              element={
                <RequireScopes scopes={["services:read"]}>
                  <ProcedureDetailPage />
                </RequireScopes>
              }
            />

            <Route
              path="team"
              element={
                <ScopeRedirect
                  targets={[
                    { to: "/team/employees", scopes: ["team:read"] },
                    { to: "/team/holidays", scopes: ["schedule:read"] },
                  ]}
                />
              }
            />
            <Route element={<LayoutRoute layout={TeamTabsLayout} />}>
              <Route
                path="team/employees"
                element={
                  <RequireScopes scopes={["team:read"]}>
                    <TeamPage />
                  </RequireScopes>
                }
              />
              <Route
                path="team/holidays"
                element={
                  <RequireScopes scopes={["schedule:read"]}>
                    <TeamHolidaysPage />
                  </RequireScopes>
                }
              />
            </Route>
            <Route
              path="team/:id"
              element={
                <RequireScopes scopes={["team:read"]}>
                  <TeamDetailPage />
                </RequireScopes>
              }
            />

            <Route
              path="settings"
              element={
                <ScopeRedirect
                  targets={[
                    { to: "/settings/roles", scopes: ["roles:read"] },
                    { to: "/settings/users", scopes: ["team:read"] },
                    {
                      to: "/settings/audit-log",
                      scopes: ["roles:read", "team:read"],
                    },
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
                path="settings/users"
                element={
                  <RequireScopes scopes={["team:read"]}>
                    <SettingsUsersPage />
                  </RequireScopes>
                }
              />
              <Route
                path="settings/audit-log"
                element={
                  <RequireScopes scopes={["roles:read", "team:read"]}>
                    <SettingsAuditLogPage />
                  </RequireScopes>
                }
              />
              <Route
                path="settings/connection"
                element={
                  <RequireScopes scopes={["roles:read", "team:read"]}>
                    <SettingsConnectionPage />
                  </RequireScopes>
                }
              />
            </Route>
            <Route
              path="settings/users/:id"
              element={
                <RequireScopes scopes={["team:read"]}>
                  <UserDetailPage />
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
