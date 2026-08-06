import { useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { Sidebar } from "@/components/Sidebar";
import { AIBar } from "@/components/AIBar";
import { WelcomeScreen } from "@/components/WelcomeScreen";
import { Wizard } from "@/components/Wizard";
import { Dashboard } from "@/components/modules/Dashboard";
import { Timeline } from "@/components/modules/Timeline";
import { Material } from "@/components/modules/Material";
import { Risk } from "@/components/modules/Risk";
import { Safety } from "@/components/modules/Safety";
import { DailyReport } from "@/components/modules/DailyReport";
import { Executive } from "@/components/modules/Executive";
import { Copilot } from "@/components/modules/Copilot";
import { ProjectSwitcher } from "@/components/ProjectSwitcher";
import { useProjectState, useChat, useSimulate } from "@/hooks/use-project";
import { logout } from "@/lib/auth.functions";
import type { ModuleId } from "@/lib/types";
import { Zap, Bell, AlertTriangle, Loader2, LogOut } from "lucide-react";

export function AppShell({ username }: { username?: string | null }) {
  const [active, setActive] = useState<ModuleId>("dashboard");
  const [wizard, setWizard] = useState(false);
  const [streamText, setStreamText] = useState("");
  const [pendingUser, setPendingUser] = useState("");
  const { data: state, error, isLoading } = useProjectState();
  const chat = useChat({
    onToken: (t) => setStreamText((prev) => prev + t),
    onReset: () => setStreamText(""),
  });
  const simulate = useSimulate();
  const router = useRouter();
  const queryClient = useQueryClient();
  const doLogout = useServerFn(logout);

  const signOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await doLogout({});
    await router.navigate({ to: "/auth", replace: true });
  };


  const navigate = (m: ModuleId) => setActive(m);

  const sendChat = async (text: string) => {
    if (active !== "copilot") setActive("copilot");
    setPendingUser(text);
    setStreamText("");
    try {
      await chat.mutateAsync({ message: text, module: active });
    } catch {
      /* toast */
    } finally {
      setPendingUser("");
      setStreamText("");
    }
  };

  const logIncident = () => {
    const desc = window.prompt("Describe the safety incident/near-miss:");
    if (!desc) return;
    sendChat(
      `Log a new safety incident with these details, choosing a sensible severity: "${desc}"`,
    );
  };

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  const backendMsg = error?.message;

  if (!state?.project) {
    return (
      <>
        <WelcomeScreen onNew={() => setWizard(true)} error={backendMsg} />
        <Wizard open={wizard} onClose={() => setWizard(false)} />
      </>
    );
  }

  return (
    <div className="flex h-screen w-full overflow-hidden">
      <Sidebar active={active} onSelect={navigate} />

      <main className="flex-1 flex flex-col h-full relative overflow-hidden bg-background">
        {backendMsg && (
          <div className="bg-[color:var(--danger)] text-white text-xs px-4 py-2 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" /> {backendMsg}
          </div>
        )}

        <header className="h-16 border-b border-border bg-background/80 backdrop-blur-md flex items-center justify-between px-6 flex-shrink-0 z-10">
          <div className="flex items-center gap-4">
            <ProjectSwitcher
              activeName={state.project.projectName}
              onNewProject={() => setWizard(true)}
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => simulate.mutate(undefined)}
              disabled={simulate.isPending}
              className="text-xs font-medium text-[color:var(--warning)] bg-[color:var(--warning)]/10 px-3 py-1.5 rounded-md border border-[color:var(--warning)]/20 hover:bg-[color:var(--warning)]/20 transition flex items-center gap-1 disabled:opacity-60"
            >
              {simulate.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
              Simulate Event
            </button>

            <button className="relative p-2 text-[color:var(--muted)] hover:text-[color:var(--text-main)] transition">
              <Bell className="w-5 h-5" />
              {state.alerts.length > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[color:var(--danger)] rounded-full border border-background" />
              )}
            </button>

            <div className="flex items-center gap-2 pl-3 border-l border-border">
              {username && (
                <span className="text-xs font-medium text-[color:var(--muted)]">{username}</span>
              )}
              <button
                onClick={signOut}
                className="text-xs font-medium px-2.5 py-1.5 rounded-md border border-border hover:border-primary transition flex items-center gap-1"
              >
                <LogOut className="w-3 h-3" /> Sign out
              </button>
            </div>
          </div>

        </header>

        <div className="flex-1 overflow-y-auto p-6 pb-40">
          {active === "dashboard" && <Dashboard state={state} />}
          {active === "timeline" && <Timeline state={state} onAskCopilot={sendChat} />}
          {active === "material" && <Material state={state} onAskCopilot={sendChat} />}
          {active === "risk" && <Risk state={state} onAskCopilot={sendChat} />}
          {active === "safety" && <Safety state={state} onLog={logIncident} onAskCopilot={sendChat} />}
          {active === "report" && <DailyReport state={state} />}
          {active === "executive" && <Executive onAskCopilot={sendChat} />}
          {active === "copilot" && (
            <Copilot
              state={state}
              pending={chat.isPending}
              streaming={streamText}
              pendingUser={pendingUser}
            />
          )}
        </div>

        <AIBar
          active={active}
          project={state.project}
          onSubmit={sendChat}
          onNavigate={navigate}
          pending={chat.isPending}
        />
      </main>

      <Wizard open={wizard} onClose={() => setWizard(false)} />
    </div>
  );
}
