# Frontend Dashboard Structure

## Overview

This document describes the frontend folder structure configured for the EpiLink dengue risk monitoring system.

## Folder Structure

```
frontend/
├── app/
│   ├── (dashboard)/          # Route group for authenticated dashboards
│   │   ├── layout.tsx        # Shared dashboard layout with sidebar
│   │   ├── admin/            # Admin dashboard pages
│   │   │   └── page.tsx
│   │   ├── supervisor/       # Supervisor dashboard pages
│   │   │   └── page.tsx
│   │   ├── phi/              # PHI (Field Officer) dashboard pages
│   │   │   └── page.tsx
│   │   └── viewer/           # Viewer dashboard pages
│   │       └── page.tsx
│   ├── login/                # Authentication pages
│   │   └── page.tsx
│   └── health/               # Health check page
│       └── page.tsx
├── components/
│   ├── dashboard/            # Dashboard-specific components
│   │   ├── shared/           # Reusable dashboard components
│   │   │   ├── StatCard.tsx
│   │   │   ├── RiskBadge.tsx
│   │   │   ├── DataTable.tsx
│   │   │   └── index.ts
│   │   ├── charts/           # Chart components (future)
│   │   ├── maps/             # Map components (future)
│   │   ├── tasks/            # Task management components (future)
│   │   └── reports/          # Report components (future)
│   ├── layout/               # Layout components
│   │   ├── Header.tsx
│   │   ├── Footer.tsx
│   │   └── PublicLayout.tsx
│   ├── pages/                # Page-level components
│   │   └── LandingPage.tsx
│   └── ui/                   # shadcn/ui components
├── lib/
│   ├── types/                # TypeScript type definitions
│   │   └── index.ts          # All app types
│   ├── api.ts                # API client utilities
│   └── utils.ts              # Utility functions
└── services/
    └── api/                  # API service layer
        └── index.ts          # API functions

```

## Dashboard Routes

### Admin Dashboard (`/admin`)

- **Purpose**: National-level monitoring and system administration
- **Features**:
  - National overview with key metrics
  - Risk distribution across districts
  - User management
  - System configuration
  - Weekly report approval

### Supervisor Dashboard (`/supervisor`)

- **Purpose**: District-level coordination and task management
- **Features**:
  - District-specific risk levels
  - PHI management
  - Task creation and assignment
  - Evidence verification
  - District reports

### PHI Dashboard (`/phi`)

- **Purpose**: Field officer task management
- **Features**:
  - Assigned tasks list
  - Evidence upload with geo-tagging
  - Task status updates
  - Offline support (future)
  - Map view

### Viewer Dashboard (`/viewer`)

- **Purpose**: Public/read-only access to system data
- **Features**:
  - National statistics
  - District risk levels
  - Public reports
  - Analytics (non-sensitive data)

## Key Components

### Dashboard Layout (`app/(dashboard)/layout.tsx`)

- Responsive sidebar navigation
- Role-based menu items
- Mobile-friendly with drawer
- User profile and logout
- Notification bell

### Shared Components (`components/dashboard/shared/`)

1. **StatCard**: Display key metrics with icons
2. **RiskBadge**: Color-coded risk level badges
3. **DataTable**: Generic data display component

### API Services (`services/api/`)

Organized service modules:

- `authService`: Authentication and user session
- `dashboardService`: Dashboard stats and notifications
- `predictionService`: Risk predictions
- `taskService`: Task management and evidence
- `districtService`: District data
- `userService`: User CRUD operations
- `reportService`: Weekly reports

### TypeScript Types (`lib/types/`)

Comprehensive type definitions for:

- User roles and authentication
- Risk predictions and levels
- Tasks and evidence
- Districts and MOH areas
- Reports and analytics
- API responses

## Next Steps

To continue building the dashboards:

1. **Install additional packages** for charts and maps:

   ```bash
   npm install recharts leaflet react-leaflet
   npm install -D @types/leaflet
   ```

2. **Create chart components** in `components/dashboard/charts/`
3. **Add map visualizations** in `components/dashboard/maps/`
4. **Implement task components** in `components/dashboard/tasks/`
5. **Connect to backend API** once available
6. **Add authentication middleware** for route protection
7. **Implement real-time updates** with WebSockets

## Environment Variables

Add to `.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:3001/api
NEXT_PUBLIC_MAP_TILES_URL=https://tile.openstreetmap.org/{z}/{x}/{y}.png
```

## Dashboard Access

- Admin: `http://localhost:3000/admin`
- Supervisor: `http://localhost:3000/supervisor`
- PHI: `http://localhost:3000/phi`
- Viewer: `http://localhost:3000/viewer`
- Login: `http://localhost:3000/login`
