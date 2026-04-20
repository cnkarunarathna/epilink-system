"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";

interface Props {
  districts: string[];
  onSelect: (district: string) => void;
}

export default function DistrictSearchBar({ districts, onSelect }: Props) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const handleChange = (value: string) => {
    setQuery(value);
    if (value.trim().length >= 1) {
      setSuggestions(
        districts
          .filter((d) => d.toLowerCase().includes(value.toLowerCase()))
          .slice(0, 6),
      );
      setShowSuggestions(true);
    } else {
      setShowSuggestions(false);
    }
  };

  const handleSelect = (district: string) => {
    setQuery(district);
    setShowSuggestions(false);
    onSelect(district);
  };

  const handleGo = () => {
    const exact = districts.find(
      (d) => d.toLowerCase() === query.toLowerCase(),
    );
    if (exact) {
      handleSelect(exact);
    } else if (suggestions.length > 0) {
      handleSelect(suggestions[0]);
    }
  };

  return (
    <div className="relative">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Find your district..."
            value={query}
            onChange={(e) => handleChange(e.target.value)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
            onFocus={() => query.trim() && setShowSuggestions(true)}
            onKeyDown={(e) => e.key === "Enter" && handleGo()}
            className="pl-9 h-11 text-base"
          />
        </div>
        <Button
          size="lg"
          disabled={!query.trim()}
          onClick={handleGo}
          className="h-11"
        >
          Go
        </Button>
      </div>
      {showSuggestions && suggestions.length > 0 && (
        <ul className="absolute top-full left-0 right-0 z-50 mt-1 bg-card border rounded-lg shadow-xl overflow-hidden">
          {suggestions.map((d) => (
            <li
              key={d}
              className="flex items-center gap-2 px-4 py-2.5 cursor-pointer hover:bg-accent transition-colors text-sm"
              onMouseDown={() => handleSelect(d)}
            >
              <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              {d}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
