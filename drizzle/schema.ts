import {
  int,
  index,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  passwordHash: varchar("passwordHash", { length: 220 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  profile: mysqlEnum("profile", ["requester", "agent", "approver", "manager"]).default("requester").notNull(),
  departmentId: int("departmentId").references(() => departments.id),
  teamId: int("teamId").references(() => teams.id),
  active: int("active").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const departments = mysqlTable("departments", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 120 }).notNull(),
  code: varchar("code", { length: 40 }).notNull().unique(),
  active: int("active").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const userInvitations = mysqlTable("userInvitations", {
  id: int("id").autoincrement().primaryKey(),
  email: varchar("email", { length: 320 }).notNull().unique(),
  passwordHash: varchar("passwordHash", { length: 220 }),
  profile: mysqlEnum("profile", ["requester", "agent", "approver", "manager"]).default("requester").notNull(),
  departmentId: int("departmentId").references(() => departments.id),
  teamId: int("teamId").references(() => teams.id),
  invitedById: int("invitedById").notNull().references(() => users.id),
  active: int("active").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const teams = mysqlTable(
  "teams",
  {
    id: int("id").autoincrement().primaryKey(),
    departmentId: int("departmentId").notNull().references(() => departments.id),
    name: varchar("name", { length: 120 }).notNull(),
    active: int("active").default(1).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [index("teams_department_idx").on(table.departmentId)],
);

export const queues = mysqlTable(
  "queues",
  {
    id: int("id").autoincrement().primaryKey(),
    departmentId: int("departmentId").notNull().references(() => departments.id),
    teamId: int("teamId").notNull().references(() => teams.id),
    name: varchar("name", { length: 120 }).notNull(),
    active: int("active").default(1).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [index("queues_team_idx").on(table.teamId)],
);

export const managerScopes = mysqlTable(
  "managerScopes",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull().references(() => users.id),
    departmentId: int("departmentId").references(() => departments.id),
    teamId: int("teamId").references(() => teams.id),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    uniqueIndex("manager_scopes_unique").on(table.userId, table.departmentId, table.teamId),
    index("manager_scopes_user_idx").on(table.userId),
    index("manager_scopes_department_idx").on(table.departmentId),
    index("manager_scopes_team_idx").on(table.teamId),
  ],
);

export const roles = mysqlTable("roles", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 80 }).notNull().unique(),
  description: varchar("description", { length: 255 }),
  isSystem: int("isSystem").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const permissions = mysqlTable("permissions", {
  id: int("id").autoincrement().primaryKey(),
  code: varchar("code", { length: 120 }).notNull().unique(),
  description: varchar("description", { length: 255 }),
});

export const userRoles = mysqlTable(
  "userRoles",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull().references(() => users.id),
    roleId: int("roleId").notNull().references(() => roles.id),
    departmentId: int("departmentId").references(() => departments.id),
    teamId: int("teamId").references(() => teams.id),
    queueId: int("queueId").references(() => queues.id),
  },
  table => [uniqueIndex("user_roles_scope_unique").on(table.userId, table.roleId, table.departmentId, table.teamId, table.queueId)],
);

export const rolePermissions = mysqlTable(
  "rolePermissions",
  {
    id: int("id").autoincrement().primaryKey(),
    roleId: int("roleId").notNull().references(() => roles.id),
    permissionId: int("permissionId").notNull().references(() => permissions.id),
  },
  table => [uniqueIndex("role_permissions_unique").on(table.roleId, table.permissionId)],
);

export const serviceCategories = mysqlTable(
  "serviceCategories",
  {
    id: int("id").autoincrement().primaryKey(),
    parentId: int("parentId"),
    name: varchar("name", { length: 120 }).notNull(),
    code: varchar("code", { length: 60 }).notNull().unique(),
    description: varchar("description", { length: 255 }),
    sortOrder: int("sortOrder").default(0).notNull(),
    active: int("active").default(1).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [index("service_categories_parent_idx").on(table.parentId, table.active)],
);

export const ticketTypes = mysqlTable("ticketTypes", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 120 }).notNull(),
  description: varchar("description", { length: 255 }),
  defaultQueueId: int("defaultQueueId").references(() => queues.id),
  active: int("active").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const services = mysqlTable(
  "services",
  {
    id: int("id").autoincrement().primaryKey(),
    categoryId: int("categoryId").notNull().references(() => serviceCategories.id),
    name: varchar("name", { length: 160 }).notNull(),
    code: varchar("code", { length: 60 }).notNull().unique(),
    description: varchar("description", { length: 500 }),
    defaultTicketTypeId: int("defaultTicketTypeId").references(() => ticketTypes.id),
    defaultQueueId: int("defaultQueueId").references(() => queues.id),
    active: int("active").default(1).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [index("services_category_idx").on(table.categoryId, table.active)],
);

export const tickets = mysqlTable(
  "tickets",
  {
    id: int("id").autoincrement().primaryKey(),
    publicNumber: varchar("publicNumber", { length: 32 }).notNull().unique(),
    title: varchar("title", { length: 180 }).notNull(),
    description: text("description").notNull(),
    requesterId: int("requesterId").notNull().references(() => users.id),
    departmentId: int("departmentId").notNull().references(() => departments.id),
    teamId: int("teamId").notNull().references(() => teams.id),
    queueId: int("queueId").notNull().references(() => queues.id),
    assigneeId: int("assigneeId").references(() => users.id),
    ticketTypeId: int("ticketTypeId").notNull().references(() => ticketTypes.id),
    categoryId: int("categoryId").references(() => serviceCategories.id),
    serviceId: int("serviceId").references(() => services.id),
    priority: mysqlEnum("priority", ["low", "medium", "high", "urgent"]).default("medium").notNull(),
    status: mysqlEnum("status", ["open", "in_progress", "waiting_requester", "resolved", "closed"]).default("open").notNull(),
    approvalStatus: mysqlEnum("approvalStatus", ["pending", "approved", "rejected"]).default("pending").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
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

export const ticketAttachments = mysqlTable(
  "ticketAttachments",
  {
    id: int("id").autoincrement().primaryKey(),
    ticketId: int("ticketId").notNull().references(() => tickets.id),
    commentId: int("commentId"),
    uploadedById: int("uploadedById").notNull().references(() => users.id),
    fileName: varchar("fileName", { length: 255 }).notNull(),
    contentType: varchar("contentType", { length: 120 }).notNull(),
    fileSize: int("fileSize").notNull(),
    storageKey: varchar("storageKey", { length: 500 }).notNull().unique(),
    storageUrl: varchar("storageUrl", { length: 600 }).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("ticket_attachments_ticket_idx").on(table.ticketId, table.createdAt)],
);

export const ticketApprovals = mysqlTable(
  "ticketApprovals",
  {
    id: int("id").autoincrement().primaryKey(),
    ticketId: int("ticketId").notNull().references(() => tickets.id),
    approverId: int("approverId").notNull().references(() => users.id),
    requestedById: int("requestedById").notNull().references(() => users.id),
    status: mysqlEnum("status", ["pending", "approved", "rejected"]).default("pending").notNull(),
    requestNote: text("requestNote"),
    decisionNote: text("decisionNote"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    decidedAt: timestamp("decidedAt"),
  },
  table => [index("ticket_approvals_approver_idx").on(table.approverId, table.status), index("ticket_approvals_ticket_idx").on(table.ticketId, table.createdAt)],
);

export const ticketComments = mysqlTable(
  "ticketComments",
  {
    id: int("id").autoincrement().primaryKey(),
    ticketId: int("ticketId").notNull().references(() => tickets.id),
    authorId: int("authorId").notNull().references(() => users.id),
    visibility: mysqlEnum("visibility", ["public", "internal"]).default("public").notNull(),
    body: text("body").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [index("ticket_comments_ticket_idx").on(table.ticketId, table.createdAt)],
);

export const ticketEvents = mysqlTable(
  "ticketEvents",
  {
    id: int("id").autoincrement().primaryKey(),
    ticketId: int("ticketId").notNull().references(() => tickets.id),
    actorId: int("actorId").references(() => users.id),
    eventType: varchar("eventType", { length: 80 }).notNull(),
    payload: text("payload").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("ticket_events_ticket_idx").on(table.ticketId, table.createdAt)],
);

export const auditLogs = mysqlTable(
  "auditLogs",
  {
    id: int("id").autoincrement().primaryKey(),
    actorId: int("actorId").references(() => users.id),
    ticketId: int("ticketId").references(() => tickets.id),
    action: varchar("action", { length: 100 }).notNull(),
    resource: varchar("resource", { length: 100 }).notNull(),
    payload: text("payload").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("audit_logs_ticket_idx").on(table.ticketId, table.createdAt), index("audit_logs_actor_idx").on(table.actorId, table.createdAt)],
);

export const notifications = mysqlTable("notifications", {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull().references(() => users.id),
    ticketId: int("ticketId").references(() => tickets.id),
    approvalId: int("approvalId").references(() => ticketApprovals.id),
    type: varchar("type", { length: 60 }).notNull(),
    title: varchar("title", { length: 180 }).notNull(),
    body: text("body").notNull(),
    readAt: timestamp("readAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("notifications_user_idx").on(table.userId, table.readAt, table.createdAt)],
);

export const aiAssistanceRequests = mysqlTable(
  "aiAssistanceRequests",
  {
    id: int("id").autoincrement().primaryKey(),
    ticketId: int("ticketId").notNull().references(() => tickets.id),
    requesterId: int("requesterId").notNull().references(() => users.id),
    operation: varchar("operation", { length: 60 }).notNull(),
    status: mysqlEnum("status", ["pending", "completed", "failed"]).default("pending").notNull(),
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
