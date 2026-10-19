-- Security hardening: prevent anon/authenticated Data API roles from accessing application tables.
-- The application uses the trusted server-side DATABASE_URL for database operations.
-- No client-facing policies are added: application access must continue through the authenticated API.
ALTER TABLE "public"."aiAssistanceRequests" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "public"."auditLogs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "public"."departments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "public"."managerScopes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "public"."notifications" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "public"."permissions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "public"."queues" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "public"."rolePermissions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "public"."roles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "public"."serviceCategories" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "public"."services" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "public"."teams" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "public"."ticketApprovals" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "public"."ticketAttachments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "public"."ticketComments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "public"."ticketEvents" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "public"."ticketTypes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "public"."tickets" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "public"."userInvitations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "public"."userRoles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;