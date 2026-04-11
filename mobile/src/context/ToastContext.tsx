/**
 * Toast Context
 * Provides a lightweight in-app notification queue for success, error,
 * warning, and info feedback without any third-party library.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useReducer,
  ReactNode,
} from "react";

export type ToastVariant = "success" | "error" | "warning" | "info";

export interface ToastOptions {
  message: string;
  variant?: ToastVariant;
  /** Auto-dismiss duration in ms. Defaults: success/info = 3000, error/warning = 5000 */
  duration?: number;
  /** Optional inline action button */
  action?: { label: string; onPress: () => void };
}

export interface Toast extends Required<Omit<ToastOptions, "action">> {
  id: string;
  action?: { label: string; onPress: () => void };
}

// ─── Reducer ────────────────────────────────────────────────────────────────

type Action =
  | { type: "ENQUEUE"; toast: Toast }
  | { type: "DISMISS"; id: string };

function reducer(state: Toast[], action: Action): Toast[] {
  switch (action.type) {
    case "ENQUEUE":
      // Keep at most 1 toast visible — replace if one is already queued
      return [action.toast];
    case "DISMISS":
      return state.filter((t) => t.id !== action.id);
    default:
      return state;
  }
}

// ─── Context ─────────────────────────────────────────────────────────────────

interface ToastContextValue {
  toasts: Toast[];
  showToast: (options: ToastOptions) => void;
  dismissToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export const ToastProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [toasts, dispatch] = useReducer(reducer, []);

  const showToast = useCallback((options: ToastOptions) => {
    const variant: ToastVariant = options.variant ?? "info";
    const defaultDuration =
      variant === "error" || variant === "warning" ? 5000 : 3000;

    const toast: Toast = {
      id: String(Date.now()),
      message: options.message,
      variant,
      duration: options.duration ?? defaultDuration,
      action: options.action,
    };
    dispatch({ type: "ENQUEUE", toast });
  }, []);

  const dismissToast = useCallback((id: string) => {
    dispatch({ type: "DISMISS", id });
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, showToast, dismissToast }}>
      {children}
    </ToastContext.Provider>
  );
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

export const useToast = (): Pick<ToastContextValue, "showToast"> => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return { showToast: ctx.showToast };
};

export const useToastInternal = (): ToastContextValue => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToastInternal must be used inside <ToastProvider>");
  return ctx;
};
