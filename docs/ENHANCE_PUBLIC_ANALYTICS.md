# Public Analytics Enhancement Plan
## Making Dengue Risk Data Understandable for Everyone

**Goal**: Transform the current technically-oriented public risk dashboard into a clear, actionable, and reassuring experience for general public users who have no background in epidemiology, statistics, or data science.

---

## Current State Analysis

### What Exists Today

The `/risk-map` page provides three analysis tabs backed by real AI/ML predictions:

| Tab | Content | Problem for Public Users |
|-----|---------|--------------------------|
| **Risk Map** | Interactive map, top-10 list, district trend table | "Predicted cases" number has no context — is 50 bad? |
| **Predictions & Trends** | 12-week bar chart, outbreak alerts, hotspots, growth rate panel | "Growth rate", "hotspot", "outbreak alert" — jargon-heavy |
| **Weather & Analysis** | Correlation scatter plots, correlation tables, district comparison bars | "Correlation coefficient" is meaningless to most users |

### Core Problems

1. **No plain-language explanations** — metrics are shown without "what this means for you"
2. **Jargon overload** — "growth rate", "correlation", "hotspot", "outbreak alert severity" are technical terms
3. **No action guidance** — users see risk but have no idea what to do about it
4. **Complex chart types** — scatter plots and correlation tables require data literacy
5. **Numbers without context** — "47 predicted cases" — is that a lot? For which population?
6. **No personal relevance** — no way to quickly find your district's risk
7. **Overwhelming information density** — three dense tabs with many panels
8. **No narrative summary** — users must interpret data themselves

---

## Enhancement Principles

1. **Lead with meaning, not numbers** — tell users what the data implies before showing the data
2. **Use everyday language** — replace every technical term with a phrase a 12-year-old understands
3. **Show one thing at a time** — progressive disclosure, not wall-of-data
4. **Always answer "what should I do?"** — every risk level maps to concrete advice
5. **Make it personal** — district search/lookup first, national picture second
6. **Use visual metaphors** — traffic lights, thermometers, weather icons over bar charts

---

## Phase 1 — Plain Language & Messaging Overhaul ✅ DONE
**Goal**: Replace technical labels and jargon with clear, human-readable language throughout the existing UI without changing layout.
**Effort**: ~1 week | **Impact**: High | **Status**: Completed 2026-04-19

### 1.1 Rename Metrics & Labels

| Current Label | Replacement Label | Notes |
|--------------|-------------------|-------|
| `Predicted Cases` | `Expected dengue cases this week` | Add "(estimated)" badge |
| `High Risk Districts` | `Districts to watch closely` | Less alarming framing |
| `Average Temperature` | `Current heat level (avg. °C)` | Add weather icon |
| `Growth Rate` | `Is dengue spreading or slowing?` | Use ↑ Spreading / ↓ Slowing |
| `Hotspots` | `Areas with sudden rise in cases` | Human description |
| `Outbreak Alert` | `Health Warning` | Familiar public-health term |
| `Correlation` | Remove from public view entirely | Move to admin-only tab |
| `Trend` | `How cases changed over time` | Explicit |
| `Timeseries` | `Week-by-week history` | Plain English |
| `Forecast Week` | `Week of [date range]` | Show actual calendar dates |

### 1.2 Add Contextual Subtitles to All Metric Cards

Each metric card in the hero row should have a two-line treatment:
- **Line 1 (large)**: The number/value
- **Line 2 (small, muted)**: A sentence explaining what it means

Example:
```
┌─────────────────────────────────┐
│  247                            │
│  Expected dengue cases          │
│  nationwide this week           │
│  ─────────────────────────────  │
│  This is the AI model's         │
│  estimate. Actual reported cases│
│  may be lower or higher.        │
└─────────────────────────────────┘
```

### 1.3 Replace Risk Level Badge Language

| Current | Replacement | Color Guidance |
|---------|-------------|---------------|
| `Very High` | `Very High Risk — Take precautions now` | Red |
| `High` | `High Risk — Stay alert` | Orange-red |
| `Medium` | `Moderate Risk — Stay cautious` | Amber |
| `Low` | `Low Risk — Normal vigilance` | Yellow-green |
| `Very Low` | `Minimal Risk — Situation is calm` | Green |

### 1.4 Add a "Plain English Summary" Banner

Add a dynamically generated text summary at the very top of the risk map page, above all tabs.

Example output (generated from API data):
> **This week, dengue risk is elevated in 6 out of 25 districts.** Colombo, Gampaha, and Kandy are the areas with the highest number of expected cases. If you live in or are travelling to these areas, take extra precautions against mosquito bites.

**Implementation**: Create a `PublicSummaryBanner` component that receives `summary` data from `fetchPublicDashboardSummary()` and renders a paragraph using a template.

**File to create**: `frontend/components/public/PublicSummaryBanner.tsx`

---

## Phase 2 — Visual Simplification
**Goal**: Replace or supplement complex visualizations with intuitive, icon-based, and story-driven visuals.
**Effort**: ~2 weeks | **Impact**: High

### 2.1 Redesign the "Predictions & Trends" Tab

**Current**: 12-week bar chart (raw numbers), outlet alerts panel, hotspots panel, growth rate panel — all shown simultaneously.

**Replacement**: A single unified "Story" view with three cards in sequence:

**Card A — The Trend Story**
Replace the 12-week bar chart with an annotated area chart:
- Use `<AreaChart>` from Recharts with gradient fill
- X-axis: Actual calendar week labels (e.g., "Jan 12", "Jan 19") instead of "W1", "W2"
- Add an annotation line for the "national average" to give context
- Add call-out labels for peaks: "Highest point this period"
- **Hide** raw numbers on the chart; show them only in tooltip on hover

```
frontend/components/public/TrendStoryChart.tsx
```

**Card B — Districts to Watch**
Replace the `HotspotsPanel` and `GrowthRatePanel` (which show growth %, coordinates, technical severity) with:
- A simple ranked list: "Top 5 areas with rising cases"
- Each item: district name + one-line plain English status + colored dot
- "Gampaha — Cases rose sharply this week. Stay alert."
- "Matara — Cases are declining. Situation improving."

```
frontend/components/public/DistrictWatchList.tsx
```

**Card C — Health Warnings**
Redesign `OutbreakAlerts` for public:
- Remove severity levels (critical/high/moderate/low)
- Use only two states: ⚠️ **Watch** and 🔴 **Warning**
- Add a "What to do" expandable section per alert
- When no alerts: show a calm green "✓ No major health warnings this week"

```
frontend/components/public/PublicHealthWarnings.tsx
```

### 2.2 Remove/Replace the "Weather & Analysis" Tab

The weather correlation scatter plot and correlation tables are appropriate for health professionals, not the public. Replace the entire tab with:

**New Tab: "Protect Yourself"**

Three simple sections:

**Section A — Why dengue rises in certain weather**
A visual explainer card (no data) with icon illustrations:
- 🌧️ Rain + 🌡️ Heat = 🦟 More mosquitoes = ⚠️ More dengue risk
- One paragraph of plain text explaining the seasonal pattern

**Section B — District Risk Table (simplified)**
Replace the 3-column grid of district cards (which shows raw case numbers) with:
- A searchable list sorted by risk level
- Each row: District name | Risk traffic light (🔴🟠🟡🟢) | Simple status phrase
- No case numbers visible by default (show on expand/click)

```
frontend/components/public/DistrictRiskTable.tsx
```

**Section C — Prevention Checklist**
Static content (no data dependency):
- A simple checklist of dengue prevention measures
- Adapted based on the current national risk level (high = more urgent language)

```
frontend/components/public/PreventionChecklist.tsx
```

### 2.3 Improve the Map Legend

Current legend uses hex color codes internally and labels like "Very High (≥100)". Replace with:

| Color Swatch | Label | What It Means |
|------|-------|----------------|
| 🔴 Deep Red | Very High Risk | Take strong precautions |
| 🟠 Orange | High Risk | Stay alert |
| 🟡 Amber | Moderate Risk | Be cautious |
| 🟢 Light Green | Low Risk | Normal care |
| 💚 Green | Minimal Risk | Situation is calm |

Remove case number thresholds (≥100, 50-99) from the public legend — these numbers confuse rather than inform.

**File to edit**: `frontend/components/dashboard/maps/SriLankaMap.tsx` — add a `publicMode` prop that switches legend rendering.

### 2.4 Add a "Your District" Quick-Lookup

Add a search bar above the map:
```
┌──────────────────────────────────────────────┐
│  🔍  Find your district...             [Go]  │
└──────────────────────────────────────────────┘
```

On selection, the map zooms to the district, highlights it, and shows a summary panel:
```
┌─────────────────────────────────┐
│  📍 Colombo                     │
│  Risk Level: 🔴 High Risk       │
│  "Cases are elevated this week. │
│   Take extra precautions."      │
│                                 │
│  [What should I do? ▼]          │
└─────────────────────────────────┘
```

**File to create**: `frontend/components/public/DistrictSearchBar.tsx`
**File to edit**: `frontend/app/risk-map/page.tsx` — wire district selection state

---

## Phase 3 — Guided Experience & Onboarding
**Goal**: Orient new visitors and make the page intuitive without any instruction.
**Effort**: ~1 week | **Impact**: Medium

### 3.1 Add a "How to Use This Page" Intro Panel

Show once per session (dismissible). Three simple steps with icons:

```
┌─────────────────────────────────────────────────────┐
│  How to use this dengue risk map                    │
│                                                     │
│  1. 🔍 Search your district to see local risk       │
│  2. 🗺️ Click any district on the map for details   │
│  3. ✅ Read what precautions to take                │
│                                          [Got it]   │
└─────────────────────────────────────────────────────┘
```

**File to create**: `frontend/components/public/OnboardingBanner.tsx`
Uses `sessionStorage` to show only once.

### 3.2 Redesign Tab Labels

Current tabs: "Risk Map" | "Predictions & Trends" | "Weather & Analysis"

New tabs (more action-oriented):
- **"Risk Map"** → **"Where is dengue now?"**
- **"Predictions & Trends"** → **"Is it getting better or worse?"**
- **"Weather & Analysis"** → **"How can I protect myself?"**

**File to edit**: `frontend/app/risk-map/page.tsx` — Lines 326-354 (tab definitions)

### 3.3 Add Inline Explanation Tooltips

For any remaining metric that might confuse (e.g., "AI-predicted" labels), add a small `ℹ️` icon that shows a plain-language tooltip on hover/tap:

- "AI-predicted ℹ️" → tooltip: "Our computer model estimates this number based on past data and weather patterns. It is not an official government figure."
- "Week 14 ℹ️" → tooltip: "This refers to the 14th week of the year, from [date] to [date]."

**File to create**: `frontend/components/public/InfoTooltip.tsx`

### 3.4 Add a "Last Updated" Indicator

Clearly show data freshness at the top of the page:

```
📅 Data last updated: Sunday, April 13, 2026 — Updates every week
```

This builds trust and sets expectations. Currently the data update timing is mentioned only in the hero section in small text.

---

## Phase 4 — Actionable Health Guidance
**Goal**: Ensure every user knows exactly what to do based on their district's risk level.
**Effort**: ~1 week | **Impact**: High (most practically useful phase)

### 4.1 Risk-Level Action Cards

Create a reusable `ActionGuidance` component that maps risk levels to specific recommendations:

**Very High / High Risk:**
```
🔴 High Dengue Risk in Your Area

What to do:
✓ Use mosquito repellent (DEET-based) daily
✓ Wear long sleeves and pants during dawn and dusk
✓ Empty any standing water around your home
✓ Use mosquito nets at night
✓ Seek medical attention immediately if you have fever

[More prevention tips →]
```

**Moderate Risk:**
```
🟡 Moderate Dengue Risk — Stay Cautious

What to do:
✓ Check for and remove standing water weekly
✓ Use repellent when outdoors
✓ Monitor for fever symptoms

[Prevention tips →]
```

**Low / Minimal Risk:**
```
🟢 Low Dengue Risk — Stay Prepared

Dengue is always present in Sri Lanka. Keep these habits year-round:
✓ Regular home inspection for standing water
✓ Repellent when in forested or low-lying areas
```

**File to create**: `frontend/components/public/ActionGuidance.tsx`
**File to edit**: `frontend/app/risk-map/page.tsx` — render `ActionGuidance` in district details panel

### 4.2 National Alert Level Indicator

Add a prominent "National Dengue Status" indicator to the page header, similar to a weather index:

```
┌─────────────────────────────────────┐
│  🇱🇰 National Dengue Status         │
│  ████████░░  ELEVATED               │
│  6 of 25 districts are high risk    │
└─────────────────────────────────────┘
```

Uses a simple 5-level scale: Calm → Low → Elevated → High → Critical

Derived from the ratio of high-risk districts to total districts.

**File to create**: `frontend/components/public/NationalStatusBar.tsx`

### 4.3 Link to Official Health Resources

Add a "Need help?" section at the bottom of each risk tab:

```
Need more information?
📞 Epidemiology Unit Hotline: 0800-448-448
🌐 Health Ministry Dengue Page: [Link]
🏥 Find your nearest dengue treatment center: [Link]
```

---

## Phase 5 — Mobile & Accessibility
**Goal**: Ensure the enhanced experience works well on mobile phones (the primary device for most Sri Lankan public users) and meets basic accessibility standards.
**Effort**: ~1 week | **Impact**: Medium-High

### 5.1 Mobile-First Map Experience

The current map requires mouse hover for tooltips, which doesn't work on touch devices. Changes:
- Replace hover tooltips with tap-to-select behavior (already partially implemented)
- Move the district details panel below the map on mobile (not side-by-side)
- Make the legend collapsible on mobile to save vertical space
- Add a "View List Instead" toggle that shows the top-10 list instead of the map for small screens

**File to edit**: `frontend/components/dashboard/maps/SriLankaMap.tsx`

### 5.2 Simplified Mobile Tab Layout

On screens < 768px:
- Stack all tab content vertically in a single scroll (remove tabs entirely)
- Show sections in order: Summary Banner → District Lookup → Map → Trend Story → Health Warnings → Protection Tips
- This eliminates the cognitive overhead of tab navigation for mobile users

**File to edit**: `frontend/app/risk-map/page.tsx` — add responsive rendering logic

### 5.3 Color Accessibility

Current risk colors (red/amber/yellow/green) rely solely on color to convey meaning. Add:
- Pattern fills on map for color-blind users (diagonal stripes for high risk, dots for low)
- Text labels inside map districts at higher zoom levels
- Ensure all text passes WCAG AA contrast ratio (4.5:1 minimum)

**File to edit**: `frontend/components/dashboard/maps/SriLankaMap.tsx`

### 5.4 Screen Reader Support

- Add `aria-label` to all map interactive elements
- Add `role="status"` to the summary banner so screen readers announce updates
- Ensure all chart data is also available as a text table (visually hidden)

---

## Implementation Order & Priority

```
Phase 1: Language & Messaging       ████████████ Week 1        (No new UI, highest ROI)
Phase 2: Visual Simplification      ████████████████████ Weeks 2-3
Phase 4: Actionable Guidance        ████████████ Week 4        (High user value)
Phase 3: Guided Experience          ████████ Week 5
Phase 5: Mobile & Accessibility     ████████ Week 6
```

> Phase 4 is moved before Phase 3 in implementation order because actionable guidance has more immediate user value than onboarding UX. Phase 3 (onboarding) is polish after the core content is improved.

---

## Files to Create (New)

| File | Purpose |
|------|---------|
| `frontend/components/public/PublicSummaryBanner.tsx` | Dynamic plain-English summary at top of page |
| `frontend/components/public/TrendStoryChart.tsx` | Annotated area chart replacing raw bar chart |
| `frontend/components/public/DistrictWatchList.tsx` | Plain-English district status list |
| `frontend/components/public/PublicHealthWarnings.tsx` | Simplified health warnings (⚠️ Watch / 🔴 Warning) |
| `frontend/components/public/DistrictRiskTable.tsx` | Searchable district list with traffic-light risk |
| `frontend/components/public/PreventionChecklist.tsx` | Static dengue prevention tips |
| `frontend/components/public/DistrictSearchBar.tsx` | "Find your district" quick-lookup |
| `frontend/components/public/OnboardingBanner.tsx` | First-visit how-to guide (session-dismissed) |
| `frontend/components/public/InfoTooltip.tsx` | Reusable ℹ️ plain-language tooltip |
| `frontend/components/public/ActionGuidance.tsx` | Risk-level-specific action recommendations |
| `frontend/components/public/NationalStatusBar.tsx` | National dengue status level indicator |

## Files to Modify (Existing)

| File | Change |
|------|--------|
| `frontend/app/risk-map/page.tsx` | Tab labels, district search state, banner integration |
| `frontend/components/dashboard/maps/SriLankaMap.tsx` | `publicMode` prop for simplified legend |
| `frontend/components/dashboard/analytics/OutbreakAlerts.tsx` | `publicMode` prop for simplified severity |
| `frontend/components/dashboard/analytics/HotspotsPanel.tsx` | Replace with `DistrictWatchList` in public view |
| `frontend/components/dashboard/analytics/GrowthRatePanel.tsx` | Replace with `DistrictWatchList` in public view |
| `frontend/components/dashboard/analytics/WeatherCorrelation.tsx` | Remove from public tab entirely |

---

## Success Metrics

After implementation, the following should be measurable improvements:

| Metric | Target |
|--------|--------|
| Average time to find district risk level | < 10 seconds (from page load) |
| Users who scroll past first tab | > 60% (up from estimated ~20%) |
| Bounce rate from risk-map page | Reduced by 30% |
| User comprehension of risk level | 90%+ can correctly identify their district's risk after 1 visit |
| Mobile usability score | > 85 on Lighthouse mobile audit |

---

## Notes & Constraints

- **Do not remove data** — all existing API endpoints and data continue to power the page; only the presentation layer changes
- **Admin/PHI views unchanged** — these enhancements are for the public `/risk-map` route only; authenticated dashboards remain as-is
- **Preserve the map** — the interactive Sri Lanka map is the centerpiece and should stay; simplify around it, not replace it
- **No new API endpoints needed** — all data required for Phases 1-4 is already available via existing public analytics endpoints
- **Weather correlation data** — moved out of public view but remains available via API for future authenticated views or reporting
