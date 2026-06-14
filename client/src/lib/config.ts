export const config = {
  apiBase: import.meta.env.VITE_API_BASE_URL ?? "",
  auth0: {
    domain: (import.meta.env.VITE_AUTH0_DOMAIN_URL || "").replace(/^https?:\/\//, ""),
    clientId: import.meta.env.VITE_AUTH0_CLIENT_ID || "",
    audience: import.meta.env.VITE_AUTH0_AUDIENCE || "",
    redirectUri: import.meta.env.VITE_AUTH0_REDIRECT_URI || window.location.origin + "/dashboard",
  },
  agoraAppId: import.meta.env.VITE_AGORA_APP_ID || "",
  stripePk: import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || "",
  discordUrl: import.meta.env.VITE_DISCORD_INVITE_URL || "https://discord.gg/soulseer",
  facebookUrl: import.meta.env.VITE_FACEBOOK_GROUP_URL || "https://facebook.com/groups/soulseer",
};
