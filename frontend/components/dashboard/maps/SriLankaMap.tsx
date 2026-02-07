"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { MapPin, Activity } from "lucide-react";
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

// Reverse mapping for lookups
const reverseDistrictNameMapping: Record<string, string> = Object.fromEntries(
  Object.entries(districtNameMapping).map(([k, v]) => [v, k])
);

// Risk level color scale
const getRiskColor = (cases: number): string => {
  if (cases >= 100) return "#7f1d1d"; // red-900 - Very High
  if (cases >= 50) return "#dc2626"; // red-600 - High
  if (cases >= 25) return "#f59e0b"; // amber-500 - Medium
  if (cases >= 10) return "#facc15"; // yellow-400 - Low
  return "#4ade80"; // green-400 - Very Low
};

// GeoJSON Layer component that uses the map context
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
  const layerId = "districts-fill";
  const outlineLayerId = "districts-outline";

  // Build the color expression for MapLibre
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

      // Default color for unmatched districts
      matchExpression.push(isDark ? "#374151" : "#e5e7eb");
      return matchExpression as MapLibreGL.ExpressionSpecification;
    }, [data, isDark]);

  useEffect(() => {
    if (!isLoaded || !map) return;

    const setupLayers = async () => {
      try {
        // Wait for style to be loaded
        if (!map.isStyleLoaded()) {
          await new Promise<void>((resolve) => {
            map.once("styledata", () => resolve());
          });
        }

        // Remove existing layers and source if they exist
        if (map.getLayer(outlineLayerId)) map.removeLayer(outlineLayerId);
        if (map.getLayer(layerId)) map.removeLayer(layerId);
        if (map.getSource(sourceId)) map.removeSource(sourceId);

        // Fetch GeoJSON data
        const response = await fetch("/District_geo.json");
        const geoJsonData = await response.json();

        // Add unique IDs to features for hover state
        geoJsonData.features = geoJsonData.features.map(
          (feature: any, index: number) => ({
            ...feature,
            id: index,
          })
        );

        // Add the source
        map.addSource(sourceId, {
          type: "geojson",
          data: geoJsonData,
          generateId: true,
        });

        // Add fill layer
        map.addLayer({
          id: layerId,
          type: "fill",
          source: sourceId,
          paint: {
            "fill-color": buildColorExpression(),
            "fill-opacity": [
              "case",
              ["boolean", ["feature-state", "hover"], false],
              0.9,
              0.7,
            ],
          },
        });

        // Add outline layer
        map.addLayer({
          id: outlineLayerId,
          type: "line",
          source: sourceId,
          paint: {
            "line-color": [
              "case",
              ["boolean", ["feature-state", "hover"], false],
              isDark ? "#60a5fa" : "#1e40af",
              isDark ? "#1f2937" : "#ffffff",
            ],
            "line-width": [
              "case",
              ["boolean", ["feature-state", "hover"], false],
              3,
              2,
            ],
          },
        });

        // Mouse event handlers
        const handleMouseMove = (
          e: MapLibreGL.MapMouseEvent & {
            features?: MapLibreGL.MapGeoJSONFeature[];
          }
        ) => {
          if (!e.features?.length || !map.getSource(sourceId)) return;

          const feature = e.features[0];

          // Update hover state
          if (hoveredIdRef.current !== null) {
            try {
              map.setFeatureState(
                { source: sourceId, id: hoveredIdRef.current },
                { hover: false }
              );
            } catch {
              // Ignore errors during cleanup
            }
          }

          hoveredIdRef.current = feature.id ?? null;
          if (hoveredIdRef.current !== null) {
            try {
              map.setFeatureState(
                { source: sourceId, id: hoveredIdRef.current },
                { hover: true }
              );
            } catch {
              // Ignore errors during cleanup
            }
          }

          // Update cursor
          map.getCanvas().style.cursor = "pointer";

          // Notify parent of hovered district
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
            } catch {
              // Ignore errors during cleanup
            }
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

          const feature = e.features[0];
          const geoJsonName = feature.properties?.ADM2_EN;
          const apiName = districtNameMapping[geoJsonName];

          if (apiName && onDistrictClick) {
            onDistrictClick(apiName);
          }
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
        if (map.getLayer(outlineLayerId)) map.removeLayer(outlineLayerId);
        if (map.getLayer(layerId)) map.removeLayer(layerId);
        if (map.getSource(sourceId)) map.removeSource(sourceId);
      } catch {
        // Ignore cleanup errors
      }
    };
  }, [
    isLoaded,
    map,
    onDistrictClick,
    onDistrictHover,
    isDark,
    buildColorExpression,
  ]);

  // Update colors when data changes
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

export default function SriLankaMap({
  data,
  onDistrictClick,
}: SriLankaMapProps) {
  const [hoveredDistrict, setHoveredDistrict] = useState<string | null>(null);
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = mounted && resolvedTheme === "dark";

  // Get district data by API name
  const getDistrictData = (
    apiDistrictName: string
  ): DistrictData | undefined => {
    return data.find((d) => d.district === apiDistrictName);
  };

  return (
    <div className="relative w-full h-full min-h-[600px]">
      <Map
        center={[80.7718, 7.8731]}
        zoom={4}
        minZoom={4}
        maxZoom={12}
        maxBounds={[
          [78.5, 5.5],
          [82.5, 10.5],
        ]}
      >
        <GeoJSONLayer
          data={data}
          onDistrictClick={onDistrictClick}
          onDistrictHover={setHoveredDistrict}
        />
        <MapControls position="bottom-right" showZoom showFullscreen />
      </Map>

      {/* Tooltip for hovered district */}
      {hoveredDistrict && (
        <div
          className={`absolute top-4 right-4 backdrop-blur-md p-4 rounded-xl shadow-2xl border-2 z-[1000] min-w-[200px] animate-in fade-in-0 slide-in-from-top-2 duration-200 ${
            isDark
              ? "bg-gray-900/95 border-blue-500/50"
              : "bg-white/98 border-blue-200"
          }`}
        >
          <div className="flex items-center gap-2 mb-2">
            <MapPin
              className={`h-5 w-5 ${
                isDark ? "text-blue-400" : "text-blue-600"
              }`}
            />
            <h4 className="font-bold text-base">{hoveredDistrict}</h4>
          </div>
          {getDistrictData(hoveredDistrict) && (
            <div className="space-y-2">
              <div
                className={`flex items-center justify-between p-2 rounded-lg ${
                  isDark ? "bg-blue-900/50" : "bg-blue-50"
                }`}
              >
                <span
                  className={`text-xs font-medium ${
                    isDark ? "text-gray-300" : "text-slate-600"
                  }`}
                >
                  Predicted Cases
                </span>
                <span
                  className={`text-lg font-bold ${
                    isDark ? "text-blue-300" : "text-blue-900"
                  }`}
                >
                  {getDistrictData(
                    hoveredDistrict
                  )?.predicted_cases.toLocaleString()}
                </span>
              </div>
              <p
                className={`text-xs italic ${
                  isDark ? "text-gray-400" : "text-slate-500"
                }`}
              >
                Click to view detailed analysis
              </p>
            </div>
          )}
        </div>
      )}

      {/* Legend */}
      <div
        className={`absolute bottom-4 left-4 backdrop-blur-md p-5 rounded-xl shadow-2xl border-2 z-[1000] min-w-[180px] ${
          isDark
            ? "bg-gray-900/95 border-gray-700"
            : "bg-white/98 border-slate-200"
        }`}
      >
        <div
          className={`flex items-center gap-2 mb-4 pb-3 border-b ${
            isDark ? "border-gray-700" : "border-slate-200"
          }`}
        >
          <div className="p-1.5 bg-gradient-to-br from-red-500 to-orange-500 rounded-lg">
            <Activity className="h-4 w-4 text-white" />
          </div>
          <h4 className="font-bold text-sm">Risk Levels</h4>
        </div>
        <div className="space-y-2.5">
          {[
            {
              level: "Very High",
              cases: "≥100 cases",
              color: "#7f1d1d",
              hoverBg: isDark ? "hover:bg-red-900/30" : "hover:bg-red-50",
            },
            {
              level: "High",
              cases: "50-99 cases",
              color: "#dc2626",
              hoverBg: isDark ? "hover:bg-red-900/30" : "hover:bg-red-50",
            },
            {
              level: "Medium",
              cases: "25-49 cases",
              color: "#f59e0b",
              hoverBg: isDark ? "hover:bg-amber-900/30" : "hover:bg-amber-50",
            },
            {
              level: "Low",
              cases: "10-24 cases",
              color: "#facc15",
              hoverBg: isDark ? "hover:bg-yellow-900/30" : "hover:bg-yellow-50",
            },
            {
              level: "Very Low",
              cases: "<10 cases",
              color: "#4ade80",
              hoverBg: isDark ? "hover:bg-green-900/30" : "hover:bg-green-50",
            },
          ].map((item) => (
            <div
              key={item.level}
              className={`flex items-center gap-3 p-1.5 rounded-lg transition-colors cursor-pointer ${item.hoverBg}`}
            >
              <div
                className="w-4 h-4 rounded-md shrink-0 shadow-sm border border-black/10"
                style={{ backgroundColor: item.color }}
              />
              <div className="flex-1">
                <div className="text-xs font-semibold">{item.level}</div>
                <div
                  className={`text-[10px] ${
                    isDark ? "text-gray-400" : "text-slate-500"
                  }`}
                >
                  {item.cases}
                </div>
              </div>
            </div>
          ))}
          <div
            className={`flex items-center gap-3 p-1.5 rounded-lg transition-colors cursor-pointer ${
              isDark ? "hover:bg-gray-800" : "hover:bg-slate-50"
            }`}
          >
            <div
              className={`w-4 h-4 rounded-md shrink-0 shadow-sm border ${
                isDark
                  ? "bg-gray-600 border-gray-500"
                  : "bg-gray-200 border-gray-300"
              }`}
            />
            <div className="flex-1">
              <div className="text-xs font-semibold">No Data</div>
              <div
                className={`text-[10px] ${
                  isDark ? "text-gray-400" : "text-slate-500"
                }`}
              >
                Not available
              </div>
            </div>
          </div>
        </div>
        <div
          className={`mt-4 pt-3 border-t ${
            isDark ? "border-gray-700" : "border-slate-200"
          }`}
        >
          <p
            className={`text-[10px] text-center italic ${
              isDark ? "text-gray-400" : "text-slate-500"
            }`}
          >
            Hover over districts for details
          </p>
        </div>
      </div>
    </div>
  );
}
