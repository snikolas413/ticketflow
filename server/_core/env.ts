// Platform values are read at use time. See the Webdev service/authentication skills.
export const ENV = {
  get appId() { return process.env.APP_ID ?? process.env.MANUS_PROJECT_ID ?? "ticketflow-production"; },
  get cookieSecret() { return process.env.SESSION_SECRET ?? process.env.MANUS_JWT_SECRET ?? ""; },
  get databaseUrl() { return process.env.DATABASE_URL ?? ""; },
  // Optional OpenAI-compatible provider for AI assistance. No Manus endpoint is used.
  get aiApiUrl() { return process.env.AI_API_URL ?? ""; },
  get aiApiKey() { return process.env.AI_API_KEY ?? ""; },
  get platformApiUrl() { return process.env.PLATFORM_API_URL ?? ""; },
  get platformApiKey() { return process.env.PLATFORM_API_KEY ?? ""; },
  // Preserve the legacy hint when supplied; otherwise roles remain application data.
  get ownerOpenId() { return process.env.OWNER_OPEN_ID ?? ""; },
  get isProduction() { return process.env.NODE_ENV === "production"; },
  get supabaseUrl() { return process.env.SUPABASE_URL ?? ""; },
  get supabaseServiceRoleKey() { return process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""; },
  get supabaseStorageBucket() { return process.env.SUPABASE_STORAGE_BUCKET ?? "ticket-attachments"; },
  get smtpHost() { return process.env.SMTP_HOST ?? "smtp.gmail.com"; },
  get smtpPort() { return Number(process.env.SMTP_PORT ?? "465"); },
  get smtpUser() { return process.env.SMTP_USER ?? ""; },
  get smtpPass() { return process.env.SMTP_PASS ?? ""; },
  get smtpFrom() { return process.env.SMTP_FROM ?? process.env.SMTP_USER ?? ""; },
  get gmailOAuthClientId() { return process.env.GMAIL_OAUTH_CLIENT_ID ?? process.env.GOOGLE_OAUTH_CLIENT_ID ?? process.env.GMAIL_CLIENT_ID ?? process.env.GOOGLE_CLIENT_ID ?? ""; },
  get gmailOAuthClientSecret() { return process.env.GMAIL_OAUTH_CLIENT_SECRET ?? process.env.GOOGLE_OAUTH_CLIENT_SECRET ?? process.env.GMAIL_CLIENT_SECRET ?? process.env.GOOGLE_CLIENT_SECRET ?? ""; },
  get gmailOAuthRefreshToken() { return process.env.GMAIL_OAUTH_REFRESH_TOKEN ?? process.env.GOOGLE_OAUTH_REFRESH_TOKEN ?? process.env.GMAIL_REFRESH_TOKEN ?? process.env.GOOGLE_REFRESH_TOKEN ?? ""; },
  get gmailUserEmail() { return process.env.GMAIL_USER_EMAIL ?? process.env.GMAIL_FROM ?? process.env.SMTP_FROM ?? process.env.SMTP_USER ?? ""; },
};
