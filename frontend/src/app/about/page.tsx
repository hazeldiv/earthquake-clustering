"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Cpu,
  MapPin,
  Network,
  TrendingUp,
  Activity,
  Layers,
  ShieldAlert,
  Info,
  Calendar,
  Compass,
  BarChart3,
  GitBranch,
  Grid
} from "lucide-react";

export default function AboutPage() {
  const [activeTab, setActiveTab] = useState<"how-it-works" | "metrics" | "eda">("how-it-works");

  // Metrics state
  const [metrics, setMetrics] = useState<{
    inertia: number;
    silhouette: number;
    davies_bouldin: number;
    calinski_harabasz: number;
    dunn: number;
  } | null>(null);
  const [loadingMetrics, setLoadingMetrics] = useState(true);
  const [metricsError, setMetricsError] = useState<string | null>(null);

  const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";

  useEffect(() => {
    fetch(`${API_BASE}/api/metrics`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load model metrics");
        return res.json();
      })
      .then((data) => {
        setMetrics(data);
        setLoadingMetrics(false);
      })
      .catch((err) => {
        console.error(err);
        setMetricsError("Unable to fetch clustering metrics. Please verify the backend API server is running.");
        setLoadingMetrics(false);
      });
  }, [API_BASE]);

  return (
    <div className="w-full h-screen overflow-y-auto custom-scrollbar bg-[#090d16] text-slate-100 flex flex-col relative overflow-x-hidden font-sans selection:bg-cyan-500/20 selection:text-cyan-300 scroll-smooth">
      {/* Background Neon Glow Effects */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-cyan-500/5 blur-[120px] pointer-events-none z-0" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-purple-500/5 blur-[120px] pointer-events-none z-0" />

      {/* Header Area */}
      <header className="w-full max-w-5xl mx-auto px-6 pt-8 pb-4 z-10 flex items-center justify-between border-b border-white/5">
        <Link
          href="/"
          className="flex items-center gap-2 px-4 py-2 rounded-xl glass text-xs font-semibold text-slate-400 hover:text-cyan-400 hover:border-cyan-500/30 transition-all duration-300"
        >
          <ArrowLeft className="w-4 h-4" />
          BACK TO DASHBOARD
        </Link>
      </header>

      {/* Main Content Container */}
      <div className="w-full max-w-4xl mx-auto px-6 py-12 z-10 flex flex-col gap-8">
        
        {/* Title Block */}
        <div className="flex flex-col gap-3">
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight uppercase bg-gradient-to-r from-cyan-400 via-sky-300 to-purple-400 bg-clip-text text-transparent">
            Clustering Methodology & Analysis
          </h1>
          <p className="text-slate-400 text-sm md:text-base max-w-2xl leading-relaxed">
            Our pipeline automatically processes raw earthquake records and transforms them into active hazard zones, identifying regional impacts through spatial algorithms.
          </p>
        </div>

        {/* Tab Controls */}
        <div className="flex border-b border-white/5 gap-6 mt-2">
          <button
            onClick={() => setActiveTab("how-it-works")}
            className={`pb-3 text-xs md:text-sm font-bold uppercase tracking-wider transition-all duration-300 border-b-2 cursor-pointer ${
              activeTab === "how-it-works"
                ? "border-cyan-400 text-cyan-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            How it works
          </button>
          <button
            onClick={() => setActiveTab("metrics")}
            className={`pb-3 text-xs md:text-sm font-bold uppercase tracking-wider transition-all duration-300 border-b-2 cursor-pointer ${
              activeTab === "metrics"
                ? "border-cyan-400 text-cyan-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            Model Evaluation
          </button>
          <button
            onClick={() => setActiveTab("eda")}
            className={`pb-3 text-xs md:text-sm font-bold uppercase tracking-wider transition-all duration-300 border-b-2 cursor-pointer ${
              activeTab === "eda"
                ? "border-cyan-400 text-cyan-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            Exploratory Data Analysis
          </button>
        </div>

        {/* Tab Contents */}
        <div className="flex-1 flex flex-col gap-8 min-h-[300px]">
          
          {/* TAB 1: HOW IT WORKS */}
          {activeTab === "how-it-works" && (
            <div className="flex flex-col gap-10 animate-fadeIn duration-500">
              {/* Steps Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Step 1: Data Filtering */}
                <div className="p-6 rounded-2xl glass flex flex-col gap-4 border-white/5 hover:border-cyan-500/20 transition-all duration-300">
                  <div className="w-10 h-10 rounded-xl bg-cyan-950/40 border border-cyan-500/30 flex items-center justify-center">
                    <Activity className="w-5 h-5 text-cyan-400" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <div className="text-[10px] text-cyan-400 font-bold uppercase tracking-wider">Step 1</div>
                    <h3 className="text-base font-bold text-slate-200">Data Filtering & Querying</h3>
                    <p className="text-slate-400 text-xs leading-relaxed mt-1">
                      The database gathers historical seismic data in Indonesia. It filters for significant events with a **magnitude of 5.0 or greater** occurring over the **last 10 years**. These events represent potentially damaging earthquakes that highlight current geological strain.
                    </p>
                  </div>
                </div>

                {/* Step 2: K-Means Clustering */}
                <div className="p-6 rounded-2xl glass flex flex-col gap-4 border-white/5 hover:border-purple-500/20 transition-all duration-300">
                  <div className="w-10 h-10 rounded-xl bg-purple-950/40 border border-purple-500/30 flex items-center justify-center">
                    <Cpu className="w-5 h-5 text-purple-400" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <div className="text-[10px] text-purple-400 font-bold uppercase tracking-wider">Step 2</div>
                    <h3 className="text-base font-bold text-slate-200">K-Means Spatial Clustering</h3>
                    <p className="text-slate-400 text-xs leading-relaxed mt-1">
                      Using the spatial coordinates (latitude and longitude), the backend executes a **K-Means clustering algorithm**. This groups geographically dense points together, partitioning the earthquake data into $K$ distinct seismic clusters representing active fault systems or subduction zones.
                    </p>
                  </div>
                </div>

                {/* Step 3: Boundary Smoothing */}
                <div className="p-6 rounded-2xl glass flex flex-col gap-4 border-white/5 hover:border-pink-500/20 transition-all duration-300">
                  <div className="w-10 h-10 rounded-xl bg-pink-950/40 border border-pink-500/30 flex items-center justify-center">
                    <Layers className="w-5 h-5 text-pink-400" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <div className="text-[10px] text-pink-400 font-bold uppercase tracking-wider">Step 3</div>
                    <h3 className="text-base font-bold text-slate-200">B-Spline Boundary Interpolation</h3>
                    <p className="text-slate-400 text-xs leading-relaxed mt-1">
                      To visualize the danger zones, a **Convex Hull** is computed around the outer points of each cluster. The boundary is then smoothed using a **B-Spline interpolation algorithm**. This creates continuous, rounded hazard contours instead of rigid, jagged polygons, representing spatial hazard probability.
                    </p>
                  </div>
                </div>

                {/* Step 4: Spatial Join */}
                <div className="p-6 rounded-2xl glass flex flex-col gap-4 border-white/5 hover:border-amber-500/20 transition-all duration-300">
                  <div className="w-10 h-10 rounded-xl bg-amber-950/40 border border-amber-500/30 flex items-center justify-center">
                    <MapPin className="w-5 h-5 text-amber-400" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <div className="text-[10px] text-amber-400 font-bold uppercase tracking-wider">Step 4</div>
                    <h3 className="text-base font-bold text-slate-200">Administrative Spatial Joins</h3>
                    <p className="text-slate-400 text-xs leading-relaxed mt-1">
                      Finally, a **spatial join (intersection)** is performed between the smoothed cluster boundaries and the official boundary shapes of 394 Indonesian districts (**Kabupaten/Kota**) and **Provinces**. This determines exactly which local administrations fall within high-risk seismic sectors.
                    </p>
                  </div>
                </div>

              </div>

              {/* Detailed Mathematical & Code Breakdown */}
              <section className="flex flex-col gap-6 mt-4">
                <h2 className="text-xl font-bold uppercase tracking-wider text-slate-200 flex items-center gap-2">
                  <Network className="w-5 h-5 text-cyan-400" /> Core Algorithms in Depth
                </h2>

                <div className="flex flex-col gap-6">

                  {/* K-Means Details */}
                  <div className="p-6 rounded-2xl bg-white/2 border border-white/5 flex flex-col gap-3">
                    <h4 className="text-sm font-bold text-slate-300">1. Spatial Distance Optimization</h4>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      The K-Means algorithm partitions the $N$ observations into $K$ clusters by minimizing the within-cluster sum of squares (WCSS). The distance metric used is the **Haversine distance** (accounting for Earth's curvature) to ensure accuracy near equatorial coordinates.
                    </p>
                    <div className="p-4 rounded-xl bg-slate-950/50 border border-white/5 font-mono text-[11px] text-slate-300 mt-2 overflow-x-auto">
                      {"minimize WCSS = \u2211_{i=1}^{K} \u2211_{x \u2208 S_i} || x - \u03bc_i ||\u00b2"}
                    </div>
                  </div>

                  {/* B-Spline Details */}
                  <div className="p-6 rounded-2xl bg-white/2 border border-white/5 flex flex-col gap-3">
                    <h4 className="text-sm font-bold text-slate-300">2. Boundary Hull Smoothing</h4>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Once a convex hull is constructed, the coordinates are fitted to a closed B-Spline curve. This creates a parametric curve that passes close to control points, avoiding overlapping self-intersections and defining a continuous hazard zone map layer.
                    </p>
                  </div>

                  {/* Warning Callout */}
                  <div className="p-5 rounded-2xl bg-amber-500/5 border border-amber-500/20 flex gap-4 items-start">
                    <ShieldAlert className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                    <div className="flex flex-col gap-1">
                      <h4 className="text-xs font-bold text-amber-400">Important Advisory</h4>
                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        The computed boundaries represent historical spatial density of earthquake epicenters. They are intended for hazard research and retrospective trend analysis and should not be used as real-time predictive evacuation boundaries.
                      </p>
                    </div>
                  </div>

                </div>
              </section>
            </div>
          )}

          {/* TAB 2: MODEL EVALUATION METRICS */}
          {activeTab === "metrics" && (
            <div className="flex flex-col gap-6 animate-fadeIn duration-500">
              
              <div className="flex flex-col gap-2">
                <h2 className="text-lg font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                  <GitBranch className="w-5 h-5 text-purple-400" /> Model Evaluation Metrics
                </h2>
                <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
                  These mathematical coefficients measure the compactness, separation density, and spatial coherence of the generated seismic clusters. Below are the actual performance metrics computed from the current trained K-Means model.
                </p>
              </div>

              {loadingMetrics ? (
                <div className="py-16 flex flex-col items-center justify-center gap-3 text-slate-400">
                  <Activity className="w-8 h-8 animate-spin text-cyan-400" />
                  <span className="text-xs font-semibold uppercase tracking-wider">Loading Model Metrics...</span>
                </div>
              ) : metricsError ? (
                <div className="p-6 rounded-2xl bg-red-500/5 border border-red-500/20 text-center flex flex-col items-center gap-4 py-12">
                  <ShieldAlert className="w-10 h-10 text-red-500" />
                  <p className="text-xs text-slate-400 max-w-md">{metricsError}</p>
                </div>
              ) : metrics && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-2">
                  
                  {/* Inertia */}
                  <div className="p-6 rounded-2xl glass border-white/5 flex flex-col gap-3">
                    <div className="flex justify-between items-start">
                      <h3 className="text-sm font-bold text-slate-300">Inertia (WCSS)</h3>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono bg-cyan-950/40 border border-cyan-500/20 text-cyan-400">
                        Lower is better
                      </span>
                    </div>
                    <div className="text-2xl font-black text-cyan-400 my-1 font-mono">
                      {metrics.inertia.toLocaleString()}
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      Measures the sum of squared distances of samples to their closest cluster center, where lower values indicate tighter, more compact clusters.
                    </p>
                  </div>

                  {/* Silhouette Score */}
                  <div className="p-6 rounded-2xl glass border-white/5 flex flex-col gap-3">
                    <div className="flex justify-between items-start">
                      <h3 className="text-sm font-bold text-slate-300">Silhouette Score</h3>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono bg-emerald-950/40 border border-emerald-500/20 text-emerald-400">
                        Range: [-1, 1] (Higher is better)
                      </span>
                    </div>
                    <div className="text-2xl font-black text-emerald-400 my-1 font-mono">
                      {metrics.silhouette}
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      Calculates the mean ratio of intra-cluster distance to nearest-cluster distance for each sample, ranging from -1 to 1, where higher values indicate better-defined and well-separated clusters.
                    </p>
                  </div>

                  {/* Davies-Bouldin Index */}
                  <div className="p-6 rounded-2xl glass border-white/5 flex flex-col gap-3">
                    <div className="flex justify-between items-start">
                      <h3 className="text-sm font-bold text-slate-300">Davies-Bouldin Index</h3>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono bg-purple-950/40 border border-purple-500/20 text-purple-400">
                        Lower is better (Min: 0)
                      </span>
                    </div>
                    <div className="text-2xl font-black text-purple-400 my-1 font-mono">
                      {metrics.davies_bouldin}
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      Computes the average similarity ratio between each cluster and its most similar one, where lower values (minimum 0) indicate better clustering with lower intra-cluster distance and higher inter-cluster separation.
                    </p>
                  </div>

                  {/* Calinski-Harabasz Index */}
                  <div className="p-6 rounded-2xl glass border-white/5 flex flex-col gap-3">
                    <div className="flex justify-between items-start">
                      <h3 className="text-sm font-bold text-slate-300">Calinski-Harabasz Index</h3>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono bg-amber-950/40 border border-amber-500/20 text-amber-400">
                        Higher is better
                      </span>
                    </div>
                    <div className="text-2xl font-black text-amber-400 my-1 font-mono">
                      {metrics.calinski_harabasz.toLocaleString()}
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      Computes the ratio of the sum of between-clusters dispersion and of within-cluster dispersion, where higher values indicate that clusters are dense and well-separated.
                    </p>
                  </div>

                  {/* Dunn Index */}
                  <div className="p-6 rounded-2xl glass border-white/5 flex flex-col gap-3 md:col-span-2">
                    <div className="flex justify-between items-start">
                      <h3 className="text-sm font-bold text-slate-300">Dunn Index</h3>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono bg-sky-950/40 border border-sky-500/20 text-sky-400">
                        Higher is better
                      </span>
                    </div>
                    <div className="text-2xl font-black text-sky-400 my-1 font-mono">
                      {metrics.dunn}
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      Measures the ratio of the minimum distance between points in different clusters to the maximum diameter of any cluster, where higher values indicate compact clusters that are far apart from each other.
                    </p>
                  </div>

                </div>
              )}
            </div>
          )}

          {/* TAB 3: EXPLORATORY DATA ANALYSIS (EDA) */}
          {activeTab === "eda" && (
            <div className="flex flex-col gap-10 animate-fadeIn duration-500">
              
              <div className="flex flex-col gap-2">
                <h2 className="text-lg font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-cyan-400" /> Exploratory Data Analysis (EDA)
                </h2>
                <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
                  A comprehensive analysis of raw seismic catalog records in Indonesia. These statistics highlight underlying distribution trends in coordinate locations, depths, and earthquake magnitudes.
                </p>
              </div>

              <div className="flex flex-col gap-12 mt-2">
                
                {/* 1. Spatial Locations Plot */}
                <div className="p-6 rounded-2xl glass border-white/5 flex flex-col gap-6 hover:border-cyan-500/10 transition-all duration-300">
                  <div className="flex flex-col gap-1.5">
                    <div className="text-[10px] text-cyan-400 font-bold uppercase tracking-wider">Visualization 1</div>
                    <h3 className="text-lg font-bold text-slate-200 flex items-center gap-2">
                      <Compass className="w-4 h-4 text-cyan-400" /> Spatial Epicenter Distribution
                    </h3>
                  </div>
                  <div className="w-full rounded-xl overflow-hidden border border-white/5 bg-slate-950/40 p-2 flex items-center justify-center">
                    <img 
                      src="/eda/earthquake_locations.png" 
                      alt="Earthquake Locations in Indonesia" 
                      className="max-h-[420px] w-auto object-contain hover:scale-[1.02] transition-transform duration-500"
                    />
                  </div>
                  <div className="flex flex-col gap-3">
                    <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Analysis & Findings:</h4>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      This scatter plot maps the coordinates (latitude vs. longitude) of recorded earthquakes, with point colors representing their magnitude. It reveals that the seismic events trace the subduction zones and tectonic faults of the Indonesian archipelago, with high event concentrations along the Sumatra fault line, the Java subduction zone, and dense clusters in Eastern Indonesia, particularly around the Banda Arc, Molucca Sea, and northern Papua.
                    </p>
                  </div>
                </div>

                {/* 2. Magnitude Distribution Plot */}
                <div className="p-6 rounded-2xl glass border-white/5 flex flex-col gap-6 hover:border-emerald-500/10 transition-all duration-300">
                  <div className="flex flex-col gap-1.5">
                    <div className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider">Visualization 2</div>
                    <h3 className="text-lg font-bold text-slate-200 flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-emerald-400" /> Earthquake Magnitude Histogram
                    </h3>
                  </div>
                  <div className="w-full rounded-xl overflow-hidden border border-white/5 bg-slate-950/40 p-2 flex items-center justify-center">
                    <img 
                      src="/eda/magnitude_distribution.png" 
                      alt="Earthquake Magnitude Distribution" 
                      className="max-h-[350px] w-auto object-contain hover:scale-[1.02] transition-transform duration-500"
                    />
                  </div>
                  <div className="flex flex-col gap-3">
                    <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Analysis & Findings:</h4>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      The histogram of earthquake magnitudes shows a distribution that peaks around magnitude 3.3 to 3.4. It exhibits a sharp cutoff on the left (under magnitude 2.0) representing the limit of the seismic network's detection threshold, and a classic Gutenberg-Richter log-linear decay on the right, indicating that while minor tremors are very frequent, moderate-to-strong earthquakes (magnitude ≥ 5.0) are comparatively rare.
                    </p>
                  </div>
                </div>

                {/* 3. Depth Distribution Plot */}
                <div className="p-6 rounded-2xl glass border-white/5 flex flex-col gap-6 hover:border-purple-500/10 transition-all duration-300">
                  <div className="flex flex-col gap-1.5">
                    <div className="text-[10px] text-purple-400 font-bold uppercase tracking-wider">Visualization 3</div>
                    <h3 className="text-lg font-bold text-slate-200 flex items-center gap-2">
                      <Layers className="w-4 h-4 text-purple-400" /> Focal Depth Distribution
                    </h3>
                  </div>
                  <div className="w-full rounded-xl overflow-hidden border border-white/5 bg-slate-950/40 p-2 flex items-center justify-center">
                    <img 
                      src="/eda/depth_distribution.png" 
                      alt="Earthquake Focal Depth Distribution" 
                      className="max-h-[350px] w-auto object-contain hover:scale-[1.02] transition-transform duration-500"
                    />
                  </div>
                  <div className="flex flex-col gap-3">
                    <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Analysis & Findings:</h4>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      The depth histogram reveals that the vast majority of seismic activity in Indonesia is shallow-focus (occurring within the top 50 km of the crust), peaking sharply in the 0–20 km bin. A long right tail represents intermediate and deep-focus earthquakes (extending to over 700 km depth) occurring inside the sinking oceanic plates of active subduction zones.
                    </p>
                  </div>
                </div>

                {/* 4. Events Per Year Plot */}
                <div className="p-6 rounded-2xl glass border-white/5 flex flex-col gap-6 hover:border-amber-500/10 transition-all duration-300">
                  <div className="flex flex-col gap-1.5">
                    <div className="text-[10px] text-amber-400 font-bold uppercase tracking-wider">Visualization 4</div>
                    <h3 className="text-lg font-bold text-slate-200 flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-amber-400" /> Temporal Earthquake Events (2008–2025)
                    </h3>
                  </div>
                  <div className="w-full rounded-xl overflow-hidden border border-white/5 bg-slate-950/40 p-2 flex items-center justify-center">
                    <img 
                      src="/eda/events_per_year.png" 
                      alt="Earthquake Events per Year" 
                      className="max-h-[350px] w-auto object-contain hover:scale-[1.02] transition-transform duration-500"
                    />
                  </div>
                  <div className="flex flex-col gap-3">
                    <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Analysis & Findings:</h4>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      This bar chart tracks annual earthquake frequency, showing a steady number of events from 2009 to 2016 (around 4,000–6,500 annually) followed by a substantial increase starting in 2017, peaking at 14,000 events in 2025. This rise is primarily associated with the expansion and modernization of the BMKG detection network (new stations and automated logging) rather than an increase in underlying tectonic activity.
                    </p>
                  </div>
                </div>

                {/* 5. Top 10 Locations Plot */}
                <div className="p-6 rounded-2xl glass border-white/5 flex flex-col gap-6 hover:border-pink-500/10 transition-all duration-300">
                  <div className="flex flex-col gap-1.5">
                    <div className="text-[10px] text-pink-400 font-bold uppercase tracking-wider">Visualization 5</div>
                    <h3 className="text-lg font-bold text-slate-200 flex items-center gap-2">
                      <Grid className="w-4 h-4 text-pink-400" /> Seismically Active Regions Ranking
                    </h3>
                  </div>
                  <div className="w-full rounded-xl overflow-hidden border border-white/5 bg-slate-950/40 p-2 flex items-center justify-center">
                    <img 
                      src="/eda/top10_locations.png" 
                      alt="Top 10 Locations with Most Frequent Earthquakes" 
                      className="max-h-[350px] w-auto object-contain hover:scale-[1.02] transition-transform duration-500"
                    />
                  </div>
                  <div className="flex flex-col gap-3">
                    <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Analysis & Findings:</h4>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      A horizontal ranking of the most active seismic zones shows that the Minahassa Peninsula and wider Sulawesi region experience the highest frequency of earthquakes (surpassing 12,000–13,000 events in the catalog). Java, Sumbawa, and Northern/Southern Sumatra also rank highly, reflecting their position along major subduction interfaces and continental strike-slip faults.
                    </p>
                  </div>
                </div>

              </div>

            </div>
          )}

        </div>

        {/* Footer info */}
        <footer className="mt-8 text-center text-[10px] text-slate-500 border-t border-white/5 pt-8">
          Indonesia Earthquake Clustering Project &bull; Powered by Next.js & FastAPI
        </footer>

      </div>
    </div>
  );
}
