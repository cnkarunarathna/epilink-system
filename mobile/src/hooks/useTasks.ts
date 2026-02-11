/**
 * Hook for fetching and filtering tasks
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { getTasks } from "../api/taskService";
import { Task, TaskStatus } from "../types/task.types";

interface UseTasksOptions {
  status?: TaskStatus | "all";
  assignedPhiId?: string;
  search?: string;
}

export const useTasks = (options: UseTasksOptions) => {
  const { status = "all", assignedPhiId, search = "" } = options;
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTasks = useCallback(
    async (isRefresh = false) => {
      setError(null);
      isRefresh ? setIsRefreshing(true) : setIsLoading(true);

      try {
        const response = await getTasks({
          status: status === "all" ? undefined : status,
          assignedPhiId,
        });
        setTasks(response);
      } catch (err: any) {
        setError(err?.message || "Failed to load tasks");
      } finally {
        isRefresh ? setIsRefreshing(false) : setIsLoading(false);
      }
    },
    [status, assignedPhiId],
  );

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const filteredTasks = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return tasks;
    return tasks.filter((task) => {
      const title = task.title?.toLowerCase() || "";
      const address = task.address?.toLowerCase() || "";
      const district = task.district?.name?.toLowerCase() || "";
      return (
        title.includes(query) ||
        address.includes(query) ||
        district.includes(query)
      );
    });
  }, [tasks, search]);

  return {
    tasks: filteredTasks,
    isLoading,
    isRefreshing,
    error,
    refresh: () => fetchTasks(true),
    refetch: () => fetchTasks(false),
  };
};
