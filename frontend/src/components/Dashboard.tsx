"use client";

import { useState, useEffect, useMemo } from "react";
import dynamic from "next/dynamic";
import { 
  Activity, 
  Layers, 
  Filter, 
  Search, 
  MapPin, 
  Clock, 
  Compass, 
  RefreshCw,
  X,
  ChevronRight,
  ChevronLeft,
  TrendingUp,
  AlertTriangle,
  Info,
  HelpCircle
} from "lucide-react";
import Link from "next/link";
import { CLUSTER_COLORS } from "./constants";
import RecomputeModal from "./RecomputeModal";

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

// Load Map component dynamically with SSR disabled to prevent Leaflet window reference errors
const Map = dynamic(() => import("./Map"), { 
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex flex-col items-center justify-center bg-[#090d16] text-slate-400 gap-3">
      <RefreshCw className="w-8 h-8 animate-spin text-cyan-400" />
      <span className="text-sm font-semibold tracking-wider">LOADING INDONESIA MAP...</span>
    </div>
  )
});

interface EarthquakePoint {
  latitude: number;
  longitude: number;
  magnitude: number;
  depth: number;
  datetime: string;
  kabupaten_kota: string;
  province: string;
}

interface ClusterData {
  cluster_id: number;
  title: string;
  centroid: [number, number];
  kabupaten_kota: string[];
  provinces: string[];
  event_count: number;
  frequency_last_10_years: number;
  avg_magnitude: number;
  avg_depth: number;
  hull_polygon: [number, number][];
  points: EarthquakePoint[];
}

export default function Dashboard() {
  const [clusters, setClusters] = useState<ClusterData[]>([]);
  const [loading, setLoading] = useState(true);
  const [recomputing, setRecomputing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Selection & hover state
  const [selectedClusterId, setSelectedClusterId] = useState<number | null>(null);
  const [hoveredClusterId, setHoveredClusterId] = useState<number | null>(null);

  // Panel collapse/expand states
  const [leftPanelOpen, setLeftPanelOpen] = useState(true);
  const [rightPanelOpen, setRightPanelOpen] = useState(true);

  // Automatically reopen right details panel when a cluster is selected
  useEffect(() => {
    if (selectedClusterId !== null) {
      setRightPanelOpen(true);
    }
  }, [selectedClusterId]);
  
  // Filter states
  const [minEvents, setMinEvents] = useState<number>(5);
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [defaultParams, setDefaultParams] = useState<ClusterParams>({
    k_min: 72, k_max: 96, random_state: 42,
    mag_threshold: 5.0, depth_threshold: 50.0,
    neighbor_distance: 0.3, min_events: 5, year_span: 10, smooth_factor: 50
  });

  const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";

  // Fetch default params from backend on mount
  useEffect(() => {
    fetch(`${API_BASE}/api/defaults`)
      .then(r => r.json())
      .then(data => setDefaultParams(data))
      .catch(() => {}); // silently fall back to hard-coded defaults
  }, []);

  // Fetch cluster data
  const fetchClusters = async (forceRecompute = false) => {
    try {
      setLoading(true);
      setError(null);
      const url = `${API_BASE}/api/clusters${forceRecompute ? "?recompute=true" : ""}`;
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`Failed to load data: status ${res.status}`);
      }
      const data = await res.json();
      setClusters(data);
    } catch (err: any) {
      console.error(err);
      setError("Unable to connect to the seismic backend service. Please make sure the FastAPI server is running.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClusters();
  }, []);

  // Handle recompute click — open modal instead of running immediately
  const handleRecompute = () => setShowModal(true);

  // Called when user confirms params in the modal
  const handleConfirmRecompute = async (params: ClusterParams) => {
    setShowModal(false);
    setRecomputing(true);
    try {
      const res = await fetch(`${API_BASE}/api/clusters/recompute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });
      if (res.ok) {
        setTimeout(() => {
          fetchClusters(false);
          setRecomputing(false);
        }, 12000);
      } else {
        throw new Error("Trigger recompute failed");
      }
    } catch (err) {
      console.error(err);
      setError("Failed to trigger recomputation.");
      setRecomputing(false);
    }
  };

  // Filtered clusters calculation
  const filteredClusters = useMemo(() => {
    return clusters.filter(c => {
      // Filter by cluster size
      const matchesEvents = c.event_count >= minEvents;
      // Filter by search query (province or regency name)
      const matchesSearch = searchQuery === "" || 
        c.kabupaten_kota.some(k => k.toLowerCase().includes(searchQuery.toLowerCase())) ||
        c.provinces.some(p => p.toLowerCase().includes(searchQuery.toLowerCase()));

      return matchesEvents && matchesSearch;
    });
  }, [clusters, minEvents, searchQuery]);

  // Selected cluster object
  const selectedCluster = useMemo(() => {
    if (selectedClusterId === null) return null;
    return clusters.find(c => c.cluster_id === selectedClusterId) || null;
  }, [clusters, selectedClusterId]);

  // Overall Statistics from the database
  const stats = useMemo(() => {
    if (clusters.length === 0) return { totalClusters: 0, totalEvents: 0, highestAvgMag: 0, activeRegency: "None" };

    const totalClusters = clusters.length;
    const totalEvents = clusters.reduce((acc, c) => acc + c.event_count, 0);
    const highestAvgMag = Math.max(...clusters.map(c => c.avg_magnitude));
    
    // Find the regency appearing most across clusters
    const regencyCounts: { [key: string]: number } = {};
    clusters.forEach(c => {
      c.kabupaten_kota.forEach(k => {
        // clean type like "Kabupaten " or "Kota " for stats
        const name = k.replace(/Kabupaten |Kota /g, "");
        regencyCounts[name] = (regencyCounts[name] || 0) + c.event_count;
      });
    });

    let activeRegency = "N/A";
    let maxCount = 0;
    Object.entries(regencyCounts).forEach(([name, count]) => {
      if (count > maxCount) {
        maxCount = count;
        activeRegency = name;
      }
    });

    return { totalClusters, totalEvents, highestAvgMag: round(highestAvgMag, 2), activeRegency };
  }, [clusters]);

  function round(val: number, decimals: number) {
    return Number(Math.round(Number(val + "e" + decimals)) + "e-" + decimals);
  }

  return (
    <div className="w-full h-screen flex relative overflow-hidden font-sans">
      {/* 1. Main Background Map */}
      <div className="w-full h-full absolute inset-0 z-0">
        <Map
          clusters={filteredClusters}
          selectedClusterId={selectedClusterId}
          hoveredClusterId={hoveredClusterId}
          onSelectCluster={setSelectedClusterId}
          onHoverCluster={setHoveredClusterId}
        />
      </div>

      {/* 2. Floating Header & Trigger Panel */}
      <div className="absolute top-4 right-4 z-10 pointer-events-auto flex items-center gap-2">
        <Link
          href="/about"
          className="flex items-center justify-center p-2.5 rounded-xl glass text-slate-400 hover:text-cyan-400 hover:border-cyan-500/30 transition-all duration-300"
          title="How Clustering Works"
        >
          <HelpCircle className="w-4 h-4" />
        </Link>
        <button
          onClick={handleRecompute}
          disabled={recomputing || loading}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl glass text-xs font-semibold tracking-wider text-cyan-400 hover:text-white uppercase transition-all duration-300 disabled:opacity-50"
          id="recompute-btn"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${recomputing ? "animate-spin" : ""}`} />
          {recomputing ? "Reclustering..." : "Recompute Clusters"}
        </button>
      </div>

      {/* 3. Floating Left Sidebar - Control Panel */}
      <div className={`absolute top-4 left-4 bottom-4 w-96 z-10 pointer-events-auto glass rounded-2xl flex flex-col shadow-2xl border-white/10 overflow-hidden transition-all duration-300 ${
        leftPanelOpen ? "translate-x-0 opacity-100" : "-translate-x-[calc(100%+16px)] opacity-0 pointer-events-none"
      }`}>
        
        {/* Sidebar Header */}
        <div className="p-5 border-b border-white/5 flex flex-col gap-1.5 bg-slate-950/20">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
            </span>
            <h1 className="text-sm font-bold uppercase tracking-wider text-slate-200">
              Seismic Cluster Monitor
            </h1>
          </div>
          <p className="text-[11px] text-slate-400">
            Identifying high-frequency earthquake zones (Magnitude &ge; 5.0) in Indonesia.
          </p>
        </div>

        {/* Sidebar Loading / Error State */}
        {loading && !recomputing ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-slate-400">
            <RefreshCw className="w-8 h-8 animate-spin text-cyan-400" />
            <span className="text-xs font-semibold tracking-widest uppercase">Fetching seismic data...</span>
          </div>
        ) : error ? (
          <div className="flex-1 p-6 flex flex-col items-center justify-center text-center gap-4">
            <AlertTriangle className="w-12 h-12 text-amber-500" />
            <div className="text-sm font-medium text-slate-300">{error}</div>
            <button
              onClick={() => fetchClusters()}
              className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-semibold uppercase tracking-wider transition-colors"
            >
              Retry Connection
            </button>
          </div>
        ) : (
          <div className="flex-1 flex flex-col overflow-hidden">
            
            {/* Summary Statistics Card */}
            <div className="p-4 bg-slate-950/15 border-b border-white/5 grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-lg bg-white/3 flex flex-col gap-0.5">
                <span className="text-slate-400 flex items-center gap-1"><Layers className="w-3 h-3 text-cyan-400" /> Clusters</span>
                <span className="text-lg font-bold text-cyan-400">{stats.totalClusters}</span>
              </div>
              <div className="p-3 rounded-lg bg-white/3 flex flex-col gap-0.5">
                <span className="text-slate-400 flex items-center gap-1"><Activity className="w-3 h-3 text-red-400" /> Events</span>
                <span className="text-lg font-bold text-red-400">{stats.totalEvents}</span>
              </div>
              <div className="p-3 rounded-lg bg-white/3 flex flex-col gap-0.5">
                <span className="text-slate-400 flex items-center gap-1"><TrendingUp className="w-3 h-3 text-amber-400" /> Peak Avg Mag</span>
                <span className="text-lg font-bold text-amber-400">M {stats.highestAvgMag}</span>
              </div>
              <div className="p-3 rounded-lg bg-white/3 flex flex-col gap-0.5 overflow-hidden">
                <span className="text-slate-400 flex items-center gap-1 truncate"><MapPin className="w-3 h-3 text-purple-400" /> Max Impact</span>
                <span className="text-sm font-bold text-slate-200 truncate">{stats.activeRegency}</span>
              </div>
            </div>

            {/* Filter Section */}
            <div className="p-4 border-b border-white/5 flex flex-col gap-3.5">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
                <span className="flex items-center gap-1.5"><Filter className="w-3.5 h-3.5 text-cyan-400" /> Filter Clusters</span>
                <span className="text-[10px] text-cyan-400 font-mono">{filteredClusters.length} / {clusters.length} visible</span>
              </div>

              {/* Regency Search */}
              <div className="relative">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search Regency or Province..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-xs rounded-xl bg-slate-900/60 border border-white/5 focus:outline-none focus:border-cyan-500 text-slate-200 transition-colors"
                />
                {searchQuery && (
                  <button 
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>


            </div>

            {/* Clusters List */}
            <div className="flex-1 overflow-y-auto no-scrollbar p-3 flex flex-col gap-2 bg-slate-950/5">
              {filteredClusters.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400 flex flex-col items-center gap-2">
                  <Info className="w-5 h-5 text-slate-500" />
                  No clusters match the active filters.
                </div>
              ) : (
                filteredClusters.map((cluster) => {
                  const color = CLUSTER_COLORS[cluster.cluster_id % CLUSTER_COLORS.length];
                  const isSelected = selectedClusterId === cluster.cluster_id;
                  const isHovered = hoveredClusterId === cluster.cluster_id;
                  const mainKabName = cluster.title.split('(')[1]?.replace(')', '') || cluster.title;
                  
                  return (
                    <div
                      key={cluster.cluster_id}
                      onClick={() => setSelectedClusterId(isSelected ? null : cluster.cluster_id)}
                      onMouseEnter={() => setHoveredClusterId(cluster.cluster_id)}
                      onMouseLeave={() => setHoveredClusterId(null)}
                      className={`p-3 rounded-xl cursor-pointer border transition-all duration-300 ${
                        isSelected 
                          ? "bg-slate-900/80 border-cyan-500/50 shadow-md" 
                          : isHovered
                          ? "bg-slate-900/40 border-white/10"
                          : "bg-white/2 border-white/5"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span 
                            className="w-2.5 h-2.5 rounded-full inline-block shrink-0" 
                            style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}` }}
                          />
                          <span className="font-bold text-[12px] text-slate-200">
                            Cluster {cluster.cluster_id + 1}
                          </span>
                        </div>
                        <span className="text-[10px] bg-slate-900 px-2 py-0.5 rounded-full text-slate-400 border border-white/5 font-mono">
                          {cluster.event_count} events
                        </span>
                      </div>
                      
                      <div className="text-[11px] text-slate-400 mt-1.5 flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-slate-500 shrink-0" />
                        <span className="truncate">{mainKabName}</span>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-2 mt-2 pt-2 border-t border-white/5 text-[10px] text-slate-400">
                        <div>
                          <span className="text-[9px] block text-slate-500">10Y Freq</span>
                          <span className="font-semibold text-cyan-400">{cluster.frequency_last_10_years}</span>
                        </div>
                        <div>
                          <span className="text-[9px] block text-slate-500">Avg Mag</span>
                          <span className="font-semibold text-amber-400">M {cluster.avg_magnitude}</span>
                        </div>
                        <div>
                          <span className="text-[9px] block text-slate-500">Avg Depth</span>
                          <span className="font-semibold text-purple-400">{cluster.avg_depth} km</span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {/* Left Sidebar Toggle Button */}
      <button
        onClick={() => setLeftPanelOpen(!leftPanelOpen)}
        className={`absolute top-1/2 -translate-y-1/2 z-20 w-8 h-12 flex items-center justify-center rounded-r-xl glass border-l-0 hover:text-cyan-400 text-slate-400 transition-all duration-300 pointer-events-auto cursor-pointer ${
          leftPanelOpen ? "left-[400px]" : "left-4 rounded-l-xl border-l"
        }`}
        title={leftPanelOpen ? "Collapse Filter Panel" : "Expand Filter Panel"}
      >
        {leftPanelOpen ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
      </button>

      {/* 4. Selected Cluster Details Card (Floating on bottom-right or top-right depending on size) */}
      {selectedCluster && (
        <>
          <div className={`absolute top-4 right-4 bottom-4 w-96 z-10 pointer-events-auto glass rounded-2xl flex flex-col shadow-2xl border-white/10 overflow-hidden transition-all duration-300 ${
            rightPanelOpen ? "translate-x-0 opacity-100" : "translate-x-[calc(100%+16px)] opacity-0 pointer-events-none"
          }`}>
          
          {/* Details Header */}
          <div className="p-4 border-b border-white/5 bg-slate-950/20 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div 
                className="w-3 h-3 rounded-full" 
                style={{ 
                  backgroundColor: CLUSTER_COLORS[selectedCluster.cluster_id % CLUSTER_COLORS.length],
                  boxShadow: `0 0 10px ${CLUSTER_COLORS[selectedCluster.cluster_id % CLUSTER_COLORS.length]}` 
                }}
              />
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                Cluster {selectedCluster.cluster_id + 1} Details
              </h2>
            </div>
            <button 
              onClick={() => setSelectedClusterId(null)}
              className="p-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto no-scrollbar p-4 flex flex-col gap-4">
            
            {/* Primary Stats Info */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-900/60 border border-white/5">
                <span className="text-slate-400 block mb-0.5">Average Magnitude</span>
                <span className="text-lg font-bold text-amber-400">M {selectedCluster.avg_magnitude}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-900/60 border border-white/5">
                <span className="text-slate-400 block mb-0.5">Average Depth</span>
                <span className="text-lg font-bold text-purple-400">{selectedCluster.avg_depth} km</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-900/60 border border-white/5">
                <span className="text-slate-400 block mb-0.5">10-Year Frequency</span>
                <span className="text-lg font-bold text-cyan-400">{selectedCluster.frequency_last_10_years} events</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-900/60 border border-white/5">
                <span className="text-slate-400 block mb-0.5">Total Frequency</span>
                <span className="text-lg font-bold text-slate-200">{selectedCluster.event_count} events</span>
              </div>
            </div>

            {/* Affected Regency List */}
            <div className="flex flex-col gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                <Compass className="w-3.5 h-3.5 text-cyan-400" /> Intersected Kabupaten/Kota
              </span>
              <div className="flex flex-wrap gap-1.5">
                {selectedCluster.kabupaten_kota.map((kab, idx) => (
                  <span 
                    key={idx} 
                    className="text-[10px] bg-slate-900/80 px-2.5 py-1 rounded-full text-slate-300 border border-white/5"
                  >
                    {kab}
                  </span>
                ))}
              </div>
            </div>

            {/* Recent Events Feed inside this cluster */}
            <div className="flex flex-col gap-2 flex-1 overflow-hidden">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-red-400" /> Recent Events in Cluster
              </span>
              
              <div className="flex-1 overflow-y-auto no-scrollbar flex flex-col gap-2 pr-1">
                {selectedCluster.points.slice(0, 15).map((point, idx) => (
                  <div 
                    key={idx}
                    className="p-2.5 rounded-lg bg-white/2 border border-white/5 flex flex-col gap-1 text-[11px]"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-300">M {point.magnitude}</span>
                      <span className="text-[9px] text-slate-400">{point.datetime.split(' ')[0]}</span>
                    </div>
                    <div className="text-[10px] text-slate-400 flex items-center justify-between">
                      <span>Depth: {point.depth} km</span>
                      <span className="truncate max-w-[150px]">{point.kabupaten_kota}</span>
                    </div>
                  </div>
                ))}
                {selectedCluster.points.length > 15 && (
                  <div className="text-center text-[9px] text-slate-500 py-1">
                    Showing top 15 of {selectedCluster.points.length} events
                  </div>
                )}
              </div>
            </div>

          </div>

          {/* Footer Reset Zoom Button */}
          <div className="p-4 border-t border-white/5 bg-slate-950/20 flex gap-2">
            <button
              onClick={() => setSelectedClusterId(null)}
              className="flex-1 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl transition-all duration-300"
            >
              Clear Selection
            </button>
          </div>

          </div>

          {/* Right Sidebar Toggle Button */}
          <button
            onClick={() => setRightPanelOpen(!rightPanelOpen)}
            className={`absolute top-1/2 -translate-y-1/2 z-20 w-8 h-12 flex items-center justify-center rounded-l-xl glass border-r-0 hover:text-cyan-400 text-slate-400 transition-all duration-300 pointer-events-auto cursor-pointer ${
              rightPanelOpen ? "right-[400px]" : "right-4 rounded-r-xl border-r"
            }`}
            title={rightPanelOpen ? "Collapse Details Panel" : "Expand Details Panel"}
          >
            {rightPanelOpen ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </>
      )}

      {/* 5. Recompute Parameters Modal */}
      <RecomputeModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onConfirm={handleConfirmRecompute}
        defaultParams={defaultParams}
      />

      {/* 6. Recompute Alert / Spinner overlay */}
      {recomputing && (
        <div className="absolute inset-0 bg-[#090d16]/85 backdrop-blur-md z-50 flex flex-col items-center justify-center text-center gap-4 pointer-events-auto">
          <RefreshCw className="w-12 h-12 text-cyan-400 animate-spin" />
          <div className="flex flex-col gap-1">
            <h3 className="text-lg font-bold text-slate-100 uppercase tracking-widest">
              Reclustering Earthquakes
            </h3>
            <p className="text-xs text-slate-400 max-w-sm">
              The K-Means clustering algorithm, B-Spline interpolation, and spatial joins with 394 Indonesian boundary polygons are running. This takes approximately 10–12 seconds.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
