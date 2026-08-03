import { createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { HardHat, Loader2 } from "lucide-react";
import { getAuthSession, login, signup } from "@/lib/auth.functions";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Construction Intelligence Hub" },
      {
        name: "description",
        content:
          "Sign in or create an account to open the Construction Intelligence Hub command centre.",
      },
      { property: "og:title", content: "Sign in — Construction Intelligence Hub" },
      {
        property: "og:description",
        content: "Access the AI-powered construction command centre.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: async () => {
    const { username } = await getAuthSession();
    if (username) throw redirect({ to: "/" });
    return null;
  },
  component: AuthPage,
});

function AuthPage() {
  const router = useRouter();
  const doLogin = useServerFn(login);
  const doSignup = useServerFn(signup);
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const fn = mode === "login" ? doLogin : doSignup;
      const res = await fn({ data: { username, password } });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      await router.navigate({ to: "/" });
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center px-4 bg-background">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8 text-center">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
            <HardHat className="w-6 h-6 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">Construction Intelligence Hub</h1>
          <p className="text-sm text-[color:var(--muted)] mt-1">
            Sign in to open your project command centre.
          </p>
        </div>

        <div className="bg-surface border border-border rounded-2xl shadow-premium p-6">
          <div className="flex gap-1 p-1 bg-background rounded-lg mb-5">
            {(["login", "signup"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setMode(m);
                  setError(null);
                }}
                className={`flex-1 text-xs font-semibold py-2 rounded-md transition ${
                  mode === m
                    ? "bg-surface border border-border shadow-sm"
                    : "text-[color:var(--muted)]"
                }`}
              >
                {m === "login" ? "Log in" : "Sign up"}
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="text-xs font-medium text-[color:var(--muted)]" htmlFor="username">
                Username
              </label>
              <input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                className="mt-1 w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-[color:var(--muted)]" htmlFor="password">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                className="mt-1 w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
              />
            </div>

            {error && (
              <p className="text-xs text-[color:var(--danger)] font-medium">{error}</p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full bg-[color:var(--text-main)] text-surface py-2.5 rounded-lg text-sm font-semibold hover:bg-black transition disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {busy && <Loader2 className="w-4 h-4 animate-spin" />}
              {mode === "login" ? "Log in" : "Create account"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
