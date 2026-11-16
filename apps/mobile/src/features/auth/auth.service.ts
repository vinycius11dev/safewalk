import {
  sessionResponseSchema,
  userResponseSchema,
  profileResponseSchema,
  profileUpdateSchema,
  changePinSchema,
  deleteAccountSchema,
  profileSettingsResponseSchema,
  personalDataExportSchema,
  passwordResetRequestResponseSchema,
  type ProfileSettingsInput,
} from '@safewalk/contracts';
import { z } from 'zod';
import { apiRequest } from '@/lib/api-client';
export const authService = {
  demo: () => apiRequest('/auth/demo', sessionResponseSchema, { method: 'POST' }),
  login: (email: string, password: string) =>
    apiRequest('/auth/login', sessionResponseSchema, { method: 'POST', body: { email, password } }),
  register: (name: string, email: string, password: string) =>
    apiRequest('/auth/register', sessionResponseSchema, {
      method: 'POST',
      body: { name, email, password },
    }),
  forgotPassword: (email: string) =>
    apiRequest('/auth/password/forgot', passwordResetRequestResponseSchema, {
      method: 'POST',
      body: { email },
    }),
  resetPassword: (token: string, password: string) =>
    apiRequest('/auth/password/reset', z.undefined(), {
      method: 'POST',
      body: { token, password },
    }),
  me: (token: string) => apiRequest('/auth/me', userResponseSchema, { token }),
  setPin: (token: string, pin: string) =>
    apiRequest('/auth/pin', z.undefined(), { token, method: 'PUT', body: { pin } }),
  profile: (token: string, signal?: AbortSignal) =>
    apiRequest('/auth/profile', profileResponseSchema, { token, signal }),
  updateProfile: (token: string, body: z.infer<typeof profileUpdateSchema>) =>
    apiRequest('/auth/profile', profileResponseSchema, { token, method: 'PUT', body }),
  changePin: (token: string, body: z.infer<typeof changePinSchema>) =>
    apiRequest('/auth/pin/change', z.undefined(), { token, method: 'PUT', body }),
  setDuressPin: (token: string, currentPin: string, duressPin: string) =>
    apiRequest('/auth/duress-pin', z.undefined(), {
      token,
      method: 'PUT',
      body: { currentPin, duressPin },
    }),
  removeDuressPin: (token: string, currentPin: string) =>
    apiRequest('/auth/duress-pin', z.undefined(), {
      token,
      method: 'DELETE',
      body: { currentPin },
    }),
  deleteAccount: (token: string, body: z.infer<typeof deleteAccountSchema>) =>
    apiRequest('/auth/account', z.undefined(), { token, method: 'DELETE', body }),
  settings: (token: string, signal?: AbortSignal) =>
    apiRequest('/auth/settings', profileSettingsResponseSchema, { token, signal }),
  saveSettings: (token: string, body: ProfileSettingsInput) =>
    apiRequest('/auth/settings', profileSettingsResponseSchema, { token, method: 'PUT', body }),
  exportData: (token: string) => apiRequest('/auth/export', personalDataExportSchema, { token }),
};
