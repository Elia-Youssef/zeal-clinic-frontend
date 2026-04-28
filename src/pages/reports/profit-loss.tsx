
import { useEffect, useState } from "react";
import { DollarSign, TrendingDown, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loading } from "@/components/shared/loading";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/utils";
import { useAlertStore } from "@/lib/stores/alert-store";
import type { ProfitLossReport } from "@/lib/types";
import { DatePicker } from "@/components/ui/date-picker";

function StatCard({
  title,
  value,
  icon: Icon,
}: {
  title: string;
  value: string;
  icon: React.ElementType;
}) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-1">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <Icon className="size-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}

export default function ProfitLossPage() {
  const addAlert = useAlertStore((s) => s.addAlert);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [data, setData] = useState<ProfitLossReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (from) params.set("from", from);
        if (to) params.set("to", to);
        const query = params.size > 0 ? `?${params.toString()}` : "";
        const report = await api.get<ProfitLossReport>(
          `/reports/profit-loss${query}`,
        );
        if (active) setData(report);
      } catch (err) {
        addAlert("error", getErrorMessage(err));
        if (active) setData(null);
      } finally {
        if (active) setLoading(false);
      }
    };

    load();
    return () => {
      active = false;
    };
  }, [addAlert, from, to]);

  if (loading) return <Loading />;
  if (!data) {
    return (
      <p className="py-12 text-center text-muted-foreground">
        Profit and loss data is unavailable.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">From</label>
            <DatePicker value={from} onChange={setFrom} />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">To</label>
            <DatePicker value={to} onChange={setTo} />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          title="Revenue"
          value={`$${data.totalRevenue.toFixed(2)}`}
          icon={TrendingUp}
        />
        <StatCard
          title="Expenses"
          value={`$${data.totalExpenses.toFixed(2)}`}
          icon={TrendingDown}
        />
        <StatCard
          title="Net Profit"
          value={`$${data.netProfit.toFixed(2)}`}
          icon={DollarSign}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Expense Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          {data.expenseBreakdown.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No expense breakdown returned by the API.
            </p>
          ) : (
            <div className="space-y-2">
              {data.expenseBreakdown.map((item) => (
                <div
                  key={item.category}
                  className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm"
                >
                  <p className="font-medium">{item.category}</p>
                  <p className="font-medium">${item.total.toFixed(2)}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
