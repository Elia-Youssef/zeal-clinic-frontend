
import { useEffect, useState } from "react";
import { CalendarCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loading } from "@/components/shared/loading";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/utils";
import { useAlertStore } from "@/lib/stores/alert-store";
import type { ForecastReport } from "@/lib/types";

function StatCard({
  title,
  value,
  icon: Icon,
  subtitle,
}: {
  title: string;
  value: string;
  icon: React.ElementType;
  subtitle?: string;
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
        {subtitle && (
          <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
        )}
      </CardContent>
    </Card>
  );
}

export default function ForecastPage() {
  const addAlert = useAlertStore((s) => s.addAlert);
  const [data, setData] = useState<ForecastReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      try {
        const report = await api.get<ForecastReport>("/reports/forecast");
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
  }, [addAlert]);

  if (loading) return <Loading />;
  if (!data) {
    return (
      <p className="py-12 text-center text-muted-foreground">
        Forecast data is unavailable.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          title="This Week"
          value={data.thisWeek.toString()}
          icon={CalendarCheck}
          subtitle="Upcoming appointments"
        />
        <StatCard
          title="This Month"
          value={data.thisMonth.toString()}
          icon={CalendarCheck}
          subtitle="Remaining appointments"
        />
        <StatCard
          title="Next Month"
          value={data.nextMonth.toString()}
          icon={CalendarCheck}
          subtitle="Scheduled ahead"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Forecast by Category</CardTitle>
        </CardHeader>
        <CardContent>
          {data.byCategory.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No forecast categories returned by the API.
            </p>
          ) : (
            <div className="space-y-2">
              {data.byCategory.map((item) => (
                <div
                  key={item.category}
                  className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm"
                >
                  <div>
                    <p className="font-medium">{item.category}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.count} appointment{item.count === 1 ? "" : "s"}
                    </p>
                  </div>
                  <p className="font-medium">${item.revenue.toFixed(2)}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
