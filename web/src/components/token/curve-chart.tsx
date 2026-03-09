"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { cn } from "@/lib/utils";

type Interval = "1m" | "5m" | "15m" | "1h" | "4h" | "1d";

interface CurveChartProps {
  poolAddress: string;
  className?: string;
}

interface OHLCVBar {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  time: number;
}

const INTERVALS: { label: string; value: Interval }[] = [
  { label: "1m", value: "1m" },
  { label: "5m", value: "5m" },
  { label: "15m", value: "15m" },
  { label: "1h", value: "1h" },
  { label: "4h", value: "4h" },
  { label: "1D", value: "1d" },
];

const REFRESH_MS = 30_000;

async function fetchOHLCV(
  poolAddress: string,
  interval: Interval
): Promise<OHLCVBar[]> {
  const url = `https://datapi.jup.ag/v1/pools/${poolAddress}/ohlcv?interval=${interval}&limit=300`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch OHLCV data (${res.status})`);
  const data = await res.json();
  // The Jupiter API returns an array of OHLCV bars
  if (Array.isArray(data)) return data;
  // Some responses nest inside a key
  if (data?.data && Array.isArray(data.data)) return data.data;
  if (data?.ohlcv && Array.isArray(data.ohlcv)) return data.ohlcv;
  throw new Error("Unexpected OHLCV response format");
}

export function CurveChart({ poolAddress, className }: CurveChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<ReturnType<typeof import("lightweight-charts").createChart> | null>(null);
  const candleSeriesRef = useRef<unknown>(null);
  const volumeSeriesRef = useRef<unknown>(null);

  const [interval, setInterval] = useState<Interval>("5m");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Initialize chart
  useEffect(() => {
    if (!containerRef.current) return;

    let disposed = false;

    async function initChart() {
      const lc = await import("lightweight-charts");

      if (disposed || !containerRef.current) return;

      const chart = lc.createChart(containerRef.current, {
        layout: {
          background: { type: lc.ColorType.Solid, color: "#0a0a0a" },
          textColor: "#666",
          fontSize: 11,
        },
        grid: {
          vertLines: { color: "#1a1a1a" },
          horzLines: { color: "#1a1a1a" },
        },
        crosshair: {
          mode: lc.CrosshairMode.Normal,
        },
        rightPriceScale: {
          borderColor: "#1a1a1a",
        },
        timeScale: {
          borderColor: "#1a1a1a",
          timeVisible: true,
          secondsVisible: false,
        },
        handleScroll: true,
        handleScale: true,
      });

      chart.timeScale().fitContent();

      const candleSeries = chart.addSeries(lc.CandlestickSeries, {
        upColor: "#22c55e",
        downColor: "#ef4444",
        borderDownColor: "#ef4444",
        borderUpColor: "#22c55e",
        wickDownColor: "#ef4444",
        wickUpColor: "#22c55e",
      });

      const volumeSeries = chart.addSeries(lc.HistogramSeries, {
        priceFormat: { type: "volume" },
        priceScaleId: "volume",
      });

      chart.priceScale("volume").applyOptions({
        scaleMargins: { top: 0.8, bottom: 0 },
      });

      chartRef.current = chart;
      candleSeriesRef.current = candleSeries;
      volumeSeriesRef.current = volumeSeries;

      // Handle resize
      const resizeObserver = new ResizeObserver((entries) => {
        if (entries.length === 0 || !containerRef.current) return;
        const { width } = entries[0].contentRect;
        chart.applyOptions({ width });
      });
      resizeObserver.observe(containerRef.current);

      return () => {
        resizeObserver.disconnect();
      };
    }

    let cleanupResize: (() => void) | undefined;
    initChart().then((cleanup) => {
      cleanupResize = cleanup;
    });

    return () => {
      disposed = true;
      cleanupResize?.();
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, []);

  // Fetch and update data
  const updateData = useCallback(async () => {
    if (!candleSeriesRef.current || !volumeSeriesRef.current) return;

    try {
      setLoading(true);
      setError(null);

      const bars = await fetchOHLCV(poolAddress, interval);

      if (bars.length === 0) {
        setError("No chart data available for this pool.");
        setLoading(false);
        return;
      }

      const candleData = bars.map((bar) => ({
        time: bar.time as import("lightweight-charts").UTCTimestamp,
        open: bar.open,
        high: bar.high,
        low: bar.low,
        close: bar.close,
      }));

      const volumeData = bars.map((bar) => ({
        time: bar.time as import("lightweight-charts").UTCTimestamp,
        value: bar.volume,
        color:
          bar.close >= bar.open
            ? "rgba(34, 197, 94, 0.3)"
            : "rgba(239, 68, 68, 0.3)",
      }));

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (candleSeriesRef.current as any).setData(candleData);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (volumeSeriesRef.current as any).setData(volumeData);

      chartRef.current?.timeScale().fitContent();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load chart data");
    } finally {
      setLoading(false);
    }
  }, [poolAddress, interval]);

  // Load data on mount and when interval changes
  useEffect(() => {
    // Small delay to ensure chart is initialized
    const initTimeout = setTimeout(updateData, 100);
    return () => clearTimeout(initTimeout);
  }, [updateData]);

  // Auto-refresh
  useEffect(() => {
    const timer = window.setInterval(updateData, REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [updateData]);

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {/* Interval selector */}
      <div className="flex items-center gap-1">
        {INTERVALS.map((iv) => (
          <button
            key={iv.value}
            onClick={() => setInterval(iv.value)}
            className={cn(
              "rounded px-2.5 py-1 text-xs font-medium transition-colors",
              interval === iv.value
                ? "bg-white/10 text-white"
                : "text-muted-foreground hover:bg-white/5 hover:text-white"
            )}
          >
            {iv.label}
          </button>
        ))}
      </div>

      {/* Chart container */}
      <div className="relative h-[400px] w-full overflow-hidden rounded-lg border border-white/5">
        <div ref={containerRef} className="h-full w-full" />

        {/* Loading overlay */}
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#0a0a0a]/80 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-3">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/20 border-t-white/60" />
              <span className="text-xs text-muted-foreground">
                Loading chart...
              </span>
            </div>
          </div>
        )}

        {/* Error overlay */}
        {error && !loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#0a0a0a]/80 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-2 px-4 text-center">
              <span className="text-sm text-red-400">{error}</span>
              <button
                onClick={updateData}
                className="rounded px-3 py-1 text-xs text-muted-foreground hover:bg-white/5 hover:text-white transition-colors"
              >
                Try again
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
