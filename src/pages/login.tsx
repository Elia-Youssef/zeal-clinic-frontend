import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/shared/form-field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { ClinicLogo } from "@/components/shared/clinic-logo";
import { useAuthStore } from "@/lib/stores/auth-store";
import { documentTitle } from "@/lib/stores/title-store";
import { api } from "@/lib/api";
import { useLoadingStore } from "@/lib/stores/loading-store";
import { consumeAuthRedirect } from "@/lib/auth-redirect";
import { Eye, EyeOff } from "lucide-react";

export default function Home() {
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);
  const hydrate = useAuthStore((s) => s.hydrate);
  const unblock = useLoadingStore((s) => s.unblock);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    document.title = documentTitle("Sign in");
  }, []);

  useEffect(() => {
    const token = sessionStorage.getItem("token");
    if (!token) {
      unblock();
      return;
    }

    let cancelled = false;
    api
      .get("/auth/verify")
      .then(() => {
        if (cancelled) return;
        hydrate();
        navigate(consumeAuthRedirect(), { replace: true });
      })
      .catch(() => {
        if (!cancelled) unblock();
      });

    return () => {
      cancelled = true;
    };
  }, [navigate, hydrate, unblock]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await login(username, password);
      navigate(consumeAuthRedirect(), { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to connect to the server.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-full w-full items-center justify-center bg-muted">
      <Card className="w-90 max-w-full gap-4 py-4">
        <CardHeader className="flex flex-col items-center text-center">
          <div className="aspect-square size-14 rounded-xl overflow-hidden mb-2">
            {/* Decorative: the clinic's name is right below. */}
            <ClinicLogo />
          </div>
          <CardTitle className="text-xl">Zeal Clinic</CardTitle>
          <CardDescription>Sign in to your account to continue</CardDescription>
        </CardHeader>

        <form onSubmit={handleSubmit}>
          <CardContent className="flex flex-col gap-3">
            <FormField label="Username" size="small">
              {({ id }) => (
                <Input
                  id={id}
                  type="text"
                  autoComplete="username"
                  placeholder="Enter your username"
                  value={username}
                  className="h-9"
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              )}
            </FormField>

            <FormField label="Password" size="small">
              {({ id }) => (
                <InputGroup className="h-9">
                  <InputGroupInput
                    id={id}
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <InputGroupAddon align="inline-end">
                    <InputGroupButton
                      size="icon-xs"
                      aria-label={
                        showPassword ? "Hide password" : "Show password"
                      }
                      onClick={() => setShowPassword((v) => !v)}
                    >
                      {showPassword ? <EyeOff /> : <Eye />}
                    </InputGroupButton>
                  </InputGroupAddon>
                </InputGroup>
              )}
            </FormField>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button
              type="submit"
              size="lg"
              className="w-full"
              disabled={loading}
            >
              {loading ? "Signing in…" : "Sign in"}
            </Button>
          </CardContent>
        </form>
      </Card>
    </div>
  );
}
