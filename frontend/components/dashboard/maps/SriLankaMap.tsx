"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
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

  // Load GeoJSON data
  useEffect(() => {
    fetch("/District_geo.json")
      .then((res) => res.json())
      .then((data) => setSriLankaGeoJSON(data))
      .catch((err) => console.error("Error loading GeoJSON:", err));
  }, []);

  // Update map when data changes
  useEffect(() => {
    setMapKey((prev) => prev + 1);
  }, [data]);

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
    if (!apiDistrictName) return "#e5e7eb"; // gray-200 - no data

    const districtData = data.find((d) => d.district === apiDistrictName);
    if (!districtData) return "#e5e7eb"; // gray-200 - no data

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
      color: "#ffffff",
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
          color: "#334155",
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
          className: "district-tooltip",
        }
      );
    }
  };

  if (!sriLankaGeoJSON) {
    return (
      <div className="relative w-full h-full min-h-[600px] flex items-center justify-center">
        <div className="text-gray-500">Loading map...</div>
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
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
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
        <div className="absolute top-4 right-4 bg-white/95 backdrop-blur-sm p-3 rounded-lg shadow-xl border border-gray-200 z-[1000]">
          <h4 className="font-bold text-sm">{hoveredDistrict}</h4>
          {getDistrictData(
            Object.keys(districtNameMapping).find(
              (key) => districtNameMapping[key] === hoveredDistrict
            ) || ""
          ) && (
            <p className="text-xs text-gray-600 mt-1">
              Predicted Cases:{" "}
              <span className="font-semibold text-gray-900">
                {getDistrictData(
                  Object.keys(districtNameMapping).find(
                    (key) => districtNameMapping[key] === hoveredDistrict
                  ) || ""
                )?.predicted_cases.toLocaleString()}
              </span>
            </p>
          )}
        </div>
      )}

      {/* Custom CSS for tooltips */}
      <style jsx global>{`
        .district-tooltip {
          background: white !important;
          border: 1px solid #e5e7eb !important;
          border-radius: 6px !important;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15) !important;
          padding: 4px 8px !important;
        }
        .district-tooltip::before {
          border-top-color: white !important;
        }
      `}</style>

      {/* Legend */}
      <div className="absolute bottom-4 left-4 bg-white/95 backdrop-blur-sm p-4 rounded-lg shadow-xl border border-gray-200 z-[1000]">
        <h4 className="font-bold text-sm mb-3">Risk Level</h4>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full shrink-0"
              style={{ backgroundColor: "#7f1d1d" }}
            ></div>
            <span className="text-xs font-medium">Very High (≥100)</span>
          </div>
          <div className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full shrink-0"
              style={{ backgroundColor: "#dc2626" }}
            ></div>
            <span className="text-xs font-medium">High (50-99)</span>
          </div>
          <div className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full shrink-0"
              style={{ backgroundColor: "#f59e0b" }}
            ></div>
            <span className="text-xs font-medium">Medium (25-49)</span>
          </div>
          <div className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full shrink-0"
              style={{ backgroundColor: "#facc15" }}
            ></div>
            <span className="text-xs font-medium">Low (10-24)</span>
          </div>
          <div className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full shrink-0"
              style={{ backgroundColor: "#4ade80" }}
            ></div>
            <span className="text-xs font-medium">Very Low (&lt;10)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-gray-200 border border-gray-300 shrink-0"></div>
            <span className="text-xs font-medium">No Data</span>
          </div>
        </div>
      </div>
    </div>
  );
}
