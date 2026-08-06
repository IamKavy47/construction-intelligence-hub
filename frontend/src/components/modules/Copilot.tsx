import type { ProjectState } from "@/lib/types";
import { Sparkles, Bot, User, FileText, Loader2, Volume2, Square } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { playWavSegments } from "@/lib/voice";
import { toast } from "sonner";

/** Sarvam AI voice output languages. */
const TTS_LANGUAGES: { code: string; label: string }[] = [
  { code: "en-IN", label: "English" },
  { code: "hi-IN", label: "हिन्दी" },
  { code: "mr-IN", label: "मराठी" },
  { code: "ta-IN", label: "தமிழ்" },
  { code: "te-IN", label: "తెలుగు" },
  { code: "kn-IN", label: "ಕನ್ನಡ" },
  { code: "ml-IN", label: "മലയാളം" },
  { code: "bn-IN", label: "বাংলা" },
  { code: "gu-IN", label: "ગુજરાતી" },
  { code: "pa-IN", label: "ਪੰਜਾਬੀ" },
];

export function Copilot({
  state,
  pending,
  streaming = "",
  pendingUser = "",
}: {
  state: ProjectState;
  pending: boolean;
  /** Live text as the model types it (SSE stream). */
  streaming?: string;
  /** The message just sent, shown optimistically while the reply streams. */
  pendingUser?: string;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const stopRef = useRef<(() => void) | null>(null);
  const [voiceLang, setVoiceLang] = useState("en-IN");
  const [loadingIdx, setLoadingIdx] = useState<number | null>(null);
  const [speakingIdx, setSpeakingIdx] = useState<number | null>(null);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [state.chatHistory.length, pending, streaming]);

  // Stop any playback when leaving the module.
  useEffect(() => () => stopRef.current?.(), []);

  const stopSpeaking = () => {
    stopRef.current?.();
    stopRef.current = null;
    setSpeakingIdx(null);
  };

  const speak = async (index: number, text: string) => {
    if (speakingIdx === index || loadingIdx !== null) {
      stopSpeaking();
      return;
    }
    stopSpeaking();
    setLoadingIdx(index);
    try {
      const { audios } = await api.speak(text, voiceLang);
      setSpeakingIdx(index);
      stopRef.current = await playWavSegments(audios, () => {
        setSpeakingIdx((cur) => (cur === index ? null : cur));
      });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoadingIdx(null);
    }
  };


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
        <div className="flex items-center gap-3">
          <label className="text-xs text-[color:var(--muted)] flex items-center gap-1.5">
            <Volume2 className="w-4 h-4 text-primary" />
            <select
              value={voiceLang}
              onChange={(e) => setVoiceLang(e.target.value)}
              aria-label="Voice reply language"
              className="bg-surface border border-border rounded-lg text-xs px-2 py-1 focus:outline-none focus:border-primary"
            >
              {TTS_LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.label}
                </option>
              ))}
            </select>
          </label>
          <div className="text-xs text-[color:var(--muted)]">
            {state.uploadedDocuments.length} documents indexed
          </div>
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
              {m.role === "bot" && (
                <button
                  type="button"
                  onClick={() => speak(i, m.text)}
                  disabled={loadingIdx !== null && loadingIdx !== i}
                  title={speakingIdx === i ? "Stop" : "Listen to this reply"}
                  className="inline-flex items-center gap-1.5 text-xs text-[color:var(--muted)] hover:text-primary transition disabled:opacity-40"
                >
                  {loadingIdx === i ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : speakingIdx === i ? (
                    <Square className="w-3.5 h-3.5 text-danger" />
                  ) : (
                    <Volume2 className="w-3.5 h-3.5" />
                  )}
                  {speakingIdx === i ? "Stop" : "Listen"}
                </button>
              )}
            </div>

          </div>
        ))}

        {pending && pendingUser && (
          <div className="flex gap-4 max-w-3xl ml-auto flex-row-reverse">
            <div className="w-8 h-8 rounded-full bg-[color:var(--text-main)] text-surface flex items-center justify-center flex-shrink-0">
              <User className="w-4 h-4" />
            </div>
            <div className="space-y-1 text-right">
              <div className="text-xs font-medium text-[color:var(--muted)]">You</div>
              <div className="bg-[color:var(--text-main)] text-surface p-4 rounded-2xl rounded-tr-sm text-sm leading-relaxed whitespace-pre-wrap text-left">
                {pendingUser}
              </div>
            </div>
          </div>
        )}

        {pending && (
          <div className="flex gap-4 max-w-3xl">
            <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
              <Bot className="w-4 h-4 text-primary" />
            </div>
            {streaming ? (
              <div className="space-y-1">
                <div className="text-xs font-medium text-[color:var(--muted)]">Copilot</div>
                <div className="bg-surface border border-border p-4 rounded-2xl rounded-tl-sm text-sm leading-relaxed prose-chat max-w-2xl">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{streaming}</ReactMarkdown>
                  <span className="inline-block w-1.5 h-4 align-middle bg-primary/70 animate-pulse ml-0.5" />
                </div>
              </div>
            ) : (
              <div className="bg-surface border border-border p-4 rounded-2xl rounded-tl-sm h-11 flex items-center gap-1.5 w-24">
                <Loader2 className="w-3 h-3 animate-spin text-primary" />
                <span className="text-xs text-[color:var(--muted)]">Thinking</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
