"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Search, Map, CheckSquare, X } from "lucide-react";

const SESSION_KEY = "dengue_onboarding_dismissed";

const STEPS = [
  { icon: Search, label: "Search your district to see local risk" },
  { icon: Map, label: "Click any district on the map for details" },
  { icon: CheckSquare, label: "Read what precautions to take" },
];

export default function OnboardingBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!sessionStorage.getItem(SESSION_KEY)) {
      setVisible(true);
    }
  }, []);

  const dismiss = () => {
    sessionStorage.setItem(SESSION_KEY, "1");
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="relative rounded-xl border-2 border-blue-200 dark:border-blue-800 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/50 dark:to-indigo-950/50 p-5">
      <button
        onClick={dismiss}
        className="absolute top-3 right-3 p-1 rounded-full hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
        aria-label="Dismiss guide"
      >
        <X className="h-4 w-4 text-blue-600 dark:text-blue-400" />
      </button>

      <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-4">
        How to use this dengue risk map
      </h3>

      <div className="grid sm:grid-cols-3 gap-4">
        {STEPS.map(({ icon: Icon, label }, i) => (
          <div key={i} className="flex items-start gap-3">
            <div className="flex-shrink-0 w-7 h-7 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
              {i + 1}
            </div>
            <div className="flex items-center gap-2 text-sm text-blue-800 dark:text-blue-200">
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 flex justify-end">
        <Button size="sm" onClick={dismiss}>
          Got it
        </Button>
      </div>
    </div>
  );
}
