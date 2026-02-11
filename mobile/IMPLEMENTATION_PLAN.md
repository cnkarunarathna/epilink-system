# EpiLink PHI Mobile App - Implementation Plan

## 📱 Overview

This document outlines the comprehensive implementation plan for the EpiLink PHI (Public Health Inspector) Mobile Application built with React Native and Expo. The app provides field officers with task management, evidence collection, route optimization, and real-time notifications.

---

## 🎨 Design System & Theme

### Color Palette (Matching Frontend)

Based on the web dashboard's design system in `frontend/app/globals.css`:

#### Light Theme

```javascript
colors: {
  // Primary - Rich emerald green for health, vitality
  primary: 'oklch(0.52 0.16 155)',       // #10b981 equivalent
  primaryForeground: 'oklch(0.99 0 0)', // White text

  // Secondary - Sage green for calm
  secondary: 'oklch(0.94 0.025 145)',
  secondaryForeground: 'oklch(0.25 0.04 150)',

  // Background & Surface
  background: 'oklch(0.995 0.002 120)',  // Nearly white with green tint
  card: 'oklch(1 0 0)',                  // Pure white

  // Muted - Soft green-tinted grays
  muted: 'oklch(0.97 0.008 140)',
  mutedForeground: 'oklch(0.52 0.015 145)',

  // Accent - Bright lime for highlights
  accent: 'oklch(0.95 0.04 145)',
  accentForeground: 'oklch(0.28 0.1 150)',

  // Destructive - Vibrant red-orange for warnings
  destructive: 'oklch(0.55 0.22 27)',    // #ef4444 equivalent

  // Borders
  border: 'oklch(0.91 0.012 145)',
  input: 'oklch(0.91 0.012 145)',

  // Status Colors
  success: '#10b981',   // Green
  warning: '#f59e0b',   // Amber
  error: '#ef4444',     // Red
  info: '#3b82f6',      // Blue
}
```

#### Dark Theme

```javascript
colors: {
  primary: 'oklch(0.68 0.2 155)',        // Brighter emerald
  primaryForeground: 'oklch(0.1 0.015 150)',

  background: 'oklch(0.14 0.015 150)',   // Dark green-tinted
  card: 'oklch(0.17 0.018 150)',

  muted: 'oklch(0.21 0.018 150)',
  mutedForeground: 'oklch(0.66 0.015 145)',

  border: 'oklch(0.24 0.025 150)',
}
```

### Typography

- **Font Family**: System font (San Francisco on iOS, Roboto on Android)
- **Headings**: Semi-bold (600)
- **Body**: Regular (400)
- **Captions**: Regular (400), smaller size

### Spacing Scale

```javascript
spacing: {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
}
```

---

## 🏗️ Project Structure

```
mobile/
├── App.tsx                      # Root component with providers
├── app.json                     # Expo configuration
├── package.json                 # Dependencies
├── tsconfig.json               # TypeScript config
├── .env                        # Environment variables
├── assets/                     # Static assets
│   ├── images/
│   ├── icons/
│   └── fonts/
└── src/
    ├── api/                    # API client & services
    │   ├── client.ts          # Axios instance with interceptors
    │   ├── authService.ts     # Authentication API
    │   ├── taskService.ts     # Tasks API
    │   ├── evidenceService.ts # Evidence upload API
    │   ├── geocodingService.ts # Geocoding API
    │   └── types.ts           # API type definitions
    │
    ├── components/             # Reusable components
    │   ├── common/
    │   │   ├── Button.tsx
    │   │   ├── Card.tsx
    │   │   ├── Input.tsx
    │   │   ├── Badge.tsx
    │   │   ├── StatusBadge.tsx
    │   │   ├── Loading.tsx
    │   │   └── ErrorMessage.tsx
    │   ├── task/
    │   │   ├── TaskCard.tsx
    │   │   ├── TaskListItem.tsx
    │   │   ├── TaskDetailHeader.tsx
    │   │   ├── TaskStatusStepper.tsx
    │   │   └── TaskFilters.tsx
    │   ├── evidence/
    │   │   ├── EvidenceItem.tsx
    │   │   ├── EvidenceList.tsx
    │   │   ├── CameraCapture.tsx
    │   │   └── PhotoPreview.tsx
    │   └── map/
    │       ├── LocationMap.tsx
    │       ├── RouteMap.tsx
    │       └── MarkerPin.tsx
    │
    ├── context/                # React Context providers
    │   ├── AuthContext.tsx    # Authentication state
    │   └── TaskContext.tsx    # Task management state
    │
    ├── hooks/                  # Custom React hooks
    │   ├── useAuth.ts         # Authentication hook
    │   ├── useTasks.ts        # Tasks fetching & management
    │   ├── useLocation.ts     # GPS location tracking
    │   ├── useCamera.ts       # Camera access
    │   └── useNotifications.ts # Push notifications
    │
    ├── navigation/             # Navigation configuration
    │   ├── RootNavigator.tsx  # Root stack navigator
    │   ├── AuthNavigator.tsx  # Auth flow (Login)
    │   ├── MainNavigator.tsx  # Main app (Bottom tabs)
    │   └── types.ts           # Navigation type definitions
    │
    ├── screens/                # Screen components
    │   ├── auth/
    │   │   ├── LoginScreen.tsx
    │   │   └── SplashScreen.tsx
    │   ├── tasks/
    │   │   ├── TaskListScreen.tsx
    │   │   ├── TaskDetailScreen.tsx
    │   │   └── TaskMapScreen.tsx
    │   ├── evidence/
    │   │   ├── CameraScreen.tsx
    │   │   ├── EvidenceReviewScreen.tsx
    │   │   └── EvidenceUploadScreen.tsx
    │   ├── profile/
    │   │   └── ProfileScreen.tsx
    │   └── notifications/
    │       └── NotificationsScreen.tsx
    │
    ├── theme/                  # Theme configuration
    │   ├── colors.ts          # Color palette
    │   ├── typography.ts      # Font styles
    │   ├── spacing.ts         # Spacing values
    │   └── index.ts           # Theme provider
    │
    ├── types/                  # TypeScript definitions
    │   ├── task.types.ts      # Task entity types
    │   ├── evidence.types.ts  # Evidence types
    │   ├── user.types.ts      # User types
    │   └── api.types.ts       # API response types
    │
    └── utils/                  # Utility functions
        ├── storage.ts         # AsyncStorage helpers
        ├── validation.ts      # Form validation
        ├── dateFormatter.ts   # Date formatting
        ├── permissions.ts     # Device permissions
        └── constants.ts       # App constants
```

---

## 📦 Dependencies & Libraries

### Core Dependencies

```json
{
  "expo": "~54.0.33",
  "react": "19.1.0",
  "react-native": "0.81.5",
  "typescript": "~5.9.2"
}
```

### Navigation

```json
{
  "@react-navigation/native": "^7.0.0",
  "@react-navigation/native-stack": "^7.0.0",
  "@react-navigation/bottom-tabs": "^7.0.0",
  "react-native-screens": "^4.4.0",
  "react-native-safe-area-context": "^5.1.1"
}
```

### UI & Design

```json
{
  "react-native-paper": "^5.12.5",
  "react-native-vector-icons": "^10.2.0",
  "@react-native-community/datetimepicker": "^8.2.0",
  "react-native-gesture-handler": "~2.23.0",
  "react-native-reanimated": "~3.18.0"
}
```

### Maps & Location

```json
{
  "react-native-maps": "^1.20.0",
  "expo-location": "~18.0.7",
  "react-native-geolocation-service": "^5.3.1"
}
```

### Camera & Media

```json
{
  "expo-camera": "~16.0.19",
  "expo-image-picker": "~16.0.4",
  "expo-image-manipulator": "~13.0.5",
  "react-native-image-resizer": "^3.0.10"
}
```

### Notifications

```json
{
  "expo-notifications": "~0.30.0",
  "expo-device": "~7.0.2"
}
```

### HTTP & Storage

```json
{
  "axios": "^1.7.0",
  "@react-native-async-storage/async-storage": "^2.1.0"
}
```

### Forms & Validation

```json
{
  "react-hook-form": "^7.54.0",
  "zod": "^3.24.1",
  "@hookform/resolvers": "^3.9.1"
}
```

### Utils

```json
{
  "date-fns": "^3.0.0",
  "lodash": "^4.17.21"
}
```

---

## 🔐 Authentication Flow

### Implementation Details

#### 1. **Login Screen** (`screens/auth/LoginScreen.tsx`)

- Email & password input with validation
- "Remember Me" checkbox for persistent login
- Loading state during authentication
- Error handling with user-friendly messages
- Biometric authentication option (future enhancement)

#### 2. **Auth Context** (`context/AuthContext.tsx`)

```typescript
interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<void>;
}
```

#### 3. **Token Management**

- Store JWT in AsyncStorage
- Automatic token refresh on app start
- Axios interceptor for attaching token
- Handle 401 responses by logging out
- Token expiry checking

#### 4. **API Endpoints Used**

- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Validate token & get user info
- `POST /api/auth/logout` - Logout (optional)

---

## 📋 Task Management Module

### Implementation Details

#### 1. **Task List Screen** (`screens/tasks/TaskListScreen.tsx`)

**Features:**

- Pull-to-refresh for updating task list
- Filter by status (All, Assigned, In Progress, Submitted)
- Search by title or location
- Sort by priority, due date, created date
- Badge indicators for overdue tasks
- Empty state when no tasks

**API Endpoint:**

- `GET /api/tasks?assignedPhiId={userId}&status={status}`

**UI Components:**

- `TaskCard` - Individual task preview
- `TaskFilters` - Filter chips at top
- Search bar with debounced query

#### 2. **Task Detail Screen** (`screens/tasks/TaskDetailScreen.tsx`)

**Features:**

- Task type badge (Cleanup, Fogging, Inspection, Investigation)
- Priority indicator (Low, Medium, High, Urgent)
- Full task description
- Address with map preview
- Due date with countdown
- Current status with stepper visualization
- Action buttons based on status:
  - **Assigned**: "Start Task" → Changes status to IN_PROGRESS
  - **In Progress**: "Submit Task" → Requires evidence upload
  - **Submitted**: View only (waiting for verification)
  - **Rejected**: View rejection reason, "Restart Task"
  - **Completed**: View only

**API Endpoints:**

- `GET /api/tasks/:id` - Get task details
- `PATCH /api/tasks/:id/status` - Update task status
- `GET /api/tasks/:id/evidence` - Get evidence for task

**Status Workflow:**

```
ASSIGNED → IN_PROGRESS → SUBMITTED → VERIFIED → COMPLETED
                ↓
           REJECTED (with reason) → IN_PROGRESS (restart)
```

#### 3. **Task Map Screen** (`screens/tasks/TaskMapScreen.tsx`)

**Features:**

- Map view with all assigned task locations
- Color-coded markers by status:
  - 🔵 Blue: Assigned
  - 🟡 Yellow: In Progress
  - 🟢 Green: Completed
  - 🔴 Red: Overdue
- Tap marker to see task preview
- "Navigate" button opens Google Maps/Apple Maps
- Current location indicator
- Cluster markers when zoomed out

**Dependencies:**

- `react-native-maps`
- `expo-location`

---

## 📸 Evidence Collection Module

### Implementation Details

#### 1. **Camera Screen** (`screens/evidence/CameraScreen.tsx`)

**Features:**

- Full-screen camera view
- Capture button with loading state
- Flash toggle
- Front/back camera switch
- Grid overlay for alignment (optional)
- Review captured photo before submitting

**Permissions Required:**

- Camera access
- Location access (for GPS tagging)

**Dependencies:**

- `expo-camera`
- `expo-location`

#### 2. **Evidence Upload Screen** (`screens/evidence/EvidenceUploadScreen.tsx`)

**Features:**

- Multi-photo upload (up to 5 images per task)
- Photo thumbnails with delete option
- Notes text area (optional, max 1000 chars)
- Automatic GPS tagging
- GPS coordinates display
- Image compression before upload (max 10MB)
- Upload progress indicator
- Offline queue (store locally, upload when online)

**API Endpoint:**

- `POST /api/tasks/:taskId/evidence`

**Request Body:**

```typescript
{
  imageUrl: string,      // Base64 or uploaded S3 URL
  notes?: string,
  latitude?: number,
  longitude?: number
}
```

#### 3. **Evidence Review Screen** (`screens/evidence/EvidenceReviewScreen.tsx`)

**Features:**

- List of all evidence submitted for a task
- Photo gallery view
- Evidence status:
  - 🟡 Pending verification
  - ✅ Approved
  - ❌ Rejected (with reason)
- Submission timestamp
- GPS location on map

---

## 🗺️ Route Optimization (Future Feature)

### Implementation Plan

#### 1. **Route Optimization Service** (`api/routeService.ts`)

**Features:**

- Fetch all task locations for the day
- Calculate optimal route using Traveling Salesman Problem (TSP) algorithm
- Integration with OpenRouteService API
- Return ordered list of tasks with distance/time estimates

**Algorithm:**

- Use Nearest Neighbor heuristic or Genetic Algorithm
- Consider task priority and due dates
- Optimize for shortest distance or shortest time

#### 2. **Optimized Route Screen**

**Features:**

- Display optimized route on map with numbered waypoints
- Turn-by-turn navigation preview
- Estimated total distance and time
- Reorder tasks manually if needed
- "Start Navigation" button

**External API:**

- OpenRouteService API for directions
- Fallback to Google Maps Directions API

---

## 🔔 Push Notifications

### Implementation Details

#### 1. **Notification Setup** (`utils/notifications.ts`)

**Features:**

- Request notification permissions on first launch
- Register device for push notifications
- Handle notification token and send to backend
- Listen for incoming notifications
- Navigate to relevant screen when tapped

**Notification Types:**

- **New Task Assigned**: "You've been assigned a new cleanup task in Colombo"
- **Task Overdue**: "Your inspection task at Location X is overdue"
- **Evidence Rejected**: "Your evidence for Task Y was rejected"
- **Task Reminder**: "You have 2 pending tasks due today"

#### 2. **API Integration**

**Endpoints:**

- `POST /api/users/:id/device-token` - Register device token
- Backend sends notifications via Firebase Cloud Messaging (FCM) or Expo Push Notifications

**Dependencies:**

- `expo-notifications`
- `expo-device`

---

## 🌐 Offline Support

### Implementation Strategy

#### 1. **Data Caching**

- Cache task list locally using AsyncStorage
- Sync on app start and pull-to-refresh
- Show cached data when offline with banner indicator

#### 2. **Offline Queue**

- Queue evidence uploads when offline
- Store photos and metadata locally
- Auto-upload when connection restored
- Show upload queue in UI

#### 3. **Sync Indicator**

- "Offline" banner at top of screen
- "Syncing..." indicator when uploading
- Success/failure toast messages

---

## 🔧 Development Phases

### Phase 1: Foundation (Week 1-2)

- [x] Setup project structure and install dependencies
- [x] Implement theme system matching frontend
- [x] Configure navigation (auth & main stacks)
- [x] Build API client with interceptors
- [x] Implement authentication flow
- [x] Create reusable UI components (Button, Card, Input, Badge)

### Phase 2: Task Management (Week 3-4)

- [ ] Build Task List Screen with filters
- [ ] Build Task Detail Screen
- [ ] Implement task status workflow
- [ ] Add pull-to-refresh and search
- [ ] Build Task Map Screen with markers
- [ ] Integrate location services

### Phase 3: Evidence Collection (Week 5-6)

- [ ] Implement Camera Screen
- [ ] Build photo capture and preview
- [ ] Implement Evidence Upload Screen
- [ ] Add image compression
- [ ] Build Evidence Review Screen
- [ ] Implement offline queue for uploads

### Phase 4: Notifications & Polish (Week 7-8)

- [ ] Setup push notifications
- [ ] Implement notification handlers
- [ ] Add loading states and error handling
- [ ] Implement offline support
- [ ] Add accessibility features
- [ ] Testing on iOS and Android devices

### Phase 5: Advanced Features (Future)

- [ ] Route optimization with TSP algorithm
- [ ] Turn-by-turn navigation
- [ ] Biometric authentication
- [ ] Dark mode toggle in settings
- [ ] Performance monitoring
- [ ] Analytics tracking

---

## 🧪 Testing Strategy

### Unit Tests

- API service functions
- Utility functions (date formatting, validation)
- Custom hooks

### Integration Tests

- Authentication flow
- Task CRUD operations
- Evidence upload workflow

### E2E Tests

- Login to task list flow
- Complete task with evidence upload
- Offline sync behavior

### Testing Tools

- Jest for unit tests
- React Native Testing Library
- Detox for E2E tests

---

## 📱 Device Permissions

### Required Permissions

#### iOS (`Info.plist`)

```xml
<key>NSCameraUsageDescription</key>
<string>EpiLink needs camera access to capture evidence photos</string>

<key>NSLocationWhenInUseUsageDescription</key>
<string>EpiLink needs location access to tag evidence with GPS coordinates</string>

<key>NSPhotoLibraryUsageDescription</key>
<string>EpiLink needs photo library access to select images</string>
```

#### Android (`AndroidManifest.xml`)

```xml
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" />
<uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" />
```

---

## 🔐 Security Considerations

1. **Token Storage**: Use `expo-secure-store` for sensitive data (production)
2. **HTTPS Only**: Enforce HTTPS for all API calls
3. **Certificate Pinning**: Implement in production build
4. **Photo Privacy**: Strip EXIF metadata except GPS (if needed)
5. **Biometric Auth**: Add Face ID/Touch ID for quick login
6. **App Lock**: Auto-lock after inactivity
7. **Secure Camera**: Prevent screenshots of sensitive screens

---

## 🚀 Deployment

### Development Build

```bash
# Install dependencies
npm install

# Start Expo development server
npm start

# Run on iOS simulator
npm run ios

# Run on Android emulator
npm run android
```

### Production Build

#### iOS (TestFlight)

```bash
# Build iOS app
eas build --platform ios --profile production

# Submit to TestFlight
eas submit --platform ios
```

#### Android (Google Play Console)

```bash
# Build Android APK/AAB
eas build --platform android --profile production

# Submit to Play Store
eas submit --platform android
```

### Environment Variables (`.env`)

```env
API_BASE_URL=https://api.epilink.gov.lk/api
EXPO_PUBLIC_API_URL=https://api.epilink.gov.lk/api
GOOGLE_MAPS_API_KEY=your_key_here
OPENROUTE_API_KEY=your_key_here
```

### EAS Configuration (`eas.json`)

```json
{
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal",
      "android": {
        "buildType": "apk"
      }
    },
    "production": {
      "android": {
        "buildType": "aab"
      }
    }
  },
  "submit": {
    "production": {}
  }
}
```

---

## 📊 Performance Optimization

1. **Image Optimization**
   - Compress images to < 1MB before upload
   - Use `react-native-fast-image` for caching
   - Lazy load images in lists

2. **List Performance**
   - Use `FlatList` with `windowSize` optimization
   - Implement `getItemLayout` for fixed-height items
   - Use `React.memo` for TaskCard components

3. **API Caching**
   - Implement SWR (stale-while-revalidate) pattern
   - Cache task list for 5 minutes
   - Prefetch task details on list mount

4. **Memory Management**
   - Release camera resources when screen unmounts
   - Clear image cache periodically
   - Lazy load map markers

---

## 🎯 Success Metrics

### Key Performance Indicators (KPIs)

- **Task Completion Rate**: % of assigned tasks completed within deadline
- **Evidence Upload Success Rate**: % of evidence uploads without errors
- **App Crash Rate**: < 1% of sessions
- **Average Task Completion Time**: Track time from assigned to completed
- **User Engagement**: Daily active users (PHIs)
- **Offline Sync Success**: % of queued uploads successfully synced

### Monitoring Tools

- Firebase Analytics for user behavior
- Sentry for crash reporting
- Expo Application Services (EAS) for build monitoring

---

## 📝 API Endpoints Reference

### Authentication

| Method | Endpoint           | Description               |
| ------ | ------------------ | ------------------------- |
| POST   | `/api/auth/login`  | Login with email/password |
| GET    | `/api/auth/me`     | Get current user info     |
| POST   | `/api/auth/logout` | Logout                    |

### Tasks

| Method | Endpoint                | Description                     |
| ------ | ----------------------- | ------------------------------- |
| GET    | `/api/tasks`            | Get all tasks (filtered by PHI) |
| GET    | `/api/tasks/:id`        | Get task details                |
| PATCH  | `/api/tasks/:id/status` | Update task status              |

### Evidence

| Method | Endpoint                  | Description           |
| ------ | ------------------------- | --------------------- |
| GET    | `/api/tasks/:id/evidence` | Get evidence for task |
| POST   | `/api/tasks/:id/evidence` | Upload new evidence   |

### Geocoding

| Method | Endpoint                      | Description                    |
| ------ | ----------------------------- | ------------------------------ |
| POST   | `/api/tasks/geocode`          | Geocode address to coordinates |
| POST   | `/api/tasks/reverse-geocode`  | Reverse geocode coordinates    |
| POST   | `/api/tasks/search-addresses` | Search for addresses           |

---

## 🎓 Learning Resources

- [React Navigation Docs](https://reactnavigation.org/)
- [Expo Documentation](https://docs.expo.dev/)
- [React Native Paper](https://callstack.github.io/react-native-paper/)
- [TypeScript with React Native](https://reactnative.dev/docs/typescript)

---

## 🤝 Contributing Guidelines

1. Follow TypeScript strict mode
2. Use functional components with hooks
3. Implement error boundaries
4. Add loading states for all async operations
5. Handle network errors gracefully
6. Test on both iOS and Android
7. Follow React Native performance best practices
8. Use absolute imports with path aliases

---

## 📄 License

This mobile application is part of the EpiLink system developed for the Ministry of Health, Sri Lanka.

---

## 👥 Team & Support

- **Developer**: [Your Name]
- **Project Supervisor**: [Supervisor Name]
- **Backend API**: `http://localhost:3001/api` (development)
- **Production API**: TBD

---

**Last Updated**: February 11, 2026
**Version**: 1.0.0
**Status**: Planning Phase
