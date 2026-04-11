# EpiLink PHI Mobile App — UI/UX Responsiveness Enhancement Plan

## Executive Summary

The app has a strong design foundation: emerald green palette, gradient headers, animated cards, haptic feedback, and shimmer skeletons. The core design tone stays. This plan targets three specific pain points:

1. **Alert gaps** — bell icon exists but does nothing; no in-app toasts; success actions are silent
2. **Render/interaction lag** — missing `React.memo`, inline component definitions re-create on every render, staggered animations run after data fetch (late entrance), un-memoized map markers
3. **Responsiveness gaps** — hardcoded pixel values, no screen-scale utility, fixed `width: "48%"` grids that break on small screens, tab bar overlap with content on some device heights

All changes preserve the existing visual language. No design overhaul — surgical improvements only.

---

## Part 1 — In-App Alert & Notification System

### 1.1 Toast/Snackbar Component

**Problem:** Successful actions (task status update, evidence upload, route fetch) give no success feedback. Errors are shown only via inline `ErrorMessage`, which gets buried. The `Alert.alert()` for permissions is blocking and jarring.

**Solution:** Build a lightweight `Toast` component backed by a `ToastContext`. No new library required — use `Animated` + `react-native-safe-area-context` insets.

**Files to create:**
- `mobile/src/components/common/Toast.tsx` — animated slide-in banner (bottom)
- `mobile/src/context/ToastContext.tsx` — context + `useToast()` hook

**Toast variants:**
| Variant | Color | Icon | Use case |
|---------|-------|------|----------|
| `success` | `colors.success` | `check-circle` | Task submitted, evidence uploaded |
| `error` | `colors.destructive` | `alert-circle` | API failure, permission denied |
| `warning` | `colors.warning` | `alert` | Overdue task reminder, low GPS accuracy |
| `info` | `colors.primary` | `information` | Route recalculated, data refreshed |

**Behavior:**
- Slides up from bottom, 56px above tab bar
- Auto-dismisses after 3000ms (`success`/`info`) or 5000ms (`error`/`warning`)
- Swipe-down to dismiss (pan gesture)
- Maximum 1 toast visible at a time; queue subsequent ones
- Uses `useNativeDriver: true` for translate animation — zero JS-thread lag

**Implementation sketch:**
```typescript
// context/ToastContext.tsx
export type ToastVariant = 'success' | 'error' | 'warning' | 'info';
export interface ToastOptions {
  message: string;
  variant?: ToastVariant;
  duration?: number;
  action?: { label: string; onPress: () => void };
}
// showToast(options) queued via useReducer
```

**Wire into App.tsx:**
```tsx
// App.tsx — wrap inside SafeAreaProvider
<ToastProvider>
  <RootNavigator />
  <ToastContainer /> {/* renders above everything */}
</ToastProvider>
```

**Where to call `showToast`:**

| Screen | Trigger | Toast |
|--------|---------|-------|
| `TaskDetailScreen` | Status update success | `success` "Task marked as In Progress" |
| `TaskDetailScreen` | Status update error | `error` "Failed to update — tap to retry" |
| `EvidenceUploadScreen` | Upload complete | `success` "Evidence uploaded successfully" |
| `EvidenceUploadScreen` | Upload error | `error` "Upload failed. Check connection." |
| `RouteScreen` | Route optimized | `info` "Route optimized for N stops" |
| `HomeScreen` | Pull-to-refresh complete | `info` "Dashboard updated" |
| `TaskListScreen` | Pull-to-refresh complete | `info` "Task list refreshed" |
| `ProfileScreen` | Logout | no toast (navigates away) |

---

### 1.2 Activate the Bell Button (Notification Center)

**Problem:** `HomeScreen` has a `bellButton` with `TouchableOpacity` but no `onPress` handler — it's a dead UI element. PHIs need to know about newly assigned tasks and high-risk alerts.

**Solution:** Add a `NotificationsScreen` accessible from the bell. Since push notifications require an Expo push token + backend setup, phase this:

**Phase A (immediate, no backend change):**
- Bell navigates to a `NotificationsScreen` within `MainNavigator` (stack screen, hidden from tab bar)
- Screen shows a curated local list derived from existing data:
  - Overdue tasks (from `stats.overdueCount`)
  - High/Very High district risk prediction
  - Rejected tasks (from `stats.rejected`)
- Badge count on bell icon = `stats.overdueCount + stats.rejected`

**Phase B (future):**
- Expo Push Notifications via `expo-notifications`
- Backend emits push on new task assignment, status change by supervisor
- `NotificationsScreen` shows persisted push history from AsyncStorage

**Files to create/modify:**
- `mobile/src/screens/notifications/NotificationsScreen.tsx`
- `mobile/src/navigation/types.ts` — add `Notifications` to `MainStackParamList`
- `mobile/src/navigation/MainNavigator.tsx` — register screen
- `mobile/src/screens/home/HomeScreen.tsx` — wire bell `onPress`, add badge dot

**Bell badge implementation:**
```tsx
// HomeScreen — replace bellButton TouchableOpacity
<TouchableOpacity
  style={styles.bellButton}
  onPress={() => navigation.navigate('Notifications')}
  activeOpacity={0.7}
>
  <MaterialCommunityIcons name="bell-outline" size={22} color="rgba(255,255,255,0.85)" />
  {badgeCount > 0 && (
    <View style={styles.bellBadge}>
      <Text style={styles.bellBadgeText}>
        {badgeCount > 9 ? '9+' : String(badgeCount)}
      </Text>
    </View>
  )}
</TouchableOpacity>
```

---

### 1.3 High-Risk Alert Banner Pulse Animation

**Problem:** The overdue alert banner (`alertBanner`) is static — it blends into the page for urgent scenarios. When risk level is "Very High" or "High", PHIs need a stronger visual cue.

**Solution:** Add a subtle pulse animation to the alert banner border when `overdueCount > 3` or risk level is High/Very High.

```typescript
// Pulse animation on alertBanner borderColor opacity
const pulseAnim = useRef(new Animated.Value(0.2)).current;
useEffect(() => {
  if (stats?.overdueCount > 3) {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.6, duration: 800, useNativeDriver: false }),
        Animated.timing(pulseAnim, { toValue: 0.2, duration: 800, useNativeDriver: false }),
      ])
    ).start();
  }
}, [stats?.overdueCount]);
```

Note: `useNativeDriver: false` required here because `borderColor` is not supported by the native driver. Keep this animation only on the border — all translate/opacity/scale animations keep `useNativeDriver: true`.

---

## Part 2 — Performance & Lag Elimination

### 2.1 Memoize TaskCard and TaskFilters

**Problem:** `TaskCard` and `TaskFilters` are not wrapped in `React.memo`. On every parent re-render (search input typing, filter change), all visible cards re-render even if their task data hasn't changed.

**Solution:**

```typescript
// components/task/TaskCard.tsx
export const TaskCard = React.memo<TaskCardProps>(({ task, onPress }) => {
  // existing implementation
}, (prev, next) => prev.task.id === next.task.id && prev.task.status === next.task.status);

// components/task/TaskFilters.tsx
export const TaskFilters = React.memo<TaskFiltersProps>(({ value, onChange }) => {
  // existing implementation
});
```

The custom comparator on `TaskCard` means a card only re-renders when its own task's status changes — not when other tasks in the list update.

---

### 2.2 Move ActionCard Out of HomeScreen Render Function

**Problem:** `ActionCard` is defined as a functional component **inside** `HomeScreen` (line 196–246 of `HomeScreen.tsx`). This means React creates a new component type on every render of `HomeScreen`, causing all three action cards to **fully unmount and remount** instead of re-rendering. This defeats `useRef` animations inside `ActionCard`.

**Solution:** Hoist `ActionCard` to module scope (outside `HomeScreen`):

```typescript
// At module level, before HomeScreen
const ActionCard: React.FC<ActionCardProps> = React.memo(({ icon, label, color, onPress }) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  // ... existing press handlers
});
```

This is the single highest-impact change for HomeScreen lag.

---

### 2.3 Stabilize useTasks / useCallback Dependencies

**Problem:** In `HomeScreen`, `fetchData` depends on 6 `Animated.Value` refs listed in `useCallback` deps array (lines 122–131). `Animated.Value` refs never change identity, so they should not be in deps. This causes no extra re-renders but adds unnecessary noise and risks future bugs if someone adds a non-ref dep.

**Solution:** Remove `Animated.Value` refs from `useCallback` dependency arrays — they are stable refs:

```typescript
const fetchData = useCallback(async (refresh = false) => {
  // ... unchanged
}, [user?.district]); // Only actual data dependency
```

---

### 2.4 Defer Entrance Animations from Data Fetch

**Problem:** In `HomeScreen.fetchData`, entrance animations start inside the `finally` block, meaning animations only begin **after** the API response. On slow connections, the screen shows a blank loading state for 2-5 seconds, then everything animates in. Users on fast connections see it too quickly to appreciate the stagger.

**Solution:** Start header entrance animation immediately on mount (before fetch), and animate content sections as their data arrives:

```typescript
useEffect(() => {
  // Header fades in immediately — no data needed
  Animated.timing(fadeHeader, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  fetchData();
}, []);

// In fetchData, after stats loaded:
Animated.parallel([
  Animated.timing(fadeStats, { toValue: 1, duration: 400, useNativeDriver: true }),
  Animated.spring(slideStats, { toValue: 0, ...animation.spring.gentle, useNativeDriver: true }),
]).start();
```

This makes the app feel instantly responsive even on slow API connections.

---

### 2.5 FlatList Optimization in TaskListScreen

**Problem:** `TaskListScreen` uses `FlatList` but is missing key render optimization props.

**Add these props:**
```tsx
<FlatList
  data={filteredTasks}
  keyExtractor={(item) => item.id}
  renderItem={({ item, index }) => (
    <TaskCard task={item} onPress={handleTaskPress} index={index} />
  )}
  // Add these:
  removeClippedSubviews={true}        // unmount off-screen items (Android)
  maxToRenderPerBatch={8}             // reduce initial render batch size
  windowSize={5}                      // keep 5 viewport windows in memory
  initialNumToRender={6}              // render 6 items on first pass
  getItemLayout={getItemLayout}       // skip dynamic measurement if card height is fixed
/>
```

**`getItemLayout` for TaskCard** (measure card height once, hardcode it):
```typescript
const TASK_CARD_HEIGHT = 120; // measure actual height
const getItemLayout = (_: any, index: number) => ({
  length: TASK_CARD_HEIGHT,
  offset: TASK_CARD_HEIGHT * index,
  index,
});
```

---

### 2.6 TaskMap Marker Memoization

**Problem:** `TaskMapScreen` already uses `useMemo` for markers, but re-creates the entire marker array when any task changes. Map re-rendering with many markers is expensive.

**Solution:** Memoize per-marker, not the whole array:

```typescript
// Memoize each marker's callout content separately
// Use React.memo on custom MapMarker components if using custom callouts
const MemoizedMarker = React.memo(TaskMapMarker, (p, n) => p.task.id === n.task.id && p.task.status === n.task.status);
```

Also add `tracksViewChanges={false}` to `Marker` components once their content is set — this stops the native map from continuously re-rendering unchanged markers:

```tsx
<Marker
  key={task.id}
  coordinate={...}
  tracksViewChanges={false}  // critical for map performance
>
```

---

### 2.7 Eliminate Redundant API Calls on Tab Refocus

**Problem:** Each tab navigation triggers a fresh `useEffect(() => { fetchData() })` re-run because `useCallback` recreates `fetchData` on route change. This causes visible loading flickers when switching between tabs.

**Solution:** Add a simple stale-time gate:

```typescript
const lastFetchTime = useRef<number>(0);
const STALE_TIME_MS = 30_000; // 30 seconds

const fetchData = useCallback(async (refresh = false) => {
  const now = Date.now();
  if (!refresh && now - lastFetchTime.current < STALE_TIME_MS) return;
  lastFetchTime.current = now;
  // ... rest of fetch
}, [user?.district]);
```

---

## Part 3 — Responsive Layout Fixes

### 3.1 Screen Dimensions Utility

**Problem:** Many pixel values are hardcoded (e.g., `decorCircle1: width: 140`, `avatarCircle: width/height: 52`, `actionIcon: width/height: 50`). These look correct on an iPhone 14 Pro (390pt wide) but are proportionally too large on small devices (320pt) and too small on tablets (768pt+).

**Solution:** Create a `responsive.ts` utility:

```typescript
// mobile/src/utils/responsive.ts
import { Dimensions, PixelRatio } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const BASE_WIDTH = 390; // iPhone 14 Pro reference

export const scale = (size: number) =>
  Math.round((SCREEN_WIDTH / BASE_WIDTH) * size);

export const verticalScale = (size: number) =>
  Math.round((SCREEN_HEIGHT / 844) * size); // 844 = iPhone 14 Pro height

export const moderateScale = (size: number, factor = 0.5) =>
  Math.round(size + (scale(size) - size) * factor);

export const isSmallDevice = SCREEN_WIDTH < 375;
export const isTablet = SCREEN_WIDTH >= 768;

export const hp = (percent: number) => (SCREEN_HEIGHT * percent) / 100;
export const wp = (percent: number) => (SCREEN_WIDTH * percent) / 100;
```

**Apply to HomeScreen:**
```typescript
// Replace hardcoded pixels with scaled values
decorCircle1: { width: scale(140), height: scale(140), borderRadius: scale(70) },
avatarCircle: { width: scale(52), height: scale(52), borderRadius: scale(26) },
actionIcon: { width: scale(50), height: scale(50), borderRadius: scale(25) },
statIconCircle: { width: scale(42), height: scale(42), borderRadius: scale(21) },
```

---

### 3.2 Fix Stats Grid on Small Devices

**Problem:** `statsGrid` uses `width: "48%"` (line 764 of `HomeScreen.tsx`). On 320pt-wide devices (iPhone SE 1st gen, some Android budget devices), this causes cards to slightly overflow or compress icon text.

**Solution:** Use `Dimensions`-aware column calculation:

```typescript
import { Dimensions } from 'react-native';
const { width } = Dimensions.get('window');
const CARD_GAP = spacing.sm;
const HORIZONTAL_PADDING = spacing.lg * 2;
const CARD_WIDTH = (width - HORIZONTAL_PADDING - CARD_GAP) / 2;

// In StyleSheet:
statCard: {
  width: CARD_WIDTH,
  // remove flexBasis: "46%" and width: "48%"
}
```

---

### 3.3 Tab Bar Content Overlap Fix

**Problem:** The custom floating tab bar overlaps the bottom of `ScrollView` content on devices with small screens or non-standard safe area insets. The current `paddingBottom: spacing.xl` (32px) in `scrollContent` is insufficient for tab bar height + safe area on some Android devices.

**Solution:** Calculate tab bar height dynamically using safe area insets:

```typescript
// In screens that use ScrollView
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const insets = useSafeAreaInsets();
const TAB_BAR_HEIGHT = 70; // measured from CustomTabBar
const scrollPaddingBottom = TAB_BAR_HEIGHT + insets.bottom + spacing.lg;

// Apply:
<ScrollView contentContainerStyle={{ paddingBottom: scrollPaddingBottom }}>
```

Apply this to: `HomeScreen`, `TaskListScreen`, `RiskMapScreen`, `RouteScreen`, `ProfileScreen`.

---

### 3.4 Typography Scaling for Accessibility

**Problem:** All font sizes are fixed pixel values from `typography.ts`. Users with OS-level large text accessibility settings see no scaling.

**Solution:** Respect system font scaling with a cap to prevent layout breakage:

```typescript
// mobile/src/utils/responsive.ts — add to existing utility
import { Text, TextProps } from 'react-native';

// Wrapper that allows system font scaling but caps at 1.3x
export const accessibleFontSize = (size: number) =>
  Math.min(size * PixelRatio.getFontScale(), size * 1.3);
```

Apply to critical labels (task titles, status badges, counter values) while leaving decorative text (role pill, district banner) at fixed sizes.

---

### 3.5 Gradient Header Height Adaptation

**Problem:** `gradientHeader` in `HomeScreen` uses fixed `paddingBottom: spacing.xl` (32px). On tall devices (iPhone 14 Pro Max at 932pt height), the header feels undersized. On short devices (iPhone SE at 667pt), it crowds the content.

**Solution:**

```typescript
import { Dimensions } from 'react-native';
const { height } = Dimensions.get('window');
const headerPaddingBottom = height > 800 ? spacing.xxl : spacing.xl;

// In StyleSheet:
gradientHeader: {
  paddingBottom: headerPaddingBottom,
  // rest unchanged
}
```

---

## Part 4 — User Interactivity Improvements

### 4.1 Skeleton Screens for All Loading States

**Problem:** `HomeScreen` shows a blank white screen while loading (no skeleton). Only `TaskListScreen` has shimmer skeletons. First load on `HomeScreen`, `ProfileScreen`, and `RouteScreen` shows nothing.

**Solution:** Add skeleton variants for each screen:

**`HomeScreen` skeleton:**
```
┌─────────────────────────────────┐  ← shimmer gradient header block (120px)
├────────┬────────┬────────┬──────┤  ← 4 stat card shimmers (2×2 grid)
├─────────────────────────────────┤  ← risk card shimmer
├────────┬────────┬───────────────┤  ← 3 action card shimmers
└─────────────────────────────────┘
```

Create `HomeScreenSkeleton` component using existing `ShimmerPlaceholder`.

**`RouteScreen` skeleton:** 3-4 shimmer route stop cards.

**`ProfileScreen` skeleton:** Avatar circle + 2 label shimmers.

---

### 4.2 Empty State Illustrations

**Problem:** When no tasks match a filter, only a text message appears ("No tasks found for this filter"). This is visually empty and provides no helpful action.

**Solution:** Add contextual empty states with icon + message + CTA:

```tsx
// components/common/EmptyState.tsx
interface EmptyStateProps {
  icon: string;              // MaterialCommunityIcons name
  title: string;
  subtitle?: string;
  action?: { label: string; onPress: () => void };
}

// Usage in TaskListScreen:
<EmptyState
  icon="clipboard-check-outline"
  title="No tasks found"
  subtitle="Try a different filter or pull to refresh"
  action={{ label: "View All Tasks", onPress: () => setFilter('all') }}
/>
```

Apply to: `TaskListScreen` (all filter variants), `TaskMapScreen` (no tasks near location), `RouteScreen` (no stops).

---

### 4.3 Swipe-to-Filter on TaskListScreen

**Problem:** Filter chips require precise taps. On small screens, the `TaskFilters` horizontal scroll bar is hard to interact with while walking (field use case).

**Solution:** Add swipe left/right gesture on the main task list to cycle through filters:

```typescript
import { PanResponder } from 'react-native';

const FILTERS: TaskFilterValue[] = ['all', 'assigned', 'in_progress', 'submitted', 'completed'];

const panResponder = PanResponder.create({
  onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dx) > 20 && Math.abs(gs.dy) < 10,
  onPanResponderRelease: (_, gs) => {
    if (gs.dx < -50) cycleFilter(+1); // swipe left → next filter
    if (gs.dx > 50) cycleFilter(-1);  // swipe right → prev filter
    Haptics.selectionAsync();
  },
});
```

---

### 4.4 Long-Press Context Menu on TaskCard

**Problem:** Common actions (view details, mark in progress) require navigating into task detail. For PHIs with many tasks, reducing taps speeds up workflows.

**Solution:** Long-press on `TaskCard` shows a bottom action sheet with:
- "View Details" → navigate to `TaskDetail`  
- "Mark In Progress" (if status is `assigned`) → direct API call + toast
- "View on Map" → navigate to `TaskMap` with task pre-selected

Use `react-native-paper`'s `Portal` + `Modal` (already a dependency) for the action sheet. No new package needed.

```typescript
// In TaskCard.tsx
<TouchableOpacity
  onPress={() => onPress(task)}
  onLongPress={() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setShowActions(true);
  }}
  delayLongPress={300}
>
```

---

### 4.5 Progress Indicator on Evidence Upload

**Problem:** `EvidenceUploadScreen` shows a numeric `{uploadProgress}%` but no visual progress bar. Users uploading a large photo (4-8MB) see a number changing with no sense of completion.

**Solution:** Replace or augment the text counter with an animated progress bar:

```tsx
// Animated width from 0 → 100%
const progressWidth = useRef(new Animated.Value(0)).current;

useEffect(() => {
  Animated.timing(progressWidth, {
    toValue: uploadProgress,
    duration: 200,
    useNativeDriver: false, // width animation requires JS driver
  }).start();
}, [uploadProgress]);

// Render:
<View style={styles.progressTrack}>
  <Animated.View
    style={[
      styles.progressFill,
      { width: progressWidth.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }) }
    ]}
  />
</View>
<Text>{uploadProgress}%</Text>
```

---

### 4.6 Keyboard-Aware Input Handling

**Problem:** On screens with text inputs (`LoginScreen`, `TaskListScreen` search), the keyboard covers the input or submit button on small devices. `LoginScreen` mitigates this with `KeyboardAvoidingView` but the search bar in `TaskListScreen` has no such handling.

**Solution:**

```typescript
// TaskListScreen — wrap FlatList section in KeyboardAvoidingView
import { KeyboardAvoidingView, Platform } from 'react-native';

<KeyboardAvoidingView
  behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
  keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
>
  <FlatList ... />
</KeyboardAvoidingView>
```

Also add `returnKeyType="search"` and `blurOnSubmit={true}` to the search `Input` in `TaskListScreen`.

---

## Part 5 — Implementation Priority Order

| Priority | Change | Impact | Effort | File(s) |
|----------|--------|--------|--------|---------|
| **P0** | Hoist `ActionCard` out of `HomeScreen` render | Eliminates remount lag | 5 min | `HomeScreen.tsx` |
| **P0** | `React.memo` on `TaskCard` + `TaskFilters` | Eliminates list re-render lag | 10 min | `TaskCard.tsx`, `TaskFilters.tsx` |
| **P0** | `tracksViewChanges={false}` on map markers | Eliminates map pan lag | 5 min | `TaskMapScreen.tsx` |
| **P1** | Toast system (`ToastContext` + `Toast` component) | Closes biggest UX feedback gap | 2 hr | New files + 5 screens |
| **P1** | `responsive.ts` utility + apply to `HomeScreen` | Fixes small device layout | 1 hr | New util + `HomeScreen.tsx` |
| **P1** | ScrollView `paddingBottom` with insets | Fixes tab bar overlap | 30 min | 5 screens |
| **P1** | Defer entrance animations (header on mount) | App feels instant | 20 min | `HomeScreen.tsx` |
| **P1** | Stale-time gate on `fetchData` | Eliminates tab-switch flicker | 30 min | `HomeScreen.tsx`, `TaskListScreen.tsx` |
| **P2** | Bell badge + `NotificationsScreen` | Activates dead UI element | 3 hr | New screen + navigation |
| **P2** | `HomeScreen` skeleton | Eliminates blank first load | 1 hr | New component |
| **P2** | Empty state component | Better empty list UX | 1 hr | New component + 3 screens |
| **P2** | Evidence upload progress bar | Visual upload feedback | 30 min | `EvidenceUploadScreen.tsx` |
| **P2** | FlatList optimization props | Smoother long lists | 20 min | `TaskListScreen.tsx` |
| **P3** | Long-press context menu on `TaskCard` | Fewer taps for common actions | 2 hr | `TaskCard.tsx` |
| **P3** | Swipe-to-filter on task list | Field-use ergonomics | 1 hr | `TaskListScreen.tsx` |
| **P3** | Typography accessibility scaling | Accessibility compliance | 1 hr | `responsive.ts` + theme |
| **P3** | High-risk pulse animation | Urgent alert visibility | 30 min | `HomeScreen.tsx` |
| **P3** | `KeyboardAvoidingView` on search | Small device keyboard UX | 20 min | `TaskListScreen.tsx` |

---

## Part 6 — Files Overview

### New Files
```
mobile/src/
├── components/common/
│   ├── Toast.tsx                  # Toast banner component
│   └── EmptyState.tsx             # Empty state with icon + CTA
├── context/
│   └── ToastContext.tsx           # Toast queue context + useToast hook
├── screens/
│   └── notifications/
│       └── NotificationsScreen.tsx  # Bell notification center
└── utils/
    └── responsive.ts              # Scale utilities + device size helpers
```

### Modified Files
```
mobile/src/
├── App.tsx                        # Wrap with ToastProvider
├── navigation/
│   ├── types.ts                   # Add Notifications to MainStackParamList
│   └── MainNavigator.tsx          # Register NotificationsScreen
├── components/task/
│   ├── TaskCard.tsx               # React.memo + long-press actions
│   └── TaskFilters.tsx            # React.memo
├── screens/home/
│   └── HomeScreen.tsx             # Hoist ActionCard, defer animations, bell badge, stale gate, responsive scaling
├── screens/tasks/
│   ├── TaskListScreen.tsx         # FlatList opts, stale gate, keyboard aware, swipe filter, empty state
│   ├── TaskDetailScreen.tsx       # showToast on status update
│   ├── EvidenceUploadScreen.tsx   # showToast on upload, animated progress bar
│   ├── TaskMapScreen.tsx          # tracksViewChanges={false}, memoized markers
│   └── RouteScreen.tsx            # showToast on route fetch, skeleton, scrollPadding
└── screens/profile/
    └── ProfileScreen.tsx          # scrollPadding fix, skeleton
```

---

## Notes on What NOT to Change

- The emerald green palette, gradient headers, and glassmorphic tab bar — keep as-is
- The `Animated.stagger` entrance sequences — only make them start earlier, not remove them
- The haptic feedback pattern — already well implemented across the app
- The shimmer skeleton design in `ShimmerCardSkeleton` — reuse it for new skeleton screens
- `react-native-paper` usage — don't introduce another component library; use Paper's `Portal`/`Modal` for action sheets
- The Axios interceptor error handling — the global 401 clear is correct; don't move it to per-call handlers
