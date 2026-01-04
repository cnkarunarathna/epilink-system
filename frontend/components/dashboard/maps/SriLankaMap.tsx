"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { MapPin, Activity } from "lucide-react";
import { useTheme } from "next-themes";
import "leaflet/dist/leaflet.css";

interface DistrictData {
  district: string;
  predicted_cases: number;
}

interface SriLankaMapProps {
  data: DistrictData[];
  onDistrictClick?: (district: string) => void;
}

// Dynamically import map components (client-side only for Next.js)
const MapContainer = dynamic(
  () => import("react-leaflet").then((mod) => mod.MapContainer),
  { ssr: false }
);
const TileLayer = dynamic(
  () => import("react-leaflet").then((mod) => mod.TileLayer),
  { ssr: false }
);
const GeoJSON = dynamic(
  () => import("react-leaflet").then((mod) => mod.GeoJSON),
  { ssr: false }
);

export default function SriLankaMap({
  data,
  onDistrictClick,
}: SriLankaMapProps) {
  const [mapKey, setMapKey] = useState(0);
  const [hoveredDistrict, setHoveredDistrict] = useState<string | null>(null);
  const [sriLankaGeoJSON, setSriLankaGeoJSON] = useState<any>(null);
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Ensure mounted for theme detection
  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = mounted && resolvedTheme === "dark";

  // Load GeoJSON data
  useEffect(() => {
    fetch("/District_geo.json")
      .then((res) => res.json())
      .then((data) => setSriLankaGeoJSON(data))
      .catch((err) => console.error("Error loading GeoJSON:", err));
  }, []);

  // Update map when data or theme changes
  useEffect(() => {
    setMapKey((prev) => prev + 1);
  }, [data, resolvedTheme]);

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

  // Get color based on predicted cases (risk level)
  const getDistrictColor = (geoJsonDistrictName: string): string => {
    const apiDistrictName = districtNameMapping[geoJsonDistrictName];
    if (!apiDistrictName) return isDark ? "#374151" : "#e5e7eb"; // gray for no data

    const districtData = data.find((d) => d.district === apiDistrictName);
    if (!districtData) return isDark ? "#374151" : "#e5e7eb"; // gray for no data

    const cases = districtData.predicted_cases;

    // Color scale based on risk levels (data-driven thresholds)
    if (cases >= 100) return "#7f1d1d"; // red-900 - Very High
    if (cases >= 50) return "#dc2626"; // red-600 - High
    if (cases >= 25) return "#f59e0b"; // amber-500 - Medium
    if (cases >= 10) return "#facc15"; // yellow-400 - Low
    return "#4ade80"; // green-400 - Very Low
  };

  // Get district data
  const getDistrictData = (
    geoJsonDistrictName: string
  ): DistrictData | undefined => {
    const apiDistrictName = districtNameMapping[geoJsonDistrictName];
    if (!apiDistrictName) return undefined;
    return data.find((d) => d.district === apiDistrictName);
  };

  // Style function for GeoJSON features
  const styleFeature = (feature: any) => {
    const districtName = feature?.properties?.ADM2_EN || "";
    const color = getDistrictColor(districtName);

    return {
      fillColor: color,
      weight: 2,
      opacity: 1,
      color: isDark ? "#1f2937" : "#ffffff",
      fillOpacity: 0.7,
    };
  };

  // Event handlers for GeoJSON features
  const onEachFeature = (feature: any, layer: any) => {
    const geoJsonDistrictName = feature?.properties?.ADM2_EN || "";
    const apiDistrictName = districtNameMapping[geoJsonDistrictName];
    const districtData = getDistrictData(geoJsonDistrictName);

    layer.on({
      mouseover: (e: any) => {
        const layer = e.target;
        layer.setStyle({
          weight: 3,
          color: isDark ? "#60a5fa" : "#334155",
          fillOpacity: 0.9,
        });
        setHoveredDistrict(apiDistrictName || geoJsonDistrictName);
      },
      mouseout: (e: any) => {
        const layer = e.target;
        layer.setStyle(styleFeature(feature));
        setHoveredDistrict(null);
      },
      click: () => {
        if (onDistrictClick && apiDistrictName) {
          onDistrictClick(apiDistrictName);
        }
      },
    });

    // Add tooltip
    if (apiDistrictName) {
      layer.bindTooltip(
        `<div style="font-weight: bold;">${apiDistrictName}</div>${
          districtData
            ? `<div style="font-size: 12px;">Cases: ${districtData.predicted_cases.toLocaleString()}</div>`
            : ""
        }`,
        {
          permanent: false,
          direction: "center",
          className: `district-tooltip ${isDark ? "dark" : ""}`,
        }
      );
    }
  };

  // Tile layer URLs
  const lightTileUrl = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
  const darkTileUrl =
    "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";

  if (!sriLankaGeoJSON) {
    return (
      <div className="relative w-full h-full min-h-[600px] flex items-center justify-center">
        <div className="text-muted-foreground">Loading map...</div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full min-h-[600px]">
      <MapContainer
        key={mapKey}
        center={[7.8731, 80.7718]}
        zoom={8}
        style={{ height: "100%", width: "100%", minHeight: "600px" }}
        className="rounded-lg"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url={isDark ? darkTileUrl : lightTileUrl}
        />

        {/* GeoJSON district polygons */}
        <GeoJSON
          key={mapKey}
          data={sriLankaGeoJSON as any}
          style={styleFeature}
          onEachFeature={onEachFeature}
        />
      </MapContainer>

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
          {getDistrictData(
            Object.keys(districtNameMapping).find(
              (key) => districtNameMapping[key] === hoveredDistrict
            ) || ""
          ) && (
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
                    Object.keys(districtNameMapping).find(
                      (key) => districtNameMapping[key] === hoveredDistrict
                    ) || ""
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

      {/* Custom CSS for tooltips */}
      <style jsx global>{`
        .district-tooltip {
          background: white !important;
          border: 2px solid #e2e8f0 !important;
          border-radius: 10px !important;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15) !important;
          padding: 6px 10px !important;
          font-weight: 600 !important;
          color: #1e293b !important;
        }
        .district-tooltip.dark {
          background: #1f2937 !important;
          border: 2px solid #374151 !important;
          color: #f3f4f6 !important;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5) !important;
        }
        .district-tooltip::before {
          border-top-color: white !important;
        }
        .district-tooltip.dark::before {
          border-top-color: #1f2937 !important;
        }
        .leaflet-container {
          background: ${isDark ? "#111827" : "#f8fafc"} !important;
        }
      `}</style>

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
          <div
            className={`flex items-center gap-3 p-1.5 rounded-lg transition-colors cursor-pointer ${
              isDark ? "hover:bg-red-900/30" : "hover:bg-red-50"
            }`}
          >
            <div
              className="w-4 h-4 rounded-md shrink-0 shadow-sm border border-red-800/20"
              style={{ backgroundColor: "#7f1d1d" }}
            ></div>
            <div className="flex-1">
              <div className="text-xs font-semibold">Very High</div>
              <div
                className={`text-[10px] ${
                  isDark ? "text-gray-400" : "text-slate-500"
                }`}
              >
                ≥100 cases
              </div>
            </div>
          </div>
          <div
            className={`flex items-center gap-3 p-1.5 rounded-lg transition-colors cursor-pointer ${
              isDark ? "hover:bg-red-900/30" : "hover:bg-red-50"
            }`}
          >
            <div
              className="w-4 h-4 rounded-md shrink-0 shadow-sm border border-red-600/20"
              style={{ backgroundColor: "#dc2626" }}
            ></div>
            <div className="flex-1">
              <div className="text-xs font-semibold">High</div>
              <div
                className={`text-[10px] ${
                  isDark ? "text-gray-400" : "text-slate-500"
                }`}
              >
                50-99 cases
              </div>
            </div>
          </div>
          <div
            className={`flex items-center gap-3 p-1.5 rounded-lg transition-colors cursor-pointer ${
              isDark ? "hover:bg-amber-900/30" : "hover:bg-amber-50"
            }`}
          >
            <div
              className="w-4 h-4 rounded-md shrink-0 shadow-sm border border-amber-600/20"
              style={{ backgroundColor: "#f59e0b" }}
            ></div>
            <div className="flex-1">
              <div className="text-xs font-semibold">Medium</div>
              <div
                className={`text-[10px] ${
                  isDark ? "text-gray-400" : "text-slate-500"
                }`}
              >
                25-49 cases
              </div>
            </div>
          </div>
          <div
            className={`flex items-center gap-3 p-1.5 rounded-lg transition-colors cursor-pointer ${
              isDark ? "hover:bg-yellow-900/30" : "hover:bg-yellow-50"
            }`}
          >
            <div
              className="w-4 h-4 rounded-md shrink-0 shadow-sm border border-yellow-500/20"
              style={{ backgroundColor: "#facc15" }}
            ></div>
            <div className="flex-1">
              <div className="text-xs font-semibold">Low</div>
              <div
                className={`text-[10px] ${
                  isDark ? "text-gray-400" : "text-slate-500"
                }`}
              >
                10-24 cases
              </div>
            </div>
          </div>
          <div
            className={`flex items-center gap-3 p-1.5 rounded-lg transition-colors cursor-pointer ${
              isDark ? "hover:bg-green-900/30" : "hover:bg-green-50"
            }`}
          >
            <div
              className="w-4 h-4 rounded-md shrink-0 shadow-sm border border-green-400/20"
              style={{ backgroundColor: "#4ade80" }}
            ></div>
            <div className="flex-1">
              <div className="text-xs font-semibold">Very Low</div>
              <div
                className={`text-[10px] ${
                  isDark ? "text-gray-400" : "text-slate-500"
                }`}
              >
                &lt;10 cases
              </div>
            </div>
          </div>
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
            ></div>
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
