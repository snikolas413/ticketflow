// Platform values are read at use time. See the Webdev service/authentication skills.
export const ENV = {
  get appId() { return process.env.APP_ID ?? process.env.MANUS_PROJECT_ID ?? "ticketflow-production"; },
  get cookieSecret() { return process.env.SESSION_SECRET ?? process.env.MANUS_JWT_SECRET ?? ""; },
  get databaseUrl() { return process.env.DATABASE_URL ?? ""; },
  // Keep Forge settings for existing AI, notification, and platform integrations.
  get forgeApiUrl() { return process.env.MANUS_API_URL ?? ""; },
  get forgeApiKey() { return process.env.MANUS_API_KEY ?? ""; },
  // Preserve the legacy hint when supplied; otherwise roles remain application data.
  get ownerOpenId() { return process.env.OWNER_OPEN_ID ?? ""; },
  get isProduction() { return process.env.NODE_ENV === "production"; },
  get supabaseUrl() { return process.env.SUPABASE_URL ?? ""; },
  get supabaseServiceRoleKey() { return process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""; },
  get supabaseStorageBucket() { return process.env.SUPABASE_STORAGE_BUCKET ?? "ticket-attachments"; },
};
