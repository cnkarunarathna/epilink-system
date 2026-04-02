# Analytics Dashboard UX Enhancement Plan

## Problem Analysis

The current admin analytics page has a **two-level nested tab system** that forces admins to make at minimum two clicks to reach any analytical interface, and loses context when switching between them.

### Current Navigation Tree

```
/admin/analytics
└── Outer Tabs (grid-cols-3)
    ├── Current Predictions        ← loads immediately
    │   └── Inner Tabs (grid-cols-4)
    │       ├── Overview           ← map + top 10 + 12-week trend
    │       ├── Advanced Analytics ← alerts + hotspots + weather
    │       ├── AI Insights        ← explainable + advanced panels
    │       └── District Analysis  ← full district grid + bar chart
    ├── Historical Analytics       ← dynamically imports /historical/page
    └── National Report            ← NationalSummaryPanel only
```

### Core Pain Points

1. **Double-click navigation**: Admins must first pick an outer tab, then an inner tab. Reaching "AI Insights" requires 2 clicks from any other section.

2. **Context fragmentation**: Selecting a district on the map (Overview inner tab) and then clicking the Sparkles "Explain This" button jumps the admin to the AI Insights inner tab — but the map is gone. There is no persistent district context panel visible across tab switches.

3. **Historical Analytics creates disorientation**: It is embedded as an outer tab via a dynamic import of a completely separate route (`/historical/page`). The nested tabs inside Historical (District Comparison, Seasonal Pattern, Weather Impact, Yearly Summary) add a third de facto level to the hierarchy.

4. **National Report is isolated**: A single panel component occupies an entire outer tab slot, given equal visual weight to tabs containing 4–5 panels each.

5. **No spatial anchor while scrolling**: Once inside a tab, the header/metrics bar scrolls away. There is no persistent summary strip to anchor the admin's context while reading charts deep in the page.

6. **Floating chat bubble competes for attention**: `FloatingChatBubble` renders over content with no spatial relationship to the data being discussed.

---

## Proposed Layout Architecture

### 1. Collapse to a Single-Level Left Navigation Rail

Replace the two outer/inner tab layers with a **vertical icon + label nav rail** fixed on the left side of the analytics page. Every analytical view becomes a direct, one-click destination.

```
┌─────────────────────────────────────────────────────────────────┐
│  [sticky metrics bar — total cases / high-risk / week / temp]   │
├──────────┬──────────────────────────────────────────────────────┤
│  Nav     │                                                        │
│  Rail    │   Active Panel Content                                 │
│          │                                                        │
│  ○ Map   │                                                        │
│  ○ Trend │                                                        │
│  ○ Alert │                                                        │
│  ○ Hot   │                                                        │
│  ○ AI    │                                                        │
│  ○ Hist  │                                                        │
│  ○ Natl  │                                                        │
│          │                                                        │
└──────────┴──────────────────────────────────────────────────────┘
```

**Nav rail entries (7 panels, all one click away):**

| Label | Icon | Current location |
|---|---|---|
| Risk Map | `MapPin` | Overview inner tab |
| Trends | `TrendingUp` | Overview inner tab (12-week chart + top-10) |
| Alerts | `AlertTriangle` | Advanced inner tab |
| Hotspots | `Zap` | Advanced inner tab |
| AI Insights | `Brain` | AI Insights inner tab |
| Historical | `History` | Historical outer tab |
| National | `Globe` | National outer tab |

The District Analysis inner tab content (full district grid) can merge into the Risk Map panel as a collapsible sidebar panel beside the map.

---

### 2. Persistent District Context Strip

When a district is selected (from the map, top-10 list, or any panel), a **slim context strip** appears pinned beneath the sticky metrics bar:

```
┌──────────────────────────────────────────────────────┐
│  📍 Colombo  ·  142 cases  ·  Very High  ·  [✕ Clear]│
└──────────────────────────────────────────────────────┘
```

This strip persists as the admin navigates between panels. The AI Insights panel, Historical panel, and Advanced panels each read `selectedDistrict` from it and automatically pre-select/scope their data to that district. Clicking "Explain This" on the top-10 list navigates to AI Insights **and** keeps the district context visible — no more context loss on tab switch.

---

### 3. Sticky Metrics Bar

Move the four key metric cards (Total Cases, High Risk Districts, Districts Covered, Avg Temperature) into a **compact horizontal strip** pinned below the page header. It stays visible regardless of which panel is active or how far the admin has scrolled.

```
┌────────────────┬────────────────┬────────────────┬────────────────┐
│  Total Cases   │  High Risk     │  Districts     │  Avg Temp      │
│  1,284  ▲4.2%  │  8  districts  │  25  covered   │  29.3°C        │
└────────────────┴────────────────┴────────────────┴────────────────┘
```

This removes the need to scroll back to the top to recall the current week's summary.

---

### 4. Inline Chat Drawer (Replace Floating Bubble)

Replace `FloatingChatBubble` with a **slide-in drawer** anchored to the right edge of the analytics layout. A persistent icon button in the nav rail opens/closes it. The drawer renders at 380px wide alongside the current panel content rather than overlapping it.

When a district is selected, the drawer opens with that district pre-loaded in the chat context. This connects the conversational AI directly to the map or panel the admin is currently viewing.

---

### 5. Historical Panel: Integrated Tabs (Not a Separate Route)

Instead of dynamically importing the entire `/historical/page` route as a tab, render the four historical sub-panels (District Comparison, Seasonal Pattern, Weather Impact, Yearly Summary) as **horizontal scroll tabs within the Historical panel**. This keeps all analytics within one route with a consistent layout shell and eliminates the route-switch flash on first load.

The district context strip feeds the selected district into the District Comparison and Weather Impact tabs automatically.

---

## Implementation Plan

### Phase 1 — Layout Restructure

**Files to modify:**
- [frontend/app/(dashboard)/admin/analytics/page.tsx](frontend/app/(dashboard)/admin/analytics/page.tsx) — primary changes

**Steps:**

1. **Add `activePanel` state** replacing the current `innerTab` + outer `Tabs` component. Type it as a union of the 7 panel keys: `"map" | "trends" | "alerts" | "hotspots" | "ai" | "historical" | "national"`.

2. **Build the nav rail component** (inline in the page or extracted to `components/dashboard/analytics/AnalyticsNavRail.tsx`). Use a vertical `div` with `w-14` collapsed / `w-44` expanded states (toggle on hover or a pin button). Each item: icon + label, `active` highlight using `bg-primary/10 text-primary`.

3. **Build the sticky metrics bar** as a component extracted to `components/dashboard/analytics/AnalyticsMetricsBar.tsx`. Accepts the `summary` prop. Use `position: sticky; top: 0` with `z-10` and `backdrop-blur`.

4. **Build the district context strip** as `components/dashboard/analytics/DistrictContextStrip.tsx`. Accepts `district`, `prediction`, `onClear`. Render between metrics bar and panel area. Pass `selectedDistrict` down to all panels that use it.

5. **Replace `<Tabs>` structure** in the return JSX with a two-column layout: `<nav rail> | <panel area>`. Conditionally render each panel based on `activePanel`.

6. **Move "District Analysis" content** (the full 25-district grid) into the Risk Map panel as a collapsible list beside the map (`md:grid-cols-[1fr_320px]`).

### Phase 2 — Chat Drawer

**Files to modify / create:**
- [frontend/components/dashboard/analytics/FloatingChatBubble.tsx](frontend/components/dashboard/analytics/FloatingChatBubble.tsx) — add drawer mode variant
- [frontend/app/(dashboard)/admin/analytics/page.tsx](frontend/app/(dashboard)/admin/analytics/page.tsx) — integrate drawer state

**Steps:**

1. Add a `mode: "floating" | "drawer"` prop to `FloatingChatBubble`. In drawer mode, render inside a `Sheet` (Radix `SheetContent` side="right") instead of a fixed-position overlay.

2. Add a chat toggle button as the last item in the nav rail (icon: `MessageSquare`).

3. Pass `selectedDistrict` into the drawer so it pre-populates the chat context.

### Phase 3 — Historical Panel Integration

**Files to modify:**
- [frontend/app/(dashboard)/admin/analytics/page.tsx](frontend/app/(dashboard)/admin/analytics/page.tsx) — remove dynamic import, inline historical tabs
- [frontend/app/(dashboard)/admin/analytics/historical/page.tsx](frontend/app/(dashboard)/admin/analytics/historical/page.tsx) — keep as standalone route, extract sub-panels into shared components if not already

**Steps:**

1. Import the four historical tab components directly:
   ```ts
   import DistrictComparisonTab from "@/components/dashboard/historical/DistrictComparisonTab";
   import SeasonalPatternTab from "@/components/dashboard/historical/SeasonalPatternTab";
   import WeatherImpactTab from "@/components/dashboard/historical/WeatherImpactTab";
   import YearlySummaryTab from "@/components/dashboard/historical/YearlySummaryTab";
   ```

2. Render them inside the Historical panel using a standard `<Tabs>` (horizontal, `grid-cols-4`) — this is a single-level tab system within one panel, which is acceptable and matches the existing historical page.

3. Remove the `dynamic(() => import("./historical/page"))` call. The standalone `/historical` route can still exist for deep-linking.

---

## Summary of Changes

| What changes | Why |
|---|---|
| 2-level nested tabs → 1-level nav rail | Every panel is one click away; no cognitive overhead of "which outer tab am I in" |
| Outer tabs removed | Nav rail replaces them with clearer spatial layout |
| Floating chat → slide-in drawer | Chat doesn't obscure charts; is spatially tied to analytics layout |
| District context strip | Maintains selected district context across all panel switches |
| Sticky metrics bar | Key numbers always visible; no scroll-to-top to check current week |
| Historical dynamic import → inline | Eliminates route-switch flash; consistent layout shell |
| District Analysis merged into Risk Map | Reduces panel count; district list and map are naturally co-located |

No new routes, no new libraries (Radix `Sheet` already installed), no backend changes required.
