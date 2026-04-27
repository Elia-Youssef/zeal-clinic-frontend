"use client";

import { useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Connect a client</CardTitle>
          <CardDescription>
            Other devices on the same network can connect to this server using the
            address below. Scan the QR code from a mobile device or copy the URL
            manually.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
            <div className="flex shrink-0 items-center justify-center rounded-lg bg-white p-4 ring-1 ring-foreground/10">
              <QRCodeSVG value={data.url} size={200} level="M" />
            </div>

            <div className="flex flex-1 flex-col gap-3">
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">
                  Server URL
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 rounded-md border border-border bg-muted px-3 py-2 font-mono text-sm break-all">
                    {data.url}
                  </code>
                  <Button variant="outline" size="sm" onClick={handleCopy}>
                    {copied ? (
                      <>
                        <Check className="size-3.5" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="size-3.5" />
                        Copy
                      </>
                    )}
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">
                    Host
                  </p>
                  <p className="font-mono text-sm">{data.host}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">
                    Port
                  </p>
                  <p className="font-mono text-sm">{data.port}</p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
