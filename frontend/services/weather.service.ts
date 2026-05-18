export interface DailyWeather {
  date: string;
  precipitationSum: number;
  weatherCode: number;
}

export type WeatherSeverity = "none" | "light" | "moderate" | "heavy" | "storm";

export function getWeatherSeverity(w: DailyWeather): WeatherSeverity {
  const { precipitationSum: p, weatherCode: c } = w;
  if (c >= 95) return "storm";
  if (p > 15 || c === 82) return "heavy";
  if (p > 5 || c >= 63) return "moderate";
  if (p > 0.5 || c >= 51) return "light";
  return "none";
}

export function getWeatherLabel(code: number): string {
  if (code === 0) return "Clear sky";
  if (code <= 3) return "Partly cloudy";
  if (code <= 48) return "Fog";
  if (code <= 57) return "Drizzle";
  if (code <= 67) return "Rain";
  if (code <= 82) return "Rain showers";
  return "Thunderstorm";
}

export async function fetchLocationForecast(
  lat: number,
  lon: number,
): Promise<Map<string, DailyWeather>> {
  const params = new URLSearchParams({
    latitude: lat.toFixed(4),
    longitude: lon.toFixed(4),
    daily: "precipitation_sum,weathercode",
    timezone: "Asia/Colombo",
    forecast_days: "16",
  });

  const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
  if (!res.ok) throw new Error(`Weather API ${res.status}`);

  const data = await res.json();
  const result = new Map<string, DailyWeather>();
  const times: string[] = data.daily?.time ?? [];
  const precip: (number | null)[] = data.daily?.precipitation_sum ?? [];
  const codes: (number | null)[] = data.daily?.weathercode ?? [];

  for (let i = 0; i < times.length; i++) {
    result.set(times[i], {
      date: times[i],
      precipitationSum: precip[i] ?? 0,
      weatherCode: codes[i] ?? 0,
    });
  }

  return result;
}
