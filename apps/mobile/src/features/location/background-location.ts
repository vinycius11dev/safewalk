import { Platform } from 'react-native';
import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import * as SecureStore from 'expo-secure-store';
import { z } from 'zod';
import { readSession } from '@/lib/session-storage';
import { ApiError } from '@/lib/api-client';
import { tripsService } from '@/features/trips/trips.service';

const taskName = 'safewalk-real-trip-location';
const storageKey = 'safewalk-background-trip';
const taskConfig = z.object({ tripId: z.uuid(), userId: z.uuid() });
if (Platform.OS !== 'web' && !TaskManager.isTaskDefined(taskName)) {
  TaskManager.defineTask<{ locations: Location.LocationObject[] }>(
    taskName,
    async ({ data, error }) => {
      if (error || !data?.locations.length) return;
      try {
        const stored = await SecureStore.getItemAsync(storageKey);
        const parsed = taskConfig.safeParse(stored ? JSON.parse(stored) : null);
        const session = await readSession();
        if (!parsed.success || !session || session.user.id !== parsed.data.userId) {
          await stopBackgroundTrip();
          return;
        }
        const latest = data.locations.at(-1);
        if (
          !latest ||
          latest.coords.accuracy === null ||
          latest.coords.accuracy > 150 ||
          latest.timestamp < Date.now() - 180000
        )
          return;
        await tripsService.position(session.token, parsed.data.tripId, {
          latitude: latest.coords.latitude,
          longitude: latest.coords.longitude,
          accuracyMeters: latest.coords.accuracy,
          recordedAt: new Date(latest.timestamp).toISOString(),
        });
      } catch (failure) {
        if (failure instanceof ApiError && [401, 403, 404, 409, 410].includes(failure.status))
          await stopBackgroundTrip();
      }
    },
  );
}
export async function stopBackgroundTrip(): Promise<void> {
  if (Platform.OS === 'web') return;
  if (await Location.hasStartedLocationUpdatesAsync(taskName))
    await Location.stopLocationUpdatesAsync(taskName);
  await SecureStore.deleteItemAsync(storageKey);
}
export async function startBackgroundTrip(tripId: string): Promise<void> {
  if (Platform.OS === 'web')
    throw new Error(
      'O navegador acompanha apenas enquanto a página está ativa. Use o aplicativo nativo para testar tela bloqueada.',
    );
  const session = await readSession();
  if (!session) throw new Error('Entre novamente para iniciar o acompanhamento.');
  const permission = await Location.requestBackgroundPermissionsAsync();
  if (permission.status !== 'granted')
    throw new Error(
      'A localização em segundo plano não foi autorizada. O acompanhamento continua apenas com o aplicativo aberto.',
    );
  await SecureStore.setItemAsync(storageKey, JSON.stringify({ tripId, userId: session.user.id }));
  try {
    await Location.startLocationUpdatesAsync(taskName, {
      accuracy: Location.Accuracy.High,
      timeInterval: 10000,
      distanceInterval: 10,
      pausesUpdatesAutomatically: false,
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: 'SafeWalk · trajeto ativo',
        notificationBody: 'Sua localização está sendo compartilhada durante esta caminhada.',
      },
    });
  } catch (error) {
    await SecureStore.deleteItemAsync(storageKey);
    throw error;
  }
}
