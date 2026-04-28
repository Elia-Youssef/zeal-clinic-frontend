import { useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loading } from "@/components/shared/loading";
import { api } from "@/lib/api";
import { getErrorMessage } from "@/lib/utils";
import { useAlertStore } from "@/lib/stores/alert-store";

type ServerUrl = {
  url: string;
  host: string;
  port: string;
};

export default function ConnectionPage() {
  const addAlert = useAlertStore((s) => s.addAlert);
  const [data, setData] = useState<ServerUrl | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      try {
        const res = await api.get<ServerUrl>("/server-url");
        if (active) setData(res);
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

  const handleCopy = async () => {
    if (!data) return;
    try {
      await navigator.clipboard.writeText(data.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      addAlert("error", getErrorMessage(err));
    }
  };

  if (loading) return <Loading />;
  if (!data) {
    return (
      <p className="py-12 text-center text-muted-foreground">
        Server address is unavailable.
      </p>
    );
  }

  return (
    <div className="flex items-center justify-around">
      <Card className="w-100">
        <CardHeader>
          <CardTitle>Connect a client</CardTitle>
          <CardDescription>
            Other devices on the same network can connect to this server using
            the address below. Scan the QR code from a mobile device or copy the
            URL manually.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <div className="flex flex-col gap-6 mt-2 items-center">
            <div className="flex shrink-0 items-center justify-center rounded-lg bg-white p-4 ring-1 ring-foreground/10">
              <QRCodeSVG
                value={data.url}
                size={200}
                level="M"
                fgColor="#090b0c"
              />
            </div>

            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">
                Server URL
              </p>
              <code className="flex flex-row items-center justify-between flex-1 rounded-md border border-border bg-muted px-3 gap-4">
                <span className="font-mono text-sm break-all">{data.url}</span>
                <Button variant="ghost" onClick={handleCopy} className="p-0">
                  {copied ? (
                    <Check className="size-3.5" />
                  ) : (
                    <Copy className="size-3.5" />
                  )}
                </Button>
              </code>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
