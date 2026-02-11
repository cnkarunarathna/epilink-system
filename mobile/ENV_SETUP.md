# EpiLink PHI Mobile - Environment Configuration

## Development Setup

### For iOS Simulator

The app is configured to use `http://localhost:3001/api` which works directly with the iOS simulator.

### For Android Emulator

The app automatically uses `http://10.0.2.2:3001/api` for Android emulators. The special IP `10.0.2.2` is an alias to the host machine's localhost.

### For Physical Devices (Testing on Real Phone)

If you want to test on a physical device:

1. Find your computer's local IP address:
   - macOS: Run `ifconfig | grep "inet " | grep -v 127.0.0.1`
   - Windows: Run `ipconfig` and look for IPv4 Address

2. Update `src/utils/constants.ts` temporarily:

   ```typescript
   return "http://YOUR_LOCAL_IP:3001/api"; // e.g., http://192.168.1.100:3001/api
   ```

3. Make sure your phone and computer are on the same WiFi network

4. Ensure your backend allows connections from your local IP (CORS is configured to allow all origins in development)

## Backend Configuration

The backend has been updated to:

- ✅ Allow all origins in development mode for mobile testing
- ✅ Return `accessToken` field (matching mobile app expectations)
- ✅ Run on port 3001 with `/api` prefix

## Testing the Connection

1. **Start the backend**:

   ```bash
   cd backend
   npm run start:dev
   ```

2. **Start the mobile app**:

   ```bash
   cd mobile
   npm start
   # Then press 'i' for iOS or 'a' for Android
   ```

3. **Test login** with default credentials:
   - Admin: `admin@epilink.gov.lk` / `Admin@123`
   - Supervisor: `supervisor@epilink.gov.lk` / `Supervisor@123`
   - PHI: `phi@epilink.gov.lk` / `Phi@123`

## Troubleshooting

### "Network Error" on Android

- Make sure you're using `10.0.2.2` instead of `localhost`
- The app is already configured to handle this automatically

### "Network Error" on iOS

- Make sure backend is running on port 3001
- Try `http://localhost:3001/api/auth/me` in Safari to verify

### Backend not reachable

- Check if backend is running: `curl http://localhost:3001/api`
- Check firewall settings
- Verify CORS configuration in backend

### Physical Device Connection Issues

- Ensure both devices are on same WiFi
- Check if your firewall is blocking incoming connections
- Use your computer's local IP address (not localhost)
