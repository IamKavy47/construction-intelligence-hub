import type { WeatherReport } from "@/lib/types";
import { useRefreshWeather } from "@/hooks/use-project";
import { CloudOff, RefreshCw, CloudRain, Sun, Cloud, CloudLightning, Loader2 } from "lucide-react";

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  sun: Sun,
  cloud: Cloud,
  "cloud-rain": CloudRain,
  "cloud-lightning": CloudLightning,
};

export function WeatherWidget({ report }: { report: WeatherReport | null }) {
  const refresh = useRefreshWeather();

  if (!report) {
    return (
      <div className="bg-surface border border-border rounded-xl p-5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 text-[color:var(--muted)] text-sm">
          <CloudOff className="w-5 h-5" />
          <span>No live weather data yet for this site.</span>
        </div>
        <button
          disabled={refresh.isPending}
          onClick={() => refresh.mutate()}
          className="text-xs bg-[color:var(--text-main)] text-surface px-3 py-1.5 rounded-md hover:bg-black transition flex items-center gap-1 disabled:opacity-60"
        >
          {refresh.isPending ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <RefreshCw className="w-3 h-3" />
          )}
          Pull Live Weather
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-primary text-white rounded-xl p-5 shadow-sm flex items-center justify-between relative overflow-hidden gap-4 flex-wrap">
        <div className="absolute -right-8 -top-8 opacity-20 scale-125 pointer-events-none">
          <CloudRain className="w-40 h-40" />
        </div>
        <div className="relative z-10 flex gap-6 items-center flex-wrap">
          <div>
            <div className="text-xs font-medium opacity-80 uppercase tracking-wider">
              Site Conditions • {report.location}
            </div>
            <div className="text-4xl font-bold mt-1">{report.temp}°C</div>
            <div className="text-sm mt-1 font-medium">{report.desc}</div>
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
            <div>
              <span className="opacity-80">Wind:</span>{" "}
              <span className="font-semibold">{report.wind}</span>
            </div>
            <div>
              <span className="opacity-80">Humidity:</span>{" "}
              <span className="font-semibold">{report.humidity}</span>
            </div>
          </div>
        </div>
        <button
          disabled={refresh.isPending}
          onClick={() => refresh.mutate()}
          className="relative z-10 text-xs bg-white/15 hover:bg-white/25 transition px-3 py-1.5 rounded-md flex items-center gap-1 disabled:opacity-60"
        >
          {refresh.isPending ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <RefreshCw className="w-3 h-3" />
          )}
          Refresh
        </button>
      </div>

      {report.forecast && report.forecast.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {report.forecast.slice(0, 5).map((f) => {
            const Icon = ICONS[f.icon] ?? Cloud;
            const isRisk = f.risk !== "Clear";
            return (
              <div
                key={f.day}
                className={`rounded-xl p-3 text-center flex flex-col items-center justify-center gap-1 border ${
                  isRisk
                    ? "border-[color:var(--warning)]/50 bg-[color:var(--warning)]/5"
                    : "border-border bg-surface"
                }`}
              >
                <div
                  className={`text-xs font-semibold uppercase ${
                    isRisk ? "text-[color:var(--warning)]" : "text-[color:var(--muted)]"
                  }`}
                >
                  {f.day}
                </div>
                <Icon
                  className={`w-5 h-5 ${
                    isRisk ? "text-[color:var(--warning)]" : ""
                  }`}
                />
                <div className="font-bold">{f.temp}°</div>
                <div
                  className={`text-[10px] ${
                    isRisk
                      ? "bg-[color:var(--warning)]/20 text-[color:var(--warning)] px-2 py-0.5 rounded font-bold"
                      : "text-[color:var(--muted)]"
                  }`}
                >
                  {f.risk}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
