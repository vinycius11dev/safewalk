import { z } from 'zod';
import { urbanWeatherSchema } from '@safewalk/contracts';
import { publicJson } from './public-http.js';
import type { UrbanBounds } from './urban-bounds.js';

const responseSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
  current_units: z.object({
    interval: z.literal('seconds'),
    precipitation: z.literal('mm'),
    rain: z.literal('mm'),
  }),
  current: z.object({
    time: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/),
    interval: z.number().positive(),
    precipitation: z.number().nonnegative(),
    rain: z.number().nonnegative(),
    weather_code: z.number().int(),
  }),
});

export async function fetchWeather(bbox: UrbanBounds) {
  const latitude = Number(((bbox[1] + bbox[3]) / 2).toFixed(2));
  const longitude = Number(((bbox[0] + bbox[2]) / 2).toFixed(2));
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.search = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    current: 'precipitation,rain,weather_code',
    timezone: 'UTC',
    forecast_days: '1',
  }).toString();
  const data = responseSchema.parse(await publicJson(url));
  const fetchedAt = new Date();
  const observedAt = new Date(`${data.current.time}:00.000Z`).toISOString();
  if (Math.abs(new Date(observedAt).getTime() - fetchedAt.getTime()) > 3_600_000)
    throw new Error('URBAN_WEATHER_OUTDATED');
  return urbanWeatherSchema.parse({
    latitude: data.latitude,
    longitude: data.longitude,
    observedAt,
    fetchedAt: fetchedAt.toISOString(),
    expiresAt: new Date(fetchedAt.getTime() + 600_000).toISOString(),
    precipitationMillimeters: data.current.precipitation,
    rainMillimeters: data.current.rain,
    intervalSeconds: data.current.interval,
    weatherCode: data.current.weather_code,
    sourceUrl: 'https://open-meteo.com/en/docs',
    attribution: 'Weather data by Open-Meteo.com (CC BY 4.0).',
    note: 'Precipitação modelada acumulada no intervalo em segundos informado, não mm/h. Coordenada é a célula do modelo; chuva não confirma alagamento.',
  });
}
