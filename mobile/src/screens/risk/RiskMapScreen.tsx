/**
 * Risk Map Screen — Full-screen dengue risk overlay with floating bottom sheet
 */

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  ScrollView,
  PanResponder,
  Platform,
  useWindowDimensions,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
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

const getRiskIcon = (
  cases: number,
): React.ComponentProps<typeof MaterialCommunityIcons>["name"] => {
  if (cases >= 100) return "alert-octagon";
  if (cases >= 50) return "alert-circle";
  if (cases >= 25) return "alert";
  if (cases >= 10) return "shield-check";
  return "shield-check-outline";
};

/* ── District name mapping ────────────────────────────────────────────────── */
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

const apiToDisplayName: Record<string, string> = Object.entries(
  districtNameMapping,
).reduce(
  (acc, [geo, api]) => {
    acc[api] = geo;
    return acc;
  },
  {} as Record<string, string>,
);

/* ── Map HTML ─────────────────────────────────────────────────────────────── */
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
          lat: d.latitude,
          lng: d.longitude,
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
    html, body { width: 100%; height: 100%; background: linear-gradient(180deg, #f4fbf5 0%, #e8f5e9 100%); font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; overflow: hidden; }
    #map { width: 100%; height: 100vh; }

    .maplibregl-ctrl-bottom-right,
    .maplibregl-ctrl-bottom-left,
    .maplibregl-ctrl-top-right { display: none !important; }

    .maplibregl-popup-content {
      background: #fff;
      border-radius: 16px;
      padding: 0;
      box-shadow: 0 8px 32px rgba(0,0,0,0.18);
      border: 1px solid #f0f0f0;
      overflow: hidden;
      min-width: 190px;
    }
    .maplibregl-popup-tip { display: none; }
    .maplibregl-popup-close-button {
      font-size: 20px;
      padding: 8px 12px;
      color: #9ca3af;
    }
    .popup-header { height: 6px; width: 100%; }
    .popup-body { padding: 14px 16px 16px; }
    .popup-name { font-weight: 800; font-size: 15px; color: #111827; margin-bottom: 8px; }
    .popup-cases-row { display: flex; align-items: baseline; gap: 6px; margin-bottom: 4px; }
    .popup-cases-num { font-size: 28px; font-weight: 900; line-height: 1; }
    .popup-cases-label { font-size: 12px; color: #6b7280; font-weight: 500; }
    .popup-badge {
      display: inline-flex;
      align-items: center;
      padding: 3px 12px;
      border-radius: 24px;
      font-size: 11px;
      font-weight: 700;
      margin-bottom: 10px;
    }
    .popup-bar-track {
      height: 6px;
      background: #f3f4f6;
      border-radius: 4px;
      overflow: hidden;
      margin-bottom: 10px;
    }
    .popup-bar-fill { height: 100%; border-radius: 4px; }
    .popup-env {
      display: flex;
      gap: 12px;
      font-size: 11px;
      color: #6b7280;
      padding-top: 8px;
      border-top: 1px solid #f3f4f6;
    }
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
      if (c >= 10) return "#b45309";
      return "#16a34a";
    }

    function zoomMap(delta) {
      var nextZoom = Math.max(5.5, Math.min(13, map.getZoom() + delta));
      map.easeTo({ zoom: nextZoom, duration: 300 });
    }

    var map = new maplibregl.Map({
      container: "map",
      style: {
        version: 8,
        glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
        sources: {
          "osm": {
            type: "raster",
            tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
            tileSize: 256,
            attribution: "© OpenStreetMap"
          }
        },
        layers: [
          { id: "background", type: "background", paint: { "background-color": "#e8f5e9" } },
          { id: "osm-base", type: "raster", source: "osm", paint: { "raster-opacity": 0.18 } }
        ]
      },
      center: [80.7718, 7.8731],
      zoom: 6.8,
      minZoom: 5.5,
      maxZoom: 13,
      maxBounds: [[77.5, 4.5], [83.5, 11.5]],
      attributionControl: false,
      dragRotate: false,
      pitchWithRotate: false
    });

    function resetView() {
      map.flyTo({ center: [80.7718, 7.8731], zoom: 6.8, duration: 800 });
    }

    var popup = new maplibregl.Popup({ closeButton: true, closeOnClick: false, maxWidth: "240px", offset: 10 });

    popup.on("close", function() {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: "popupClose" }));
      }
    });

    var selectedId = null;

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
            ["boolean", ["feature-state", "selected"], false], 0.92,
            ["boolean", ["feature-state", "hover"], false], 0.82,
            0.72
          ]
        }
      });

      map.addLayer({
        id: "districts-outline",
        type: "line",
        source: "districts",
        paint: {
          "line-color": [
            "case",
            ["boolean", ["feature-state", "selected"], false], "#ffffff",
            ["boolean", ["feature-state", "hover"], false], "rgba(255,255,255,0.9)",
            "rgba(255,255,255,0.55)"
          ],
          "line-width": [
            "case",
            ["boolean", ["feature-state", "selected"], false], 2.5,
            ["boolean", ["feature-state", "hover"], false], 2,
            1
          ]
        }
      });

      map.addLayer({
        id: "districts-labels",
        type: "symbol",
        source: "districts",
        minzoom: 7,
        layout: {
          "text-field": ["get", "ADM2_EN"],
          "text-size": ["interpolate", ["linear"], ["zoom"], 7, 9, 10, 12],
          "text-font": ["Open Sans Regular"],
          "text-allow-overlap": false
        },
        paint: {
          "text-color": "#1f2937",
          "text-halo-color": "rgba(255,255,255,0.95)",
          "text-halo-width": 2
        }
      });

      var hoveredId = null;

      map.on("mousemove", "districts-fill", function(e) {
        if (!e.features || !e.features.length) return;
        if (hoveredId !== null) map.setFeatureState({ source: "districts", id: hoveredId }, { hover: false });
        hoveredId = e.features[0].id;
        map.setFeatureState({ source: "districts", id: hoveredId }, { hover: true });
        map.getCanvas().style.cursor = "pointer";
      });

      map.on("mouseleave", "districts-fill", function() {
        if (hoveredId !== null) map.setFeatureState({ source: "districts", id: hoveredId }, { hover: false });
        hoveredId = null;
        map.getCanvas().style.cursor = "";
      });

      map.on("click", "districts-fill", function(e) {
        if (!e.features || !e.features.length) return;

        if (selectedId !== null) map.setFeatureState({ source: "districts", id: selectedId }, { selected: false });
        selectedId = e.features[0].id;
        map.setFeatureState({ source: "districts", id: selectedId }, { selected: true });

        var geoName = e.features[0].properties.ADM2_EN;
        var apiName = districtNameMapping[geoName] || geoName;
        var d = districtData[apiName];
        var cases = d ? d.cases : 0;
        var riskColor = getRiskColor(cases);
        var displayName = d ? d.displayName : geoName;
        var barPct = Math.min(cases / 150 * 100, 100);

        if (d && d.lat && d.lng) {
          map.flyTo({ center: [d.lng, d.lat], zoom: Math.max(map.getZoom(), 8), duration: 600, essential: true });
        }

        var html = '<div class="popup-header" style="background:' + riskColor + '"></div>';
        html += '<div class="popup-body">';
        html += '<div class="popup-name">' + displayName + '</div>';
        html += '<div class="popup-cases-row"><span class="popup-cases-num" style="color:' + riskColor + '">' + cases + '</span><span class="popup-cases-label">predicted cases</span></div>';
        html += '<div class="popup-badge" style="background:' + riskColor + '20;color:' + riskColor + '">' + getRiskLevel(cases) + ' Risk</div>';
        html += '<div class="popup-bar-track"><div class="popup-bar-fill" style="width:' + barPct + '%;background:' + riskColor + '"></div></div>';
        if (d && (d.temp != null || d.rain != null)) {
          html += '<div class="popup-env">';
          if (d.temp != null) html += '<span>🌡 ' + d.temp.toFixed(1) + '°C</span>';
          if (d.rain != null) html += '<span>🌧 ' + d.rain.toFixed(0) + 'mm</span>';
          html += '</div>';
        }
        html += '</div>';

        popup.setLngLat(e.lngLat).setHTML(html).addTo(map);

        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: "districtTap", apiName: apiName, displayName: displayName, cases: cases
          }));
        }
      });

      map.on("click", function(e) {
        var features = map.queryRenderedFeatures(e.point, { layers: ["districts-fill"] });
        if (!features.length) {
          if (selectedId !== null) {
            map.setFeatureState({ source: "districts", id: selectedId }, { selected: false });
            selectedId = null;
          }
          popup.remove();
          if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: "mapBlankTap" }));
          }
        }
      });

      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: "mapReady" }));
      }
    });

    window.flyToDistrict = function(lat, lng, zoom) {
      map.flyTo({ center: [lng, lat], zoom: zoom || 9, duration: 700, essential: true });
    };
    window.zoomInMap = function() {
      zoomMap(1);
    };
    window.zoomOutMap = function() {
      zoomMap(-1);
    };
    window.resetView = resetView;
    window.clearSelection = function() {
      if (selectedId !== null) {
        map.setFeatureState({ source: "districts", id: selectedId }, { selected: false });
        selectedId = null;
      }
      popup.remove();
    };
  </script>
</body>
</html>`;
}

/* ── Component ────────────────────────────────────────────────────────────── */
export const RiskMapScreen: React.FC = () => {
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [predictions, setPredictions] = useState<DistrictPrediction[]>([]);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isMapReady, setIsMapReady] = useState(false);
  const [isDataReady, setIsDataReady] = useState(false);
  const [spotlightDistrict, setSpotlightDistrict] =
    useState<DistrictPrediction | null>(null);
  const [sheetExpanded, setSheetExpanded] = useState(false);

  const isLandscape = windowWidth > windowHeight;
  const sheetHeight = Math.round(
    Math.min(
      isLandscape ? 420 : 560,
      windowHeight * (isLandscape ? 0.72 : 0.58),
    ),
  );
  const peekHeight = Math.round(
    Math.min(
      isLandscape ? 150 : 184,
      Math.max(
        isLandscape ? 132 : 160,
        windowHeight * (isLandscape ? 0.24 : 0.2),
      ),
    ),
  );
  const collapsedY = Math.max(0, sheetHeight - peekHeight);

  const webViewRef = useRef<WebView>(null);
  const sheetExpandedRef = useRef(false);

  const sheetAnim = useRef(new Animated.Value(collapsedY)).current;
  const headerAnim = useRef(new Animated.Value(0)).current;
  const statsAnim = useRef(new Animated.Value(0)).current;
  const spotlightAnim = useRef(new Animated.Value(0)).current;
  const loadingOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    sheetAnim.setValue(sheetExpandedRef.current ? 0 : collapsedY);
  }, [collapsedY, sheetAnim]);

  /* ── Sheet snap helpers ── */
  const expandSheet = useCallback(() => {
    sheetExpandedRef.current = true;
    setSheetExpanded(true);
    Animated.spring(sheetAnim, {
      toValue: 0,
      ...animation.spring.gentle,
      useNativeDriver: true,
    }).start();
  }, [sheetAnim]);

  const collapseSheet = useCallback(() => {
    sheetExpandedRef.current = false;
    setSheetExpanded(false);
    Animated.spring(sheetAnim, {
      toValue: collapsedY,
      ...animation.spring.gentle,
      useNativeDriver: true,
    }).start();
  }, [sheetAnim, collapsedY]);

  /* ── Drag pan responder (handle-only) ── */
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, gs) =>
          Math.abs(gs.dy) > 5 && Math.abs(gs.dy) > Math.abs(gs.dx),
        onPanResponderMove: (_, gs) => {
          const base = sheetExpandedRef.current ? 0 : collapsedY;
          const next = Math.max(0, Math.min(collapsedY, base + gs.dy));
          sheetAnim.setValue(next);
        },
        onPanResponderRelease: (_, gs) => {
          if (gs.dy < -50 || gs.vy < -0.5) {
            sheetExpandedRef.current = true;
            setSheetExpanded(true);
            Animated.spring(sheetAnim, {
              toValue: 0,
              ...animation.spring.gentle,
              useNativeDriver: true,
            }).start();
          } else if (gs.dy > 50 || gs.vy > 0.5) {
            sheetExpandedRef.current = false;
            setSheetExpanded(false);
            Animated.spring(sheetAnim, {
              toValue: collapsedY,
              ...animation.spring.gentle,
              useNativeDriver: true,
            }).start();
          } else {
            Animated.spring(sheetAnim, {
              toValue: sheetExpandedRef.current ? 0 : collapsedY,
              ...animation.spring.gentle,
              useNativeDriver: true,
            }).start();
          }
        },
      }),
    [collapsedY, sheetAnim],
  );

  /* ── Data fetching ── */
  const fetchData = useCallback(
    async (refresh = false) => {
      if (refresh) {
        setIsRefreshing(true);
        setIsDataReady(false);
      }
      try {
        const [districtRes, summaryRes] = await Promise.allSettled([
          getDistrictLatest(),
          getDashboardSummary(),
        ]);
        if (districtRes.status === "fulfilled") {
          const sorted = [...districtRes.value]
            .filter((d) => d.district?.trim())
            .sort((a, b) => b.predicted_cases - a.predicted_cases);
          setPredictions(sorted);
        }
        if (summaryRes.status === "fulfilled") setSummary(summaryRes.value);
      } catch {
        // silently handle
      } finally {
        setIsDataReady(true);
        if (refresh) {
          setIsRefreshing(false);
        }
        Animated.stagger(100, [
          Animated.timing(headerAnim, {
            toValue: 1,
            duration: 450,
            useNativeDriver: true,
          }),
          Animated.timing(statsAnim, {
            toValue: 1,
            duration: 450,
            useNativeDriver: true,
          }),
        ]).start();
      }
    },
    [headerAnim, statsAnim],
  );

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  /* ── Spotlight entrance animation ── */
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

  /* ── WebView messages ── */
  const handleWebViewMessage = useCallback(
    (event: any) => {
      try {
        const data = JSON.parse(event.nativeEvent.data);
        if (data.type === "mapReady") {
          setIsMapReady(true);
          Animated.timing(loadingOpacity, {
            toValue: 0,
            duration: 400,
            useNativeDriver: true,
          }).start();
        } else if (data.type === "districtTap") {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          const match = predictions.find((p) => p.district === data.apiName);
          if (match) {
            setSpotlightDistrict(match);
            expandSheet();
          }
        } else if (data.type === "popupClose" || data.type === "mapBlankTap") {
          setSpotlightDistrict(null);
          collapseSheet();
        }
      } catch {
        // ignore
      }
    },
    [predictions, expandSheet, collapseSheet, loadingOpacity],
  );

  const dismissSpotlight = useCallback(() => {
    setSpotlightDistrict(null);
    collapseSheet();
    webViewRef.current?.injectJavaScript(
      "window.clearSelection && window.clearSelection(); null;",
    );
  }, [collapseSheet]);

  const handleResetMap = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSpotlightDistrict(null);
    collapseSheet();
    webViewRef.current?.injectJavaScript(
      "window.clearSelection && window.clearSelection(); window.resetView && window.resetView(); null;",
    );
  }, [collapseSheet]);

  const handleZoomIn = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    webViewRef.current?.injectJavaScript(
      "window.zoomInMap && window.zoomInMap(); null;",
    );
  }, []);

  const handleZoomOut = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    webViewRef.current?.injectJavaScript(
      "window.zoomOutMap && window.zoomOutMap(); null;",
    );
  }, []);

  const handleRefresh = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsMapReady(false);
    loadingOpacity.setValue(1);
    await fetchData(true);
  }, [fetchData, loadingOpacity]);

  const flyToDistrict = useCallback((d: DistrictPrediction) => {
    if (d.latitude && d.longitude) {
      webViewRef.current?.injectJavaScript(
        `window.flyToDistrict && window.flyToDistrict(${d.latitude}, ${d.longitude}, 9); null;`,
      );
    }
  }, []);

  const showLoading = predictions.length > 0 ? !isMapReady : !isDataReady;
  const showEmptyState = isDataReady && predictions.length === 0;

  /* ── Stat chips ── */
  const statChips = summary
    ? [
        {
          icon: "virus" as const,
          value: summary.total_cases?.toLocaleString() ?? "—",
          label: "Total Cases",
          color: "#3b82f6",
        },
        {
          icon: "alert-circle" as const,
          value: String(summary.high_risk_districts ?? 0),
          label: "High Risk",
          color: "#dc2626",
        },
        {
          icon: ((summary.change_percent ?? 0) >= 0
            ? "trending-up"
            : "trending-down") as React.ComponentProps<
            typeof MaterialCommunityIcons
          >["name"],
          value: `${(summary.change_percent ?? 0) >= 0 ? "+" : ""}${(summary.change_percent ?? 0).toFixed(1)}%`,
          label: "Change",
          color:
            (summary.change_percent ?? 0) >= 0 ? "#dc2626" : colors.success,
        },
        {
          icon: "map-marker-multiple" as const,
          value: String(summary.district_count ?? 0),
          label: "Districts",
          color: colors.primary,
        },
      ]
    : [];

  const riskLegendItems = [
    { label: "Very High", color: "#7f1d1d" },
    { label: "High", color: "#dc2626" },
    { label: "Medium", color: "#f59e0b" },
    { label: "Low", color: "#b45309" },
    { label: "Very Low", color: "#16a34a" },
  ];

  const sheetBottom = TAB_BAR_HEIGHT + insets.bottom;
  const headerTop = insets.top + spacing.sm;
  const chipsTop = headerTop + 52 + spacing.sm;
  const legendTop = chipsTop + 48;
  const controlsTop = legendTop + 8;
  const mapReadyToShow = predictions.length > 0;

  /* ── Render ── */
  return (
    <View style={styles.container}>
      {/* Full-screen map or empty state */}
      {mapReadyToShow ? (
        <WebView
          ref={webViewRef}
          source={{ html: buildMapHTML(predictions) }}
          style={StyleSheet.absoluteFill}
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
      ) : showEmptyState ? (
        <View style={styles.emptyMapStage}>
          <LinearGradient
            colors={["rgba(0,130,60,0.10)", "rgba(255,255,255,0.65)"]}
            style={styles.emptyMapGlow}
          />
          <View style={styles.emptyMapCard}>
            <View style={styles.emptyMapIconRing}>
              <MaterialCommunityIcons
                name="map-outline"
                size={34}
                color={colors.primary}
              />
            </View>
            <Text style={styles.emptyMapTitle}>
              No district predictions yet
            </Text>
            <Text style={styles.emptyMapText}>
              The live map will appear here as soon as the latest weekly
              district data is available.
            </Text>
            <TouchableOpacity
              style={styles.emptyMapButton}
              onPress={handleRefresh}
            >
              <MaterialCommunityIcons
                name={isRefreshing ? "loading" : "refresh"}
                size={16}
                color="#fff"
              />
              <Text style={styles.emptyMapButtonText}>Try again</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      {/* Loading overlay */}
      <Animated.View
        style={[
          styles.loadingOverlay,
          { opacity: showLoading ? loadingOpacity : 0 },
        ]}
        pointerEvents={showLoading ? "auto" : "none"}
      >
        <View style={styles.loadingIconRing}>
          <MaterialCommunityIcons
            name="map-search-outline"
            size={42}
            color={colors.primary}
          />
        </View>
        <Text style={styles.loadingTitle}>Loading Risk Map</Text>
        <Text style={styles.loadingSubtitle}>
          Fetching district predictions…
        </Text>
        <View style={styles.loadingDots}>
          {[0, 1, 2].map((i) => (
            <View
              key={i}
              style={[styles.loadingDot, i === 1 && styles.loadingDotActive]}
            />
          ))}
        </View>
      </Animated.View>

      {/* Compact legend */}
      {mapReadyToShow && (
        <View
          style={[styles.legendRail, { top: legendTop }]}
          pointerEvents="box-none"
        >
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.legendStrip}
          >
            {riskLegendItems.map((item) => (
              <View key={item.label} style={styles.legendPill}>
                <View
                  style={[styles.legendDot, { backgroundColor: item.color }]}
                />
                <Text style={styles.legendText}>{item.label}</Text>
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Map action rail */}
      {mapReadyToShow && (
        <View style={[styles.mapActionRail, { top: controlsTop }]}>
          <TouchableOpacity
            style={styles.mapActionButton}
            onPress={handleResetMap}
            accessibilityLabel="Reset map view"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <MaterialCommunityIcons
              name="crosshairs-gps"
              size={18}
              color={colors.primary}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.mapActionButton}
            onPress={handleZoomIn}
            accessibilityLabel="Zoom in"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <MaterialCommunityIcons
              name="plus"
              size={18}
              color={colors.primary}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.mapActionButton}
            onPress={handleZoomOut}
            accessibilityLabel="Zoom out"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <MaterialCommunityIcons
              name="minus"
              size={18}
              color={colors.primary}
            />
          </TouchableOpacity>
        </View>
      )}

      {/* Floating header pill */}
      <Animated.View
        style={[
          styles.floatingHeader,
          { top: headerTop },
          {
            opacity: headerAnim,
            transform: [
              {
                translateY: headerAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-16, 0],
                }),
              },
            ],
          },
        ]}
        pointerEvents="box-none"
      >
        <LinearGradient
          colors={["rgba(0,130,60,0.96)", "rgba(0,117,89,0.93)"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.headerPill}
        >
          <View style={styles.headerIconWrap}>
            <MaterialCommunityIcons
              name="shield-alert"
              size={18}
              color="rgba(255,255,255,0.9)"
            />
          </View>
          <View style={styles.headerText}>
            <Text style={styles.headerTitle}>Dengue Risk Map</Text>
            {summary?.current_week && (
              <Text style={styles.headerSub}>
                Week {summary.current_week.week} · {summary.current_week.year}
              </Text>
            )}
          </View>
          <TouchableOpacity
            style={styles.refreshBtn}
            onPress={handleRefresh}
            disabled={isRefreshing}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <MaterialCommunityIcons
              name={isRefreshing ? "loading" : "refresh"}
              size={18}
              color="rgba(255,255,255,0.9)"
            />
          </TouchableOpacity>
        </LinearGradient>
      </Animated.View>

      {/* Floating stat chips */}
      {statChips.length > 0 && (
        <Animated.View
          style={[
            styles.statChipsRow,
            { top: chipsTop },
            {
              opacity: statsAnim,
              transform: [
                {
                  translateY: statsAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [10, 0],
                  }),
                },
              ],
            },
          ]}
          pointerEvents="none"
        >
          {statChips.map((chip) => (
            <View key={chip.label} style={styles.statChip}>
              <MaterialCommunityIcons
                name={chip.icon}
                size={14}
                color={chip.color}
              />
              <Text style={[styles.statChipValue, { color: chip.color }]}>
                {chip.value}
              </Text>
              <Text style={styles.statChipLabel}>{chip.label}</Text>
            </View>
          ))}
        </Animated.View>
      )}

      {/* Bottom sheet */}
      <Animated.View
        style={[
          styles.sheet,
          shadows.lg,
          {
            bottom: sheetBottom,
            height: sheetHeight,
            transform: [{ translateY: sheetAnim }],
          },
        ]}
      >
        {/* Drag handle */}
        <View {...panResponder.panHandlers} style={styles.sheetHandleArea}>
          <View style={styles.handleBar} />
        </View>

        {/* Sheet header */}
        <View style={styles.sheetHeader}>
          <View style={styles.sheetTitleRow}>
            <View style={styles.sheetAccentBar} />
            <Text style={styles.sheetTitle} numberOfLines={1}>
              {spotlightDistrict
                ? (apiToDisplayName[spotlightDistrict.district] ??
                  spotlightDistrict.district)
                : "District Rankings"}
            </Text>
            {!spotlightDistrict && predictions.length > 0 && (
              <View style={styles.countPill}>
                <Text style={styles.countPillText}>{predictions.length}</Text>
              </View>
            )}
          </View>
          <TouchableOpacity
            style={styles.sheetToggleBtn}
            onPress={sheetExpanded ? collapseSheet : expandSheet}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <MaterialCommunityIcons
              name={sheetExpanded ? "chevron-down" : "chevron-up"}
              size={20}
              color={colors.textSecondary}
            />
          </TouchableOpacity>
        </View>

        {/* Spotlight district banner */}
        {spotlightDistrict && (
          <Animated.View
            style={[
              styles.spotlightCard,
              {
                opacity: spotlightAnim,
                transform: [
                  {
                    translateY: spotlightAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [12, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <LinearGradient
              colors={[
                getRiskColor(spotlightDistrict.predicted_cases) + "18",
                getRiskColor(spotlightDistrict.predicted_cases) + "06",
              ]}
              style={styles.spotlightInner}
            >
              <View
                style={[
                  styles.spotlightAccentBar,
                  {
                    backgroundColor: getRiskColor(
                      spotlightDistrict.predicted_cases,
                    ),
                  },
                ]}
              />
              <MaterialCommunityIcons
                name={getRiskIcon(spotlightDistrict.predicted_cases)}
                size={30}
                color={getRiskColor(spotlightDistrict.predicted_cases)}
                style={{ marginLeft: spacing.xs }}
              />
              <View style={styles.spotlightInfo}>
                <View style={styles.spotlightBadgeRow}>
                  <View
                    style={[
                      styles.spotlightDot,
                      {
                        backgroundColor: getRiskColor(
                          spotlightDistrict.predicted_cases,
                        ),
                      },
                    ]}
                  />
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
                <View style={styles.spotlightEnvRow}>
                  {spotlightDistrict.temperature != null && (
                    <View style={styles.spotlightEnvItem}>
                      <MaterialCommunityIcons
                        name="thermometer"
                        size={12}
                        color={colors.textSecondary}
                      />
                      <Text style={styles.spotlightEnvText}>
                        {spotlightDistrict.temperature.toFixed(1)}°C
                      </Text>
                    </View>
                  )}
                  {spotlightDistrict.precipitation != null && (
                    <View style={styles.spotlightEnvItem}>
                      <MaterialCommunityIcons
                        name="water-outline"
                        size={12}
                        color={colors.textSecondary}
                      />
                      <Text style={styles.spotlightEnvText}>
                        {spotlightDistrict.precipitation.toFixed(0)}mm
                      </Text>
                    </View>
                  )}
                </View>
              </View>
              <View style={styles.spotlightCases}>
                <Text
                  style={[
                    styles.spotlightCasesNum,
                    {
                      color: getRiskColor(spotlightDistrict.predicted_cases),
                    },
                  ]}
                >
                  {spotlightDistrict.predicted_cases}
                </Text>
                <Text style={styles.spotlightCasesLabel}>cases</Text>
              </View>
              <TouchableOpacity
                style={styles.spotlightDismiss}
                onPress={dismissSpotlight}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <MaterialCommunityIcons
                  name="close"
                  size={13}
                  color={colors.textSecondary}
                />
              </TouchableOpacity>
            </LinearGradient>
          </Animated.View>
        )}

        {predictions.length === 0 ? (
          <View style={styles.emptySheetState}>
            <MaterialCommunityIcons
              name="map-search-outline"
              size={24}
              color={colors.primary}
            />
            <Text style={styles.emptySheetTitle}>
              Waiting for live district data
            </Text>
            <Text style={styles.emptySheetText}>
              Once the weekly predictions load, rankings and district details
              will appear here.
            </Text>
            <TouchableOpacity
              style={styles.emptySheetButton}
              onPress={handleRefresh}
            >
              <Text style={styles.emptySheetButtonText}>Refresh data</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <ScrollView
            style={styles.rankingsList}
            contentContainerStyle={styles.rankingsContent}
            showsVerticalScrollIndicator={false}
            scrollEnabled={sheetExpanded}
            nestedScrollEnabled
          >
            {predictions.map((d, index) => {
              const riskColor = getRiskColor(d.predicted_cases);
              const riskLevel = getRiskLevel(d.predicted_cases);
              const isSelected = spotlightDistrict?.district === d.district;
              const displayName = apiToDisplayName[d.district] ?? d.district;
              const barPct = Math.min((d.predicted_cases / 150) * 100, 100);

              return (
                <TouchableOpacity
                  key={d.district}
                  style={[
                    styles.rankRow,
                    isSelected && {
                      backgroundColor: riskColor + "0d",
                      borderColor: riskColor + "40",
                    },
                  ]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    if (isSelected) {
                      dismissSpotlight();
                    } else {
                      setSpotlightDistrict(d);
                      flyToDistrict(d);
                      expandSheet();
                    }
                  }}
                  activeOpacity={0.72}
                >
                  {/* Selected left bar */}
                  {isSelected && (
                    <View
                      style={[
                        styles.rankSelectedBar,
                        { backgroundColor: riskColor },
                      ]}
                    />
                  )}

                  {/* Rank badge */}
                  {index < 3 ? (
                    <LinearGradient
                      colors={[riskColor, riskColor + "bb"]}
                      style={styles.rankBadge}
                    >
                      <MaterialCommunityIcons
                        name={
                          index === 0
                            ? "medal"
                            : index === 1
                              ? "medal-outline"
                              : "numeric-3-circle-outline"
                        }
                        size={14}
                        color="#fff"
                      />
                    </LinearGradient>
                  ) : (
                    <View
                      style={[
                        styles.rankBadge,
                        { backgroundColor: colors.muted },
                      ]}
                    >
                      <Text style={styles.rankNumber}>{index + 1}</Text>
                    </View>
                  )}

                  {/* District info */}
                  <View style={styles.rankInfo}>
                    <Text
                      style={[
                        styles.rankName,
                        isSelected && { color: riskColor },
                      ]}
                      numberOfLines={1}
                    >
                      {displayName}
                    </Text>
                    <View style={styles.rankMeta}>
                      {d.temperature != null && (
                        <View style={styles.rankMetaItem}>
                          <MaterialCommunityIcons
                            name="thermometer"
                            size={10}
                            color={colors.textSecondary}
                          />
                          <Text style={styles.rankMetaText}>
                            {d.temperature.toFixed(1)}°C
                          </Text>
                        </View>
                      )}
                      {d.precipitation != null && (
                        <View style={styles.rankMetaItem}>
                          <MaterialCommunityIcons
                            name="water-outline"
                            size={10}
                            color={colors.textSecondary}
                          />
                          <Text style={styles.rankMetaText}>
                            {d.precipitation.toFixed(0)}mm
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>

                  {/* Cases + badge */}
                  <View style={styles.rankRight}>
                    <Text style={[styles.rankCases, { color: riskColor }]}>
                      {d.predicted_cases}
                    </Text>
                    <View
                      style={[
                        styles.riskLabel,
                        { backgroundColor: riskColor + "18" },
                      ]}
                    >
                      <Text
                        style={[styles.riskLabelText, { color: riskColor }]}
                      >
                        {riskLevel}
                      </Text>
                    </View>
                  </View>

                  {/* Progress bar at bottom */}
                  <View style={styles.rankBarTrack}>
                    <View
                      style={[
                        styles.rankBarFill,
                        {
                          width: `${barPct}%` as any,
                          backgroundColor: riskColor,
                        },
                      ]}
                    />
                  </View>
                </TouchableOpacity>
              );
            })}

            {/* Disclaimer */}
            <View style={styles.disclaimer}>
              <MaterialCommunityIcons
                name="information-outline"
                size={13}
                color={colors.textSecondary}
              />
              <Text style={styles.disclaimerText}>
                AI-powered weekly predictions. Consult the Ministry of Health
                for official advisories.
              </Text>
            </View>
          </ScrollView>
        )}
      </Animated.View>
    </View>
  );
};

/* ── Styles ───────────────────────────────────────────────────────────────── */
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  /* Loading */
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  loadingIconRing: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: colors.primary + "12",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  loadingTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text,
  },
  loadingSubtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
  },
  loadingDots: {
    flexDirection: "row",
    gap: 6,
    marginTop: spacing.sm,
  },
  loadingDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: colors.primary + "30",
  },
  loadingDotActive: {
    backgroundColor: colors.primary,
  },

  /* Empty map stage */
  emptyMapStage: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },
  emptyMapGlow: {
    ...StyleSheet.absoluteFillObject,
  },
  emptyMapCard: {
    width: "100%",
    maxWidth: 360,
    alignItems: "center",
    padding: spacing.xl,
    borderRadius: borderRadius["3xl"],
    backgroundColor: "rgba(255,255,255,0.92)",
    borderWidth: 1,
    borderColor: colors.border,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.12,
        shadowRadius: 22,
      },
      android: { elevation: 8 },
    }),
  },
  emptyMapIconRing: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
    backgroundColor: colors.primary + "12",
  },
  emptyMapTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.text,
    textAlign: "center",
  },
  emptyMapText: {
    marginTop: spacing.sm,
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 20,
  },
  emptyMapButton: {
    marginTop: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary,
  },
  emptyMapButtonText: {
    color: "#fff",
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
  },

  /* Map guidance */
  mapGuideCard: {
    position: "absolute",
    left: spacing.md,
    right: 72,
    zIndex: 18,
    padding: spacing.sm,
    borderRadius: borderRadius["2xl"],
    backgroundColor: colors.glass.background,
    borderWidth: 1,
    borderColor: colors.glass.border,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.12,
        shadowRadius: 16,
      },
      android: { elevation: 4 },
    }),
  },
  mapGuideHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  mapGuideIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary + "10",
  },
  mapGuideTextWrap: {
    flex: 1,
  },
  mapGuideTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    color: colors.text,
  },
  mapGuideText: {
    marginTop: 1,
    fontSize: 11,
    color: colors.textSecondary,
  },
  legendStrip: {
    gap: 6,
    paddingRight: spacing.xs,
  },
  legendRail: {
    position: "absolute",
    left: spacing.md,
    right: 72,
    zIndex: 18,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: borderRadius.full,
    backgroundColor: colors.glass.background,
    borderWidth: 1,
    borderColor: colors.glass.border,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.12,
        shadowRadius: 14,
      },
      android: { elevation: 4 },
    }),
  },
  legendPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 10,
    color: colors.textSecondary,
    fontWeight: typography.fontWeight.medium,
  },

  /* Map controls */
  mapActionRail: {
    position: "absolute",
    right: spacing.md,
    zIndex: 18,
    gap: 8,
  },
  mapActionButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.glass.background,
    borderWidth: 1,
    borderColor: colors.glass.border,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.12,
        shadowRadius: 14,
      },
      android: { elevation: 4 },
    }),
  },

  /* Empty sheet */
  emptySheetState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
  },
  emptySheetTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    color: colors.text,
    textAlign: "center",
  },
  emptySheetText: {
    fontSize: typography.fontSize.sm,
    lineHeight: 20,
    color: colors.textSecondary,
    textAlign: "center",
  },
  emptySheetButton: {
    marginTop: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary,
  },
  emptySheetButtonText: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    color: "#fff",
  },

  /* Floating header */
  floatingHeader: {
    position: "absolute",
    left: spacing.md,
    right: spacing.md,
    zIndex: 20,
  },
  headerPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius["2xl"],
    ...Platform.select({
      ios: {
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 12,
      },
      android: { elevation: 8 },
    }),
  },
  headerIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerText: { flex: 1 },
  headerTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    color: "#fff",
  },
  headerSub: {
    fontSize: typography.fontSize.xs,
    color: "rgba(255,255,255,0.72)",
    marginTop: 1,
  },
  refreshBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },

  /* Stat chips */
  statChipsRow: {
    position: "absolute",
    left: spacing.md,
    right: spacing.md,
    flexDirection: "row",
    gap: spacing.xs,
    zIndex: 15,
  },
  statChip: {
    flex: 1,
    alignItems: "center",
    paddingVertical: spacing.sm,
    paddingHorizontal: 4,
    backgroundColor: "rgba(255,255,255,0.93)",
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.5)",
    gap: 2,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 6,
      },
      android: { elevation: 3 },
    }),
  },
  statChipValue: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.bold,
    lineHeight: 16,
  },
  statChipLabel: {
    fontSize: 9,
    color: colors.textSecondary,
    fontWeight: typography.fontWeight.medium,
    textAlign: "center",
  },

  /* Bottom sheet */
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    backgroundColor: "rgba(255,255,255,0.97)",
    borderTopLeftRadius: borderRadius["3xl"],
    borderTopRightRadius: borderRadius["3xl"],
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  sheetHandleArea: {
    alignItems: "center",
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  handleBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  sheetTitleRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  sheetAccentBar: {
    width: 3,
    height: 16,
    borderRadius: 2,
    backgroundColor: colors.primary,
  },
  sheetTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    color: colors.text,
    flex: 1,
  },
  countPill: {
    backgroundColor: colors.primary + "15",
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
  },
  countPillText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    color: colors.primary,
  },
  sheetToggleBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.muted,
    alignItems: "center",
    justifyContent: "center",
  },

  /* Spotlight card */
  spotlightCard: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    borderRadius: borderRadius.xl,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
  },
  spotlightInner: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.md,
    gap: spacing.sm,
  },
  spotlightAccentBar: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
  },
  spotlightInfo: { flex: 1, gap: 4 },
  spotlightBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  spotlightDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  spotlightBadgeText: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
  },
  spotlightEnvRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  spotlightEnvItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  spotlightEnvText: {
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
  },
  spotlightCases: { alignItems: "center" },
  spotlightCasesNum: {
    fontSize: typography.fontSize["2xl"],
    fontWeight: typography.fontWeight.bold,
    lineHeight: 28,
  },
  spotlightCasesLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
  },
  spotlightDismiss: {
    position: "absolute",
    top: spacing.xs,
    right: spacing.xs,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.muted,
    alignItems: "center",
    justifyContent: "center",
  },

  /* Rankings */
  rankingsList: { flex: 1 },
  rankingsContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.lg,
    gap: spacing.xs,
  },
  rankRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm + 2,
    paddingBottom: spacing.sm + 4,
    gap: spacing.sm,
    overflow: "hidden",
  },
  rankSelectedBar: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
  },
  rankBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  rankNumber: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.bold,
    color: colors.textSecondary,
  },
  rankInfo: { flex: 1 },
  rankName: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text,
  },
  rankMeta: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: 2,
  },
  rankMetaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  rankMetaText: {
    fontSize: 10,
    color: colors.textSecondary,
  },
  rankRight: { alignItems: "flex-end", gap: 3 },
  rankCases: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
  },
  riskLabel: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
  },
  riskLabelText: {
    fontSize: 9,
    fontWeight: typography.fontWeight.bold,
  },
  rankBarTrack: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: colors.border,
  },
  rankBarFill: {
    height: "100%",
    borderRadius: 1,
  },

  /* Disclaimer */
  disclaimer: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    marginTop: spacing.xs,
    padding: spacing.md,
    backgroundColor: colors.muted,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  disclaimerText: {
    flex: 1,
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
    lineHeight: 16,
  },
});
