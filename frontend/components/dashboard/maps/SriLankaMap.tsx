"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { MapPin, Activity, RotateCcw } from "lucide-react";
import { useTheme } from "next-themes";
import { Map, useMap, MapControls } from "@/components/ui/map";
import type MapLibreGL from "maplibre-gl";

interface DistrictData {
  district: string;
  predicted_cases: number;
}

interface SriLankaMapProps {
  data: DistrictData[];
  onDistrictClick?: (district: string) => void;
}

// Tight bounding box around Sri Lanka (SW → NE corners)
const SRI_LANKA_BOUNDS: [[number, number], [number, number]] = [
  [79.4, 5.6],
  [82.1, 10.0],
];

// Mapping from GeoJSON district names to API district names
const districtNameMapping: Record<string, string> = {
  Trincomalee: "Trincomalee",
  Mullaitivu: "Mullaitivu",
  Jaffna: "Jaffna",
  Kilinochchi: "Kilinochchi",
  Mannar: "Mannar",
  Puttalam: "Puttalam",
  Gampaha: "Gampaha",
  Colombo: "Colombo",
  Kalutara: "Kalutara",
  Galle: "Galle",
  Matara: "Matara",
  Hambantota: "Hambanthota",
  Ampara: "Ampara",
  Batticaloa: "Batticaloa",
  Ratnapura: "Ratnapura",
  Monaragala: "Monaragala",
  Kegalle: "Kegalle",
  Badulla: "Badulla",
  Matale: "Matale",
  Polonnaruwa: "Polonnaruwa",
  Kurunegala: "Kurunegala",
  Anuradhapura: "Anuradhapura",
  "Nuwara Eliya": "NuwaraEliya",
  Vavuniya: "Vavuniya",
  Kandy: "Kandy",
};

// Compute the centroid of a polygon ring (first ring of first polygon)
function ringCentroid(ring: number[][]): [number, number] {
  let x = 0, y = 0;
  for (const [cx, cy] of ring) { x += cx; y += cy; }
  return [x / ring.length, y / ring.length];
}

function featureCentroid(geometry: any): [number, number] {
  if (geometry.type === "Polygon") {
    return ringCentroid(geometry.coordinates[0]);
  }
  // MultiPolygon — pick the largest ring by bounding-box area
  let best: number[][] = geometry.coordinates[0][0];
  let bestArea = 0;
  for (const polygon of geometry.coordinates) {
    const ring = polygon[0];
    const lons = ring.map((c: number[]) => c[0]);
    const lats = ring.map((c: number[]) => c[1]);
    const area =
      (Math.max(...lons) - Math.min(...lons)) *
      (Math.max(...lats) - Math.min(...lats));
    if (area > bestArea) { bestArea = area; best = ring; }
  }
  return ringCentroid(best);
}

// Risk level color scale (aligned with legend thresholds)
const getRiskColor = (cases: number): string => {
  if (cases >= 100) return "#7f1d1d"; // red-900  — Very High
  if (cases >= 50)  return "#dc2626"; // red-600  — High
  if (cases >= 25)  return "#f59e0b"; // amber-500 — Medium
  if (cases >= 10)  return "#facc15"; // yellow-400 — Low
  return "#4ade80";                   // green-400  — Very Low
};

// ─── Reset-view button rendered inside the Map context ───────────────────────
function ResetViewButton() {
  const { map } = useMap();

  return (
    <button
      onClick={() =>
        map?.fitBounds(SRI_LANKA_BOUNDS, { padding: 32, animate: true, duration: 600 })
      }
      title="Reset view — show all of Sri Lanka"
      className="
        absolute bottom-[120px] right-4 z-1000
        flex items-center justify-center
        w-9 h-9 rounded-lg shadow-md
        bg-card/95 border border-border
        text-muted-foreground hover:text-primary
        hover:bg-accent transition-colors duration-150
        backdrop-blur-sm
      "
    >
      <RotateCcw className="h-4 w-4" />
    </button>
  );
}

// ─── GeoJSON layer + map event wiring ────────────────────────────────────────
function GeoJSONLayer({
  data,
  onDistrictClick,
  onDistrictHover,
}: {
  data: DistrictData[];
  onDistrictClick?: (district: string) => void;
  onDistrictHover?: (district: string | null) => void;
}) {
  const { map, isLoaded } = useMap();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const hoveredIdRef = useRef<string | number | null>(null);
  const sourceId = "districts-source";
  const labelsSourceId = "districts-labels-source";
  const layerId = "districts-fill";
  const outlineLayerId = "districts-outline";
  const labelsLayerId = "districts-labels";

  // Build the fill-color expression for MapLibre
  const buildColorExpression =
    useCallback((): MapLibreGL.ExpressionSpecification => {
      const matchExpression: [string, ...unknown[]] = [
        "match",
        ["get", "ADM2_EN"],
      ];

      Object.entries(districtNameMapping).forEach(([geoJsonName, apiName]) => {
        const districtData = data.find((d) => d.district === apiName);
        const cases = districtData?.predicted_cases ?? 0;
        const color = districtData
          ? getRiskColor(cases)
          : isDark
          ? "#374151"
          : "#e5e7eb";
        matchExpression.push(geoJsonName, color);
      });

      matchExpression.push(isDark ? "#374151" : "#e5e7eb");
      return matchExpression as MapLibreGL.ExpressionSpecification;
    }, [data, isDark]);

  useEffect(() => {
    if (!isLoaded || !map) return;

    const setupLayers = async () => {
      try {
        if (!map.isStyleLoaded()) {
          await new Promise<void>((resolve) => {
            map.once("styledata", () => resolve());
          });
        }

        // Clean up existing layers / sources
        if (map.getLayer(labelsLayerId))   map.removeLayer(labelsLayerId);
        if (map.getLayer(outlineLayerId))  map.removeLayer(outlineLayerId);
        if (map.getLayer(layerId))         map.removeLayer(layerId);
        if (map.getSource(labelsSourceId)) map.removeSource(labelsSourceId);
        if (map.getSource(sourceId))       map.removeSource(sourceId);

        const response = await fetch("/District_geo.json");
        const geoJsonData = await response.json();

        geoJsonData.features = geoJsonData.features.map(
          (feature: any, index: number) => ({ ...feature, id: index })
        );

        map.addSource(sourceId, {
          type: "geojson",
          data: geoJsonData,
          generateId: true,
        });

        // One centroid point per district — prevents duplicate labels on MultiPolygon features
        // Only include features that are in our known district mapping (excludes "[unknown]" etc.)
        const knownGeoNames = new Set(Object.keys(districtNameMapping));
        const centroidFeatures = geoJsonData.features
          .filter((f: any) => knownGeoNames.has(f.properties?.ADM2_EN))
          .map((f: any) => ({
            type: "Feature",
            geometry: { type: "Point", coordinates: featureCentroid(f.geometry) },
            properties: { ADM2_EN: f.properties.ADM2_EN },
          }));
        map.addSource(labelsSourceId, {
          type: "geojson",
          data: { type: "FeatureCollection", features: centroidFeatures },
        });

        // Fill layer
        map.addLayer({
          id: layerId,
          type: "fill",
          source: sourceId,
          paint: {
            "fill-color": buildColorExpression(),
            "fill-opacity": [
              "case",
              ["boolean", ["feature-state", "hover"], false],
              0.92,
              0.72,
            ],
          },
        });

        // Outline layer — emphasised on hover
        map.addLayer({
          id: outlineLayerId,
          type: "line",
          source: sourceId,
          paint: {
            "line-color": [
              "case",
              ["boolean", ["feature-state", "hover"], false],
              isDark ? "#6ee7b7" : "#059669", // emerald on hover
              isDark ? "#1f2937" : "#ffffff",
            ],
            "line-width": [
              "case",
              ["boolean", ["feature-state", "hover"], false],
              2.5,
              1.5,
            ],
          },
        });

        // District name labels — one per district centroid, always on top
        map.addLayer({
          id: labelsLayerId,
          type: "symbol",
          source: labelsSourceId,
          layout: {
            "text-field": ["get", "ADM2_EN"],
            "text-font": ["Noto Sans Regular", "Open Sans Regular", "Arial Unicode MS Regular"],
            "text-size": ["interpolate", ["linear"], ["zoom"], 6, 9, 10, 13],
            "text-max-width": 8,
            "text-allow-overlap": false,
            "text-ignore-placement": false,
          },
          paint: {
            "text-color": isDark ? "#f9fafb" : "#111827",
            "text-halo-color": isDark ? "#111827" : "#ffffff",
            "text-halo-width": 1.5,
            "text-opacity": [
              "interpolate", ["linear"], ["zoom"],
              6, 0,
              7, 1,
            ],
          },
        });

        // ── Mouse event handlers ──
        const handleMouseMove = (
          e: MapLibreGL.MapMouseEvent & {
            features?: MapLibreGL.MapGeoJSONFeature[];
          }
        ) => {
          if (!e.features?.length || !map.getSource(sourceId)) return;

          const feature = e.features[0];

          if (hoveredIdRef.current !== null) {
            try {
              map.setFeatureState(
                { source: sourceId, id: hoveredIdRef.current },
                { hover: false }
              );
            } catch { /* ignore */ }
          }

          hoveredIdRef.current = feature.id ?? null;
          if (hoveredIdRef.current !== null) {
            try {
              map.setFeatureState(
                { source: sourceId, id: hoveredIdRef.current },
                { hover: true }
              );
            } catch { /* ignore */ }
          }

          map.getCanvas().style.cursor = "pointer";

          const geoJsonName = feature.properties?.ADM2_EN;
          const apiName = districtNameMapping[geoJsonName];
          onDistrictHover?.(apiName || null);
        };

        const handleMouseLeave = () => {
          if (hoveredIdRef.current !== null && map.getSource(sourceId)) {
            try {
              map.setFeatureState(
                { source: sourceId, id: hoveredIdRef.current },
                { hover: false }
              );
            } catch { /* ignore */ }
          }
          hoveredIdRef.current = null;
          map.getCanvas().style.cursor = "";
          onDistrictHover?.(null);
        };

        const handleClick = (
          e: MapLibreGL.MapMouseEvent & {
            features?: MapLibreGL.MapGeoJSONFeature[];
          }
        ) => {
          if (!e.features?.length) return;
          const geoJsonName = e.features[0].properties?.ADM2_EN;
          const apiName = districtNameMapping[geoJsonName];
          if (apiName && onDistrictClick) onDistrictClick(apiName);
        };

        map.on("mousemove", layerId, handleMouseMove);
        map.on("mouseleave", layerId, handleMouseLeave);
        map.on("click", layerId, handleClick);

        return () => {
          map.off("mousemove", layerId, handleMouseMove);
          map.off("mouseleave", layerId, handleMouseLeave);
          map.off("click", layerId, handleClick);
        };
      } catch (error) {
        console.error("Error setting up GeoJSON layer:", error);
      }
    };

    setupLayers();

    return () => {
      try {
        if (map.getLayer(labelsLayerId))   map.removeLayer(labelsLayerId);
        if (map.getLayer(outlineLayerId))  map.removeLayer(outlineLayerId);
        if (map.getLayer(layerId))         map.removeLayer(layerId);
        if (map.getSource(labelsSourceId)) map.removeSource(labelsSourceId);
        if (map.getSource(sourceId))       map.removeSource(sourceId);
      } catch { /* ignore cleanup errors */ }
    };
  }, [isLoaded, map, onDistrictClick, onDistrictHover, isDark, buildColorExpression]);

  // Colour-only update when data changes (no layer rebuild / no re-fit)
  useEffect(() => {
    if (!isLoaded || !map || !map.getLayer(layerId)) return;
    try {
      map.setPaintProperty(layerId, "fill-color", buildColorExpression());
    } catch (error) {
      console.error("Error updating fill color:", error);
    }
  }, [isLoaded, map, data, buildColorExpression]);

  return null;
}

// ─── Public component ─────────────────────────────────────────────────────────
export default function SriLankaMap({
  data,
  onDistrictClick,
}: SriLankaMapProps) {
  const [hoveredDistrict, setHoveredDistrict] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const getDistrictData = (apiName: string): DistrictData | undefined =>
    data.find((d) => d.district === apiName);

  if (!mounted) return null;

  return (
    <div className="relative w-full h-full">
      {/*
        bounds   → MapLibre fits the viewport to Sri Lanka on mount (no fixed zoom)
        fitBoundsOptions.animate: false → instant, no jarring fly-in on first load
        minZoom  → allow slight zoom-out for regional context, no world-panning
        maxBounds → constrain pan to the broader island region
      */}
      <Map
        bounds={SRI_LANKA_BOUNDS}
        fitBoundsOptions={{ padding: 32, animate: false }}
        minZoom={6}
        maxZoom={13}
        maxBounds={[[77.0, 4.0], [84.5, 12.0]]}
        styles={{
          light: "https://basemaps.cartocdn.com/gl/positron-nolabels-gl-style/style.json",
          dark:  "https://basemaps.cartocdn.com/gl/dark-matter-nolabels-gl-style/style.json",
        }}
      >
        <GeoJSONLayer
          data={data}
          onDistrictClick={onDistrictClick}
          onDistrictHover={setHoveredDistrict}
        />
        <MapControls position="bottom-right" showZoom showFullscreen />
        <ResetViewButton />
      </Map>

      {/* ── Hover tooltip (top-right, theme-token colours) ── */}
      {hoveredDistrict && (
        <div className="
          absolute top-3 right-3 z-1000
          bg-card/95 backdrop-blur-md
          border border-primary/25
          rounded-xl shadow-xl p-4
          min-w-50 max-w-60
          animate-in fade-in-0 slide-in-from-top-2 duration-150
        ">
          <div className="flex items-center gap-2 mb-2.5">
            <MapPin className="h-4 w-4 text-primary shrink-0" />
            <h4 className="font-bold text-sm leading-tight">{hoveredDistrict}</h4>
          </div>

          {getDistrictData(hoveredDistrict) ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between px-2.5 py-1.5 bg-primary/10 rounded-lg">
                <span className="text-xs font-medium text-muted-foreground">
                  Predicted Cases
                </span>
                <span className="text-base font-bold tabular-nums text-foreground">
                  {getDistrictData(hoveredDistrict)?.predicted_cases.toLocaleString()}
                </span>
              </div>
              <RiskIndicator
                cases={getDistrictData(hoveredDistrict)!.predicted_cases}
              />
              <p className="text-[11px] text-muted-foreground italic text-center pt-0.5">
                Click to view detailed analysis
              </p>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground italic">No data available</p>
          )}
        </div>
      )}

      {/* ── Risk legend (bottom-left, theme-token colours) ── */}
      <div className="
        absolute bottom-3 left-3 z-1000
        bg-card/95 backdrop-blur-md
        border border-border/80
        rounded-xl shadow-xl p-4
        min-w-40
      ">
        <div className="flex items-center gap-2 mb-3 pb-2.5 border-b border-border">
          <div className="p-1 bg-linear-to-br from-red-500 to-orange-500 rounded-md">
            <Activity className="h-3.5 w-3.5 text-white" />
          </div>
          <h4 className="font-bold text-xs">Risk Levels</h4>
        </div>

        <div className="space-y-1.5">
          {LEGEND_ITEMS.map((item) => (
            <div
              key={item.level}
              className="flex items-center gap-2.5 px-1 py-1 rounded-md transition-colors hover:bg-muted/50"
            >
              <span
                className="w-3.5 h-3.5 rounded-sm shrink-0 shadow-sm border border-black/10"
                style={{ backgroundColor: item.color }}
              />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold">{item.level}</div>
                <div className="text-[10px] text-muted-foreground">{item.cases}</div>
              </div>
            </div>
          ))}
          <div className="flex items-center gap-2.5 px-1 py-1 rounded-md transition-colors hover:bg-muted/50">
            <span className="w-3.5 h-3.5 rounded-sm shrink-0 border border-border bg-muted" />
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold">No Data</div>
              <div className="text-[10px] text-muted-foreground">Not available</div>
            </div>
          </div>
        </div>

        <p className="mt-2.5 pt-2 border-t border-border text-[10px] text-center text-muted-foreground italic">
          Hover districts for details
        </p>
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const LEGEND_ITEMS = [
  { level: "Very High", cases: "≥100 cases", color: "#7f1d1d" },
  { level: "High",      cases: "50–99 cases", color: "#dc2626" },
  { level: "Medium",    cases: "25–49 cases", color: "#f59e0b" },
  { level: "Low",       cases: "10–24 cases", color: "#facc15" },
  { level: "Very Low",  cases: "<10 cases",   color: "#4ade80" },
];

const RISK_META: Record<string, { label: string; dot: string }> = {
  "#7f1d1d": { label: "Very High", dot: "bg-red-900" },
  "#dc2626": { label: "High",      dot: "bg-red-600" },
  "#f59e0b": { label: "Medium",    dot: "bg-amber-500" },
  "#facc15": { label: "Low",       dot: "bg-yellow-400" },
  "#4ade80": { label: "Very Low",  dot: "bg-green-400" },
};

function RiskIndicator({ cases }: { cases: number }) {
  const color = getRiskColor(cases);
  const meta = RISK_META[color];
  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1 bg-muted/50 rounded-lg">
      <span className={`w-2 h-2 rounded-full shrink-0 ${meta?.dot}`} />
      <span className="text-xs font-medium text-muted-foreground">Risk:</span>
      <span className="text-xs font-bold">{meta?.label}</span>
    </div>
  );
}
