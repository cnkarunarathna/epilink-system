import api from "@/lib/api";

export interface User {
  id: string;
  name: string;
  email: string;
  role: "admin" | "supervisor" | "phi" | "viewer";
  district?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateUserData {
  name: string;
  email: string;
  password: string;
  role: "admin" | "supervisor" | "phi" | "viewer";
  district?: string;
}

export interface UpdateUserData {
  name?: string;
  email?: string;
  password?: string;
  role?: "admin" | "supervisor" | "phi" | "viewer";
  district?: string;
  isActive?: boolean;
}

export interface UserStats {
  totalUsers: number;
  activeUsers: number;
  inactiveUsers: number;
  usersByRole: {
    admin?: number;
    supervisor?: number;
    phi?: number;
    viewer?: number;
  };
}

const usersService = {
  // Get all users
  async getAll(): Promise<User[]> {
    const response = await api.get<User[]>("/users");
    return response.data;
  },

  // Get a single user by ID
  async getById(id: string): Promise<User> {
    const response = await api.get<User>(`/users/${id}`);
    return response.data;
  },

  // Create a new user
  async create(userData: CreateUserData): Promise<User> {
    const response = await api.post<User>("/users", userData);
    return response.data;
  },

  // Update an existing user
  async update(id: string, userData: UpdateUserData): Promise<User> {
    const response = await api.patch<User>(`/users/${id}`, userData);
    return response.data;
  },

  // Delete a user
  async delete(id: string): Promise<void> {
    await api.delete(`/users/${id}`);
  },

  // Toggle user active status
  async toggleStatus(id: string): Promise<User> {
    const response = await api.patch<User>(`/users/${id}/toggle-status`);
    return response.data;
  },

  // Get user statistics
  async getStats(): Promise<UserStats> {
    const response = await api.get<UserStats>("/users/stats");
    return response.data;
  },
};

export default usersService;
