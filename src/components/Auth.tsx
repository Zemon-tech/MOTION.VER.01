import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/utils";
import { ShaderAnimation } from "@/components/ui/shader-animation";
import { Logo } from "@/components/Logo";
import { setFavicon } from "@/lib/meta";
import { useNavigate } from "react-router-dom";

type Mode = "login" | "signup";

const PASSWORD_RULES = {
  lowercase: /[a-z]/,
  uppercase: /[A-Z]/,
  digit: /\d/,
  special: /[^A-Za-z0-9]/,
};

function getPasswordValidationMessage(password: string): string | null {
  if (password.length < 8)
    return "Password must be at least 8 characters long.";
  if (!PASSWORD_RULES.lowercase.test(password))
    return "Password must include at least one lowercase letter.";
  if (!PASSWORD_RULES.uppercase.test(password))
    return "Password must include at least one uppercase letter.";
  if (!PASSWORD_RULES.digit.test(password))
    return "Password must include at least one digit.";
  if (!PASSWORD_RULES.special.test(password))
    return "Password must include at least one special character.";
  return null;
}

export function AuthPage() {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // Ensure favicon uses system theme on Auth page (no per-page icon here)
  useEffect(() => {
    setFavicon();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (mode === "signup") {
      if (!email.trim() || !password.trim()) {
        setError("Email and password are required.");
        return;
      }
      const passwordError = getPasswordValidationMessage(password);
      if (passwordError) {
        setError(passwordError);
        return;
      }
    } else {
      if (!email.trim() || !password.trim()) {
        setError("Please enter both email and password to sign in.");
        return;
      }
    }

    setLoading(true);
    try {
      if (mode === "signup") {
        const res = await api<{ user: any; accessToken: string }>(
          "/auth/signup",
          {
            method: "POST",
            body: JSON.stringify({ email, password, name: name || undefined }),
          },
        );
        localStorage.setItem("accessToken", res.accessToken);
        localStorage.setItem("user", JSON.stringify(res.user));
        window.dispatchEvent(new Event("auth-updated"));
        navigate("/");
      } else {
        const res = await api<{ user: any; accessToken: string }>(
          "/auth/login",
          {
            method: "POST",
            body: JSON.stringify({ email, password }),
          },
        );
        localStorage.setItem("accessToken", res.accessToken);
        localStorage.setItem("user", JSON.stringify(res.user));
        window.dispatchEvent(new Event("auth-updated"));
        navigate("/");
      }
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        // Backend sends flattened Zod errors for validation failures.
        const details = err.details as
          | { fieldErrors?: Record<string, string[]>; formErrors?: string[] }
          | undefined;
        const fieldErrors = details?.fieldErrors;
        const firstFieldError = fieldErrors
          ? Object.values(fieldErrors).find(
              (msgs) => Array.isArray(msgs) && msgs.length > 0,
            )?.[0]
          : undefined;
        const formError = details?.formErrors?.[0];
        setError(firstFieldError || formError || err.message || "Failed");
      } else if (err instanceof Error) {
        setError(err.message || "Failed");
      } else {
        setError("Failed");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-svh grid grid-cols-1 md:grid-cols-[1.2fr_0.8fr]">
      <div className="relative hidden md:block">
        <ShaderAnimation />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/30" />
      </div>

      <div className="relative flex items-center justify-center p-6 md:p-10">
        <div className="w-full max-w-sm rounded-2xl border bg-background/80 shadow-xl backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="p-6 md:p-7">
            <div className="mb-6">
              <div className="mb-2 text-center">
                <Logo size={40} className="text-foreground" />
              </div>
              <h1 className="text-2xl font-semibold text-center tracking-tight">
                {mode === "signup" ? "Create your account" : "Welcome back"}
              </h1>
              <p className="mt-1 text-center text-sm text-muted-foreground">
                {mode === "signup"
                  ? "Start crafting beautiful pages in minutes"
                  : "Sign in to continue to Motion"}
              </p>
            </div>

            <div className="mb-5 grid grid-cols-2 gap-1 rounded-lg bg-muted p-1 text-sm">
              <button
                type="button"
                onClick={() => setMode("login")}
                className={`rounded-md py-2 font-medium transition ${mode === "login" ? "bg-background shadow" : "opacity-70 hover:opacity-100"}`}
              >
                Sign in
              </button>
              <button
                type="button"
                onClick={() => setMode("signup")}
                className={`rounded-md py-2 font-medium transition ${mode === "signup" ? "bg-background shadow" : "opacity-70 hover:opacity-100"}`}
              >
                Sign up
              </button>
            </div>

            <form onSubmit={submit} className="space-y-4">
              {mode === "signup" ? (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Name</label>
                  <input
                    className="w-full rounded-lg border bg-background px-3 py-2 outline-none ring-0 focus-visible:border-foreground/60"
                    placeholder="Your name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
              ) : null}

              <div className="space-y-2">
                <label className="text-sm font-medium">Email</label>
                <input
                  className="w-full rounded-lg border bg-background px-3 py-2 outline-none ring-0 focus-visible:border-foreground/60"
                  placeholder="name@example.com"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Password</label>
                <input
                  className="w-full rounded-lg border bg-background px-3 py-2 outline-none ring-0 focus-visible:border-foreground/60"
                  placeholder="••••••••"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                {mode === "signup" ? (
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Your password must include at least 8 characters, one
                    lowercase letter, one uppercase letter, one digit, and one
                    special character.
                  </p>
                ) : null}
              </div>

              {error ? (
                <div className="text-sm text-red-600">{error}</div>
              ) : null}

              <button
                type="submit"
                disabled={loading}
                className="mt-2 w-full rounded-lg bg-foreground px-3 py-2 font-medium text-background transition hover:opacity-90 disabled:opacity-70"
              >
                {loading
                  ? "Please wait…"
                  : mode === "signup"
                    ? "Create account"
                    : "Sign in"}
              </button>
            </form>

            <div className="mt-4 text-center text-sm text-muted-foreground">
              {mode === "signup" ? (
                <button
                  type="button"
                  className="underline"
                  onClick={() => setMode("login")}
                >
                  Have an account? Sign in
                </button>
              ) : (
                <button
                  type="button"
                  className="underline"
                  onClick={() => setMode("signup")}
                >
                  New here? Create account
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
