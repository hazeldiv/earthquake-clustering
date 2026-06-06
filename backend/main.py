from fastapi import FastAPI, BackgroundTasks, Query, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import os
import uvicorn
from cluster_processor import get_clusters, compute_clusters, get_metrics, DEFAULT_PARAMS

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
    bypass_elbow: Optional[bool] = DEFAULT_PARAMS["bypass_elbow"]
    fixed_k: Optional[int] = DEFAULT_PARAMS["fixed_k"]

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
def get_defaults(response: Response):
    """Return the default clustering parameters."""
    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    return DEFAULT_PARAMS

@app.get("/api/metrics")
def get_model_metrics(response: Response, recompute: bool = Query(False, description="Force recomputation of metrics")):
    """Return model evaluation metrics (WCSS, Silhouette, Davies-Bouldin, Calinski-Harabasz, Dunn)."""
    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    return get_metrics(force_recompute=recompute)

@app.get("/api/clusters")
def get_earthquake_clusters(response: Response, recompute: bool = Query(False, description="Force recomputation of clusters")):
    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    global _cache
    if recompute:
        print("[API] Force recompute requested...")
        _cache = compute_clusters()
    elif _cache is None:
        _cache = get_clusters(force_recompute=False)
    return _cache

_recompute_status = {
    "status": "ready",
    "progress": 100,
    "message": "Ready"
}

def update_status_callback(progress: int, message: str):
    global _recompute_status
    _recompute_status["progress"] = progress
    _recompute_status["message"] = message

@app.get("/api/clusters/status")
def get_recompute_status(response: Response):
    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    global _recompute_status
    return _recompute_status

@app.post("/api/clusters/recompute")
def trigger_recompute(params: ClusterParams, background_tasks: BackgroundTasks):
    """Trigger recomputation of clusters in the background and update the cache."""
    global _recompute_status
    if _recompute_status["status"] == "processing":
        return {"status": "processing", "message": "Recomputation is already in progress."}
        
    _recompute_status["status"] = "processing"
    _recompute_status["progress"] = 0
    _recompute_status["message"] = "Initializing..."
    
    def recompute_task():
        global _cache, _recompute_status
        try:
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
                bypass_elbow=params.bypass_elbow,
                fixed_k=params.fixed_k,
                progress_callback=update_status_callback,
            )
            print("[API] Background recomputation finished.")
            _recompute_status["status"] = "ready"
            _recompute_status["progress"] = 100
            _recompute_status["message"] = "Ready"
        except Exception as e:
            print(f"[API] Error during background recomputation: {e}")
            _recompute_status["status"] = "failed"
            _recompute_status["message"] = f"Failed: {str(e)}"
            _recompute_status["progress"] = 0
        
    background_tasks.add_task(recompute_task)
    return {"status": "processing", "message": "Recomputation started in the background."}

if __name__ == "__main__":
    print("running main.py")
    import os
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=False)
