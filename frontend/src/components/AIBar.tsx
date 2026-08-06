import { useEffect, useRef, useState } from "react";
import { Paperclip, Sparkles, ArrowUp, Loader2, Mic, Square, Languages } from "lucide-react";
import { AI_SUGGESTIONS } from "@/lib/modules";
import type { ModuleId, ProjectInfo } from "@/lib/types";
import { useUpload } from "@/hooks/use-project";
import { api } from "@/lib/api";
import { startRecording, type Recorder } from "@/lib/voice";
import { toast } from "sonner";

interface Props {
  active: ModuleId;
  project: ProjectInfo | null;
  onSubmit: (text: string) => void;
  onNavigate: (m: ModuleId) => void;
  pending: boolean;
}

/** Sarvam AI supported input languages. "unknown" lets Sarvam auto-detect. */
const STT_LANGUAGES: { code: string; label: string }[] = [
  { code: "unknown", label: "Auto detect" },
  { code: "hi-IN", label: "हिन्दी" },
  { code: "en-IN", label: "English" },
  { code: "mr-IN", label: "मराठी" },
  { code: "ta-IN", label: "தமிழ்" },
  { code: "te-IN", label: "తెలుగు" },
  { code: "kn-IN", label: "ಕನ್ನಡ" },
  { code: "ml-IN", label: "മലയാളം" },
  { code: "bn-IN", label: "বাংলা" },
  { code: "gu-IN", label: "ગુજરાતી" },
  { code: "pa-IN", label: "ਪੰਜਾਬੀ" },
  { code: "od-IN", label: "ଓଡ଼ିଆ" },
];

export function AIBar({ active, project, onSubmit, onNavigate, pending }: Props) {
  const [value, setValue] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const upload = useUpload();

  const [recorder, setRecorder] = useState<Recorder | null>(null);
  const [transcribing, setTranscribing] = useState(false);
  const [level, setLevel] = useState(0);
  const [lang, setLang] = useState("unknown");

  const suggestions = AI_SUGGESTIONS[active] ?? AI_SUGGESTIONS.default;

  // Live input level for the recording indicator.
  useEffect(() => {
    if (!recorder) return;
    const id = window.setInterval(() => setLevel(recorder.level()), 100);
    return () => window.clearInterval(id);
  }, [recorder]);

  const submit = () => {
    const t = value.trim();
    if (!t) return;
    onSubmit(t);
    setValue("");
  };

  const beginRecording = async () => {
    try {
      const r = await startRecording();
      setRecorder(r);
    } catch {
      toast.error("Microphone access is needed for voice input.");
    }
  };

  const finishRecording = async () => {
    if (!recorder) return;
    setRecorder(null);
    setLevel(0);
    setTranscribing(true);
    try {
      const blob = await recorder.stop();
      if (blob.size < 2048) {
        toast.error("That recording was empty — please try again.");
        return;
      }
      const { transcript, language_code } = await api.transcribe(blob, lang);
      setValue((v) => (v ? `${v} ${transcript}` : transcript));
      onNavigate("copilot");
      toast.success(`Heard you in ${language_code}`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setTranscribing(false);
    }
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files || !files.length) return;
    if (!project) return;
    onNavigate("copilot");
    for (const f of Array.from(files)) {
      try {
        await upload.mutateAsync({ file: f, project });
      } catch {
        /* toast handled */
      }
    }
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-[640px] max-w-[92%] z-20">
      <div className="glass-panel rounded-2xl shadow-float p-2 flex flex-col gap-2">
        <div className="flex items-center px-2 pt-1 gap-2 overflow-x-auto hide-scrollbar">
          <span className="text-xs font-medium text-[color:var(--muted)] flex-shrink-0">
            Suggestions:
          </span>
          {suggestions.map((s) => (
            <button
              key={s}
              onClick={() => {
                if (s === "Upload a drawing for clash check") {
                  fileRef.current?.click();
                  return;
                }
                onSubmit(s);
              }}
              className="text-xs bg-surface border border-border px-3 py-1 rounded-full whitespace-nowrap hover:border-primary transition"
            >
              {s}
            </button>
          ))}
        </div>

        <div className="flex items-center bg-background rounded-xl border border-border p-1 pl-2">
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            multiple
            accept=".pdf,.doc,.docx,.dwg,.dxf,.xls,.xlsx,.png,.jpg,.jpeg,.csv,.txt"
            onChange={(e) => handleFiles(e.target.files)}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={!project || upload.isPending}
            title="Upload document"
            className="p-2 text-[color:var(--muted)] hover:text-primary transition-colors rounded-lg hover:bg-surface disabled:opacity-40"
          >
            {upload.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />}
          </button>

          {/* Voice input language (Sarvam AI multilingual STT) */}
          <div className="relative flex items-center" title="Voice input language">
            <Languages className="w-4 h-4 text-[color:var(--muted)] pointer-events-none absolute left-1.5" />
            <select
              value={lang}
              onChange={(e) => setLang(e.target.value)}
              aria-label="Voice input language"
              className="appearance-none bg-transparent text-xs text-[color:var(--muted)] pl-7 pr-1 py-2 rounded-lg hover:text-primary focus:outline-none cursor-pointer max-w-[92px] truncate"
            >
              {STT_LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.label}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={recorder ? finishRecording : beginRecording}
            disabled={transcribing}
            title={recorder ? "Stop and transcribe" : "Speak your question"}
            className={`p-2 rounded-lg transition-colors disabled:opacity-40 ${
              recorder
                ? "bg-danger/10 text-danger border border-danger/30"
                : "text-[color:var(--muted)] hover:text-primary hover:bg-surface"
            }`}
          >
            {transcribing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : recorder ? (
              <Square className="w-4 h-4" />
            ) : (
              <Mic className="w-4 h-4" />
            )}
          </button>

          {recorder ? (
            <div className="flex-1 flex items-center gap-1 px-3 h-9">
              {Array.from({ length: 22 }).map((_, i) => (
                <span
                  key={i}
                  className="w-1 rounded-full bg-danger/70"
                  style={{
                    height: `${Math.max(
                      3,
                      Math.min(28, level * 30 * (0.5 + Math.abs(Math.sin((i + 1) * 1.7))) + 3),
                    )}px`,
                    transition: "height 100ms linear",
                  }}
                />
              ))}
              <span className="text-xs text-danger ml-2 whitespace-nowrap">Listening…</span>
            </div>
          ) : (
            <>
              <Sparkles className="w-5 h-5 text-primary flex-shrink-0" />
              <input
                type="text"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submit()}
                placeholder={
                  transcribing ? "Transcribing your voice…" : "Ask, speak, or upload a document..."
                }
                className="flex-1 bg-transparent border-none focus:outline-none text-sm px-3 py-2 placeholder:text-[color:var(--muted)]"
              />
            </>
          )}

          <button
            onClick={submit}
            disabled={pending || !value.trim() || !!recorder}
            className="bg-[color:var(--text-main)] text-surface p-2 rounded-lg hover:bg-black transition disabled:opacity-40"
          >
            {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowUp className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
