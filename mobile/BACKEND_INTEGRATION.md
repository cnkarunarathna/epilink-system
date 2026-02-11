# Phase 1 Backend Integration - VERIFIED ✅

## Changes Made for Backend Compatibility

### 1. **Fixed API Response Type Mismatch** ✅

- **Issue**: Backend returns `accessToken`, mobile app expected `access_token`
- **Fix**: Updated `LoginResponse` interface to use `accessToken`
- **Files Changed**:
  - `mobile/src/types/user.types.ts`
  - `mobile/src/context/AuthContext.tsx`

### 2. **Updated Backend CORS Configuration** ✅

- **Issue**: Backend CORS only allowed `localhost:3000`, blocking mobile connections
- **Fix**: Updated backend to allow all origins in development mode
- **File Changed**: `backend/src/main.ts`

```typescript
// Now allows all origins in development
app.enableCors({
  origin:
    process.env.NODE_ENV === "production"
      ? process.env.NEXT_FRONTEND_URL
      : true,
  credentials: true,
});
```

### 3. **Fixed User Type to Match Backend** ✅

- **Issue**: Mobile User interface had extra fields not returned by backend
- **Fix**: Simplified User interface to match backend response
- **Removed fields**: `isActive`, `createdAt`, `updatedAt` from base User type
- **File Changed**: `mobile/src/types/user.types.ts`

### 4. **Platform-Specific API Configuration** ✅

- **Issue**: Android emulator can't use `localhost`, iOS can
- **Fix**: Automatic platform detection for API base URL
- **File Changed**: `mobile/src/utils/constants.ts`

```typescript
// iOS Simulator: http://localhost:3001/api
// Android Emulator: http://10.0.2.2:3001/api
// Production: https://api.epilink.gov.lk/api
```

### 5. **Added Development Tools** ✅

- Created comprehensive backend connectivity testing utilities
- **New Files**:
  - `mobile/src/utils/healthCheck.ts` - Connection testing utilities
  - `mobile/src/screens/dev/DevToolsScreen.tsx` - Dev tools UI
  - `mobile/ENV_SETUP.md` - Environment setup guide

## Test Credentials (From Backend Seed)

The backend seeds default users on startup. Use these for testing:

| Role       | Email                     | Password       |
| ---------- | ------------------------- | -------------- |
| Admin      | admin@epilink.gov.lk      | Admin@123      |
| Supervisor | supervisor@epilink.gov.lk | Supervisor@123 |
| PHI        | phi@epilink.gov.lk        | Phi@123        |
| Viewer     | viewer@epilink.gov.lk     | Viewer@123     |

## How to Test Backend Integration

### Step 1: Start Backend

```bash
cd backend
npm run start:dev
```

Backend should start on `http://localhost:3001`

### Step 2: Start Mobile App

```bash
cd mobile
npm start
```

### Step 3: Access Dev Tools

1. When app launches, you'll see the splash screen
2. After splash, you should see tabs at bottom
3. Click "**Dev Tools**" tab (only visible in development mode)
4. The screen will automatically run diagnostics
5. You should see:
   - ✅ "Backend is reachable"
   - API configuration details
   - Connection test results

### Step 4: Test Login

1. In Dev Tools screen, tap "🔐 Test PHI Login"
2. Should see success alert with user data
3. Or go to Login screen and manually enter credentials

## Platform-Specific Notes

### iOS Simulator ✅

- Uses `http://localhost:3001/api`
- No additional configuration needed
- Backend must be running on port 3001

### Android Emulator ✅

- Automatically uses `http://10.0.2.2:3001/api`
- The IP `10.0.2.2` is a special alias to host machine's localhost
- No changes needed in code

### Physical Device 📱

For testing on a real phone:

1. Find your computer's local IP:

   ```bash
   # macOS
   ifconfig | grep "inet " | grep -v 127.0.0.1

   # Windows
   ipconfig
   ```

2. Update `src/utils/constants.ts` temporarily:
   ```typescript
   return "http://YOUR_IP:3001/api"; // e.g., http://192.168.1.100:3001/api
   ```
3. Ensure phone and computer are on same WiFi

## API Endpoints Verified

All these endpoints are confirmed working:

| Method | Endpoint                  | Purpose                   |
| ------ | ------------------------- | ------------------------- |
| POST   | `/api/auth/login`         | User login                |
| GET    | `/api/auth/me`            | Get current user          |
| POST   | `/api/auth/logout`        | Logout                    |
| GET    | `/api/tasks`              | Get tasks (requires auth) |
| GET    | `/api/tasks/:id`          | Get task details          |
| PATCH  | `/api/tasks/:id/status`   | Update task status        |
| GET    | `/api/tasks/:id/evidence` | Get task evidence         |
| POST   | `/api/tasks/:id/evidence` | Upload evidence           |

## Troubleshooting Guide

### ❌ "Network Error" or "Cannot connect to backend"

**Symptoms**: App shows network error, Dev Tools shows red X

**Solutions**:

1. Check if backend is running:
   ```bash
   curl http://localhost:3001/api
   ```
2. Check iOS vs Android:
   - iOS: Should use `localhost:3001`
   - Android: Should use `10.0.2.2:3001`
3. Check backend logs for CORS errors
4. Restart both backend and mobile app

### ❌ "Invalid credentials" on login

**Solution**: Use exact credentials from seed data (case-sensitive)

- Email: `phi@epilink.gov.lk`
- Password: `Phi@123`

### ❌ "401 Unauthorized" on authenticated requests

**Symptoms**: Login works, but subsequent API calls fail

**Solutions**:

1. Check if token is being stored: Look at AsyncStorage in React Native Debugger
2. Check if Authorization header is attached: Look at API client interceptors
3. Token might be expired: Try logging in again

### ⚠️ Backend running but mobile can't connect

**For Android Emulator**:

- Confirm the app is using `10.0.2.2` not `localhost`
- Check Dev Tools screen to see which URL is being used

**For Physical Device**:

- Ensure phone and computer are on same WiFi
- Use computer's local IP address
- Check firewall isn't blocking connections

## Files Modified Summary

### Backend Changes

- ✅ `backend/src/main.ts` - Updated CORS config

### Mobile Changes

- ✅ `mobile/src/types/user.types.ts` - Fixed User & LoginResponse types
- ✅ `mobile/src/context/AuthContext.tsx` - Fixed accessToken reference
- ✅ `mobile/src/utils/constants.ts` - Platform-specific API URLs
- ✅ `mobile/src/navigation/MainNavigator.tsx` - Added DevTools tab
- ✅ `mobile/src/navigation/types.ts` - Added DevTools to types
- ✅ `mobile/.env` - Added API URL comment

### New Files Added

- ✅ `mobile/src/utils/healthCheck.ts` - Connection testing
- ✅ `mobile/src/screens/dev/DevToolsScreen.tsx` - Dev tools UI
- ✅ `mobile/ENV_SETUP.md` - Setup documentation
- ✅ `mobile/BACKEND_INTEGRATION.md` - This file

## Next Steps

Phase 1 is now fully verified and working with the backend! ✅

**Ready for Phase 2**:

- Full Login screen implementation with form validation
- Task List screen with real data from backend
- Task Detail screen
- Pull-to-refresh functionality

---

**Status**: ✅ Phase 1 Complete - Backend Integration Verified
**Tested On**: iOS Simulator & Android Emulator
**Backend Port**: 3001
**API Prefix**: /api
