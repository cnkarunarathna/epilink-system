/**
 * Risk Prediction Map Screen
 * Uses MapLibre GL JS inside a WebView for properly colored district polygons,
 * identical to the web dashboard. Native RN summary stats + ranked list above/below.
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Animated,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import {
  colors,
  spacing,
  typography,
  borderRadius,
  shadows,
} from "../../theme";
import {
  getDistrictLatest,
  getDashboardSummary,
  DistrictPrediction,
  DashboardSummary,
} from "../../api/analyticsService";

// Read GeoJSON as a JSON module at bundle time
import districtGeoJSON from "../../../assets/District_geo.json";

/* ---- Risk helpers (same scale as web) ---- */
const getRiskLevel = (cases: number) => {
  if (cases >= 100) return "Very High";
  if (cases >= 50) return "High";
  if (cases >= 25) return "Medium";
  if (cases >= 10) return "Low";
  return "Very Low";
};

const getRiskColor = (cases: number) => {
  if (cases >= 100) return "#7f1d1d";
  if (cases >= 50) return "#dc2626";
  if (cases >= 25) return "#f59e0b";
  if (cases >= 10) return "#facc15";
  return "#4ade80";
};

/* ---- District name mapping (GeoJSON ADM2_EN → API name) ---- */
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

/**
 * Build the HTML for the MapLibre GL JS map.
 * District prediction data is injected as a JSON string.
 */
function buildMapHTML(predictions: DistrictPrediction[]): string {
  // Build the color match expression entries
  const colorEntries = Object.entries(districtNameMapping)
    .map(([geoName, apiName]) => {
      const d = predictions.find((p) => p.district === apiName);
      const cases = d?.predicted_cases ?? 0;
      let color: string;
      if (cases >= 100) color = "#7f1d1d";
      else if (cases >= 50) color = "#dc2626";
      else if (cases >= 25) color = "#f59e0b";
      else if (cases >= 10) color = "#facc15";
      else color = "#4ade80";
      return `"${geoName}", "${color}"`;
    })
    .join(",\n          ");

  // Build district data lookup
  const districtLookup = JSON.stringify(
    predictions.reduce(
      (acc, d) => {
        acc[d.district] = {
          cases: d.predicted_cases,
          temp: d.temperature,
          rain: d.precipitation,
        };
        return acc;
      },
      {} as Record<string, any>,
    ),
  );

  const nameMapJSON = JSON.stringify(districtNameMapping);
  const geoJSONStr = JSON.stringify(districtGeoJSON);

  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <link rel="stylesheet" href="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css">
  <script src="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #f0fdf4; }
    #map { width: 100%; height: 100vh; }
    .maplibregl-popup-content {
      background: #fff;
      border-radius: 12px;
      padding: 14px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.15);
      border: 1px solid #e5e7eb;
      font-family: -apple-system, sans-serif;
      min-width: 160px;
    }
    .popup-title { font-weight: 700; font-size: 15px; color: #1f2937; margin-bottom: 4px; }
    .popup-cases { font-size: 20px; font-weight: 800; margin-bottom: 6px; }
    .popup-badge { display: inline-block; padding: 2px 10px; border-radius: 20px; font-size: 11px; font-weight: 700; }
    .popup-meta { font-size: 11px; color: #6b7280; margin-top: 6px; }
    .maplibregl-popup-close-button { font-size: 18px; padding: 4px 8px; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var districtNameMapping = ${nameMapJSON};
    var districtData = ${districtLookup};
    var geoData = ${geoJSONStr};

    function getRiskLevel(c) {
      if (c >= 100) return "Very High";
      if (c >= 50) return "High";
      if (c >= 25) return "Medium";
      if (c >= 10) return "Low";
      return "Very Low";
    }
    function getRiskColor(c) {
      if (c >= 100) return "#7f1d1d";
      if (c >= 50) return "#dc2626";
      if (c >= 25) return "#f59e0b";
      if (c >= 10) return "#facc15";
      return "#4ade80";
    }

    var map = new maplibregl.Map({
      container: "map",
      style: {
        version: 8,
        name: "Blank",
        sources: {
          "osm-tiles": {
            type: "raster",
            tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
            tileSize: 256,
            attribution: "&copy; OpenStreetMap contributors"
          }
        },
        layers: [{
          id: "osm-tiles",
          type: "raster",
          source: "osm-tiles",
          minzoom: 0,
          maxzoom: 19
        }]
      },
      center: [80.7718, 7.8731],
      zoom: 6.8,
      minZoom: 6,
      maxZoom: 12,
      maxBounds: [[78.5, 5.5], [82.5, 10.5]],
      attributionControl: false
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");

    map.on("load", function() {
      // Add IDs to features
      geoData.features = geoData.features.map(function(f, i) {
        return Object.assign({}, f, { id: i });
      });

      map.addSource("districts", { type: "geojson", data: geoData, generateId: true });

      // Fill layer with risk colors
      map.addLayer({
        id: "districts-fill",
        type: "fill",
        source: "districts",
        paint: {
          "fill-color": [
            "match", ["get", "ADM2_EN"],
            ${colorEntries},
            "#e5e7eb"
          ],
          "fill-opacity": [
            "case",
            ["boolean", ["feature-state", "hover"], false],
            0.92,
            0.72
          ]
        }
      });

      // Outline
      map.addLayer({
        id: "districts-outline",
        type: "line",
        source: "districts",
        paint: {
          "line-color": [
            "case",
            ["boolean", ["feature-state", "hover"], false],
            "#1e40af",
            "#ffffff"
          ],
          "line-width": [
            "case",
            ["boolean", ["feature-state", "hover"], false],
            3, 1.5
          ]
        }
      });

      // District labels
      map.addLayer({
        id: "districts-labels",
        type: "symbol",
        source: "districts",
        layout: {
          "text-field": ["get", "ADM2_EN"],
          "text-size": 10,
          "text-font": ["Open Sans Regular"],
          "text-allow-overlap": false
        },
        paint: {
          "text-color": "#1f2937",
          "text-halo-color": "rgba(255,255,255,0.85)",
          "text-halo-width": 1.5
        }
      });

      var hoveredId = null;
      var popup = new maplibregl.Popup({ closeButton: true, closeOnClick: true, maxWidth: "220px" });

      // Hover
      map.on("mousemove", "districts-fill", function(e) {
        if (!e.features || !e.features.length) return;
        if (hoveredId !== null) {
          map.setFeatureState({ source: "districts", id: hoveredId }, { hover: false });
        }
        hoveredId = e.features[0].id;
        map.setFeatureState({ source: "districts", id: hoveredId }, { hover: true });
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", "districts-fill", function() {
        if (hoveredId !== null) {
          map.setFeatureState({ source: "districts", id: hoveredId }, { hover: false });
        }
        hoveredId = null;
        map.getCanvas().style.cursor = "";
      });

      // Click / Tap
      map.on("click", "districts-fill", function(e) {
        if (!e.features || !e.features.length) return;
        var feat = e.features[0];
        var geoName = feat.properties.ADM2_EN;
        var apiName = districtNameMapping[geoName] || geoName;
        var d = districtData[apiName];
        var cases = d ? d.cases : 0;
        var risk = getRiskLevel(cases);
        var riskColor = getRiskColor(cases);

        var html = '<div class="popup-title">' + geoName + '</div>';
        html += '<div class="popup-cases" style="color:' + riskColor + '">' + cases + ' cases</div>';
        html += '<div class="popup-badge" style="background:' + riskColor + '18;color:' + riskColor + '">' + risk + '</div>';
        if (d && d.temp != null) {
          html += '<div class="popup-meta">🌡 ' + d.temp.toFixed(1) + '°C';
          if (d.rain != null) html += '  🌧 ' + d.rain.toFixed(0) + 'mm';
          html += '</div>';
        }

        popup.setLngLat(e.lngLat).setHTML(html).addTo(map);

        // Notify React Native
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: "districtTap", district: apiName, cases: cases }));
        }
      });
    });
  </script>
</body>
</html>`;
}

export const RiskMapScreen: React.FC = () => {
  const [predictions, setPredictions] = useState<DistrictPrediction[]>([]);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedDistrict, setSelectedDistrict] = useState<string | null>(null);
  const [showList, setShowList] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const webViewRef = useRef<WebView>(null);

  const fetchData = useCallback(
    async (refresh = false) => {
      refresh ? setIsRefreshing(true) : setIsLoading(true);
      try {
        const [districtData, summaryData] = await Promise.allSettled([
          getDistrictLatest(),
          getDashboardSummary(),
        ]);
        if (districtData.status === "fulfilled") {
          const sorted = [...districtData.value]
            .filter((d) => d.district && d.district.trim().length > 0)
            .sort((a, b) => b.predicted_cases - a.predicted_cases);
          setPredictions(sorted);
        }
        if (summaryData.status === "fulfilled") setSummary(summaryData.value);
      } catch {
        // silently handle
      } finally {
        refresh ? setIsRefreshing(false) : setIsLoading(false);
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }).start();
      }
    },
    [fadeAnim],
  );

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleWebViewMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === "districtTap") {
        setSelectedDistrict(data.district);
      }
    } catch {
      // ignore
    }
  };

  /* Summary stat cards */
  const summaryCards = summary
    ? [
        {
          label: "Total Cases",
          value: summary.total_cases?.toLocaleString() ?? "—",
          icon: "virus" as const,
          color: "#3b82f6",
        },
        {
          label: "High Risk",
          value: String(summary.high_risk_districts ?? 0),
          icon: "alert-circle" as const,
          color: "#dc2626",
        },
        {
          label: "Districts",
          value: String(summary.district_count ?? 0),
          icon: "map-marker-multiple" as const,
          color: colors.primary,
        },
        {
          label: "Change",
          value: `${(summary.change_percent ?? 0) >= 0 ? "+" : ""}${(summary.change_percent ?? 0).toFixed(1)}%`,
          icon:
            (summary.change_percent ?? 0) >= 0
              ? ("trending-up" as const)
              : ("trending-down" as const),
          color:
            (summary.change_percent ?? 0) >= 0 ? "#dc2626" : colors.success,
        },
      ]
    : [];

  const LEGEND = [
    { label: "Very High (≥100)", color: "#7f1d1d" },
    { label: "High (50-99)", color: "#dc2626" },
    { label: "Medium (25-49)", color: "#f59e0b" },
    { label: "Low (10-24)", color: "#facc15" },
    { label: "Very Low (<10)", color: "#4ade80" },
  ];

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <MaterialCommunityIcons
            name="shield-alert"
            size={22}
            color={colors.primaryForeground}
          />
          <Text style={styles.headerTitle}>Dengue Risk Map</Text>
        </View>
        {summary?.current_week && (
          <View style={styles.weekBadge}>
            <Text style={styles.weekBadgeText}>
              W{summary.current_week.week}/{summary.current_week.year}
            </Text>
          </View>
        )}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => fetchData(true)}
            tintColor={colors.primary}
          />
        }
      >
        {/* Summary Stats */}
        {summaryCards.length > 0 && (
          <Animated.View style={[styles.summaryRow, { opacity: fadeAnim }]}>
            {summaryCards.map((card) => (
              <View key={card.label} style={[styles.summaryCard, shadows.sm]}>
                <MaterialCommunityIcons
                  name={card.icon}
                  size={18}
                  color={card.color}
                />
                <Text style={[styles.summaryValue, { color: card.color }]}>
                  {card.value}
                </Text>
                <Text style={styles.summaryLabel}>{card.label}</Text>
              </View>
            ))}
          </Animated.View>
        )}

        {/* MapLibre WebView */}
        {predictions.length > 0 && (
          <View style={styles.mapContainer}>
            <WebView
              ref={webViewRef}
              source={{ html: buildMapHTML(predictions) }}
              style={styles.webView}
              originWhitelist={["*"]}
              javaScriptEnabled={true}
              domStorageEnabled={true}
              onMessage={handleWebViewMessage}
              scrollEnabled={false}
              bounces={false}
              overScrollMode="never"
              showsHorizontalScrollIndicator={false}
              showsVerticalScrollIndicator={false}
              startInLoadingState={true}
              renderLoading={() => (
                <View style={styles.loadingOverlay}>
                  <MaterialCommunityIcons
                    name="map-search"
                    size={32}
                    color={colors.primary}
                  />
                  <Text style={styles.loadingText}>Loading risk map...</Text>
                </View>
              )}
            />
          </View>
        )}

        {/* Native Legend */}
        <View style={styles.legendContainer}>
          {LEGEND.map((item) => (
            <View key={item.label} style={styles.legendItem}>
              <View
                style={[styles.legendDot, { backgroundColor: item.color }]}
              />
              <Text style={styles.legendText}>{item.label}</Text>
            </View>
          ))}
        </View>

        {/* Toggle District List */}
        <TouchableOpacity
          style={styles.listToggle}
          onPress={() => setShowList(!showList)}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons
            name="format-list-numbered"
            size={20}
            color={colors.primary}
          />
          <Text style={styles.listToggleText}>
            District Rankings ({predictions.length})
          </Text>
          <MaterialCommunityIcons
            name={showList ? "chevron-up" : "chevron-down"}
            size={20}
            color={colors.textSecondary}
          />
        </TouchableOpacity>

        {/* District List */}
        {showList && (
          <Animated.View style={[styles.listContainer, { opacity: fadeAnim }]}>
            {predictions.map((d, index) => {
              const risk = getRiskLevel(d.predicted_cases);
              const riskColor = getRiskColor(d.predicted_cases);
              const isSelected = selectedDistrict === d.district;

              return (
                <TouchableOpacity
                  key={d.district}
                  style={[
                    styles.districtRow,
                    isSelected && styles.districtRowSelected,
                  ]}
                  onPress={() => setSelectedDistrict(d.district)}
                  activeOpacity={0.7}
                >
                  {/* Rank */}
                  <View
                    style={[
                      styles.rankCircle,
                      {
                        backgroundColor: index < 3 ? riskColor : colors.muted,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.rankText,
                        {
                          color: index < 3 ? "#fff" : colors.textSecondary,
                        },
                      ]}
                    >
                      {index + 1}
                    </Text>
                  </View>

                  {/* Info */}
                  <View style={styles.districtInfo}>
                    <Text style={styles.districtName}>{d.district}</Text>
                    <View style={styles.districtMeta}>
                      {d.temperature != null && (
                        <Text style={styles.districtMetaText}>
                          🌡 {d.temperature.toFixed(1)}°
                        </Text>
                      )}
                      {d.precipitation != null && (
                        <Text style={styles.districtMetaText}>
                          🌧 {d.precipitation.toFixed(0)}mm
                        </Text>
                      )}
                    </View>
                  </View>

                  {/* Cases + Badge */}
                  <View style={styles.districtRight}>
                    <Text style={[styles.districtCases, { color: riskColor }]}>
                      {d.predicted_cases}
                    </Text>
                    <View
                      style={[
                        styles.riskBadge,
                        { backgroundColor: riskColor + "18" },
                      ]}
                    >
                      <Text
                        style={[styles.riskBadgeText, { color: riskColor }]}
                      >
                        {risk}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </Animated.View>
        )}

        {/* Disclaimer */}
        <Text style={styles.disclaimer}>
          Data is generated by AI/ML models and updated weekly. For official
          health advisories, consult the Ministry of Health.
        </Text>

        <View style={{ height: spacing.xl }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  headerTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.primaryForeground,
  },
  weekBadge: {
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  weekBadgeText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    color: colors.primaryForeground,
  },
  summaryRow: {
    flexDirection: "row",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: spacing.xs,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.sm,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
    gap: 2,
  },
  summaryValue: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
  },
  summaryLabel: {
    fontSize: 10,
    color: colors.textSecondary,
    fontWeight: typography.fontWeight.medium,
    textAlign: "center",
  },
  mapContainer: {
    marginHorizontal: spacing.md,
    borderRadius: borderRadius.xl,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
    height: 440,
  },
  webView: {
    flex: 1,
    backgroundColor: "#f0fdf4",
  },
  loadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f0fdf4",
    gap: spacing.sm,
  },
  loadingText: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    fontWeight: typography.fontWeight.medium,
  },
  legendContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 2,
    borderWidth: 0.5,
    borderColor: "rgba(0,0,0,0.1)",
  },
  legendText: {
    fontSize: 10,
    color: colors.text,
    fontWeight: typography.fontWeight.medium,
  },
  listToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    padding: spacing.md,
    marginHorizontal: spacing.md,
    marginTop: spacing.xs,
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  listToggleText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text,
    flex: 1,
  },
  listContainer: {
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  districtRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.sm,
  },
  districtRowSelected: {
    backgroundColor: colors.primary + "08",
  },
  rankCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  rankText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
  },
  districtInfo: {
    flex: 1,
  },
  districtName: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text,
  },
  districtMeta: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: 2,
  },
  districtMetaText: {
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
  },
  districtRight: {
    alignItems: "flex-end",
    gap: 3,
  },
  districtCases: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
  },
  riskBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 1,
    borderRadius: borderRadius.full,
  },
  riskBadgeText: {
    fontSize: 10,
    fontWeight: typography.fontWeight.bold,
  },
  disclaimer: {
    textAlign: "center",
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    opacity: 0.6,
    lineHeight: 16,
  },
});
