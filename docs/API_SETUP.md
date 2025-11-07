# API Integration with Axios

## Overview

The frontend uses **axios** for all API communications with a centralized configuration and service-based architecture.

## Architecture

### 1. Centralized Axios Instance (`lib/api.ts`)

- **Base URL**: Configured via `NEXT_PUBLIC_API_URL` environment variable
- **Timeout**: 10 seconds
- **Headers**: Default `Content-Type: application/json`
- **Interceptors**: Request and response interceptors for global error handling

### 2. Service Layer (`services/`)

- Type-safe service functions for each API domain
- Encapsulates API calls with proper TypeScript types
- Easy to test and maintain

### 3. Environment Configuration

- `.env.local` contains the backend API URL
- Allows different URLs for development, staging, and production

## File Structure

```
frontend/
├── lib/
│   └── api.ts                    # Centralized axios instance
├── services/
│   └── health.service.ts         # Health-related API calls
├── app/
│   └── health/
│       └── page.tsx              # Uses health service
└── .env.local                    # Environment variables
```

## Usage Examples

### Basic Service Call

```typescript
import healthService from "@/services/health.service";

const data = await healthService.getHealth();
```

### Error Handling

```typescript
try {
  const data = await healthService.getHealth();
  // Handle success
} catch (err) {
  if (axios.isAxiosError(err)) {
    // Handle axios-specific errors
    console.error(err.response?.data?.message || err.message);
  } else {
    // Handle other errors
    console.error("Unknown error");
  }
}
```

### Creating New Services

1. Create a new service file in `services/`:

```typescript
// services/user.service.ts
import api from "@/lib/api";

export interface User {
  id: string;
  name: string;
  email: string;
}

export const userService = {
  getUsers: async (): Promise<User[]> => {
    const response = await api.get<User[]>("/users");
    return response.data;
  },

  getUserById: async (id: string): Promise<User> => {
    const response = await api.get<User>(`/users/${id}`);
    return response.data;
  },

  createUser: async (user: Omit<User, "id">): Promise<User> => {
    const response = await api.post<User>("/users", user);
    return response.data;
  },

  updateUser: async (id: string, user: Partial<User>): Promise<User> => {
    const response = await api.put<User>(`/users/${id}`, user);
    return response.data;
  },

  deleteUser: async (id: string): Promise<void> => {
    await api.delete(`/users/${id}`);
  },
};

export default userService;
```

2. Use the service in your components:

```typescript
import userService from "@/services/user.service";

const users = await userService.getUsers();
```

## Features

### Request Interceptor

- Automatically adds authentication tokens (when implemented)
- Logs all outgoing requests in development
- Can modify request config globally

### Response Interceptor

- Handles common errors globally
- Logs API errors for debugging
- Can refresh auth tokens automatically

### Type Safety

- Full TypeScript support
- Type-safe request/response handling
- Autocomplete for service methods

## Environment Variables

Create `.env.local` in the frontend directory:

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
```

For production, update to your production API URL.

## Benefits

✅ **Centralized Configuration** - Single source of truth for API settings
✅ **Type Safety** - Full TypeScript support
✅ **Error Handling** - Global error handling with interceptors
✅ **Authentication Ready** - Easy to add auth tokens
✅ **Testable** - Service layer is easy to mock and test
✅ **Maintainable** - Clear separation of concerns
✅ **Reusable** - Service functions can be used anywhere

## Best Practices

1. **Always use the service layer** - Don't call `api` directly from components
2. **Define interfaces** - Create TypeScript interfaces for all API responses
3. **Handle errors** - Always wrap service calls in try-catch blocks
4. **Use environment variables** - Never hardcode API URLs
5. **Keep services focused** - One service per domain (users, health, etc.)

## Testing

Mock services in tests:

```typescript
jest.mock("@/services/health.service", () => ({
  getHealth: jest.fn().mockResolvedValue({
    status: "OK",
    timestamp: "2025-11-07T...",
    database: {
      status: "OK",
      database: "neondb",
      connected: true,
    },
  }),
}));
```

## Migration from Fetch

If you have existing fetch calls, migrate them to axios:

**Before:**

```typescript
const response = await fetch("http://localhost:3001/api/data");
const data = await response.json();
```

**After:**

```typescript
import api from "@/lib/api";
const response = await api.get("/api/data");
const data = response.data;
```

Or better yet, create a service:

```typescript
import dataService from "@/services/data.service";
const data = await dataService.getData();
```
