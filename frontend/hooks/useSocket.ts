import { useEffect, useCallback } from "react";
import { useSocket } from "@/contexts/SocketContext";

type EventHandler<T = any> = (data: T) => void;

/**
 * Custom hook for subscribing to socket events with automatic cleanup
 *
 * @param event - Event name to subscribe to
 * @param handler - Callback function to handle the event
 * @param deps - Optional dependency array for the handler
 *
 * @example
 * useSocketEvent('user:created', (user) => {
 *   console.log('New user:', user);
 *   setUsers(prev => [user, ...prev]);
 * }, []);
 */
export function useSocketEvent<T = any>(
  event: string,
  handler: EventHandler<T>,
  deps: React.DependencyList = []
) {
  const { socket, isConnected } = useSocket();

  const memoizedHandler = useCallback(handler, deps);

  useEffect(() => {
    if (!socket || !isConnected) {
      return;
    }

    socket.on(event, memoizedHandler);

    return () => {
      socket.off(event, memoizedHandler);
    };
  }, [socket, isConnected, event, memoizedHandler]);
}

/**
 * Custom hook for subscribing to multiple socket events at once
 *
 * @param events - Object mapping event names to handlers
 *
 * @example
 * useSocketEvents({
 *   'user:created': handleUserCreated,
 *   'user:updated': handleUserUpdated,
 *   'user:deleted': handleUserDeleted,
 * });
 */
export function useSocketEvents(events: Record<string, EventHandler>) {
  const { socket, isConnected } = useSocket();

  useEffect(() => {
    if (!socket || !isConnected) {
      return;
    }

    // Subscribe to all events
    Object.entries(events).forEach(([event, handler]) => {
      socket.on(event, handler);
    });

    // Cleanup
    return () => {
      Object.entries(events).forEach(([event, handler]) => {
        socket.off(event, handler);
      });
    };
  }, [socket, isConnected, events]);
}
