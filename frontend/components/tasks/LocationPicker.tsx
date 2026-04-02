"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import {
  Search,
  MapPin,
  Loader2,
  Crosshair,
  Maximize2,
  Minimize2,
} from "lucide-react";
import {
  Map,
  MapMarker,
  MarkerContent,
  MapControls,
  useMap,
} from "@/components/ui/map";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  searchAddresses,
  reverseGeocode,
  GeocodingResult,
} from "@/services/tasks.service";
import MapLibreGL from "maplibre-gl";

export interface LocationPickerValue {
  latitude: number | null;
  longitude: number | null;
  address: string;
}

interface LocationPickerProps {
  value?: LocationPickerValue;
  onChange?: (value: LocationPickerValue) => void;
  className?: string;
  disabled?: boolean;
  /** Initial center of the map [lng, lat]. Defaults to Sri Lanka center */
  initialCenter?: [number, number];
  /** Initial zoom level. Defaults to 8 */
  initialZoom?: number;
  /** Height of the map container. Defaults to 400px */
  height?: string | number;
}

// Internal component to handle map clicks
function MapClickHandler({
  onMapClick,
  disabled,
}: {
  onMapClick: (lngLat: { lng: number; lat: number }) => void;
  disabled: boolean;
}) {
  const { map, isLoaded } = useMap();

  useEffect(() => {
    if (!map || !isLoaded || disabled) return;

    const handleClick = (e: MapLibreGL.MapMouseEvent) => {
      onMapClick({ lng: e.lngLat.lng, lat: e.lngLat.lat });
    };

    map.on("click", handleClick);
    return () => {
      map.off("click", handleClick);
    };
  }, [map, isLoaded, onMapClick, disabled]);

  return null;
}

// Internal component to control map programmatically
function MapController({
  mapRef,
}: {
  mapRef: React.MutableRefObject<MapLibreGL.Map | null>;
}) {
  const { map, isLoaded } = useMap();

  useEffect(() => {
    if (map && isLoaded) {
      mapRef.current = map;
    }
  }, [map, isLoaded, mapRef]);

  return null;
}

export function LocationPicker({
  value,
  onChange,
  className,
  disabled = false,
  initialCenter = [80.7718, 7.8731], // Sri Lanka center
  initialZoom = 8,
  height = 400,
}: LocationPickerProps) {
  const mapRef = useRef<MapLibreGL.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [markerPosition, setMarkerPosition] = useState<{
    lng: number;
    lat: number;
  } | null>(
    value?.latitude && value?.longitude
      ? { lng: value.longitude, lat: value.latitude }
      : null,
  );
  const [searchQuery, setSearchQuery] = useState(value?.address || "");
  const [searchResults, setSearchResults] = useState<GeocodingResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isReverseGeocoding, setIsReverseGeocoding] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hasAutoLocated = useRef(false);

  // Auto-center map on user's location on mount
  useEffect(() => {
    if (hasAutoLocated.current) return;
    if (value?.latitude && value?.longitude) return; // Don't override if value already set

    if ("geolocation" in navigator) {
      hasAutoLocated.current = true;
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { longitude: lng, latitude: lat } = pos.coords;
          mapRef.current?.flyTo({
            center: [lng, lat],
            zoom: 13,
            duration: 1000,
          });
        },
        (error) => {
          console.log("Auto-locate skipped:", error.message);
        },
        { timeout: 5000, maximumAge: 300000 }, // 5s timeout, cache for 5 min
      );
    }
  }, [value?.latitude, value?.longitude]);

  // Sync external value with internal state
  useEffect(() => {
    if (value?.latitude && value?.longitude) {
      setMarkerPosition({ lng: value.longitude, lat: value.latitude });
    }
    if (value?.address) {
      setSearchQuery(value.address);
    }
  }, [value?.latitude, value?.longitude, value?.address]);

  // Debounced search
  const handleSearchChange = useCallback((query: string) => {
    setSearchQuery(query);
    setShowResults(true);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (query.length < 3) {
      setSearchResults([]);
      return;
    }

    searchTimeoutRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await searchAddresses(query, 5);
        setSearchResults(results);
      } catch (error) {
        console.error("Search error:", error);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);
  }, []);

  // Handle selecting a search result
  const handleSelectResult = useCallback(
    (result: GeocodingResult) => {
      setMarkerPosition({ lng: result.longitude, lat: result.latitude });
      setSearchQuery(result.displayName);
      setShowResults(false);

      // Fly to location
      mapRef.current?.flyTo({
        center: [result.longitude, result.latitude],
        zoom: 15,
        duration: 1500,
      });

      onChange?.({
        latitude: result.latitude,
        longitude: result.longitude,
        address: result.displayName,
      });
    },
    [onChange],
  );

  // Handle map click
  const handleMapClick = useCallback(
    async (lngLat: { lng: number; lat: number }) => {
      if (disabled) return;

      const { lng, lat } = lngLat;
      setMarkerPosition({ lng, lat });

      // Reverse geocode to get address
      setIsReverseGeocoding(true);
      try {
        const result = await reverseGeocode(lat, lng);
        const address =
          result?.displayName || `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
        setSearchQuery(address);

        onChange?.({
          latitude: lat,
          longitude: lng,
          address,
        });
      } catch (error) {
        console.error("Reverse geocode error:", error);
        onChange?.({
          latitude: lat,
          longitude: lng,
          address: `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
        });
      } finally {
        setIsReverseGeocoding(false);
      }
    },
    [disabled, onChange],
  );

  // Handle marker drag end
  const handleMarkerDragEnd = useCallback(
    async (lngLat: { lng: number; lat: number }) => {
      setMarkerPosition(lngLat);

      // Reverse geocode
      setIsReverseGeocoding(true);
      try {
        const result = await reverseGeocode(lngLat.lat, lngLat.lng);
        const address =
          result?.displayName ||
          `${lngLat.lat.toFixed(6)}, ${lngLat.lng.toFixed(6)}`;
        setSearchQuery(address);

        onChange?.({
          latitude: lngLat.lat,
          longitude: lngLat.lng,
          address,
        });
      } catch (error) {
        console.error("Reverse geocode error:", error);
        onChange?.({
          latitude: lngLat.lat,
          longitude: lngLat.lng,
          address: `${lngLat.lat.toFixed(6)}, ${lngLat.lng.toFixed(6)}`,
        });
      } finally {
        setIsReverseGeocoding(false);
      }
    },
    [onChange],
  );

  // Handle use my location
  const handleUseMyLocation = useCallback(() => {
    if (!("geolocation" in navigator)) return;

    setIsLocating(true);
    setLocationError(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { longitude: lng, latitude: lat } = pos.coords;
        setMarkerPosition({ lng, lat });

        mapRef.current?.flyTo({
          center: [lng, lat],
          zoom: 15,
          duration: 1500,
        });

        // Reverse geocode
        setIsReverseGeocoding(true);
        try {
          const result = await reverseGeocode(lat, lng);
          const address =
            result?.displayName || `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
          setSearchQuery(address);

          onChange?.({
            latitude: lat,
            longitude: lng,
            address,
          });
        } catch (error) {
          console.error("Reverse geocode error:", error);
          onChange?.({
            latitude: lat,
            longitude: lng,
            address: `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
          });
        } finally {
          setIsReverseGeocoding(false);
        }
        setIsLocating(false);
      },
      (error: GeolocationPositionError) => {
        const messages: Record<number, string> = {
          [error.PERMISSION_DENIED]: "Location access denied. Please allow location permission in your browser settings.",
          [error.POSITION_UNAVAILABLE]: "Location unavailable. Please try again or select manually.",
          [error.TIMEOUT]: "Location request timed out. Please try again.",
        };
        const message = messages[error.code] ?? "Unable to retrieve your location.";
        console.warn("Geolocation error:", error.code, error.message);
        setLocationError(message);
        setIsLocating(false);
      },
    );
  }, [onChange]);

  // Handle expand/collapse
  const handleToggleExpand = useCallback(() => {
    setIsExpanded((prev) => {
      const next = !prev;
      // Resize map after layout change
      setTimeout(() => {
        mapRef.current?.resize();
      }, 100);
      return next;
    });
  }, []);

  // Handle Escape key to collapse
  useEffect(() => {
    if (!isExpanded) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsExpanded(false);
        setTimeout(() => mapRef.current?.resize(), 100);
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isExpanded]);

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative rounded-lg overflow-hidden border transition-all duration-300",
        isExpanded && "fixed inset-0 z-50 rounded-none border-none",
        className,
      )}
    >
      {/* Search bar */}
      <div className="absolute top-3 left-3 right-3 z-10 flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search address..."
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            onFocus={() => setShowResults(true)}
            onBlur={() => setTimeout(() => setShowResults(false), 200)}
            className="pl-9 pr-9 bg-background shadow-md"
            disabled={disabled}
          />
          {(isSearching || isReverseGeocoding) && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
          )}

          {/* Search results dropdown */}
          {showResults && searchResults.length > 0 && (
            <div className="absolute top-full mt-1 left-0 right-0 bg-background border rounded-md shadow-lg max-h-60 overflow-auto z-20">
              {searchResults.map((result, index) => (
                <button
                  key={index}
                  type="button"
                  className="w-full px-3 py-2 text-left text-sm hover:bg-accent transition-colors flex items-start gap-2"
                  onClick={() => handleSelectResult(result)}
                >
                  <MapPin className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                  <span className="line-clamp-2">{result.displayName}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Use my location button */}
        <Button
          type="button"
          variant="secondary"
          size="icon"
          onClick={handleUseMyLocation}
          disabled={disabled || isLocating}
          className="shrink-0 shadow-md"
          title="Use my location"
        >
          {isLocating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Crosshair className="h-4 w-4" />
          )}
        </Button>

        {/* Expand/Collapse button */}
        <Button
          type="button"
          variant="secondary"
          size="icon"
          onClick={handleToggleExpand}
          className="shrink-0 shadow-md"
          title={isExpanded ? "Collapse map (Esc)" : "Expand map"}
        >
          {isExpanded ? (
            <Minimize2 className="h-4 w-4" />
          ) : (
            <Maximize2 className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Location error */}
      {locationError && (
        <p className="text-xs text-destructive px-1">{locationError}</p>
      )}

      {/* Map */}
      <div
        style={{
          height: isExpanded
            ? "100%"
            : typeof height === "number"
              ? `${height}px`
              : height,
        }}
      >
        <Map center={initialCenter} zoom={initialZoom} minZoom={6} maxZoom={18}>
          <MapController mapRef={mapRef} />
          <MapClickHandler onMapClick={handleMapClick} disabled={disabled} />
          {markerPosition && (
            <MapMarker
              longitude={markerPosition.lng}
              latitude={markerPosition.lat}
              draggable={!disabled}
              onDragEnd={handleMarkerDragEnd}
              anchor="bottom"
            >
              <MarkerContent>
                <MapPin className="h-8 w-8 text-primary fill-primary/20" />
              </MarkerContent>
            </MapMarker>
          )}
          <MapControls position="bottom-right" showZoom />
        </Map>
      </div>

      {/* Coordinates display */}
      <div className="absolute bottom-2 left-2 z-10 bg-background/90 backdrop-blur-sm rounded px-2 py-1 text-xs text-muted-foreground flex items-center gap-2">
        <MapPin className="h-3 w-3" />
        {markerPosition ? (
          <span>
            {markerPosition.lat.toFixed(6)}, {markerPosition.lng.toFixed(6)}
          </span>
        ) : (
          <span>Click on map to select location</span>
        )}
      </div>
    </div>
  );
}

export default LocationPicker;
