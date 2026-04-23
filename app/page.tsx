"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuthStore } from "@/lib/stores/auth-store";
import { api, ApiError } from "@/lib/api";
import { useLoading } from "@/hooks/use-loading";
import { Activity, Eye, EyeOff } from "lucide-react";

export default function Home() {
  const router = useRouter();
  const login = useAuthStore((s) => s.login);
  const hydrate = useAuthStore((s) => s.hydrate);
  const { hide } = useLoading();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const token = localStorage.getItem("token");
    if (!token) {
      hide();
      return;
    }

    let cancelled = false;
    api
      .get("/auth/verify")
      .then(() => {
        if (cancelled) return;
        hydrate();
        router.replace("/dashboard");
      })
      .catch(() => {
        /* api.ts clears auth + redirects to "/" on 401; overlay stays up through reload */
        if (!cancelled) hide();
      });

    return () => {
      cancelled = true;
    };
  }, [router, hydrate, hide]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await login(username, password);
      router.push("/dashboard");
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Unable to connect to the server.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-1 items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-2xl">
        {/* Header */}
        <div className="mb-6 flex flex-col items-center gap-3">
          <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-linear-to-br from-blue-500 to-purple-600 shadow-lg">
            <Activity className="h-8 w-8 text-white" />
          </div>
          <div className="text-center">
            <h1 className="bg-linear-to-r from-blue-400 to-purple-400 bg-clip-text text-2xl font-bold text-transparent">
              Welcome
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Clinic Management System
            </p>
          </div>
        </div>

        <hr className="mb-6 border-border" />

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Username
            </label>
            <Input
              type="text"
              placeholder="Enter your username"
              value={username}
              className="py-5 px-3"
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Password
            </label>
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="py-5 pl-3 pr-10"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <Button
            type="submit"
            className="w-full bg-linear-to-r from-purple-600 to-blue-500 text-white shadow-lg transition-opacity hover:opacity-90 py-5 px-3 mt-3"
            disabled={loading}
          >
            {loading ? "Logging in…" : "Login"}
          </Button>
        </form>
      </div>
    </div>
  );
}
