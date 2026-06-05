import Link from "next/link";
import { 
  ArrowLeft, 
  Cpu, 
  MapPin, 
  Network, 
  TrendingUp, 
  HelpCircle,
  Activity,
  Layers,
  ShieldAlert
} from "lucide-react";

export const metadata = {
  title: "Clustering Methodology | About | Seismic Hazard Analysis",
  description: "Learn how the K-Means clustering, B-Spline boundary smoothing, and spatial join algorithms identify high-risk seismic zones in Indonesia.",
};

export default function AboutPage() {
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
        <div className="flex items-center gap-2 text-slate-400">
          <HelpCircle className="w-4 h-4 text-cyan-400" />
          <span className="text-[11px] font-semibold uppercase tracking-wider">Methodology Guide</span>
        </div>
      </header>

      {/* Main Content */}
      <div className="w-full max-w-4xl mx-auto px-6 py-12 z-10 flex flex-col gap-10">
        
        {/* Title Block */}
        <div className="flex flex-col gap-3">
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight uppercase bg-gradient-to-r from-cyan-400 via-sky-300 to-purple-400 bg-clip-text text-transparent">
            How Seismic Clustering Works
          </h1>
          <p className="text-slate-400 text-sm md:text-base max-w-2xl leading-relaxed">
            Our pipeline automatically processes raw earthquake records and transforms them into active hazard zones, identifying regional impacts through spatial algorithms.
          </p>
        </div>

        {/* Steps Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
          
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
        <section className="mt-8 flex flex-col gap-6">
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

        {/* Footer info */}
        <footer className="mt-8 text-center text-[10px] text-slate-500 border-t border-white/5 pt-8">
          Indonesia Earthquake Clustering Project &bull; Powered by Next.js & FastAPI
        </footer>

      </div>
    </div>
  );
}
