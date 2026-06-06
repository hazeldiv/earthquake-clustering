"use client";

import { useState, useEffect, useRef } from "react";
import { X, RefreshCw, RotateCcw, SlidersHorizontal, Info } from "lucide-react";

interface ClusterParams {
  k_min: number;
  k_max: number;
  random_state: number;
  mag_threshold: number;
  depth_threshold: number;
  neighbor_distance: number;
  min_events: number;
  year_span: number;
  smooth_factor: number;
}

interface RecomputeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (params: ClusterParams) => void;
  currentParams: ClusterParams;
  systemDefaults: ClusterParams;
}

interface ParamConfig {
  key: keyof ClusterParams;
  label: string;
  description: string;
  min: number;
  max: number;
  step: number;
  unit?: string;
  color: string;
  isFloat?: boolean;
}

const PARAM_CONFIG: ParamConfig[] = [
  {
    key: "mag_threshold",
    label: "Min Magnitude Threshold",
    description: "Only earthquakes at or above this magnitude are included.",
    min: 4.0, max: 7.0, step: 0.1, unit: "M", color: "amber", isFloat: true
  },
  {
    key: "depth_threshold",
    label: "Max Depth Threshold",
    description: "Only earthquakes at or shallower than this depth are included.",
    min: 10, max: 200, step: 5, unit: "km", color: "purple", isFloat: true
  },
  {
    key: "k_min",
    label: "K-Means Min Clusters (K min)",
    description: "Minimum number of clusters to test during the Elbow method.",
    min: 10, max: 100, step: 1, color: "cyan"
  },
  {
    key: "k_max",
    label: "K-Means Max Clusters (K max)",
    description: "Maximum number of clusters to test during the Elbow method.",
    min: 20, max: 150, step: 1, color: "cyan"
  },
  {
    key: "min_events",
    label: "Min Events per Cluster",
    description: "Clusters with fewer events than this threshold are discarded.",
    min: 2, max: 30, step: 1, color: "green"
  },
  {
    key: "year_span",
    label: "Temporal Density Window",
    description: "A cluster must have min events within this many years to be valid.",
    min: 1, max: 20, step: 1, unit: "yrs", color: "sky"
  },
  {
    key: "neighbor_distance",
    label: "Neighbor Filter Distance",
    description: "Points with no neighbors within this degree radius are discarded as scattered.",
    min: 0.05, max: 2.0, step: 0.05, unit: "°", color: "pink", isFloat: true
  },
  {
    key: "smooth_factor",
    label: "B-Spline Smoothing Points",
    description: "Number of interpolation points used to smooth cluster boundary polygons.",
    min: 10, max: 200, step: 5, color: "orange"
  },
  {
    key: "random_state",
    label: "Random Seed",
    description: "Seed for K-Means random initialization. Change for different starting points.",
    min: 0, max: 999, step: 1, color: "slate"
  },
];

const COLOR_MAP: Record<string, { track: string; thumb: string; text: string; bg: string }> = {
  amber:  { track: "bg-amber-950/40",  thumb: "accent-amber-400",  text: "text-amber-400",  bg: "bg-amber-500/10 border-amber-500/20" },
  purple: { track: "bg-purple-950/40", thumb: "accent-purple-400", text: "text-purple-400", bg: "bg-purple-500/10 border-purple-500/20" },
  cyan:   { track: "bg-cyan-950/40",   thumb: "accent-cyan-400",   text: "text-cyan-400",   bg: "bg-cyan-500/10 border-cyan-500/20" },
  green:  { track: "bg-green-950/40",  thumb: "accent-green-400",  text: "text-green-400",  bg: "bg-green-500/10 border-green-500/20" },
  sky:    { track: "bg-sky-950/40",    thumb: "accent-sky-400",    text: "text-sky-400",    bg: "bg-sky-500/10 border-sky-500/20" },
  pink:   { track: "bg-pink-950/40",   thumb: "accent-pink-400",   text: "text-pink-400",   bg: "bg-pink-500/10 border-pink-500/20" },
  orange: { track: "bg-orange-950/40", thumb: "accent-orange-400", text: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/20" },
  slate:  { track: "bg-slate-800/40",  thumb: "accent-slate-400",  text: "text-slate-400",  bg: "bg-slate-800/40 border-slate-600/30" },
};

export default function RecomputeModal({ isOpen, onClose, onConfirm, currentParams, systemDefaults }: RecomputeModalProps) {
  const [params, setParams] = useState<ClusterParams>(currentParams);
  const backdropRef = useRef<HTMLDivElement>(null);

  // Initialize with current active parameters whenever the modal opens
  useEffect(() => {
    if (isOpen) setParams(currentParams);
  }, [isOpen, currentParams]);

  // Close on Escape key
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    if (isOpen) window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleChange = (key: keyof ClusterParams, value: number) => {
    setParams(prev => ({ ...prev, [key]: value }));
  };

  const handleReset = () => setParams(systemDefaults);

  const formatValue = (config: ParamConfig, value: number) => {
    const display = config.isFloat ? value.toFixed(config.step < 0.1 ? 2 : 1) : String(value);
    return config.unit ? `${display} ${config.unit}` : display;
  };

  const isDirty = JSON.stringify(params) !== JSON.stringify(systemDefaults);

  return (
    <div
      ref={backdropRef}
      onClick={(e) => { if (e.target === backdropRef.current) onClose(); }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
    >
      <div className="relative w-full max-w-2xl mx-4 glass rounded-2xl border border-white/10 shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/5 bg-slate-950/30 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-cyan-950/50 border border-cyan-500/30 flex items-center justify-center">
              <SlidersHorizontal className="w-4 h-4 text-cyan-400" />
            </div>
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-200">
                Clustering Parameters
              </h2>
              <p className="text-[10px] text-slate-400 mt-0.5">Tune the model before recomputing</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleReset}
              disabled={!isDirty}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 disabled:opacity-40 disabled:hover:text-slate-400 disabled:hover:bg-transparent transition-all duration-200 cursor-pointer disabled:cursor-not-allowed"
            >
              <RotateCcw className="w-3 h-3" />
              Reset to Defaults
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable params */}
        <div className="flex-1 overflow-y-auto no-scrollbar p-5 flex flex-col gap-4">
          {PARAM_CONFIG.map((config) => {
            const value = params[config.key] as number;
            const colors = COLOR_MAP[config.color] || COLOR_MAP.slate;
            return (
              <div
                key={config.key}
                className={`p-4 rounded-xl border ${colors.bg} flex flex-col gap-2.5`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-col gap-0.5">
                    <span className={`text-xs font-bold ${colors.text}`}>{config.label}</span>
                    <span className="text-[10px] text-slate-400 leading-relaxed max-w-md">{config.description}</span>
                  </div>
                  <span className={`text-sm font-bold font-mono shrink-0 ${colors.text}`}>
                    {formatValue(config, value)}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[9px] text-slate-500 w-6 text-right shrink-0">
                    {config.isFloat ? config.min.toFixed(1) : config.min}
                  </span>
                  <input
                    type="range"
                    min={config.min}
                    max={config.max}
                    step={config.step}
                    value={value}
                    onChange={e => handleChange(config.key, config.isFloat ? parseFloat(e.target.value) : parseInt(e.target.value))}
                    className={`flex-1 h-1.5 rounded-lg appearance-none cursor-pointer ${colors.thumb} bg-slate-800`}
                  />
                  <span className="text-[9px] text-slate-500 w-6 shrink-0">
                    {config.isFloat ? config.max.toFixed(1) : config.max}
                  </span>
                </div>
              </div>
            );
          })}

          {/* Info box */}
          <div className="p-4 rounded-xl bg-white/2 border border-white/5 flex gap-3 items-start">
            <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
            <p className="text-[10px] text-slate-400 leading-relaxed">
              Recomputing clusters processes the full earthquake database, runs K-Means elbow detection, and performs spatial joins on 394 Indonesian administrative boundaries. This takes approximately <span className="text-slate-300 font-semibold">10–15 seconds</span>.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/5 bg-slate-950/30 flex items-center gap-3 shrink-0">
          <button
            onClick={handleReset}
            disabled={!isDirty}
            className="flex-1 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 disabled:opacity-40 disabled:hover:text-slate-400 disabled:hover:bg-transparent border border-white/5 transition-all duration-200 flex items-center justify-center gap-1.5 cursor-pointer disabled:cursor-not-allowed"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset to Defaults
          </button>
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 transition-all duration-200 cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(params)}
            className="flex-1 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider text-[#090d16] bg-cyan-400 hover:bg-cyan-300 transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/20 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Start Reclustering
          </button>
        </div>
      </div>
    </div>
  );
}
