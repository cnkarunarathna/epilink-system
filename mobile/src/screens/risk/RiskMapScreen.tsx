import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Animated,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import {
  colors,
  spacing,
  typography,
  borderRadius,
  shadows,
  animation,
} from "../../theme";
import {
  getDistrictLatest,
  getDashboardSummary,
  DistrictPrediction,
  DashboardSummary,
} from "../../api/analyticsService";

import districtGeoJSON from "../../../assets/District_geo.json";
import { TAB_BAR_HEIGHT } from "../../utils/responsive";

/* ── Risk helpers ─────────────────────────────────────────────────────────── */
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
  if (cases >= 10) return "#b45309";
  return "#16a34a";
};

const getRiskIcon = (cases: number) => {
  if (cases >= 100) return "alert-octagon";
  if (cases >= 50) return "alert-circle";
  if (cases >= 25) return "alert";
  if (cases >= 10) return "shield-check";
  return "shield-check-outline";
};

/* ── District name mapping (GeoJSON ADM2_EN → API name) ──────────────────── */
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

// Reverse map: API name → display name (GeoJSON name used as display label)
const apiToDisplayName: Record<string, string> = Object.entries(
  districtNameMapping,
).reduce(
  (acc, [geo, api]) => {
    acc[api] = geo;
    return acc;
  },
  {} as Record<string, string>,
);

/* ── Map HTML builder ─────────────────────────────────────────────────────── */
function buildMapHTML(predictions: DistrictPrediction[]): string {
  const colorEntries = Object.entries(districtNameMapping)
    .map(([geoName, apiName]) => {
      const d = predictions.find((p) => p.district === apiName);
      const cases = d?.predicted_cases ?? 0;
      let color: string;
      if (cases >= 100) color = "#7f1d1d";
      else if (cases >= 50) color = "#dc2626";
      else if (cases >= 25) color = "#f59e0b";
      else if (cases >= 10) color = "#b45309";
      else color = "#16a34a";
      return `"${geoName}", "${color}"`;
    })
    .join(",\n          ");

  const districtLookup = JSON.stringify(
    predictions.reduce(
      (acc, d) => {
        acc[d.district] = {
          cases: d.predicted_cases,
          temp: d.temperature,
          rain: d.precipitation,
          displayName: apiToDisplayName[d.district] ?? d.district,
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
    body { background: #f0fdf4; font-family: -apple-system, BlinkMacSystemFont, sans-serif; }
    #map { width: 100%; height: 100vh; }

    /* Floating legend — bottom-left */
    #legend {
      position: fixed;
      bottom: 44px;
      left: 10px;
      background: rgba(255,255,255,0.93);
      border-radius: 10px;
      padding: 8px 10px;
      box-shadow: 0 2px 12px rgba(0,0,0,0.14);
      z-index: 10;
      border: 1px solid rgba(0,0,0,0.07);
    }
    .legend-row {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-bottom: 4px;
      font-size: 10px;
      color: #374151;
      font-weight: 500;
    }
    .legend-row:last-child { margin-bottom: 0; }
    .legend-swatch {
      width: 11px;
      height: 11px;
      border-radius: 2px;
      border: 0.5px solid rgba(0,0,0,0.12);
      flex-shrink: 0;
    }

    /* Tap hint — top center, fades out */
    #tap-hint {
      position: fixed;
      top: 10px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(0,0,0,0.62);
      color: #fff;
      font-size: 11px;
      font-weight: 600;
      padding: 5px 14px;
      border-radius: 20px;
      z-index: 10;
      white-space: nowrap;
      transition: opacity 0.5s ease;
      pointer-events: none;
    }
    #tap-hint.hidden { opacity: 0; }

    /* Popup */
    .maplibregl-popup-content {
      background: #fff;
      border-radius: 12px;
      padding: 0;
      box-shadow: 0 6px 24px rgba(0,0,0,0.16);
      border: 1px solid #e5e7eb;
      overflow: hidden;
      min-width: 170px;
    }
    .popup-accent { height: 5px; width: 100%; }
    .popup-body { padding: 12px 14px 14px; }
    .popup-title { font-weight: 700; font-size: 14px; color: #111827; margin-bottom: 4px; }
    .popup-cases { font-size: 22px; font-weight: 800; margin-bottom: 2px; }
    .popup-label { font-size: 11px; color: #6b7280; margin-bottom: 8px; }
    .popup-badge {
      display: inline-block;
      padding: 2px 10px;
      border-radius: 20px;
      font-size: 11px;
      font-weight: 700;
      margin-bottom: 8px;
    }
    .popup-bar-track {
      height: 5px;
      background: #f3f4f6;
      border-radius: 3px;
      overflow: hidden;
      margin-bottom: 8px;
    }
    .popup-bar-fill {
      height: 100%;
      border-radius: 3px;
      transition: width 0.4s ease;
    }
    .popup-meta { font-size: 11px; color: #6b7280; display: flex; gap: 10px; }
    .maplibregl-popup-close-button {
      font-size: 18px;
      padding: 6px 10px;
      color: #9ca3af;
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <div id="legend">
    <div class="legend-row"><div class="legend-swatch" style="background:#7f1d1d"></div>Very High (≥100)</div>
    <div class="legend-row"><div class="legend-swatch" style="background:#dc2626"></div>High (50–99)</div>
    <div class="legend-row"><div class="legend-swatch" style="background:#f59e0b"></div>Medium (25–49)</div>
    <div class="legend-row"><div class="legend-swatch" style="background:#b45309"></div>Low (10–24)</div>
    <div class="legend-row"><div class="legend-swatch" style="background:#16a34a"></div>Very Low (&lt;10)</div>
  </div>
  <div id="tap-hint">Tap a district to explore</div>

  <script>
    var districtNameMapping = ${nameMapJSON};
    var districtData = ${districtLookup};
    var geoData = ${geoJSONStr};
    var hintDismissed = false;

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
      if (c >= 10) return "#b45309";
      return "#16a34a";
    }

    // Auto-dismiss hint after 4s
    setTimeout(function() {
      document.getElementById("tap-hint").classList.add("hidden");
    }, 4000);

    var map = new maplibregl.Map({
      container: "map",
      style: {
        version: 8,
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

    var popup = new maplibregl.Popup({ closeButton: true, closeOnClick: true, maxWidth: "240px" });

    // Notify native when popup is closed by the user
    popup.on("close", function() {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: "popupClose" }));
      }
    });

    map.on("load", function() {
      geoData.features = geoData.features.map(function(f, i) {
        return Object.assign({}, f, { id: i });
      });

      map.addSource("districts", { type: "geojson", data: geoData, generateId: true });

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
            ["boolean", ["feature-state", "hover"], false], 0.88,
            0.70
          ],
          "fill-opacity-transition": { "duration": 200 }
        }
      });

      map.addLayer({
        id: "districts-outline",
        type: "line",
        source: "districts",
        paint: {
          "line-color": [
            "case",
            ["boolean", ["feature-state", "hover"], false],
            "#1e40af", "#ffffff"
          ],
          "line-width": [
            "case",
            ["boolean", ["feature-state", "hover"], false],
            3, 1.2
          ],
          "line-width-transition": { "duration": 150 }
        }
      });

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
          "text-halo-color": "rgba(255,255,255,0.9)",
          "text-halo-width": 1.5
        }
      });

      var hoveredId = null;

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

      map.on("click", "districts-fill", function(e) {
        if (!e.features || !e.features.length) return;

        // Dismiss hint on first tap
        if (!hintDismissed) {
          hintDismissed = true;
          document.getElementById("tap-hint").classList.add("hidden");
        }

        var feat = e.features[0];
        var geoName = feat.properties.ADM2_EN;
        var apiName = districtNameMapping[geoName] || geoName;
        var d = districtData[apiName];
        var cases = d ? d.cases : 0;
        var risk = getRiskLevel(cases);
        var riskColor = getRiskColor(cases);
        var displayName = d ? d.displayName : geoName;
        var barPct = Math.min(cases / 150 * 100, 100);

        var html = '<div class="popup-accent" style="background:' + riskColor + '"></div>';
        html += '<div class="popup-body">';
        html += '<div class="popup-title">' + displayName + '</div>';
        html += '<div class="popup-cases" style="color:' + riskColor + '">' + cases + '</div>';
        html += '<div class="popup-label">predicted cases this week</div>';
        html += '<div class="popup-badge" style="background:' + riskColor + '1a;color:' + riskColor + '">' + risk + ' Risk</div>';
        html += '<div class="popup-bar-track"><div class="popup-bar-fill" style="width:' + barPct + '%;background:' + riskColor + '"></div></div>';
        if (d && (d.temp != null || d.rain != null)) {
          html += '<div class="popup-meta">';
          if (d.temp != null) html += '<span>&#x1F321; ' + d.temp.toFixed(1) + '\u00B0C</span>';
          if (d.rain != null) html += '<span>&#x1F327; ' + d.rain.toFixed(0) + 'mm</span>';
          html += '</div>';
        }
        html += '</div>';

        popup.setLngLat(e.lngLat).setHTML(html).addTo(map);

        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: "districtTap",
            apiName: apiName,
            displayName: displayName,
            cases: cases
          }));
        }
      });

      // Signal native that the map is ready
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: "mapReady" }));
      }
    });
  </script>
</body>
</html>`;
}

/* ── Component ────────────────────────────────────────────────────────────── */
export const RiskMapScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const scrollPaddingBottom = TAB_BAR_HEIGHT + insets.bottom + spacing.lg;
  const [predictions, setPredictions] = useState<DistrictPrediction[]>([]);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isMapReady, setIsMapReady] = useState(false);
  const [spotlightDistrict, setSpotlightDistrict] =
    useState<DistrictPrediction | null>(null);
  const webViewRef = useRef<WebView>(null);

  /* ── Animation values (all declared individually — no hooks in loops) ── */
  const headerAnim = useRef(new Animated.Value(0)).current;
  const statAnim0 = useRef(new Animated.Value(0)).current;
  const statAnim1 = useRef(new Animated.Value(0)).current;
  const statAnim2 = useRef(new Animated.Value(0)).current;
  const statAnim3 = useRef(new Animated.Value(0)).current;
  const statsCardAnims = [statAnim0, statAnim1, statAnim2, statAnim3];
  const mapContainerAnim = useRef(new Animated.Value(0)).current;
  const spotlightAnim = useRef(new Animated.Value(0)).current;
  const rankingsAnim = useRef(new Animated.Value(0)).current;

  /* ── Data fetching ─────────────────────────────────────────────────────── */
  const fetchData = useCallback(
    async (refresh = false) => {
      if (refresh) {
        // Reset all animation values before re-running entrance animations
        headerAnim.setValue(0);
        statsCardAnims.forEach((a) => a.setValue(0));
        mapContainerAnim.setValue(0);
        rankingsAnim.setValue(0);
        setIsMapReady(false);
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

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

        // Staggered entrance animations
        Animated.stagger(120, [
          Animated.timing(headerAnim, {
            toValue: 1,
            duration: 450,
            useNativeDriver: true,
          }),
          Animated.stagger(
            80,
            statsCardAnims.map((a) =>
              Animated.spring(a, {
                toValue: 1,
                ...animation.spring.gentle,
                useNativeDriver: true,
              }),
            ),
          ),
          Animated.timing(mapContainerAnim, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
          }),
          Animated.timing(rankingsAnim, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
          }),
        ]).start();
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  /* ── Spotlight card animation ─────────────────────────────────────────── */
  useEffect(() => {
    if (spotlightDistrict) {
      spotlightAnim.setValue(0);
      Animated.spring(spotlightAnim, {
        toValue: 1,
        ...animation.spring.gentle,
        useNativeDriver: true,
      }).start();
    }
  }, [spotlightDistrict, spotlightAnim]);

  /* ── WebView message handler ──────────────────────────────────────────── */
  const handleWebViewMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === "mapReady") {
        setIsMapReady(true);
      } else if (data.type === "districtTap") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        const match = predictions.find((p) => p.district === data.apiName);
        if (match) setSpotlightDistrict(match);
      } else if (data.type === "popupClose") {
        setSpotlightDistrict(null);
      }
    } catch {
      // ignore malformed messages
    }
  };

  const dismissSpotlight = () => {
    setSpotlightDistrict(null);
    // Dismiss the MapLibre popup too
    webViewRef.current?.injectJavaScript("popup.remove(); null;");
  };

  /* ── Summary stat cards config ────────────────────────────────────────── */
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
          icon: (
            (summary.change_percent ?? 0) >= 0 ? "trending-up" : "trending-down"
          ) as React.ComponentProps<typeof MaterialCommunityIcons>["name"],
          color:
            (summary.change_percent ?? 0) >= 0 ? "#dc2626" : colors.success,
        },
      ]
    : [];

  /* ── Render ────────────────────────────────────────────────────────────── */
  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: scrollPaddingBottom }}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => fetchData(true)}
            tintColor={colors.primary}
          />
        }
      >
        {/* ── Gradient Header ── */}
        <Animated.View
          style={{
            opacity: headerAnim,
            transform: [
              {
                translateY: headerAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [16, 0],
                }),
              },
            ],
          }}
        >
          <LinearGradient
            colors={colors.gradient.header}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.header}
          >
            {/* Decorative circles */}
            <View style={styles.decorCircle1} />
            <View style={styles.decorCircle2} />
            <View style={styles.decorCircle3} />

            {/* Title row */}
            <View style={styles.headerTitleRow}>
              <View style={styles.headerIconCircle}>
                <MaterialCommunityIcons
                  name="shield-alert"
                  size={20}
                  color={colors.primaryForeground}
                />
              </View>
              <View style={styles.headerTextBlock}>
                <Text style={styles.headerTitle}>Dengue Risk Map</Text>
                <Text style={styles.headerSubtitle}>
                  AI-powered weekly predictions · 25 districts
                </Text>
              </View>
              {summary?.current_week && (
                <View style={styles.weekBadge}>
                  <MaterialCommunityIcons
                    name="calendar-week"
                    size={11}
                    color="rgba(255,255,255,0.8)"
                  />
                  <Text style={styles.weekBadgeText}>
                    W{summary.current_week.week} / {summary.current_week.year}
                  </Text>
                </View>
              )}
            </View>

            {/* Meta info row */}
            {summary && (
              <View style={styles.headerMetaRow}>
                <View style={styles.headerMetaItem}>
                  <MaterialCommunityIcons
                    name="virus"
                    size={13}
                    color="rgba(255,255,255,0.75)"
                  />
                  <Text style={styles.headerMetaText}>
                    {summary.total_cases?.toLocaleString()} total cases
                  </Text>
                </View>
                <View style={styles.headerMetaDivider} />
                <View style={styles.headerMetaItem}>
                  <MaterialCommunityIcons
                    name="alert-circle-outline"
                    size={13}
                    color="rgba(255,255,255,0.75)"
                  />
                  <Text style={styles.headerMetaText}>
                    {summary.high_risk_districts} high-risk districts
                  </Text>
                </View>
              </View>
            )}
          </LinearGradient>
        </Animated.View>

        {/* ── Summary Stat Cards ── */}
        {summaryCards.length > 0 && (
          <View style={styles.summaryRow}>
            {summaryCards.map((card, i) => (
              <Animated.View
                key={card.label}
                style={[
                  styles.summaryCard,
                  shadows.sm,
                  {
                    opacity: statsCardAnims[i],
                    transform: [
                      {
                        translateY: statsCardAnims[i].interpolate({
                          inputRange: [0, 1],
                          outputRange: [18, 0],
                        }),
                      },
                    ],
                  },
                ]}
              >
                {/* Colored left accent border */}
                <View
                  style={[
                    styles.summaryCardAccent,
                    { backgroundColor: card.color },
                  ]}
                />
                <LinearGradient
                  colors={[card.color + "1a", card.color + "08"]}
                  style={styles.summaryIconCircle}
                >
                  <MaterialCommunityIcons
                    name={card.icon}
                    size={19}
                    color={card.color}
                  />
                </LinearGradient>
                <Text style={[styles.summaryValue, { color: card.color }]}>
                  {card.value}
                </Text>
                <Text style={styles.summaryLabel}>{card.label}</Text>
              </Animated.View>
            ))}
          </View>
        )}

        {/* ── Map Container ── */}
        {predictions.length > 0 && (
          <Animated.View
            style={[
              styles.mapWrapper,
              {
                opacity: mapContainerAnim,
                transform: [
                  {
                    translateY: mapContainerAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [12, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <View style={[styles.mapContainer, shadows.md]}>
              <WebView
                ref={webViewRef}
                source={{ html: buildMapHTML(predictions) }}
                style={styles.webView}
                originWhitelist={["*"]}
                javaScriptEnabled
                domStorageEnabled
                onMessage={handleWebViewMessage}
                scrollEnabled={false}
                bounces={false}
                overScrollMode="never"
                showsHorizontalScrollIndicator={false}
                showsVerticalScrollIndicator={false}
              />
              {/* Native loading overlay — dismissed only after mapReady postMessage */}
              {!isMapReady && (
                <View style={styles.mapLoadingOverlay}>
                  <View style={styles.mapLoadingCard}>
                    <MaterialCommunityIcons
                      name="map-search-outline"
                      size={36}
                      color={colors.primary}
                    />
                    <Text style={styles.mapLoadingTitle}>
                      Loading Risk Map
                    </Text>
                    <Text style={styles.mapLoadingSubtext}>
                      Fetching district data…
                    </Text>
                  </View>
                </View>
              )}
            </View>
          </Animated.View>
        )}

        {/* ── Selected District Spotlight Card ── */}
        {spotlightDistrict && (
          <Animated.View
            style={[
              styles.spotlightCard,
              shadows.md,
              {
                opacity: spotlightAnim,
                transform: [
                  {
                    translateY: spotlightAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [20, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            {/* Colored left border */}
            <View
              style={[
                styles.spotlightAccent,
                {
                  backgroundColor: getRiskColor(
                    spotlightDistrict.predicted_cases,
                  ),
                },
              ]}
            />
            {/* Risk icon */}
            <LinearGradient
              colors={[
                getRiskColor(spotlightDistrict.predicted_cases) + "20",
                getRiskColor(spotlightDistrict.predicted_cases) + "0a",
              ]}
              style={styles.spotlightIconCircle}
            >
              <MaterialCommunityIcons
                name={getRiskIcon(spotlightDistrict.predicted_cases) as any}
                size={26}
                color={getRiskColor(spotlightDistrict.predicted_cases)}
              />
            </LinearGradient>
            {/* Text */}
            <View style={styles.spotlightInfo}>
              <Text style={styles.spotlightDistrict}>
                {apiToDisplayName[spotlightDistrict.district] ??
                  spotlightDistrict.district}
              </Text>
              <View
                style={[
                  styles.spotlightBadge,
                  {
                    backgroundColor:
                      getRiskColor(spotlightDistrict.predicted_cases) + "18",
                  },
                ]}
              >
                <Text
                  style={[
                    styles.spotlightBadgeText,
                    {
                      color: getRiskColor(spotlightDistrict.predicted_cases),
                    },
                  ]}
                >
                  {getRiskLevel(spotlightDistrict.predicted_cases)} Risk
                </Text>
              </View>
              <View style={styles.spotlightMeta}>
                {spotlightDistrict.temperature != null && (
                  <View style={styles.spotlightMetaItem}>
                    <MaterialCommunityIcons
                      name="thermometer"
                      size={12}
                      color={colors.textSecondary}
                    />
                    <Text style={styles.spotlightMetaText}>
                      {spotlightDistrict.temperature.toFixed(1)}°C
                    </Text>
                  </View>
                )}
                {spotlightDistrict.precipitation != null && (
                  <View style={styles.spotlightMetaItem}>
                    <MaterialCommunityIcons
                      name="water-outline"
                      size={12}
                      color={colors.textSecondary}
                    />
                    <Text style={styles.spotlightMetaText}>
                      {spotlightDistrict.precipitation.toFixed(0)}mm
                    </Text>
                  </View>
                )}
              </View>
            </View>
            {/* Cases count */}
            <View style={styles.spotlightCasesBlock}>
              <Text
                style={[
                  styles.spotlightCasesNum,
                  { color: getRiskColor(spotlightDistrict.predicted_cases) },
                ]}
              >
                {spotlightDistrict.predicted_cases}
              </Text>
              <Text style={styles.spotlightCasesLabel}>cases</Text>
            </View>
            {/* Close */}
            <TouchableOpacity
              style={styles.spotlightClose}
              onPress={dismissSpotlight}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <MaterialCommunityIcons
                name="close"
                size={16}
                color={colors.textSecondary}
              />
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* ── District Rankings ── */}
        {predictions.length > 0 && (
          <Animated.View
            style={{
              opacity: rankingsAnim,
              transform: [
                {
                  translateY: rankingsAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [16, 0],
                  }),
                },
              ],
            }}
          >
            {/* Section header */}
            <View style={styles.sectionTitleRow}>
              <View style={styles.sectionAccentBar} />
              <Text style={styles.sectionTitle}>District Rankings</Text>
              <View style={styles.countPill}>
                <Text style={styles.countPillText}>{predictions.length}</Text>
              </View>
            </View>

            {/* District rows — individual cards, stagger capped at STAGGER_LIMIT */}
            <View style={styles.rankingsList}>
              {predictions.map((d, index) => {
                const riskColor = getRiskColor(d.predicted_cases);
                const riskLevel = getRiskLevel(d.predicted_cases);
                const isSelected = spotlightDistrict?.district === d.district;
                const displayName =
                  apiToDisplayName[d.district] ?? d.district;

                return (
                  <TouchableOpacity
                    key={d.district}
                    style={[
                      styles.districtCard,
                      shadows.sm,
                      isSelected && {
                        borderLeftColor: riskColor,
                        backgroundColor: riskColor + "0c",
                      },
                    ]}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setSpotlightDistrict(isSelected ? null : d);
                    }}
                    activeOpacity={0.75}
                  >
                    {/* Selected left accent */}
                    {isSelected && (
                      <View
                        style={[
                          styles.districtSelectedBar,
                          { backgroundColor: riskColor },
                        ]}
                      />
                    )}

                    {/* Rank badge */}
                    {index < 3 ? (
                      <LinearGradient
                        colors={[riskColor, riskColor + "cc"]}
                        style={styles.rankCircle}
                      >
                        <MaterialCommunityIcons
                          name={
                            index === 0
                              ? "medal"
                              : index === 1
                                ? "medal-outline"
                                : "numeric-3-circle-outline"
                          }
                          size={16}
                          color="#fff"
                        />
                      </LinearGradient>
                    ) : (
                      <View
                        style={[
                          styles.rankCircle,
                          { backgroundColor: colors.muted },
                        ]}
                      >
                        <Text
                          style={[
                            styles.rankText,
                            { color: colors.textSecondary },
                          ]}
                        >
                          {index + 1}
                        </Text>
                      </View>
                    )}

                    {/* District info */}
                    <View style={styles.districtInfo}>
                      <Text
                        style={[
                          styles.districtName,
                          isSelected && { color: riskColor },
                        ]}
                      >
                        {displayName}
                      </Text>
                      <View style={styles.districtMeta}>
                        {d.temperature != null && (
                          <View style={styles.districtMetaItem}>
                            <MaterialCommunityIcons
                              name="thermometer"
                              size={12}
                              color={colors.textSecondary}
                            />
                            <Text style={styles.districtMetaText}>
                              {d.temperature.toFixed(1)}°C
                            </Text>
                          </View>
                        )}
                        {d.precipitation != null && (
                          <View style={styles.districtMetaItem}>
                            <MaterialCommunityIcons
                              name="water-outline"
                              size={12}
                              color={colors.textSecondary}
                            />
                            <Text style={styles.districtMetaText}>
                              {d.precipitation.toFixed(0)}mm
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>

                    {/* Cases + risk badge */}
                    <View style={styles.districtRight}>
                      <Text
                        style={[styles.districtCases, { color: riskColor }]}
                      >
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
                          {riskLevel}
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Animated.View>
        )}

        {/* ── Disclaimer ── */}
        <View style={[styles.disclaimerCard, shadows.sm]}>
          <MaterialCommunityIcons
            name="information-outline"
            size={16}
            color={colors.textSecondary}
          />
          <Text style={styles.disclaimerText}>
            Predictions are generated by AI/ML models and updated weekly. For
            official health advisories, consult the Ministry of Health.
          </Text>
        </View>

        <View style={{ height: spacing.xl }} />
      </ScrollView>
    </SafeAreaView>
  );
};

/* ── Styles ───────────────────────────────────────────────────────────────── */
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  /* Header */
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    overflow: "hidden",
    position: "relative",
    borderBottomLeftRadius: borderRadius["3xl"],
    borderBottomRightRadius: borderRadius["3xl"],
  },
  decorCircle1: {
    position: "absolute",
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: "rgba(255,255,255,0.06)",
    top: -30,
    right: -20,
  },
  decorCircle2: {
    position: "absolute",
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: "rgba(255,255,255,0.04)",
    bottom: -15,
    left: 30,
  },
  decorCircle3: {
    position: "absolute",
    width: 45,
    height: 45,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.05)",
    top: 20,
    left: "50%",
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    zIndex: 2,
  },
  headerIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTextBlock: {
    flex: 1,
  },
  headerTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.primaryForeground,
  },
  headerSubtitle: {
    fontSize: typography.fontSize.xs,
    color: "rgba(255,255,255,0.72)",
    marginTop: 1,
  },
  weekBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(255,255,255,0.18)",
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  weekBadgeText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    color: colors.primaryForeground,
  },
  headerMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: spacing.md,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    zIndex: 2,
  },
  headerMetaItem: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  headerMetaDivider: {
    width: 1,
    height: 16,
    backgroundColor: "rgba(255,255,255,0.25)",
    marginHorizontal: spacing.sm,
  },
  headerMetaText: {
    fontSize: typography.fontSize.xs,
    color: "rgba(255,255,255,0.85)",
    fontWeight: typography.fontWeight.medium,
  },

  /* Summary stat cards */
  summaryRow: {
    flexDirection: "row",
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
    gap: spacing.xs,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: borderRadius.xl,
    padding: spacing.sm + 2,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
    gap: 3,
    overflow: "hidden",
  },
  summaryCardAccent: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 3,
  },
  summaryIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
    marginTop: 4,
  },
  summaryValue: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
  },
  summaryLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
    fontWeight: typography.fontWeight.medium,
    textAlign: "center",
  },

  /* Map */
  mapWrapper: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  mapContainer: {
    borderRadius: borderRadius.xl,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
    height: 440,
    position: "relative",
  },
  webView: {
    flex: 1,
    backgroundColor: "#f0fdf4",
  },
  mapLoadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f0fdf4",
  },
  mapLoadingCard: {
    alignItems: "center",
    gap: spacing.xs,
  },
  mapLoadingTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text,
    marginTop: spacing.sm,
  },
  mapLoadingSubtext: {
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
  },

  /* Spotlight card */
  spotlightCard: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    backgroundColor: colors.card,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 4,
    overflow: "hidden",
    padding: spacing.md,
    gap: spacing.sm,
  },
  spotlightAccent: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
  },
  spotlightIconCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
  },
  spotlightInfo: {
    flex: 1,
    gap: 3,
  },
  spotlightDistrict: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    color: colors.text,
  },
  spotlightBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
  },
  spotlightBadgeText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
  },
  spotlightMeta: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: 2,
  },
  spotlightMetaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  spotlightMetaText: {
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
  },
  spotlightCasesBlock: {
    alignItems: "center",
    paddingLeft: spacing.sm,
  },
  spotlightCasesNum: {
    fontSize: typography.fontSize["2xl"],
    fontWeight: typography.fontWeight.bold,
  },
  spotlightCasesLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
  },
  spotlightClose: {
    position: "absolute",
    top: spacing.xs,
    right: spacing.xs,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.muted,
    alignItems: "center",
    justifyContent: "center",
  },

  /* Section header */
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  sectionAccentBar: {
    width: 3,
    height: 16,
    backgroundColor: colors.primary,
    borderRadius: 2,
  },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text,
    flex: 1,
  },
  countPill: {
    backgroundColor: colors.primary + "15",
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
    minWidth: 28,
    alignItems: "center",
  },
  countPillText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    color: colors.primary,
  },

  /* District ranking cards */
  rankingsList: {
    paddingHorizontal: spacing.md,
    gap: spacing.xs,
    paddingBottom: spacing.sm,
  },
  districtCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 1,
    padding: spacing.md,
    gap: spacing.sm,
    overflow: "hidden",
  },
  districtSelectedBar: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
  },
  rankCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
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
    marginTop: 3,
  },
  districtMetaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  districtMetaText: {
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
  },
  districtRight: {
    alignItems: "flex-end",
    gap: 4,
  },
  districtCases: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
  },
  riskBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
  },
  riskBadgeText: {
    fontSize: 10,
    fontWeight: typography.fontWeight.bold,
  },

  /* Disclaimer */
  disclaimerCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    backgroundColor: colors.muted,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  disclaimerText: {
    flex: 1,
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
    lineHeight: 17,
    opacity: 0.85,
  },
});
