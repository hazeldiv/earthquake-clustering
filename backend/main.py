from fastapi import FastAPI, BackgroundTasks, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import os
import uvicorn
from backend.cluster_processor import get_clusters, compute_clusters, DEFAULT_PARAMS

app = FastAPI(
    title="Indonesia Earthquake Clustering API",
    description="Backend API for clustering earthquakes > 5 magnitude in Indonesia",
    version="1.0.0"
)

# Enable CORS for Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For production, specify the actual frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global in-memory cache for fast loading
_cache = None

class ClusterParams(BaseModel):
    k_min: Optional[int] = DEFAULT_PARAMS["k_min"]
    k_max: Optional[int] = DEFAULT_PARAMS["k_max"]
    random_state: Optional[int] = DEFAULT_PARAMS["random_state"]
    mag_threshold: Optional[float] = DEFAULT_PARAMS["mag_threshold"]
    depth_threshold: Optional[float] = DEFAULT_PARAMS["depth_threshold"]
    neighbor_distance: Optional[float] = DEFAULT_PARAMS["neighbor_distance"]
    min_events: Optional[int] = DEFAULT_PARAMS["min_events"]
    year_span: Optional[int] = DEFAULT_PARAMS["year_span"]
    smooth_factor: Optional[int] = DEFAULT_PARAMS["smooth_factor"]

@app.on_event("startup")
def startup_event():
    global _cache
    print("[API] Warming up cache...")
    # Load from cache file (or compute if not exists)
    _cache = get_clusters(force_recompute=False)
    print(f"[API] Cache loaded with {len(_cache)} clusters.")

@app.get("/health")
def health():
    return {"status": "ok"}

@app.get("/api/defaults")
def get_defaults():
    """Return the default clustering parameters."""
    return DEFAULT_PARAMS

@app.get("/api/clusters")
def get_earthquake_clusters(recompute: bool = Query(False, description="Force recomputation of clusters")):
    global _cache
    if recompute:
        print("[API] Force recompute requested...")
        _cache = compute_clusters()
    elif _cache is None:
        _cache = get_clusters(force_recompute=False)
    return _cache

@app.post("/api/clusters/recompute")
def trigger_recompute(params: ClusterParams, background_tasks: BackgroundTasks):
    """Trigger recomputation of clusters in the background and update the cache."""
    def recompute_task():
        global _cache
        print("[API] Background recomputation started...")
        _cache = compute_clusters(
            k_min=params.k_min,
            k_max=params.k_max,
            random_state=params.random_state,
            mag_threshold=params.mag_threshold,
            depth_threshold=params.depth_threshold,
            neighbor_distance=params.neighbor_distance,
            min_events=params.min_events,
            year_span=params.year_span,
            smooth_factor=params.smooth_factor,
        )
        print("[API] Background recomputation finished.")
        
    background_tasks.add_task(recompute_task)
    return {"status": "processing", "message": "Recomputation started in the background."}

if __name__ == "__main__":
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)
