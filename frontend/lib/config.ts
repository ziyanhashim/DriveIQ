// Uses EXPO_PUBLIC_API_BASE_URL if set, otherwise defaults to localhost:8000
export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL || "http://localhost:8000";
