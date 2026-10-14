/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the Django API, without a trailing slash. */
  readonly VITE_API_URL?: string;
}
