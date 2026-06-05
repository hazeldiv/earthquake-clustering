"use client";

import { useEffect, Fragment } from "react";
import { MapContainer, TileLayer, Polygon, Circle, CircleMarker, Tooltip, useMap } from "react-leaflet";
import L from "leaflet";
import { CLUSTER_COLORS } from "./constants";

// Haversine formula to compute distance between two coordinates in meters
function getDistanceInMeters(coord1: [number, number], coord2: [number, number]) {
  const R = 6371e3; // Earth's radius in meters
  const lat1 = coord1[0] * Math.PI / 180;
  const lat2 = coord2[0] * Math.PI / 180;
  const deltaLat = (coord2[0] - coord1[0]) * Math.PI / 180;
  const deltaLon = (coord2[1] - coord1[1]) * Math.PI / 180;

  const a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) *
    Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}


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

interface MapProps {
  clusters: ClusterData[];
  selectedClusterId: number | null;
  hoveredClusterId: number | null;
  onSelectCluster: (id: number | null) => void;
  onHoverCluster: (id: number | null) => void;
}

// Controller component to manage map centering and zooming
function MapController({
  selectedCentroid
}: {
  selectedCentroid: [number, number] | null
}) {
  const map = useMap();

  useEffect(() => {
    if (selectedCentroid) {
      map.setView(selectedCentroid, 8, { animate: true, duration: 1.2 });
    }
  }, [selectedCentroid, map]);

  return null;
}

export default function Map({
  clusters,
  selectedClusterId,
  hoveredClusterId,
  onSelectCluster,
  onHoverCluster
}: MapProps) {

  // Find currently selected cluster's centroid
  const selectedCluster = clusters.find(c => c.cluster_id === selectedClusterId);
  const selectedCentroid = selectedCluster ? selectedCluster.centroid : null;

  // Center of Indonesia
  const defaultCenter: [number, number] = [-2.5, 118.0];
  const defaultZoom = 5;

  return (
    <div className="w-full h-full relative" id="map-container">
      <MapContainer
        center={defaultCenter}
        zoom={defaultZoom}
        className="w-full h-full"
        zoomControl={false} // Position it on bottom-right later
        minZoom={4}
        maxZoom={12}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />

        <MapController selectedCentroid={selectedCentroid} />

        {clusters.map((cluster) => {
          const color = CLUSTER_COLORS[cluster.cluster_id % CLUSTER_COLORS.length];
          const isSelected = selectedClusterId === cluster.cluster_id;
          const isHovered = hoveredClusterId === cluster.cluster_id;
          const hasSelection = selectedClusterId !== null;

          // Determine visibility and styling based on selection states
          let weight = 2;
          let fillOpacity = 0.15;
          let opacity = 0.5;

          if (isSelected) {
            weight = 4;
            fillOpacity = 0.4;
            opacity = 0.9;
          } else if (isHovered) {
            weight = 3.5;
            fillOpacity = 0.3;
            opacity = 0.8;
          } else if (hasSelection) {
            // Dim other clusters if one is selected
            opacity = 0.15;
            fillOpacity = 0.05;
            weight = 1;
          }

          // Check if cluster has a polygon path
          const hasPolygon = cluster.hull_polygon && cluster.hull_polygon.length > 0;

          // Calculate the max distance from centroid to any point in the cluster as the danger radius (in meters)
          const dangerRadius = cluster.points && cluster.points.length > 0
            ? Math.max(...cluster.points.map(pt => getDistanceInMeters(cluster.centroid, [pt.latitude, pt.longitude]))) + 10000
            : 100000; // default 80km

          return (
            <Fragment key={cluster.cluster_id}>
              {/* Draw Hull Polygon */}
              {hasPolygon && (
                <Polygon
                  positions={cluster.hull_polygon}
                  pathOptions={{
                    color: color,
                    weight: weight,
                    fillColor: color,
                    fillOpacity: fillOpacity,
                    opacity: opacity,
                    className: `transition-all duration-300 ${isSelected || isHovered ? 'drop-shadow-[0_0_10px_rgba(0,240,255,0.5)]' : ''}`
                  }}
                  eventHandlers={{
                    click: () => onSelectCluster(cluster.cluster_id),
                    mouseover: () => onHoverCluster(cluster.cluster_id),
                    mouseout: () => onHoverCluster(null)
                  }}
                >
                  <Tooltip
                    direction="top"
                    offset={[0, -4]}
                    interactive={false}
                    className="custom-tooltip"
                  >
                    <div className="flex flex-col gap-1">
                      <div className="font-bold text-sm text-white flex items-center gap-1.5">
                        <span
                          className="w-2.5 h-2.5 rounded-full inline-block"
                          style={{ backgroundColor: color }}
                        />
                        {cluster.title.split('(')[0].trim()}
                      </div>

                      <div className="text-xs text-slate-300 max-w-[250px] leading-tight flex items-center gap-1">
                        <span className="font-semibold text-slate-400 shrink-0">Impact Area:</span>
                        <span className="truncate" title={cluster.kabupaten_kota.join(', ')}>
                          {cluster.kabupaten_kota.slice(0, 3).join(', ')}
                        </span>
                        {cluster.kabupaten_kota.length > 3 && (
                          <span className="shrink-0 text-[10px] text-slate-400">
                            (+{cluster.kabupaten_kota.length - 3})
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-1 pt-1 border-t border-slate-700/50 text-[11px]">
                        <div>
                          <span className="text-slate-400">Freq (10Y):</span>{' '}
                          <span className="font-semibold text-sky-400">{cluster.frequency_last_10_years} events</span>
                        </div>
                        <div>
                          <span className="text-slate-400">Total Freq:</span>{' '}
                          <span className="font-semibold text-slate-200">{cluster.event_count}</span>
                        </div>
                        <div>
                          <span className="text-slate-400">Avg Mag:</span>{' '}
                          <span className="font-semibold text-amber-400">M {cluster.avg_magnitude}</span>
                        </div>
                        <div>
                          <span className="text-slate-400">Avg Depth:</span>{' '}
                          <span className="font-semibold text-purple-400">{cluster.avg_depth} km</span>
                        </div>
                      </div>
                    </div>
                  </Tooltip>
                </Polygon>
              )}


              {/* Draw Danger Zone Circle on Hover */}
              {isHovered && (
                <Circle
                  center={cluster.centroid}
                  radius={dangerRadius}
                  interactive={false}
                  pathOptions={{
                    color: "#ef4444", // Tailwind red-500
                    fillColor: "#ef4444",
                    fillOpacity: 0.12,
                    weight: 1.5,
                    dashArray: "6, 6"
                  }}
                />
              )}

              {/* Draw Individual Points inside the cluster only when selected */}
              {isSelected && cluster.points.map((point, pIdx) => {
                const pRadius = 4.5;
                const pOpacity = 0.8;
                const pFillOpacity = 0.8;

                return (
                  <CircleMarker
                    key={`${cluster.cluster_id}-p-${pIdx}`}
                    center={[point.latitude, point.longitude]}
                    radius={pRadius}
                    pathOptions={{
                      color: color,
                      weight: 1.5,
                      fillColor: color,
                      fillOpacity: pFillOpacity,
                      opacity: pOpacity
                    }}
                    eventHandlers={{
                      click: () => onSelectCluster(cluster.cluster_id),
                      mouseover: () => onHoverCluster(cluster.cluster_id),
                      mouseout: () => onHoverCluster(null)
                    }}
                  >
                    <Tooltip interactive={false} className="custom-tooltip">
                      <div className="text-[11px] leading-tight">
                        <div className="font-semibold text-slate-200 mb-0.5">{point.kabupaten_kota}</div>
                        <div>Magnitude: <span className="text-amber-400 font-semibold">M {point.magnitude}</span></div>
                        <div>Depth: <span className="text-purple-400 font-semibold">{point.depth} km</span></div>
                        <div>Time: <span className="text-slate-400">{point.datetime}</span></div>
                      </div>
                    </Tooltip>
                  </CircleMarker>
                );
              })}
            </Fragment>
          );

        })}
      </MapContainer>
    </div>
  );
}
