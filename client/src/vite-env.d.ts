/// <reference types="vite/client" />
interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
  readonly VITE_AUTH0_DOMAIN_URL: string;
  readonly VITE_AUTH0_CLIENT_ID: string;
  readonly VITE_AUTH0_AUDIENCE: string;
  readonly VITE_AUTH0_REDIRECT_URI: string;
  readonly VITE_AGORA_APP_ID: string;
  readonly VITE_STRIPE_PUBLISHABLE_KEY: string;
  readonly VITE_DISCORD_INVITE_URL: string;
  readonly VITE_FACEBOOK_GROUP_URL: string;
}
interface ImportMeta { readonly env: ImportMetaEnv; }
