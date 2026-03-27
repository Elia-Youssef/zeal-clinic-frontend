import { Users, CalendarDays, DollarSign, AlertTriangle, SlidersHorizontal } from "lucide-react"
import { DashboardWrapper } from "@/components/dashboard-wrapper"
import { StatCard } from "@/components/stat-card"
import { DataTable, type Column } from "@/components/data-table"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs } from "@/components/tabs"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

type InventoryItem = {
  sku: string
  name: string
  category: "Medication" | "Consumable" | "Equipment"
  quantity: number
  minQuantity: number
  unitPrice: number
  lastRestocked: string
}

const categoryVariant: Record<string, "default" | "secondary" | "outline"> = {
  Medication: "default",
  Consumable: "secondary",
  Equipment: "outline",
}

function StockBar({ quantity, min }: { quantity: number; min: number }) {
  const ratio = Math.min(quantity / (min * 5), 1)
  const isLow = quantity <= min
  return (
    <div className="flex items-center gap-2">
      <span className={`font-medium ${isLow ? "text-red-400" : ""}`}>{quantity}</span>
      <div className="h-2 w-20 rounded-full bg-muted">
        <div
          className={`h-full rounded-full ${isLow ? "bg-red-500" : "bg-green-500"}`}
          style={{ width: `${ratio * 100}%` }}
        />
      </div>
      {isLow && <AlertTriangle className="size-4 text-yellow-500" />}
    </div>
  )
}

const inventoryColumns: Column<InventoryItem>[] = [
  { key: "sku", header: "SKU", render: (row) => <span className="text-xs text-muted-foreground">{row.sku}</span> },
  { key: "name", header: "Name", render: (row) => <span className="font-medium">{row.name}</span> },
  { key: "category", header: "Category", render: (row) => <Badge variant={categoryVariant[row.category]}>{row.category}</Badge> },
  { key: "quantity", header: "Quantity", render: (row) => <StockBar quantity={row.quantity} min={row.minQuantity} /> },
  { key: "unitPrice", header: "Unit Price", className: "text-right", render: (row) => `$${row.unitPrice.toFixed(2)}` },
  { key: "totalValue", header: "Total Value", className: "text-right", render: (row) => `$${(row.quantity * row.unitPrice).toFixed(2)}` },
  { key: "lastRestocked", header: "Last Restocked", render: (row) => row.lastRestocked },
  { key: "actions", header: "Actions", className: "text-right", render: () => (
    <Button variant="ghost" size="sm" className="gap-1">
      <SlidersHorizontal className="size-3" />
      Adjust
    </Button>
  )},
]

const inventoryItems: InventoryItem[] = [
  { sku: "CON-003", name: "Alcohol Swabs (100pk)", category: "Consumable", quantity: 8, minQuantity: 10, unitPrice: 4.50, lastRestocked: "Mar 12, 2026" },
  { sku: "MED-002", name: "Amoxicillin 250mg", category: "Medication", quantity: 80, minQuantity: 20, unitPrice: 0.45, lastRestocked: "Mar 15, 2026" },
  { sku: "CON-002", name: "Bandage Roll 5cm", category: "Consumable", quantity: 45, minQuantity: 10, unitPrice: 2.25, lastRestocked: "Mar 19, 2026" },
  { sku: "EQP-001", name: "Digital Thermometer", category: "Equipment", quantity: 5, minQuantity: 2, unitPrice: 25.00, lastRestocked: "Feb 25, 2026" },
  { sku: "MED-003", name: "Ibuprofen 400mg", category: "Medication", quantity: 22, minQuantity: 40, unitPrice: 0.18, lastRestocked: "Mar 7, 2026" },
  { sku: "MED-001", name: "Paracetamol 500mg", category: "Medication", quantity: 240, minQuantity: 50, unitPrice: 0.12, lastRestocked: "Mar 22, 2026" },
  { sku: "CON-001", name: "Surgical Gloves (Box)", category: "Consumable", quantity: 15, minQuantity: 5, unitPrice: 8.50, lastRestocked: "Mar 24, 2026" },
  { sku: "CON-004", name: "Syringes 5ml (Box)", category: "Consumable", quantity: 30, minQuantity: 10, unitPrice: 12.00, lastRestocked: "Mar 20, 2026" },
]

export default function DashboardPage() {
  return (
    <DashboardWrapper title="Dashboard">
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard title="Total Patients" value="5" icon={Users} />
          <StatCard title="Today's Appointments" value="5" icon={CalendarDays} />
          <StatCard title="Revenue This Month" value="$175.00" icon={DollarSign} />
          <StatCard title="Low Stock Alerts" value="2" icon={AlertTriangle} valueClassName="text-red-500" />
        </div>

        <Tabs tabs={["All Transactions", "Invoices", "Receipts", "Refunds"]} />

        <Card>
          <CardHeader>
            <CardTitle>Inventory</CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable columns={inventoryColumns} data={inventoryItems} rowKey={(row) => row.sku} />
          </CardContent>
        </Card>
      </div>
    </DashboardWrapper>
  )
}
