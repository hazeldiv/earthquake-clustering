"""
Earthquake Data Cleaning Script
Cleans raw TSV data and outputs a cleaned version.
"""

import pandas as pd
import numpy as np

# =============================================================================
# CONFIGURATION
# =============================================================================

INPUT_PATH = './dataset/katalog_gempa_v2.tsv'
OUTPUT_PATH = './dataset/katalog_gempa_v2_cleaned.tsv'

ESSENTIAL_COLUMNS = ['latitude', 'longitude', 'magnitude', 'datetime']
CURRENT_YEAR = 2026
MAX_MAGNITUDE = 10.0  # Reasonable upper bound for MLv/mb magnitudes

# =============================================================================
# HELPERS
# =============================================================================

def iqr_bounds(series):
    Q1 = series.quantile(0.25)
    Q3 = series.quantile(0.75)
    IQR = Q3 - Q1
    return Q1 - 1.5 * IQR, Q3 + 1.5 * IQR


def log(msg):
    print(f"[CLEAN] {msg}")

# =============================================================================
# MAIN
# =============================================================================

def clean_data():
    # -------------------------------------------------------------------------
    # 1. Load & Basic Checks
    # -------------------------------------------------------------------------
    log(f"Loading data from {INPUT_PATH}")
    df = pd.read_csv(INPUT_PATH, sep='\t')
    initial_rows = len(df)
    log(f"Initial shape: {df.shape}")

    # -------------------------------------------------------------------------
    # 2. Remove Duplicates
    # -------------------------------------------------------------------------
    dup_cols = ['eventID', 'datetime', 'latitude', 'longitude']
    dup_mask = df.duplicated(subset=dup_cols, keep='first')
    n_dups = dup_mask.sum()
    df = df[~dup_mask].reset_index(drop=True)
    log(f"Removed {n_dups} duplicate rows ({initial_rows - len(df)} rows remain)")

    # -------------------------------------------------------------------------
    # 3. Handle Missing Values — drop rows where essential cols are null
    # -------------------------------------------------------------------------
    for col in ESSENTIAL_COLUMNS:
        nulls = df[col].isnull().sum()
        if nulls > 0:
            log(f"  '{col}' has {nulls} null values → dropping rows")

    mask = df[ESSENTIAL_COLUMNS].notnull().all(axis=1)
    df = df[mask].reset_index(drop=True)
    log(f"After dropping missing essentials: {len(df)} rows")

    # -------------------------------------------------------------------------
    # 4. Parse & Validate Datetime
    # -------------------------------------------------------------------------
    df['datetime'] = pd.to_datetime(df['datetime'], errors='coerce')
    invalid_dates = df['datetime'].isnull().sum()
    if invalid_dates > 0:
        log(f"Removing {invalid_dates} rows with unparseable datetime")
        df = df[df['datetime'].notnull()].reset_index(drop=True)

    # Check year range
    df['year'] = df['datetime'].dt.year
    invalid_year = ((df['year'] < 1900) | (df['year'] > CURRENT_YEAR)).sum()
    if invalid_year > 0:
        log(f"Removing {invalid_year} rows with year outside [1900, {CURRENT_YEAR}]")
        df = df[(df['year'] >= 1900) & (df['year'] <= CURRENT_YEAR)].reset_index(drop=True)

    # -------------------------------------------------------------------------
    # 5. Validate Coordinates
    # -------------------------------------------------------------------------
    lat_invalid = (~df['latitude'].between(-90, 90)).sum()
    lon_invalid = (~df['longitude'].between(-180, 180)).sum()
    if lat_invalid > 0:
        log(f"Removing {lat_invalid} rows with invalid latitude")
        df = df[df['latitude'].between(-90, 90)].reset_index(drop=True)
    if lon_invalid > 0:
        log(f"Removing {lon_invalid} rows with invalid longitude")
        df = df[df['longitude'].between(-180, 180)].reset_index(drop=True)

    # -------------------------------------------------------------------------
    # 6. Validate Magnitude
    # -------------------------------------------------------------------------
    mag_invalid = (df['magnitude'] <= 0) | (df['magnitude'] > MAX_MAGNITUDE)
    n_mag_invalid = mag_invalid.sum()
    if n_mag_invalid > 0:
        log(f"Removing {n_mag_invalid} rows with magnitude <= 0 or > {MAX_MAGNITUDE}")
        df = df[~mag_invalid].reset_index(drop=True)

    # -------------------------------------------------------------------------
    # 7. Validate Depth
    # -------------------------------------------------------------------------
    depth_invalid = df['depth'] < 0
    n_depth_invalid = depth_invalid.sum()
    if n_depth_invalid > 0:
        log(f"Removing {n_depth_invalid} rows with negative depth")
        df = df[~depth_invalid].reset_index(drop=True)

    # -------------------------------------------------------------------------
    # 8. Outlier Detection (IQR) — flag and remove on core numeric cols
    # -------------------------------------------------------------------------
    outlier_cols = ['latitude', 'longitude', 'magnitude', 'depth']
    total_outlier_rows = 0

    for col in outlier_cols:
        lower, upper = iqr_bounds(df[col])
        n_out = ((df[col] < lower) | (df[col] > upper)).sum()
        if n_out > 0:
            log(f"  '{col}': {n_out} outliers (IQR bounds: [{lower:.3f}, {upper:.3f}])")
            total_outlier_rows += n_out

    # Remove rows with outliers in ANY of the outlier columns
    mask = True
    for col in outlier_cols:
        lower, upper = iqr_bounds(df[col])
        mask &= df[col].between(lower, upper)

    n_outlier_removed = (~mask).sum()
    df = df[mask].reset_index(drop=True)
    log(f"Removed {n_outlier_removed} rows with outliers in numeric columns")

    # -------------------------------------------------------------------------
    # 9. Remove Invalid / Empty Locations
    # -------------------------------------------------------------------------
    if 'location' in df.columns:
        invalid_loc = df['location'].fillna('').str.strip().eq('')
        n_bad_loc = invalid_loc.sum()
        if n_bad_loc > 0:
            log(f"Removing {n_bad_loc} rows with empty location")
            df = df[~invalid_loc].reset_index(drop=True)

    # -------------------------------------------------------------------------
    # 10. Final Validation
    # -------------------------------------------------------------------------
    remaining_nulls = df[ESSENTIAL_COLUMNS].isnull().sum()
    if remaining_nulls.any():
        log(f"WARNING: remaining nulls in essentials:\n{remaining_nulls}")

    remaining_dups = df.duplicated(subset=dup_cols).sum()
    if remaining_dups > 0:
        log(f"WARNING: {remaining_dups} duplicate eventIDs remain")

    # -------------------------------------------------------------------------
    # 11. Save Output
    # -------------------------------------------------------------------------
    final_rows = len(df)
    pct_removed = ((initial_rows - final_rows) / initial_rows) * 100

    # Drop helper columns used during cleaning
    if 'year' in df.columns:
        df = df.drop(columns=['year'])

    df.to_csv(OUTPUT_PATH, sep='\t', index=False)
    log(f"Saved cleaned data to {OUTPUT_PATH}")
    log(f"Summary: {initial_rows} → {final_rows} rows ({pct_removed:.1f}% removed)")
    log(f"Done!")

    return df


if __name__ == '__main__':
    clean_data()