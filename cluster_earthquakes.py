"""
Earthquake Hazard Area Clustering Prototype
============================================
Uses K-Means clustering to identify earthquake hazard zones in Indonesia.
- First: filter by magnitude and depth thresholds
- Second: cluster based on latitude/longitude only
- Third: remove geographic outliers (points too far from cluster centroid)

Usage:
    python cluster_earthquakes.py
"""

import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
from sklearn.cluster import KMeans
from scipy.spatial import ConvexHull

# =============================================================================
# CONFIGURATION
# =============================================================================

DATA_PATH = './dataset/katalog_gempa_v2_cleaned.tsv'
OUTPUT_MAP = 'cluster_map.png'
ELBOW_PLOT = 'elbow_plot.png'
SAMPLE_RATE = 2  # Every 2nd row
K_MIN = 16
K_MAX = 32
RANDOM_STATE = 42

# Map extent (Indonesia bounding box)
LON_MIN, LON_MAX = 94, 142
LAT_MIN, LAT_MAX = -12, 6

# Magnitude and depth thresholds - earthquakes must meet these to be included
MAG_THRESHOLD = 5.0   # Minimum magnitude
DEPTH_THRESHOLD = 75.0  # Maximum depth (km) - shallow earthquakes only

# Scatter filtering - point must have at least one neighbor within this distance (degrees)
# ~1 degree ≈ 111km at equator, so 0.3 = ~33km radius
NEIGHBOR_DISTANCE = 0.3  # Minimum neighbor distance in degrees

# Temporal filter - cluster must have at least this many events within a 10-year span
MIN_EVENTS = 5           # Minimum earthquakes required
YEAR_SPAN = 10           # Years for temporal window


# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

def log(msg):
    """Print progress message."""
    print(f"[CLUSTER] {msg}")


def detect_elbow(inertias):
    """
    Find the elbow point in inertia values.
    Uses percentage decrease to bias toward more clusters.
    """
    inertias = np.array(inertias)
    n = len(inertias)

    # Find first point where relative decrease becomes small (< 5% improvement)
    # This biases toward higher K (more clusters)
    threshold = 0.05  # 5% relative decrease threshold

    for i in range(1, n - 1):
        # Calculate relative decrease
        relative_decrease = (inertias[i - 1] - inertias[i]) / inertias[i - 1]

        if relative_decrease < threshold:
            # Found the elbow - return this K
            best_k = i + K_MIN  # Adjust for range offset
            log(f"Elbow detection: relative decrease at K={i+K_MIN} is {relative_decrease:.1%} < {threshold:.1%}")
            log(f"Elbow detection: best K = {best_k}")
            return best_k

    # If no clear elbow, return the middle of the range
    best_k = (K_MIN + K_MAX) // 2
    log(f"Elbow detection: no clear elbow found, using middle K = {best_k}")
    return best_k


def plot_elbow(K_range, inertias, optimal_k, save_path):
    """Plot the elbow curve."""
    plt.figure(figsize=(10, 6))
    plt.plot(K_range, inertias, 'bo-', linewidth=2, markersize=8)
    plt.axvline(x=optimal_k, color='r', linestyle='--', label=f'Optimal K={optimal_k}')
    plt.xlabel('Number of Clusters (K)', fontsize=12)
    plt.ylabel('Inertia (Within-cluster sum of squares)', fontsize=12)
    plt.title('Elbow Method for Optimal K Selection', fontsize=14, fontweight='bold')
    plt.legend()
    plt.grid(True, alpha=0.3)
    plt.tight_layout()
    plt.savefig(save_path, dpi=150)
    plt.close()
    log(f"Elbow plot saved to {save_path}")


def filter_scattered_points(df, neighbor_distance, min_neighbors=3):
    """
    Filter out scattered points - points that don't have enough neighbors
    within the specified distance threshold.

    Uses simple Euclidean distance on (lon, lat) coordinates.

    Args:
        df: DataFrame with 'longitude', 'latitude' columns
        neighbor_distance: minimum distance (in degrees) to count as neighbor
        min_neighbors: minimum number of neighbors required (default: 3)

    Returns:
        Filtered DataFrame with only points that have at least min_neighbors
    """
    if len(df) < min_neighbors:
        return df.head(0)  # Return empty if not enough points

    coords = df[['longitude', 'latitude']].values
    n = len(coords)

    keep_mask = np.zeros(n, dtype=bool)

    for i in range(n):
        # Calculate distance from point i to all other points
        diff = coords - coords[i]
        distances = np.sqrt(diff[:, 0]**2 + diff[:, 1]**2)
        # Exclude self
        distances[i] = np.inf
        # Point i is kept if it has at least min_neighbors within distance
        neighbor_count = np.sum(distances <= neighbor_distance)
        if neighbor_count >= min_neighbors:
            keep_mask[i] = True

    return df[keep_mask].copy()


def has_temporal_density(events, min_events=3, year_span=10):
    """
    Check if a cluster has at least min_events within any year_span window.

    Args:
        events: Series of datetime values
        min_events: Minimum events required
        year_span: Size of window in years

    Returns:
        True if cluster meets temporal density threshold
    """
    if len(events) < min_events:
        return False

    # Sort timestamps
    timestamps = events.sort_values().values
    n = len(timestamps)

    # Convert to days for easier comparison
    days_span = year_span * 365

    # Slide a window and check if any window has >= min_events
    for i in range(n):
        window_start = timestamps[i]
        window_end = window_start + np.timedelta64(days_span, 'D')

        # Count events in this window
        count = 0
        for j in range(i, n):
            if timestamps[j] <= window_end:
                count += 1
            else:
                break

        if count >= min_events:
            return True

    return False


def filter_clusters_by_temporal_density(df, min_events=3, year_span=10):
    """
    Remove clusters that don't have at least min_events within any year_span window.

    Args:
        df: DataFrame with 'cluster' and 'datetime' columns
        min_events: Minimum events required in a window
        year_span: Size of window in years

    Returns:
        DataFrame with only clusters meeting temporal density threshold
    """
    valid_clusters = []

    for cluster_id in df['cluster'].unique():
        cluster_data = df[df['cluster'] == cluster_id]
        if has_temporal_density(cluster_data['datetime'], min_events, year_span):
            valid_clusters.append(cluster_id)

    log(f"  Clusters meeting temporal density: {len(valid_clusters)}/{df['cluster'].nunique()}")

    return df[df['cluster'].isin(valid_clusters)]


# =============================================================================
# MAIN
# =============================================================================

def main():
    # -------------------------------------------------------------------------
    # 1. Load and sample data
    # -------------------------------------------------------------------------
    log(f"Loading data from {DATA_PATH}")
    df = pd.read_csv(DATA_PATH, sep='\t')
    total_rows = len(df)
    log(f"Total rows: {total_rows:,}")

    # Sample every 10th row
    df_sampled = df.iloc[::SAMPLE_RATE].copy().reset_index(drop=True)
    log(f"Sampled every {SAMPLE_RATE}th row: {len(df_sampled):,} rows")

    # Parse datetime for temporal filtering
    df_sampled['datetime'] = pd.to_datetime(df_sampled['datetime'])
    log(f"Datetime parsed for {len(df_sampled):,} rows")

    # Show data ranges
    log(f"\nData ranges:")
    log(f"  Latitude:  {df_sampled['latitude'].min():.4f} to {df_sampled['latitude'].max():.4f}")
    log(f"  Longitude: {df_sampled['longitude'].min():.4f} to {df_sampled['longitude'].max():.4f}")
    log(f"  Magnitude: {df_sampled['magnitude'].min():.2f} to {df_sampled['magnitude'].max():.2f}")
    log(f"  Depth:     {df_sampled['depth'].min():.1f} to {df_sampled['depth'].max():.1f} km")

    # -------------------------------------------------------------------------
    # 2. Filter by magnitude and depth thresholds
    # -------------------------------------------------------------------------
    log(f"\nFiltering by magnitude >= {MAG_THRESHOLD} and depth <= {DEPTH_THRESHOLD} km...")
    df_threshold = df_sampled[
        (df_sampled['magnitude'] >= MAG_THRESHOLD) &
        (df_sampled['depth'] <= DEPTH_THRESHOLD)
    ].copy().reset_index(drop=True)
    log(f"After threshold filter: {len(df_threshold):,} rows (removed {len(df_sampled) - len(df_threshold):,})")

    # -------------------------------------------------------------------------
    # 3. Filter scattered points (at least 3 neighbors within distance)
    # -------------------------------------------------------------------------
    log(f"\nFiltering scattered points (neighbor dist>={NEIGHBOR_DISTANCE}°, min 3 neighbors)...")
    df_filtered = filter_scattered_points(df_threshold, NEIGHBOR_DISTANCE, min_neighbors=3)
    log(f"After scatter filter: {len(df_filtered):,} rows (removed {len(df_threshold) - len(df_filtered):,})")

    # -------------------------------------------------------------------------
    # 4. Prepare geographic features for clustering (lat/lon only)
    # -------------------------------------------------------------------------
    log("\nPreparing features (latitude, longitude only)...")
    geo_features = df_filtered[['latitude', 'longitude']].values

    # -------------------------------------------------------------------------
    # 5. Find optimal K using Elbow Method
    # -------------------------------------------------------------------------
    log(f"\nRunning Elbow Method (K from {K_MIN} to {K_MAX})...")
    K_range = range(K_MIN, K_MAX + 1)
    inertias = []

    for k in K_range:
        kmeans = KMeans(n_clusters=k, random_state=RANDOM_STATE, n_init=10)
        kmeans.fit(geo_features)
        inertias.append(kmeans.inertia_)
        log(f"  K={k}: inertia={kmeans.inertia_:.2f}")

    # Detect elbow point
    optimal_k = detect_elbow(inertias)
    log(f"\nOptimal K determined: {optimal_k}")

    # Plot elbow curve
    plot_elbow(K_range, inertias, optimal_k, ELBOW_PLOT)

    # -------------------------------------------------------------------------
    # 5. Final K-Means clustering with optimal K
    # -------------------------------------------------------------------------
    log(f"\nRunning final K-Means with K={optimal_k}...")
    kmeans_final = KMeans(n_clusters=optimal_k, random_state=RANDOM_STATE, n_init=10)
    labels = kmeans_final.fit_predict(geo_features)

    df_filtered['cluster'] = labels
    log(f"Clustering complete. Labels assigned.")

    # Show cluster distribution
    log("\nCluster distribution:")
    for cluster_id in range(optimal_k):
        count = (labels == cluster_id).sum()
        log(f"  Cluster {cluster_id}: {count:,} events")

    # -------------------------------------------------------------------------
    # 6. Filter clusters by temporal density (at least 3 events in 10 years)
    # -------------------------------------------------------------------------
    log(f"\nFiltering clusters by temporal density (>= {MIN_EVENTS} events in {YEAR_SPAN} years)...")
    df_filtered = filter_clusters_by_temporal_density(df_filtered, MIN_EVENTS, YEAR_SPAN)
    log(f"After temporal filter: {len(df_filtered):,} events")

    # Renumber clusters after filtering
    cluster_mapping = {old_id: new_id for new_id, old_id in enumerate(df_filtered['cluster'].unique())}
    df_filtered['cluster'] = df_filtered['cluster'].map(cluster_mapping)
    final_k = df_filtered['cluster'].nunique()
    log(f"Final cluster count: {final_k}")

    # Show final cluster distribution
    log("\nFinal cluster distribution:")
    for cluster_id in range(final_k):
        count = (df_filtered['cluster'] == cluster_id).sum()
        log(f"  Cluster {cluster_id}: {count:,} events")

    # -------------------------------------------------------------------------
    # 7. Create visualization with ConvexHull borders
    # -------------------------------------------------------------------------
    log("\nCreating visualization...")
    fig, ax = plt.subplots(figsize=(14, 10))

    # Set background color (ocean)
    ax.set_facecolor('#E8F4F8')
    fig.patch.set_facecolor('#FFFFFF')

    # Generate colors for clusters
    colors = plt.cm.tab20(np.linspace(0, 1, final_k))

    # Draw ConvexHull for each cluster
    hull_count = 0
    for cluster_id in range(final_k):
        cluster_data = df_filtered[df_filtered['cluster'] == cluster_id]
        points = cluster_data[['longitude', 'latitude']].values

        if len(points) < 3:
            log(f"  Cluster {cluster_id}: skipping (only {len(points)} points)")
            continue

        try:
            hull = ConvexHull(points)

            # Get hull vertices and close the polygon
            hull_points = points[hull.vertices]
            hull_vertices = np.vstack([hull_points, hull_points[0]])  # Close polygon

            # Fill and outline the cluster
            color = colors[cluster_id % len(colors)]
            ax.fill(hull_vertices[:, 0], hull_vertices[:, 1],
                    color=color, alpha=0.3, zorder=3)
            ax.plot(hull_vertices[:, 0], hull_vertices[:, 1],
                    color=color, linewidth=1.5, alpha=0.8, zorder=4)

            hull_count += 1
            log(f"  Cluster {cluster_id}: {len(points)} points")
        except Exception as e:
            log(f"  Cluster {cluster_id}: hull failed - {e}")

    log(f"  Drew {hull_count} cluster borders")

    # -------------------------------------------------------------------------
    # 7. Add scatter points
    # -------------------------------------------------------------------------
    scatter = ax.scatter(df_filtered['longitude'], df_filtered['latitude'],
                         c=df_filtered['cluster'], cmap='tab20',
                         s=10, alpha=0.6, zorder=5)

    # -------------------------------------------------------------------------
    # 8. Format axes and add labels
    # -------------------------------------------------------------------------
    ax.set_xlim(LON_MIN, LON_MAX)
    ax.set_ylim(LAT_MIN, LAT_MAX)
    ax.set_xlabel('Longitude (°E)', fontsize=12)
    ax.set_ylabel('Latitude (°N)', fontsize=12)
    ax.set_title(
        f'Earthquake Hazard Clusters in Indonesia\n'
        f'(Mag>={MAG_THRESHOLD}, Depth<={DEPTH_THRESHOLD}km, {final_k} clusters, {len(df_filtered):,} events)',
        fontsize=14, fontweight='bold'
    )

    # Add colorbar for cluster labels
    cbar = plt.colorbar(scatter, ax=ax, shrink=0.6)
    cbar.set_label('Cluster ID', fontsize=10)

    # Add grid
    ax.grid(True, alpha=0.3, linestyle='--')

    # Add cluster count annotation
    ax.text(0.02, 0.98, f'{optimal_k} clusters, {len(df_filtered):,} events',
            transform=ax.transAxes, fontsize=10,
            verticalalignment='top',
            bbox=dict(boxstyle='round', facecolor='white', alpha=0.8))

    # -------------------------------------------------------------------------
    # 9. Save figure
    # -------------------------------------------------------------------------
    plt.tight_layout()
    plt.savefig(OUTPUT_MAP, dpi=200)
    plt.close()
    log(f"\nMap saved to {OUTPUT_MAP}")

    # -------------------------------------------------------------------------
    # 10. Summary statistics
    # -------------------------------------------------------------------------
    log("\n" + "=" * 60)
    log("SUMMARY")
    log("=" * 60)
    log(f"Input rows:             {total_rows:,}")
    log(f"Sampled rows:           {len(df_sampled):,} (every {SAMPLE_RATE}th)")
    log(f"After mag/depth filter: {len(df_threshold):,} (mag>={MAG_THRESHOLD}, depth<={DEPTH_THRESHOLD}km)")
    log(f"After scatter filter:   {len(df_threshold) - (len(df_filtered)):,} removed")
    log(f"After temporal filter:  {len(df_filtered):,} (>= {MIN_EVENTS} events in {YEAR_SPAN} years)")
    log(f"Final clusters:         {final_k} (from K={optimal_k} initial)")
    log(f"Output files:")
    log(f"  - {OUTPUT_MAP}")
    log(f"  - {ELBOW_PLOT}")
    log("Done!")


if __name__ == '__main__':
    main()