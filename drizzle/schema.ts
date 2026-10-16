import {
  index,
  integer,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

export const userRoleEnum = pgEnum("user_role", ["user", "admin"]);
export const userProfileEnum = pgEnum("user_profile", ["requester", "agent", "approver", "manager"]);
export const ticketPriorityEnum = pgEnum("ticket_priority", ["low", "medium", "high", "urgent"]);
export const ticketStatusEnum = pgEnum("ticket_status", ["open", "in_progress", "waiting_requester", "resolved", "closed"]);
export const approvalStatusEnum = pgEnum("approval_status", ["pending", "approved", "rejected"]);
export const commentVisibilityEnum = pgEnum("comment_visibility", ["public", "internal"]);
export const aiAssistanceStatusEnum = pgEnum("ai_assistance_status", ["pending", "completed", "failed"]);

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  passwordHash: varchar("passwordHash", { length: 220 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: userRoleEnum("role").default("user").notNull(),
  profile: userProfileEnum("profile").default("requester").notNull(),
  departmentId: integer("departmentId").references(() => departments.id),
  teamId: integer("teamId").references(() => teams.id),
  active: integer("active").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(() => new Date()).notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const departments = pgTable("departments", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 120 }).notNull(),
  code: varchar("code", { length: 40 }).notNull().unique(),
  active: integer("active").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(() => new Date()).notNull(),
});

export const userInvitations = pgTable("userInvitations", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 320 }).notNull().unique(),
  passwordHash: varchar("passwordHash", { length: 220 }),
  profile: userProfileEnum("profile").default("requester").notNull(),
  departmentId: integer("departmentId").references(() => departments.id),
  teamId: integer("teamId").references(() => teams.id),
  invitedById: integer("invitedById").notNull().references(() => users.id),
  active: integer("active").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const teams = pgTable(
  "teams",
  {
    id: serial("id").primaryKey(),
    departmentId: integer("departmentId").notNull().references(() => departments.id),
    name: varchar("name", { length: 120 }).notNull(),
    active: integer("active").default(1).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(() => new Date()).notNull(),
  },
  table => [index("teams_department_idx").on(table.departmentId)],
);

export const queues = pgTable(
  "queues",
  {
    id: serial("id").primaryKey(),
    departmentId: integer("departmentId").notNull().references(() => departments.id),
    teamId: integer("teamId").notNull().references(() => teams.id),
    name: varchar("name", { length: 120 }).notNull(),
    active: integer("active").default(1).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(() => new Date()).notNull(),
  },
  table => [index("queues_team_idx").on(table.teamId)],
);

export const managerScopes = pgTable(
  "managerScopes",
  {
    id: serial("id").primaryKey(),
    userId: integer("userId").notNull().references(() => users.id),
    departmentId: integer("departmentId").references(() => departments.id),
    teamId: integer("teamId").references(() => teams.id),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    uniqueIndex("manager_scopes_unique").on(table.userId, table.departmentId, table.teamId),
    index("manager_scopes_user_idx").on(table.userId),
    index("manager_scopes_department_idx").on(table.departmentId),
    index("manager_scopes_team_idx").on(table.teamId),
  ],
);

export const roles = pgTable("roles", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 80 }).notNull().unique(),
  description: varchar("description", { length: 255 }),
  isSystem: integer("isSystem").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const permissions = pgTable("permissions", {
  id: serial("id").primaryKey(),
  code: varchar("code", { length: 120 }).notNull().unique(),
  description: varchar("description", { length: 255 }),
});

export const userRoles = pgTable(
  "userRoles",
  {
    id: serial("id").primaryKey(),
    userId: integer("userId").notNull().references(() => users.id),
    roleId: integer("roleId").notNull().references(() => roles.id),
    departmentId: integer("departmentId").references(() => departments.id),
    teamId: integer("teamId").references(() => teams.id),
    queueId: integer("queueId").references(() => queues.id),
  },
  table => [uniqueIndex("user_roles_scope_unique").on(table.userId, table.roleId, table.departmentId, table.teamId, table.queueId)],
);

export const rolePermissions = pgTable(
  "rolePermissions",
  {
    id: serial("id").primaryKey(),
    roleId: integer("roleId").notNull().references(() => roles.id),
    permissionId: integer("permissionId").notNull().references(() => permissions.id),
  },
  table => [uniqueIndex("role_permissions_unique").on(table.roleId, table.permissionId)],
);

export const serviceCategories = pgTable(
  "serviceCategories",
  {
    id: serial("id").primaryKey(),
    parentId: integer("parentId"),
    name: varchar("name", { length: 120 }).notNull(),
    code: varchar("code", { length: 60 }).notNull().unique(),
    description: varchar("description", { length: 255 }),
    sortOrder: integer("sortOrder").default(0).notNull(),
    active: integer("active").default(1).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(() => new Date()).notNull(),
  },
  table => [index("service_categories_parent_idx").on(table.parentId, table.active)],
);

export const ticketTypes = pgTable("ticketTypes", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 120 }).notNull(),
  description: varchar("description", { length: 255 }),
  defaultQueueId: integer("defaultQueueId").references(() => queues.id),
  active: integer("active").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(() => new Date()).notNull(),
});

export const services = pgTable(
  "services",
  {
    id: serial("id").primaryKey(),
    categoryId: integer("categoryId").notNull().references(() => serviceCategories.id),
    name: varchar("name", { length: 160 }).notNull(),
    code: varchar("code", { length: 60 }).notNull().unique(),
    description: varchar("description", { length: 500 }),
    defaultTicketTypeId: integer("defaultTicketTypeId").references(() => ticketTypes.id),
    defaultQueueId: integer("defaultQueueId").references(() => queues.id),
    active: integer("active").default(1).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(() => new Date()).notNull(),
  },
  table => [index("services_category_idx").on(table.categoryId, table.active)],
);

export const tickets = pgTable(
  "tickets",
  {
    id: serial("id").primaryKey(),
    publicNumber: varchar("publicNumber", { length: 32 }).notNull().unique(),
    title: varchar("title", { length: 180 }).notNull(),
    description: text("description").notNull(),
    requesterId: integer("requesterId").notNull().references(() => users.id),
    departmentId: integer("departmentId").notNull().references(() => departments.id),
    teamId: integer("teamId").notNull().references(() => teams.id),
    queueId: integer("queueId").notNull().references(() => queues.id),
    assigneeId: integer("assigneeId").references(() => users.id),
    ticketTypeId: integer("ticketTypeId").notNull().references(() => ticketTypes.id),
    categoryId: integer("categoryId").references(() => serviceCategories.id),
    serviceId: integer("serviceId").references(() => services.id),
    priority: ticketPriorityEnum("priority").default("medium").notNull(),
    status: ticketStatusEnum("status").default("open").notNull(),
    approvalStatus: approvalStatusEnum("approvalStatus").default("pending").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(() => new Date()).notNull(),
    resolvedAt: timestamp("resolvedAt"),
    closedAt: timestamp("closedAt"),
  },
  table => [
    index("tickets_requester_idx").on(table.requesterId),
    index("tickets_assignee_idx").on(table.assigneeId),
    index("tickets_approval_status_idx").on(table.approvalStatus, table.departmentId, table.teamId),
    index("tickets_queue_status_idx").on(table.queueId, table.status, table.priority),
    index("tickets_updated_idx").on(table.updatedAt),
  ],
);

export const ticketAttachments = pgTable(
  "ticketAttachments",
  {
    id: serial("id").primaryKey(),
    ticketId: integer("ticketId").notNull().references(() => tickets.id),
    commentId: integer("commentId"),
    uploadedById: integer("uploadedById").notNull().references(() => users.id),
    fileName: varchar("fileName", { length: 255 }).notNull(),
    contentType: varchar("contentType", { length: 120 }).notNull(),
    fileSize: integer("fileSize").notNull(),
    storageKey: varchar("storageKey", { length: 500 }).notNull().unique(),
    storageUrl: varchar("storageUrl", { length: 600 }).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("ticket_attachments_ticket_idx").on(table.ticketId, table.createdAt)],
);

export const ticketApprovals = pgTable(
  "ticketApprovals",
  {
    id: serial("id").primaryKey(),
    ticketId: integer("ticketId").notNull().references(() => tickets.id),
    approverId: integer("approverId").notNull().references(() => users.id),
    requestedById: integer("requestedById").notNull().references(() => users.id),
    status: approvalStatusEnum("status").default("pending").notNull(),
    requestNote: text("requestNote"),
    decisionNote: text("decisionNote"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    decidedAt: timestamp("decidedAt"),
  },
  table => [index("ticket_approvals_approver_idx").on(table.approverId, table.status), index("ticket_approvals_ticket_idx").on(table.ticketId, table.createdAt)],
);

export const ticketComments = pgTable(
  "ticketComments",
  {
    id: serial("id").primaryKey(),
    ticketId: integer("ticketId").notNull().references(() => tickets.id),
    authorId: integer("authorId").notNull().references(() => users.id),
    visibility: commentVisibilityEnum("visibility").default("public").notNull(),
    body: text("body").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(() => new Date()).notNull(),
  },
  table => [index("ticket_comments_ticket_idx").on(table.ticketId, table.createdAt)],
);

export const ticketEvents = pgTable(
  "ticketEvents",
  {
    id: serial("id").primaryKey(),
    ticketId: integer("ticketId").notNull().references(() => tickets.id),
    actorId: integer("actorId").references(() => users.id),
    eventType: varchar("eventType", { length: 80 }).notNull(),
    payload: text("payload").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("ticket_events_ticket_idx").on(table.ticketId, table.createdAt)],
);

export const auditLogs = pgTable(
  "auditLogs",
  {
    id: serial("id").primaryKey(),
    actorId: integer("actorId").references(() => users.id),
    ticketId: integer("ticketId").references(() => tickets.id),
    action: varchar("action", { length: 100 }).notNull(),
    resource: varchar("resource", { length: 100 }).notNull(),
    payload: text("payload").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("audit_logs_ticket_idx").on(table.ticketId, table.createdAt), index("audit_logs_actor_idx").on(table.actorId, table.createdAt)],
);

export const notifications = pgTable("notifications", {
    id: serial("id").primaryKey(),
    userId: integer("userId").notNull().references(() => users.id),
    ticketId: integer("ticketId").references(() => tickets.id),
    approvalId: integer("approvalId").references(() => ticketApprovals.id),
    type: varchar("type", { length: 60 }).notNull(),
    title: varchar("title", { length: 180 }).notNull(),
    body: text("body").notNull(),
    readAt: timestamp("readAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("notifications_user_idx").on(table.userId, table.readAt, table.createdAt)],
);

export const aiAssistanceRequests = pgTable(
  "aiAssistanceRequests",
  {
    id: serial("id").primaryKey(),
    ticketId: integer("ticketId").notNull().references(() => tickets.id),
    requesterId: integer("requesterId").notNull().references(() => users.id),
    operation: varchar("operation", { length: 60 }).notNull(),
    status: aiAssistanceStatusEnum("status").default("pending").notNull(),
    prompt: text("prompt").notNull(),
    response: text("response"),
    errorMessage: varchar("errorMessage", { length: 500 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    completedAt: timestamp("completedAt"),
  },
  table => [index("ai_requests_ticket_idx").on(table.ticketId, table.createdAt)],
);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Ticket = typeof tickets.$inferSelect;
export type TicketComment = typeof ticketComments.$inferSelect;
export type TicketEvent = typeof ticketEvents.$inferSelect;
export type TicketAttachment = typeof ticketAttachments.$inferSelect;
