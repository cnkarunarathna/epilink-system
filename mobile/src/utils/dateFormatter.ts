/**
 * Date formatting utilities
 */

import { format, formatDistanceToNow, isValid, parseISO } from "date-fns";

/**
 * Format date to readable string
 */
export const formatDate = (
  date: string | Date,
  formatString = "MMM dd, yyyy",
): string => {
  try {
    const dateObj = typeof date === "string" ? parseISO(date) : date;
    if (!isValid(dateObj)) return "Invalid date";
    return format(dateObj, formatString);
  } catch (error) {
    return "Invalid date";
  }
};

/**
 * Format date with time
 */
export const formatDateTime = (date: string | Date): string => {
  return formatDate(date, "MMM dd, yyyy HH:mm");
};

/**
 * Format date to relative time (e.g., "2 hours ago")
 */
export const formatRelativeTime = (date: string | Date): string => {
  try {
    const dateObj = typeof date === "string" ? parseISO(date) : date;
    if (!isValid(dateObj)) return "Invalid date";
    return formatDistanceToNow(dateObj, { addSuffix: true });
  } catch (error) {
    return "Invalid date";
  }
};

/**
 * Check if date is overdue
 */
export const isOverdue = (dueDate: string | Date | null): boolean => {
  if (!dueDate) return false;
  try {
    const dateObj = typeof dueDate === "string" ? parseISO(dueDate) : dueDate;
    return isValid(dateObj) && dateObj < new Date();
  } catch (error) {
    return false;
  }
};

/**
 * Get days until due date
 */
export const getDaysUntilDue = (
  dueDate: string | Date | null,
): number | null => {
  if (!dueDate) return null;
  try {
    const dateObj = typeof dueDate === "string" ? parseISO(dueDate) : dueDate;
    if (!isValid(dateObj)) return null;
    const diff = dateObj.getTime() - new Date().getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  } catch (error) {
    return null;
  }
};
