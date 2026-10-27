/**
 * Centralized Axios client instance.
 *
 * Base URL is read from VITE_API_BASE_URL (set in .env).
 * All API service modules should import this client instead of
 * creating their own Axios instances.
 */

import axios from 'axios';

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? '',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 90_000, // 90s — Ollama question generation can take time
});

export default apiClient;
