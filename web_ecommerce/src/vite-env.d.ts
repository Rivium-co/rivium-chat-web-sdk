/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Your project's public key (rv_live_...) from Rivium Console. */
  readonly VITE_RIVIUM_API_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
