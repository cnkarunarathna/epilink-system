# Health Check Page

## Overview

A dedicated health monitoring page at `/health` that displays real-time database connectivity status from the backend API.

## Features

✅ **Real-time Monitoring** - Auto-refreshes every 5 seconds
✅ **Visual Status Indicators** - Color-coded status badges and connection indicators
✅ **Database Information** - Shows database name, connection status, and overall health
✅ **Error Handling** - Displays user-friendly error messages when backend is unreachable
✅ **Dark Mode Support** - Fully responsive with dark mode styling
✅ **Debug Mode** - Expandable raw JSON response viewer

## URL

- **Frontend**: http://localhost:3000/health
- **Backend API**: http://localhost:3001/health

## Navigation

Access the health check page from the home page via the "Health Check" button, or navigate directly to `/health`.

## Status Indicators

### Overall Status

- **OK** - System is healthy (Green)
- **ERROR** - System has issues (Red)

### Database Connection

- **Connected** - Active database connection with pulsing indicator
- **Disconnected** - No database connection
- **Database Name** - Shows the current database name (e.g., "neondb")

## Auto-Refresh

The page automatically fetches fresh health data every 5 seconds to provide real-time monitoring without manual refresh.

## Error States

If the backend is not running or unreachable, the page displays:

- Clear error message
- Helpful troubleshooting instructions
- Suggestion to ensure backend is running on port 3001

## Technical Details

### API Integration

- Fetches data from: `http://localhost:3001/health`
- Response format:

```json
{
  "status": "OK",
  "timestamp": "2025-11-07T...",
  "database": {
    "status": "OK",
    "database": "neondb",
    "connected": true
  }
}
```

### Technologies Used

- **Next.js 16** - React framework with App Router
- **React Hooks** - useState, useEffect for state management
- **Tailwind CSS** - Utility-first styling with dark mode
- **TypeScript** - Type-safe development

## Development

```bash
# Start frontend
cd frontend
npm run dev

# Start backend (required)
cd backend
npm run start:dev
```

Both servers must be running for the health page to display data.
