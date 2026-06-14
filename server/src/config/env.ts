import "dotenv/config";

function req(name: string): string {
  const v = process.env[name];
  if (!v || v.length === 0) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(`Missing required env var: ${name}`);
    }
    console.warn(`[env] WARNING: ${name} is not set`);
    return "";
  }
  return v;
}
function opt(name: string, fallback = ""): string {
  return process.env[name] ?? fallback;
}

export const env = {
  nodeEnv: opt("NODE_ENV", "development"),
  isProd: process.env.NODE_ENV === "production",
  port: parseInt(opt("PORT", "8080"), 10),
  clientOrigin: opt("CLIENT_ORIGIN", "http://localhost:5173"),

  // Neon / Postgres
  databaseUrl: req("NEON_DB_CONNECTION_STRING"),

  // Redis
  redis: {
    host: opt("REDIS_DB_HOST"),
    port: parseInt(opt("REDIS_DB_PORT", "6379"), 10),
    username: opt("REDIS_DB_USERNAME"),
    password: opt("REDIS_DB_PASSWORD"),
  },

  // Auth0
  auth0: {
    domain: opt("AUTH0_DOMAIN") || opt("VITE_AUTH0_DOMAIN_URL"),
    audience: opt("AUTH0_AUDIENCE") || opt("VITE_AUTH0_AUDIENCE"),
    mgmtClientId: opt("AUTH0_MGMT_CLIENT_ID") || opt("AUTH0_APP_ID"),
    mgmtClientSecret: opt("AUTH0_MGMT_CLIENT_SECRET") || opt("AUTH0_CLIENT_SECRET"),
  },

  // Agora
  agora: {
    appId: opt("AGORA_APP_ID") || opt("VITE_AGORA_APP_ID"),
    certificate: opt("AGORA_SECURITY_CERTIFICATE"),
    chatAppId: opt("AGORA_CHAT_APP_ID"),
  },

  // Stripe
  stripe: {
    secretKey: req("STRIPE_SECRET_KEY"),
    webhookSecret: req("STRIPE_WEBHOOK_SIGNING_SECRET"),
  },

  // Cloudinary
  cloudinary: {
    cloudName: opt("CLOUDINARY_CLOUD_NAME"),
    apiKey: opt("CLOUDINARY_API_KEY"),
    apiSecret: opt("CLOUDINARY_SECRET"),
  },
};
