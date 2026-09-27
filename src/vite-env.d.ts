/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Development only: the origin of the API server (see .env.example). */
  readonly VITE_API_BASE_URL?: string;
}
