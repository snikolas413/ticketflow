CREATE TYPE "public"."ai_assistance_status" AS ENUM('pending', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."approval_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."comment_visibility" AS ENUM('public', 'internal');--> statement-breakpoint
CREATE TYPE "public"."ticket_priority" AS ENUM('low', 'medium', 'high', 'urgent');--> statement-breakpoint
CREATE TYPE "public"."ticket_status" AS ENUM('open', 'in_progress', 'waiting_requester', 'resolved', 'closed');--> statement-breakpoint
CREATE TYPE "public"."user_profile" AS ENUM('requester', 'agent', 'approver', 'manager');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('user', 'admin');--> statement-breakpoint
CREATE TABLE "aiAssistanceRequests" (
	"id" serial PRIMARY KEY NOT NULL,
	"ticketId" integer NOT NULL,
	"requesterId" integer NOT NULL,
	"operation" varchar(60) NOT NULL,
	"status" "ai_assistance_status" DEFAULT 'pending' NOT NULL,
	"prompt" text NOT NULL,
	"response" text,
	"errorMessage" varchar(500),
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"completedAt" timestamp
);
--> statement-breakpoint
CREATE TABLE "auditLogs" (
	"id" serial PRIMARY KEY NOT NULL,
	"actorId" integer,
	"ticketId" integer,
	"action" varchar(100) NOT NULL,
	"resource" varchar(100) NOT NULL,
	"payload" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "departments" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(120) NOT NULL,
	"code" varchar(40) NOT NULL,
	"active" integer DEFAULT 1 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "departments_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "managerScopes" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"departmentId" integer,
	"teamId" integer,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"ticketId" integer,
	"approvalId" integer,
	"type" varchar(60) NOT NULL,
	"title" varchar(180) NOT NULL,
	"body" text NOT NULL,
	"readAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "permissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" varchar(120) NOT NULL,
	"description" varchar(255),
	CONSTRAINT "permissions_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "queues" (
	"id" serial PRIMARY KEY NOT NULL,
	"departmentId" integer NOT NULL,
	"teamId" integer NOT NULL,
	"name" varchar(120) NOT NULL,
	"active" integer DEFAULT 1 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rolePermissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"roleId" integer NOT NULL,
	"permissionId" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(80) NOT NULL,
	"description" varchar(255),
	"isSystem" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "roles_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "serviceCategories" (
	"id" serial PRIMARY KEY NOT NULL,
	"parentId" integer,
	"name" varchar(120) NOT NULL,
	"code" varchar(60) NOT NULL,
	"description" varchar(255),
	"sortOrder" integer DEFAULT 0 NOT NULL,
	"active" integer DEFAULT 1 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "serviceCategories_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "services" (
	"id" serial PRIMARY KEY NOT NULL,
	"categoryId" integer NOT NULL,
	"name" varchar(160) NOT NULL,
	"code" varchar(60) NOT NULL,
	"description" varchar(500),
	"defaultTicketTypeId" integer,
	"defaultQueueId" integer,
	"active" integer DEFAULT 1 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "services_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "teams" (
	"id" serial PRIMARY KEY NOT NULL,
	"departmentId" integer NOT NULL,
	"name" varchar(120) NOT NULL,
	"active" integer DEFAULT 1 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ticketApprovals" (
	"id" serial PRIMARY KEY NOT NULL,
	"ticketId" integer NOT NULL,
	"approverId" integer NOT NULL,
	"requestedById" integer NOT NULL,
	"status" "approval_status" DEFAULT 'pending' NOT NULL,
	"requestNote" text,
	"decisionNote" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"decidedAt" timestamp
);
--> statement-breakpoint
CREATE TABLE "ticketAttachments" (
	"id" serial PRIMARY KEY NOT NULL,
	"ticketId" integer NOT NULL,
	"commentId" integer,
	"uploadedById" integer NOT NULL,
	"fileName" varchar(255) NOT NULL,
	"contentType" varchar(120) NOT NULL,
	"fileSize" integer NOT NULL,
	"storageKey" varchar(500) NOT NULL,
	"storageUrl" varchar(600) NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "ticketAttachments_storageKey_unique" UNIQUE("storageKey")
);
--> statement-breakpoint
CREATE TABLE "ticketComments" (
	"id" serial PRIMARY KEY NOT NULL,
	"ticketId" integer NOT NULL,
	"authorId" integer NOT NULL,
	"visibility" "comment_visibility" DEFAULT 'public' NOT NULL,
	"body" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ticketEvents" (
	"id" serial PRIMARY KEY NOT NULL,
	"ticketId" integer NOT NULL,
	"actorId" integer,
	"eventType" varchar(80) NOT NULL,
	"payload" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ticketTypes" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(120) NOT NULL,
	"description" varchar(255),
	"defaultQueueId" integer,
	"active" integer DEFAULT 1 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tickets" (
	"id" serial PRIMARY KEY NOT NULL,
	"publicNumber" varchar(32) NOT NULL,
	"title" varchar(180) NOT NULL,
	"description" text NOT NULL,
	"requesterId" integer NOT NULL,
	"departmentId" integer NOT NULL,
	"teamId" integer NOT NULL,
	"queueId" integer NOT NULL,
	"assigneeId" integer,
	"ticketTypeId" integer NOT NULL,
	"categoryId" integer,
	"serviceId" integer,
	"priority" "ticket_priority" DEFAULT 'medium' NOT NULL,
	"status" "ticket_status" DEFAULT 'open' NOT NULL,
	"approvalStatus" "approval_status" DEFAULT 'pending' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"resolvedAt" timestamp,
	"closedAt" timestamp,
	CONSTRAINT "tickets_publicNumber_unique" UNIQUE("publicNumber")
);
--> statement-breakpoint
CREATE TABLE "userInvitations" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" varchar(320) NOT NULL,
	"passwordHash" varchar(220),
	"profile" "user_profile" DEFAULT 'requester' NOT NULL,
	"departmentId" integer,
	"teamId" integer,
	"invitedById" integer NOT NULL,
	"active" integer DEFAULT 1 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "userInvitations_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "userRoles" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"roleId" integer NOT NULL,
	"departmentId" integer,
	"teamId" integer,
	"queueId" integer
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"openId" varchar(64) NOT NULL,
	"name" text,
	"email" varchar(320),
	"passwordHash" varchar(220),
	"loginMethod" varchar(64),
	"role" "user_role" DEFAULT 'user' NOT NULL,
	"profile" "user_profile" DEFAULT 'requester' NOT NULL,
	"departmentId" integer,
	"teamId" integer,
	"active" integer DEFAULT 1 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"lastSignedIn" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_openId_unique" UNIQUE("openId")
);
--> statement-breakpoint
ALTER TABLE "aiAssistanceRequests" ADD CONSTRAINT "aiAssistanceRequests_ticketId_tickets_id_fk" FOREIGN KEY ("ticketId") REFERENCES "public"."tickets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aiAssistanceRequests" ADD CONSTRAINT "aiAssistanceRequests_requesterId_users_id_fk" FOREIGN KEY ("requesterId") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auditLogs" ADD CONSTRAINT "auditLogs_actorId_users_id_fk" FOREIGN KEY ("actorId") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auditLogs" ADD CONSTRAINT "auditLogs_ticketId_tickets_id_fk" FOREIGN KEY ("ticketId") REFERENCES "public"."tickets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "managerScopes" ADD CONSTRAINT "managerScopes_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "managerScopes" ADD CONSTRAINT "managerScopes_departmentId_departments_id_fk" FOREIGN KEY ("departmentId") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "managerScopes" ADD CONSTRAINT "managerScopes_teamId_teams_id_fk" FOREIGN KEY ("teamId") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_ticketId_tickets_id_fk" FOREIGN KEY ("ticketId") REFERENCES "public"."tickets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_approvalId_ticketApprovals_id_fk" FOREIGN KEY ("approvalId") REFERENCES "public"."ticketApprovals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "queues" ADD CONSTRAINT "queues_departmentId_departments_id_fk" FOREIGN KEY ("departmentId") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "queues" ADD CONSTRAINT "queues_teamId_teams_id_fk" FOREIGN KEY ("teamId") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rolePermissions" ADD CONSTRAINT "rolePermissions_roleId_roles_id_fk" FOREIGN KEY ("roleId") REFERENCES "public"."roles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rolePermissions" ADD CONSTRAINT "rolePermissions_permissionId_permissions_id_fk" FOREIGN KEY ("permissionId") REFERENCES "public"."permissions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "services" ADD CONSTRAINT "services_categoryId_serviceCategories_id_fk" FOREIGN KEY ("categoryId") REFERENCES "public"."serviceCategories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "services" ADD CONSTRAINT "services_defaultTicketTypeId_ticketTypes_id_fk" FOREIGN KEY ("defaultTicketTypeId") REFERENCES "public"."ticketTypes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "services" ADD CONSTRAINT "services_defaultQueueId_queues_id_fk" FOREIGN KEY ("defaultQueueId") REFERENCES "public"."queues"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_departmentId_departments_id_fk" FOREIGN KEY ("departmentId") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticketApprovals" ADD CONSTRAINT "ticketApprovals_ticketId_tickets_id_fk" FOREIGN KEY ("ticketId") REFERENCES "public"."tickets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticketApprovals" ADD CONSTRAINT "ticketApprovals_approverId_users_id_fk" FOREIGN KEY ("approverId") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticketApprovals" ADD CONSTRAINT "ticketApprovals_requestedById_users_id_fk" FOREIGN KEY ("requestedById") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticketAttachments" ADD CONSTRAINT "ticketAttachments_ticketId_tickets_id_fk" FOREIGN KEY ("ticketId") REFERENCES "public"."tickets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticketAttachments" ADD CONSTRAINT "ticketAttachments_uploadedById_users_id_fk" FOREIGN KEY ("uploadedById") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticketComments" ADD CONSTRAINT "ticketComments_ticketId_tickets_id_fk" FOREIGN KEY ("ticketId") REFERENCES "public"."tickets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticketComments" ADD CONSTRAINT "ticketComments_authorId_users_id_fk" FOREIGN KEY ("authorId") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticketEvents" ADD CONSTRAINT "ticketEvents_ticketId_tickets_id_fk" FOREIGN KEY ("ticketId") REFERENCES "public"."tickets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticketEvents" ADD CONSTRAINT "ticketEvents_actorId_users_id_fk" FOREIGN KEY ("actorId") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticketTypes" ADD CONSTRAINT "ticketTypes_defaultQueueId_queues_id_fk" FOREIGN KEY ("defaultQueueId") REFERENCES "public"."queues"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_requesterId_users_id_fk" FOREIGN KEY ("requesterId") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_departmentId_departments_id_fk" FOREIGN KEY ("departmentId") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_teamId_teams_id_fk" FOREIGN KEY ("teamId") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_queueId_queues_id_fk" FOREIGN KEY ("queueId") REFERENCES "public"."queues"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_assigneeId_users_id_fk" FOREIGN KEY ("assigneeId") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_ticketTypeId_ticketTypes_id_fk" FOREIGN KEY ("ticketTypeId") REFERENCES "public"."ticketTypes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_categoryId_serviceCategories_id_fk" FOREIGN KEY ("categoryId") REFERENCES "public"."serviceCategories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_serviceId_services_id_fk" FOREIGN KEY ("serviceId") REFERENCES "public"."services"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "userInvitations" ADD CONSTRAINT "userInvitations_departmentId_departments_id_fk" FOREIGN KEY ("departmentId") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "userInvitations" ADD CONSTRAINT "userInvitations_teamId_teams_id_fk" FOREIGN KEY ("teamId") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "userInvitations" ADD CONSTRAINT "userInvitations_invitedById_users_id_fk" FOREIGN KEY ("invitedById") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "userRoles" ADD CONSTRAINT "userRoles_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "userRoles" ADD CONSTRAINT "userRoles_roleId_roles_id_fk" FOREIGN KEY ("roleId") REFERENCES "public"."roles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "userRoles" ADD CONSTRAINT "userRoles_departmentId_departments_id_fk" FOREIGN KEY ("departmentId") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "userRoles" ADD CONSTRAINT "userRoles_teamId_teams_id_fk" FOREIGN KEY ("teamId") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "userRoles" ADD CONSTRAINT "userRoles_queueId_queues_id_fk" FOREIGN KEY ("queueId") REFERENCES "public"."queues"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_departmentId_departments_id_fk" FOREIGN KEY ("departmentId") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_teamId_teams_id_fk" FOREIGN KEY ("teamId") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_requests_ticket_idx" ON "aiAssistanceRequests" USING btree ("ticketId","createdAt");--> statement-breakpoint
CREATE INDEX "audit_logs_ticket_idx" ON "auditLogs" USING btree ("ticketId","createdAt");--> statement-breakpoint
CREATE INDEX "audit_logs_actor_idx" ON "auditLogs" USING btree ("actorId","createdAt");--> statement-breakpoint
CREATE UNIQUE INDEX "manager_scopes_unique" ON "managerScopes" USING btree ("userId","departmentId","teamId");--> statement-breakpoint
CREATE INDEX "manager_scopes_user_idx" ON "managerScopes" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "manager_scopes_department_idx" ON "managerScopes" USING btree ("departmentId");--> statement-breakpoint
CREATE INDEX "manager_scopes_team_idx" ON "managerScopes" USING btree ("teamId");--> statement-breakpoint
CREATE INDEX "notifications_user_idx" ON "notifications" USING btree ("userId","readAt","createdAt");--> statement-breakpoint
CREATE INDEX "queues_team_idx" ON "queues" USING btree ("teamId");--> statement-breakpoint
CREATE UNIQUE INDEX "role_permissions_unique" ON "rolePermissions" USING btree ("roleId","permissionId");--> statement-breakpoint
CREATE INDEX "service_categories_parent_idx" ON "serviceCategories" USING btree ("parentId","active");--> statement-breakpoint
CREATE INDEX "services_category_idx" ON "services" USING btree ("categoryId","active");--> statement-breakpoint
CREATE INDEX "teams_department_idx" ON "teams" USING btree ("departmentId");--> statement-breakpoint
CREATE INDEX "ticket_approvals_approver_idx" ON "ticketApprovals" USING btree ("approverId","status");--> statement-breakpoint
CREATE INDEX "ticket_approvals_ticket_idx" ON "ticketApprovals" USING btree ("ticketId","createdAt");--> statement-breakpoint
CREATE INDEX "ticket_attachments_ticket_idx" ON "ticketAttachments" USING btree ("ticketId","createdAt");--> statement-breakpoint
CREATE INDEX "ticket_comments_ticket_idx" ON "ticketComments" USING btree ("ticketId","createdAt");--> statement-breakpoint
CREATE INDEX "ticket_events_ticket_idx" ON "ticketEvents" USING btree ("ticketId","createdAt");--> statement-breakpoint
CREATE INDEX "tickets_requester_idx" ON "tickets" USING btree ("requesterId");--> statement-breakpoint
CREATE INDEX "tickets_assignee_idx" ON "tickets" USING btree ("assigneeId");--> statement-breakpoint
CREATE INDEX "tickets_approval_status_idx" ON "tickets" USING btree ("approvalStatus","departmentId","teamId");--> statement-breakpoint
CREATE INDEX "tickets_queue_status_idx" ON "tickets" USING btree ("queueId","status","priority");--> statement-breakpoint
CREATE INDEX "tickets_updated_idx" ON "tickets" USING btree ("updatedAt");--> statement-breakpoint
CREATE UNIQUE INDEX "user_roles_scope_unique" ON "userRoles" USING btree ("userId","roleId","departmentId","teamId","queueId");