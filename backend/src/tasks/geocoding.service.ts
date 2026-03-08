import { Injectable, Logger } from '@nestjs/common';

export interface GeocodingResult {
  latitude: number;
  longitude: number;
  displayName: string;
  address?: {
    road?: string;
    suburb?: string;
    city?: string;
    district?: string;
    state?: string;
    postcode?: string;
    country?: string;
  };
}

interface NominatimResponse {
  lat: string;
  lon: string;
  display_name: string;
  address?: {
    road?: string;
    suburb?: string;
    city?: string;
    county?: string;
    state?: string;
    postcode?: string;
    country?: string;
  };
}

@Injectable()
export class GeocodingService {
  private readonly logger = new Logger(GeocodingService.name);
  private readonly baseUrl = 'https://nominatim.openstreetmap.org';
  private readonly userAgent = 'EpiLink/1.0 (dengue-monitoring-system)';

  // Rate limiting: Nominatim allows max 1 request per second
  private lastRequestTime = 0;
  private readonly minRequestInterval = 1100; // 1.1 seconds to be safe

  private async throttleRequest(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    if (timeSinceLastRequest < this.minRequestInterval) {
      const waitTime = this.minRequestInterval - timeSinceLastRequest;
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }

    this.lastRequestTime = Date.now();
  }

  /**
   * Convert an address string to latitude/longitude coordinates
   * @param address The address to geocode
   * @returns GeocodingResult with coordinates and formatted address
   */
  async geocodeAddress(address: string): Promise<GeocodingResult | null> {
    await this.throttleRequest();

    try {
      const params = new URLSearchParams({
        q: address,
        format: 'json',
        addressdetails: '1',
        limit: '1',
        countrycodes: 'lk', // Restrict to Sri Lanka
      });

      const response = await fetch(`${this.baseUrl}/search?${params}`, {
        headers: {
          'User-Agent': this.userAgent,
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        this.logger.error(`Geocoding request failed: ${response.status}`);
        return null;
      }

      const data: NominatimResponse[] = await response.json();

      if (!data || data.length === 0) {
        this.logger.warn(`No results found for address: ${address}`);
        return null;
      }

      const result = data[0];
      return {
        latitude: parseFloat(result.lat),
        longitude: parseFloat(result.lon),
        displayName: result.display_name,
        address: result.address
          ? {
              road: result.address.road,
              suburb: result.address.suburb,
              city: result.address.city,
              district: result.address.county,
              state: result.address.state,
              postcode: result.address.postcode,
              country: result.address.country,
            }
          : undefined,
      };
    } catch (error) {
      this.logger.error(`Geocoding error: ${error.message}`);
      return null;
    }
  }

  /**
   * Convert latitude/longitude coordinates to an address
   * @param latitude Latitude coordinate
   * @param longitude Longitude coordinate
   * @returns GeocodingResult with address details
   */
  async reverseGeocode(
    latitude: number,
    longitude: number,
  ): Promise<GeocodingResult | null> {
    await this.throttleRequest();

    try {
      const params = new URLSearchParams({
        lat: latitude.toString(),
        lon: longitude.toString(),
        format: 'json',
        addressdetails: '1',
      });

      const response = await fetch(`${this.baseUrl}/reverse?${params}`, {
        headers: {
          'User-Agent': this.userAgent,
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        this.logger.error(
          `Reverse geocoding request failed: ${response.status}`,
        );
        return null;
      }

      const result: NominatimResponse = await response.json();

      if (!result || !result.lat) {
        this.logger.warn(
          `No results for reverse geocoding: ${latitude}, ${longitude}`,
        );
        return null;
      }

      return {
        latitude: parseFloat(result.lat),
        longitude: parseFloat(result.lon),
        displayName: result.display_name,
        address: result.address
          ? {
              road: result.address.road,
              suburb: result.address.suburb,
              city: result.address.city,
              district: result.address.county,
              state: result.address.state,
              postcode: result.address.postcode,
              country: result.address.country,
            }
          : undefined,
      };
    } catch (error) {
      this.logger.error(`Reverse geocoding error: ${error.message}`);
      return null;
    }
  }

  /**
   * Search for addresses matching a query string
   * @param query The search query
   * @param limit Maximum number of results (default 5)
   * @returns Array of GeocodingResult
   */
  async searchAddresses(
    query: string,
    limit: number = 5,
  ): Promise<GeocodingResult[]> {
    await this.throttleRequest();

    try {
      const params = new URLSearchParams({
        q: query,
        format: 'json',
        addressdetails: '1',
        limit: limit.toString(),
        countrycodes: 'lk', // Restrict to Sri Lanka
      });

      const response = await fetch(`${this.baseUrl}/search?${params}`, {
        headers: {
          'User-Agent': this.userAgent,
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        this.logger.error(`Address search request failed: ${response.status}`);
        return [];
      }

      const data: NominatimResponse[] = await response.json();

      return data.map((result) => ({
        latitude: parseFloat(result.lat),
        longitude: parseFloat(result.lon),
        displayName: result.display_name,
        address: result.address
          ? {
              road: result.address.road,
              suburb: result.address.suburb,
              city: result.address.city,
              district: result.address.county,
              state: result.address.state,
              postcode: result.address.postcode,
              country: result.address.country,
            }
          : undefined,
      }));
    } catch (error) {
      this.logger.error(`Address search error: ${error.message}`);
      return [];
    }
  }
}
