import { defineTool } from "eve/tools";
import { z } from "zod";

const GEOCODE_URL = "https://geocoding-api.open-meteo.com/v1/search";
const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";

const WEATHER_CODES: Record<number, string> = {
  0: "clear sky",
  1: "mainly clear",
  2: "partly cloudy",
  3: "overcast",
  45: "fog",
  48: "freezing fog",
  51: "light drizzle",
  53: "drizzle",
  55: "heavy drizzle",
  61: "light rain",
  63: "rain",
  65: "heavy rain",
  71: "light snow",
  73: "snow",
  75: "heavy snow",
  80: "rain showers",
  81: "heavy rain showers",
  82: "violent rain showers",
  95: "thunderstorm",
  96: "thunderstorm with hail",
  99: "thunderstorm with heavy hail",
};

type GeocodeResponse = {
  results?: {
    name: string;
    latitude: number;
    longitude: number;
    country?: string;
    admin1?: string;
  }[];
};

type ForecastResponse = {
  current?: {
    temperature_2m?: number;
    apparent_temperature?: number;
    relative_humidity_2m?: number;
    wind_speed_10m?: number;
    weather_code?: number;
  };
};

export default defineTool({
  description:
    "Get the current weather anywhere in the world. Pass a place name such as " +
    "'Bengaluru', 'Paris, France' or 'Mount Fuji'. Returns temperature in " +
    "Celsius, what it feels like, humidity, wind speed, and a plain description " +
    "of conditions.",

  inputSchema: z.object({
    location: z.string().min(2).describe("A city, town, or landmark name."),
  }),

  async execute({ location }, ctx) {
    const geocodeUrl = `${GEOCODE_URL}?${new URLSearchParams({
      name: location,
      count: "1",
      language: "en",
      format: "json",
    })}`;

    const geocodeResponse = await fetch(geocodeUrl, { signal: ctx.abortSignal });
    if (!geocodeResponse.ok) {
      return { found: false, message: `Could not look up "${location}" right now.` };
    }

    const place = ((await geocodeResponse.json()) as GeocodeResponse).results?.[0];
    if (!place) {
      return { found: false, message: `No place called "${location}" was found.` };
    }

    const forecastUrl = `${FORECAST_URL}?${new URLSearchParams({
      latitude: String(place.latitude),
      longitude: String(place.longitude),
      current: "temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code",
    })}`;

    const forecastResponse = await fetch(forecastUrl, { signal: ctx.abortSignal });
    if (!forecastResponse.ok) {
      return { found: false, message: `Could not read the forecast for ${place.name}.` };
    }

    const current = ((await forecastResponse.json()) as ForecastResponse).current ?? {};
    const region = [place.admin1, place.country].filter(Boolean).join(", ");

    return {
      found: true,
      location: region ? `${place.name}, ${region}` : place.name,
      conditions:
        current.weather_code === undefined
          ? "unknown"
          : (WEATHER_CODES[current.weather_code] ?? "unusual conditions"),
      temperatureC: current.temperature_2m ?? null,
      feelsLikeC: current.apparent_temperature ?? null,
      humidityPercent: current.relative_humidity_2m ?? null,
      windSpeedKmh: current.wind_speed_10m ?? null,
    };
  },
});
