import type { ProjectState } from "@/lib/types";
import { Sparkles, Bot, User, FileText, Loader2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useEffect, useRef } from "react";

export function Copilot({
  state,
  pending,
}: {
  state: ProjectState;
  pending: boolean;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [state.chatHistory.length, pending]);

  return (
    <div className="flex flex-col h-[calc(100vh-9rem)] -mt-6 -mx-6">
      <div className="p-6 border-b border-border bg-surface/50 backdrop-blur-sm flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold ai-gradient-text flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" /> Construction Copilot
          </h1>
          <p className="text-xs text-[color:var(--muted)] mt-1">
            Context: {state.project?.projectName} • Upload documents via the chat bar below
          </p>
        </div>
        <div className="text-xs text-[color:var(--muted)]">
          {state.uploadedDocuments.length} documents indexed
        </div>
      </div>

      <div ref={scroller} className="flex-1 overflow-y-auto p-6 space-y-6 pb-40">
        {state.chatHistory.length === 0 && (
          <div className="flex gap-4 max-w-3xl">
            <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
              <Bot className="w-4 h-4 text-primary" />
            </div>
            <div className="space-y-1">
              <div className="text-xs font-medium text-[color:var(--muted)]">Copilot</div>
              <div className="bg-surface border border-border p-4 rounded-2xl rounded-tl-sm text-sm leading-relaxed max-w-2xl">
                Hi JD — I'm your AI Construction Copilot for{" "}
                <strong>{state.project?.projectName}</strong>. I have access to
                weather, web search, your uploaded documents (RAG), and every
                module in this app. Ask me anything, or upload a drawing.
              </div>
            </div>
          </div>
        )}

        {state.chatHistory.map((m, i) => (
          <div
            key={i}
            className={`flex gap-4 max-w-3xl ${
              m.role === "user" ? "ml-auto flex-row-reverse" : ""
            }`}
          >
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                m.role === "user"
                  ? "bg-[color:var(--text-main)] text-surface"
                  : "bg-primary/10 border border-primary/20"
              }`}
            >
              {m.role === "user" ? (
                <User className="w-4 h-4" />
              ) : (
                <Bot className="w-4 h-4 text-primary" />
              )}
            </div>
            <div className={`space-y-1 ${m.role === "user" ? "text-right" : ""}`}>
              <div className="text-xs font-medium text-[color:var(--muted)]">
                {m.role === "user" ? "You" : "Copilot"}
              </div>
              <div
                className={`p-4 rounded-2xl text-sm leading-relaxed prose-chat ${
                  m.role === "user"
                    ? "bg-[color:var(--text-main)] text-surface rounded-tr-sm"
                    : "bg-surface border border-border rounded-tl-sm"
                }`}
              >
                {m.role === "user" ? (
                  <div className="whitespace-pre-wrap text-left">{m.text}</div>
                ) : (
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.text}</ReactMarkdown>
                )}
                {m.attachment && (
                  <div className="mt-2 inline-flex items-center gap-2 bg-background border border-border rounded-lg px-3 py-2 text-xs text-[color:var(--text-main)]">
                    <FileText className="w-4 h-4 text-primary" />
                    <div className="text-left">
                      <div className="font-medium">{m.attachment.name}</div>
                      <div className="text-[color:var(--muted)]">
                        {m.attachment.type} • {m.attachment.size}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}

        {pending && (
          <div className="flex gap-4 max-w-3xl">
            <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Bot className="w-4 h-4 text-primary" />
            </div>
            <div className="bg-surface border border-border p-4 rounded-2xl rounded-tl-sm h-11 flex items-center gap-1.5 w-20">
              <Loader2 className="w-3 h-3 animate-spin text-primary" />
              <span className="text-xs text-[color:var(--muted)]">Thinking</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
