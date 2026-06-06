import os
import json
import pandas as pd
import numpy as np
import geopandas as gpd
from shapely.geometry import Point
from scipy.spatial import ConvexHull
from sklearn.cluster import KMeans
from sklearn.metrics import silhouette_score, davies_bouldin_score, calinski_harabasz_score
from scipy.spatial.distance import cdist
from datetime import datetime

# Configuration
DATA_PATH = os.path.join(os.path.dirname(__file__), 'dataset', 'katalog_gempa_v2_cleaned.tsv')
GEOJSON_PATH = os.path.join(os.path.dirname(__file__), 'dataset', 'IDN_adm_2_kabkota.json')
CACHE_PATH = os.path.join(os.path.dirname(__file__), 'dataset', 'processed_clusters.json')
METRICS_CACHE_PATH = os.path.join(os.path.dirname(__file__), 'dataset', 'processed_metrics.json')

K_MIN = 72
K_MAX = 96
RANDOM_STATE = 42
MAG_THRESHOLD = 5.0
DEPTH_THRESHOLD = 50.0
NEIGHBOR_DISTANCE = 0.3
MIN_EVENTS = 5
YEAR_SPAN = 10
SMOOTH_FACTOR = 50
BYPASS_ELBOW = False
FIXED_K = 75

# Default parameters as a dict for easy serialization
DEFAULT_PARAMS = {
    "k_min": K_MIN,
    "k_max": K_MAX,
    "random_state": RANDOM_STATE,
    "mag_threshold": MAG_THRESHOLD,
    "depth_threshold": DEPTH_THRESHOLD,
    "neighbor_distance": NEIGHBOR_DISTANCE,
    "min_events": MIN_EVENTS,
    "year_span": YEAR_SPAN,
    "smooth_factor": SMOOTH_FACTOR,
    "bypass_elbow": BYPASS_ELBOW,
    "fixed_k": FIXED_K,
}

def log(msg):
    print(f"[PROCESSOR] {msg}")



def filter_scattered_points(df, neighbor_distance, min_neighbors=3):
    if len(df) < min_neighbors:
        return df.head(0)

    coords = df[['longitude', 'latitude']].values
    n = len(coords)
    keep_mask = np.zeros(n, dtype=bool)

    for i in range(n):
        diff = coords - coords[i]
        distances = np.sqrt(diff[:, 0]**2 + diff[:, 1]**2)
        distances[i] = np.inf
        neighbor_count = np.sum(distances <= neighbor_distance)
        if neighbor_count >= min_neighbors:
            keep_mask[i] = True

    return df[keep_mask].copy()

def detect_elbow(inertias, k_min: int, k_max: int):
    inertias = np.array(inertias)
    n = len(inertias)
    threshold = 0.02

    for i in range(1, n - 1):
        relative_decrease = (inertias[i - 1] - inertias[i]) / inertias[i - 1]
        if relative_decrease < threshold:
            best_k = i + k_min
            log(f"Elbow detected at K={best_k} (decrease {relative_decrease:.1%})")
            return best_k

    best_k = k_max - 2
    log(f"No clear elbow, using K={best_k}")
    return best_k

def smooth_polygon_bspline(vertices, num_points=50):
    from scipy.interpolate import splprep, splev

    if len(vertices) < 4:
        return vertices

    if not np.allclose(vertices[0], vertices[-1]):
        vertices = np.vstack([vertices, vertices[0]])

    x, y = vertices[:, 0], vertices[:, 1]

    try:
        tck, _ = splprep([x, y], s=len(x)*0.5, k=min(3, len(x)-1))
        u_new = np.linspace(0, 1, num_points)
        smooth_x, smooth_y = splev(u_new, tck)
        return np.column_stack([smooth_x, smooth_y])
    except Exception as e:
        log(f"B-spline smoothing failed: {e}. Falling back to raw hull vertices.")
        return vertices

def has_temporal_density(events, min_events=5, year_span=10):
    if len(events) < min_events:
        return False

    timestamps = events.sort_values().values
    n = len(timestamps)
    days_span = year_span * 365

    for i in range(n):
        window_start = timestamps[i]
        window_end = window_start + np.timedelta64(days_span, 'D')
        
        count = 0
        for j in range(i, n):
            if timestamps[j] <= window_end:
                count += 1
            else:
                break
        if count >= min_events:
            return True

    return False

def filter_clusters_by_temporal_density(df, min_events=5, year_span=10):
    valid_clusters = []
    for cluster_id in df['cluster'].unique():
        cluster_data = df[df['cluster'] == cluster_id]
        if has_temporal_density(cluster_data['datetime'], min_events, year_span):
            valid_clusters.append(cluster_id)

    log(f"Clusters meeting temporal density: {len(valid_clusters)}/{df['cluster'].nunique()}")
    return df[df['cluster'].isin(valid_clusters)]

def compute_clusters(
    k_min: int = K_MIN,
    k_max: int = K_MAX,
    random_state: int = RANDOM_STATE,
    mag_threshold: float = MAG_THRESHOLD,
    depth_threshold: float = DEPTH_THRESHOLD,
    neighbor_distance: float = NEIGHBOR_DISTANCE,
    min_events: int = MIN_EVENTS,
    year_span: int = YEAR_SPAN,
    smooth_factor: int = SMOOTH_FACTOR,
    bypass_elbow: bool = BYPASS_ELBOW,
    fixed_k: int = FIXED_K,
):
    """Run clustering, perform spatial joins to match kabupaten/kota, and save/cache results."""
    log(f"Loading data from {DATA_PATH}...")
    df = pd.read_csv(DATA_PATH, sep='\t')
    
    # Parse datetime
    df['datetime'] = pd.to_datetime(df['datetime'])
    max_date = df['datetime'].max()
    log(f"Latest earthquake in dataset: {max_date}")
    
    # Filter by thresholds
    log("Filtering by magnitude and depth...")
    df_thresh = df[(df['magnitude'] >= mag_threshold) & (df['depth'] <= depth_threshold)].copy().reset_index(drop=True)
    log(f"Rows after threshold: {len(df_thresh)}")
    
    # Filter scattered
    log("Filtering scattered points...")
    df_filtered = filter_scattered_points(df_thresh, neighbor_distance, min_neighbors=3)
    log(f"Rows after scatter filter: {len(df_filtered)}")
    
    if len(df_filtered) == 0:
        log("No earthquakes match criteria.")
        return []

    geo_features = df_filtered[['latitude', 'longitude']].values

    # K-Means Elbow detection / selection
    if bypass_elbow:
        optimal_k = fixed_k
        log(f"Elbow method bypassed. Using fixed K={optimal_k}")
        kmeans_final = KMeans(n_clusters=optimal_k, random_state=random_state, n_init=10)
        df_filtered['cluster'] = kmeans_final.fit_predict(geo_features)
    else:
        log(f"Running Elbow Method (K from {k_min} to {k_max})...")
        inertias = []
        for k in range(k_min, k_max + 1):
            kmeans = KMeans(n_clusters=k, random_state=random_state, n_init=10)
            kmeans.fit(geo_features)
            inertias.append(kmeans.inertia_)
            
        optimal_k = detect_elbow(inertias, k_min, k_max)
        
        log(f"Running final K-Means with K={optimal_k}...")
        kmeans_final = KMeans(n_clusters=optimal_k, random_state=random_state, n_init=10)
        df_filtered['cluster'] = kmeans_final.fit_predict(geo_features)
    
    # Filter by temporal density
    log("Filtering clusters by temporal density...")
    df_filtered = filter_clusters_by_temporal_density(df_filtered, min_events, year_span)
    
    # Renumber clusters
    cluster_mapping = {old_id: new_id for new_id, old_id in enumerate(df_filtered['cluster'].unique())}
    df_filtered['cluster'] = df_filtered['cluster'].map(cluster_mapping)
    final_k = df_filtered['cluster'].nunique()
    log(f"Final cluster count: {final_k}")

    # Load administrative boundary GeoJSON
    log(f"Loading administrative boundary GeoJSON from {GEOJSON_PATH}...")
    gdf_kab = gpd.read_file(GEOJSON_PATH)
    
    # Spatial join setup for matching individual earthquake points to kab/kota
    geometry = [Point(xy) for xy in zip(df_filtered['longitude'], df_filtered['latitude'])]
    gdf_eq = gpd.GeoDataFrame(df_filtered.copy(), geometry=geometry, crs="EPSG:4326")
    
    log("Performing spatial joins for earthquake locations...")
    # Perform a spatial join (within)
    gdf_joined = gpd.sjoin(gdf_eq, gdf_kab, how="left", predicate="within")
    
    # Identify nearest kabupaten/kota for points not falling directly inside (in the sea)
    unmatched_mask = gdf_joined['NAME_2'].isna()
    unmatched_indices = gdf_joined[unmatched_mask].index
    
    log(f"Resolving nearest administrative zone for {len(unmatched_indices)} offshore earthquakes...")
    
    # Pre-build list of polygon centroids or boundaries to compute distance efficiently
    # For speed, we will compute distance from the point to all polygons
    for idx in unmatched_indices:
        point = gdf_joined.loc[idx, 'geometry']
        dists = gdf_kab.distance(point)
        min_idx = dists.idxmin()
        nearest_zone = gdf_kab.loc[min_idx]
        
        gdf_joined.loc[idx, 'NAME_2'] = nearest_zone['NAME_2']
        gdf_joined.loc[idx, 'NAME_1'] = nearest_zone['NAME_1']
        gdf_joined.loc[idx, 'TYPE_2'] = nearest_zone['TYPE_2']

    # Now calculate cluster statistics
    clusters_data = []
    
    # Ten years filter span
    ten_years_ago = max_date - pd.DateOffset(years=10)
    
    for cluster_id in range(final_k):
        c_data = gdf_joined[gdf_joined['cluster'] == cluster_id]
        
        # Centroid
        centroid_lat = float(c_data['latitude'].mean())
        centroid_lon = float(c_data['longitude'].mean())
        
        # Kabupaten/Kota names & Provinces
        # Format as "Type Name" e.g., "Kabupaten Nias" or "Kota Banda Aceh"
        kab_kota_list = []
        prov_list = []
        for _, row in c_data.iterrows():
            kab_name = f"{row['TYPE_2']} {row['NAME_2']}" if pd.notna(row['TYPE_2']) else str(row['NAME_2'])
            if kab_name not in kab_kota_list:
                kab_kota_list.append(kab_name)
            prov_name = str(row['NAME_1'])
            if prov_name not in prov_list:
                prov_list.append(prov_name)
                
        # Total event count
        event_count = len(c_data)
        
        # Frequency in last 10 years of dataset
        freq_10y = int((c_data['datetime'] >= ten_years_ago).sum())
        
        # Average magnitude and depth
        avg_mag = float(c_data['magnitude'].mean())
        avg_depth = float(c_data['depth'].mean())
        
        # Convex Hull Polygon
        points_xy = c_data[['longitude', 'latitude']].values
        hull_coords = []
        if len(points_xy) >= 3:
            try:
                hull = ConvexHull(points_xy)
                hull_points = points_xy[hull.vertices]
                hull_vertices = np.vstack([hull_points, hull_points[0]]) # Close polygon
                smooth_vertices = smooth_polygon_bspline(hull_vertices, num_points=smooth_factor)
                # Convert back to [latitude, longitude] list of lists for Leaflet
                hull_coords = [[float(y), float(x)] for x, y in smooth_vertices]
            except Exception as e:
                log(f"Failed to generate convex hull for cluster {cluster_id}: {e}")
                
        # If hull failed or we have < 3 points, fallback to circular buffer or just points
        if not hull_coords:
            # Create a simple circle-like box around points or just return empty
            hull_coords = []
            
        # Compile points info
        cluster_points = []
        for _, row in c_data.iterrows():
            cluster_points.append({
                "latitude": float(row['latitude']),
                "longitude": float(row['longitude']),
                "magnitude": float(row['magnitude']),
                "depth": float(row['depth']),
                "datetime": row['datetime'].strftime('%Y-%m-%d %H:%M:%S'),
                "kabupaten_kota": f"{row['TYPE_2']} {row['NAME_2']}" if pd.notna(row['TYPE_2']) else str(row['NAME_2']),
                "province": str(row['NAME_1'])
            })
            
        # Create a user-friendly cluster title
        main_kab = c_data['NAME_2'].value_counts().idxmax()
        main_prov = c_data[c_data['NAME_2'] == main_kab]['NAME_1'].values[0]
        cluster_title = f"Cluster {cluster_id + 1} ({main_kab}, {main_prov})"

        clusters_data.append({
            "cluster_id": cluster_id,
            "title": cluster_title,
            "centroid": [centroid_lat, centroid_lon],
            "kabupaten_kota": kab_kota_list,
            "provinces": prov_list,
            "event_count": event_count,
            "frequency_last_10_years": freq_10y,
            "avg_magnitude": round(avg_mag, 2),
            "avg_depth": round(avg_depth, 2),
            "hull_polygon": hull_coords,
            "points": cluster_points
        })

    # Calculate evaluation metrics
    final_features = df_filtered[['latitude', 'longitude']].values
    final_labels = df_filtered['cluster'].values
    inertia = float(kmeans_final.inertia_)
    
    if len(final_features) > 1 and len(np.unique(final_labels)) > 1:
        try:
            sil_score = float(silhouette_score(final_features, final_labels))
        except Exception as e:
            log(f"Failed to calculate silhouette score: {e}")
            sil_score = 0.0
            
        try:
            db_score = float(davies_bouldin_score(final_features, final_labels))
        except Exception as e:
            log(f"Failed to calculate davies bouldin score: {e}")
            db_score = 0.0
            
        try:
            ch_score = float(calinski_harabasz_score(final_features, final_labels))
        except Exception as e:
            log(f"Failed to calculate calinski harabasz score: {e}")
            ch_score = 0.0
    else:
        sil_score, db_score, ch_score = 0.0, 0.0, 0.0
        
    metrics_data = {
        "inertia": round(inertia, 2),
        "silhouette": round(sil_score, 4),
        "davies_bouldin": round(db_score, 4),
        "calinski_harabasz": round(ch_score, 2)
    }

    # Save to cache
    log(f"Saving processed clusters to {CACHE_PATH}...")
    with open(CACHE_PATH, 'w', encoding='utf-8') as f:
        json.dump(clusters_data, f, indent=2, ensure_ascii=False)
        
    log(f"Saving processed metrics to {METRICS_CACHE_PATH}...")
    with open(METRICS_CACHE_PATH, 'w', encoding='utf-8') as f:
        json.dump(metrics_data, f, indent=2, ensure_ascii=False)
        
    log("Processing and caching complete!")
    return clusters_data

def get_clusters(force_recompute=False):
    """Retrieve clusters from cache or compute if missing/forced."""
    if not force_recompute and os.path.exists(CACHE_PATH):
        log(f"Loading clusters from cache {CACHE_PATH}...")
        try:
            with open(CACHE_PATH, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            log(f"Error loading cache: {e}. Recomputing...")
            
    return compute_clusters()

def get_metrics(force_recompute=False):
    """Retrieve metrics from cache or compute if missing/forced."""
    if not force_recompute and os.path.exists(METRICS_CACHE_PATH):
        log(f"Loading metrics from cache {METRICS_CACHE_PATH}...")
        try:
            with open(METRICS_CACHE_PATH, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            log(f"Error loading metrics cache: {e}. Recomputing...")
            
    compute_clusters()
    if os.path.exists(METRICS_CACHE_PATH):
        try:
            with open(METRICS_CACHE_PATH, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            log(f"Failed to load metrics after recomputing: {e}")
    return {}

if __name__ == '__main__':
    # Test execution
    clusters = compute_clusters()
    print(f"Computed {len(clusters)} clusters successfully.")
