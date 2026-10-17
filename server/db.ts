import { and, asc, desc, eq, isNull, like, or, sql } from "drizzle-orm";
import { randomBytes, scrypt as nodeScrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { nanoid } from "nanoid";
import {
  InsertUser,
  User,
  aiAssistanceRequests,
  auditLogs,
  departments,
  queues,
  notifications,
  managerScopes,
  serviceCategories,
  services,
  ticketApprovals,
  teams,
  ticketAttachments,
  ticketComments,
  ticketEvents,
  ticketTypes,
  tickets,
  userInvitations,
  users,
} from "../drizzle/schema";
import type { TicketPriority, TicketStatus } from "@shared/ticket-types";
import { ENV } from "./_core/env";
import { storagePut, storageGetSignedUrl } from "./storage";

let _db: ReturnType<typeof drizzle> | null = null;
const scrypt = promisify(nodeScrypt);

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  return `${salt}:${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, encoded: string) {
  const [salt, storedHex] = encoded.split(":");
  if (!salt || !storedHex) return false;
  const stored = Buffer.from(storedHex, "hex");
  const derived = (await scrypt(password, salt, stored.length)) as Buffer;
  return stored.length === derived.length && timingSafeEqual(stored, derived);
}

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      const connectionUrl = new URL(process.env.DATABASE_URL);
      const sslMode = connectionUrl.searchParams.get("sslmode");
      connectionUrl.searchParams.delete("sslmode");
      const sslCa = process.env.DATABASE_SSL_CA;
      const ssl = sslCa ? { ca: sslCa } : sslMode === "require" ? { rejectUnauthorized: false } : undefined;
      _db = drizzle(new Pool({ connectionString: connectionUrl.toString(), ssl }));
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) throw new Error("Database is not available");

  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  const existingByOpenId = (await db.select({ id: users.id }).from(users).where(eq(users.openId, user.openId)).limit(1))[0];
  const hasAdmin = (await db.select({ id: users.id }).from(users).where(eq(users.role, "admin")).limit(1))[0];
  const corporateEmail = user.email?.trim().toLowerCase();
  const invitation = corporateEmail
    ? (await db.select().from(userInvitations).where(and(eq(userInvitations.email, corporateEmail), eq(userInvitations.active, 1))).limit(1))[0]
    : undefined;
  if (corporateEmail && !existingByOpenId && hasAdmin && user.openId !== ENV.ownerOpenId && !invitation) {
    throw new Error("Corporate email is not authorized by an administrator");
  }
  const textFields = ["name", "email", "loginMethod"] as const;

  for (const field of textFields) {
    if (user[field] !== undefined) {
      values[field] = user[field] ?? null;
      updateSet[field] = user[field] ?? null;
    }
  }
  if (invitation) {
    values.profile = invitation.profile;
    updateSet.profile = invitation.profile;
    values.departmentId = invitation.departmentId ?? null;
    values.teamId = invitation.teamId ?? null;
    updateSet.departmentId = invitation.departmentId ?? null;
    updateSet.teamId = invitation.teamId ?? null;
    if (invitation.passwordHash) {
      values.passwordHash = invitation.passwordHash;
      updateSet.passwordHash = invitation.passwordHash;
    }
  }

  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }
  if (user.role === undefined && user.openId !== ENV.ownerOpenId) {
    const existingAdmin = (await db.select({ id: users.id }).from(users).where(eq(users.role, "admin")).limit(1))[0];
    if (!existingAdmin) {
      values.role = "admin";
      updateSet.role = "admin";
    }
  }
  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();

  await db.insert(users).values(values).onConflictDoUpdate({ target: users.openId, set: updateSet });
  if (invitation?.profile === "manager") {
    const signedInUser = (await db.select({ id: users.id }).from(users).where(eq(users.openId, user.openId)).limit(1))[0];
    if (signedInUser && (invitation.departmentId || invitation.teamId)) {
      await db.delete(managerScopes).where(eq(managerScopes.userId, signedInUser.id));
      await db.insert(managerScopes).values({ userId: signedInUser.id, departmentId: invitation.departmentId, teamId: invitation.teamId });
    }
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export async function authenticateLocalUser(email: string, password: string) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const normalizedEmail = email.trim().toLowerCase();
  const user = (await db.select().from(users).where(eq(users.email, normalizedEmail)).limit(1))[0];
  if (!user || !user.active || !user.passwordHash) return null;
  const isEncoded = user.passwordHash.includes(":");
  const valid = isEncoded ? await verifyPassword(password, user.passwordHash) : user.passwordHash === password;
  if (!valid) return null;
  const patch: Record<string, unknown> = { lastSignedIn: new Date(), updatedAt: new Date() };
  if (!isEncoded) patch.passwordHash = await hashPassword(password);
  if (!user.openId) patch.openId = `local:${user.id}:${user.email ?? normalizedEmail}`;
  await db.update(users).set(patch).where(eq(users.id, user.id));
  return { ...user, ...patch };
}

export async function localSetupStatus() {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const localAccount = (await db.select({ id: users.id, passwordHash: users.passwordHash }).from(users).where(eq(users.active, 1)).limit(100)).find(item => Boolean(item.passwordHash));
  return { needsSetup: !localAccount };
}

export async function createInitialLocalAdmin(input: { email: string; password: string; name: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const email = input.email.trim().toLowerCase();
  const password = input.password.trim();
  const name = input.name.trim();
  if (!email || !name || password.length < 8) throw new Error("Informe nome, e-mail e uma senha com pelo menos 8 caracteres.");
  const passwordHash = await hashPassword(password);
  const existing = (await db.select().from(users).where(eq(users.email, email)).limit(1))[0];
  if (existing && existing.passwordHash) throw new Error("A conta local já existe. Entre com o e-mail e a senha cadastrados.");
  if (existing) {
    await db.update(users).set({ name, passwordHash, loginMethod: "local", role: "admin", profile: "manager", active: 1, openId: existing.openId || `local:${email}`, updatedAt: new Date() }).where(eq(users.id, existing.id));
    return (await db.select().from(users).where(eq(users.id, existing.id)).limit(1))[0];
  }
  const [createdUser] = await db.insert(users).values({
    openId: `local:${email}`,
    name,
    email,
    passwordHash,
    loginMethod: "local",
    role: "admin",
    profile: "manager",
    active: 1,
    lastSignedIn: new Date(),
  }).returning({ id: users.id });
  return (await db.select().from(users).where(eq(users.id, createdUser.id)).limit(1))[0];
}

export async function ensureFirstAdmin(user: User) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  if (user.role === "admin") return user;
  const existingAdmin = (await db.select({ id: users.id }).from(users).where(eq(users.role, "admin")).limit(1))[0];
  if (existingAdmin) return user;
  await db.update(users).set({ role: "admin", updatedAt: new Date() }).where(eq(users.id, user.id));
  return { ...user, role: "admin" as const };
}

export type UserProfile = "requester" | "agent" | "approver" | "manager";

export async function listUsersForAdmin(user: User) {
  if (user.role !== "admin") throw new Error("Only administrators can list users");
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  return db.select().from(users).orderBy(asc(users.name), asc(users.email));
}

export async function listApproverUsers() {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  return db.select({ id: users.id, name: users.name, email: users.email, departmentId: users.departmentId, teamId: users.teamId }).from(users).where(and(eq(users.active, 1), or(eq(users.role, "admin"), eq(users.profile, "approver")))).orderBy(asc(users.name));
}

export async function createUserInvitation(input: { admin: User; email: string; password: string; profile: UserProfile; departmentId?: number; teamId?: number }) {
  if (input.admin.role !== "admin") throw new Error("Only administrators can create users");
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const email = input.email.trim().toLowerCase();
  if (input.password.length < 8) throw new Error("A senha deve ter pelo menos 8 caracteres");
  if (input.profile !== "requester" && !input.departmentId) throw new Error("Atendentes, aprovadores e gestores precisam estar vinculados a um setor");
  const passwordHash = await hashPassword(input.password);
  if (input.teamId) {
    const team = (await db.select().from(teams).where(and(eq(teams.id, input.teamId), eq(teams.active, 1))).limit(1))[0];
    if (!team) throw new Error("Equipe não encontrada ou inativa");
    if (input.departmentId && team.departmentId !== input.departmentId) throw new Error("A equipe não pertence ao setor informado");
  }
  const existing = (await db.select().from(users).where(eq(users.email, email)).limit(1))[0];
  if (existing?.role === "admin") throw new Error("Este e-mail já pertence a um administrador");
  await db.insert(userInvitations).values({ email, passwordHash, profile: input.profile, departmentId: input.departmentId, teamId: input.teamId, invitedById: input.admin.id, active: 1 }).onConflictDoUpdate({ target: userInvitations.email, set: { passwordHash, profile: input.profile, departmentId: input.departmentId, teamId: input.teamId, invitedById: input.admin.id, active: 1 } });
  if (existing) {
    await db.update(users).set({ name: existing.name || email, passwordHash, loginMethod: "local", profile: input.profile, departmentId: input.departmentId ?? null, teamId: input.teamId ?? null, active: 1, updatedAt: new Date() }).where(eq(users.id, existing.id));
  } else {
    await db.insert(users).values({ openId: `local:${email}`, name: email, email, passwordHash, loginMethod: "local", role: "user", profile: input.profile, departmentId: input.departmentId ?? null, teamId: input.teamId ?? null, active: 1 });
  }
  if (input.profile === "manager" && (input.departmentId || input.teamId)) {
    const createdUser = (await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1))[0];
    if (createdUser) {
      await db.delete(managerScopes).where(eq(managerScopes.userId, createdUser.id));
      await db.insert(managerScopes).values({ userId: createdUser.id, departmentId: input.departmentId ?? null, teamId: input.teamId ?? null });
    }
  }
  return (await db.select().from(userInvitations).where(eq(userInvitations.email, email)).limit(1))[0];
}

export async function setUserActive(admin: User, userId: number, active: boolean) {
  if (admin.role !== "admin") throw new Error("Only administrators can change user status");
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.update(users).set({ active: active ? 1 : 0, updatedAt: new Date() }).where(eq(users.id, userId));
  return (await db.select().from(users).where(eq(users.id, userId)).limit(1))[0];
}

export async function setUserProfile(admin: User, userId: number, profile: UserProfile) {
  if (admin.role !== "admin") throw new Error("Only administrators can change user profiles");
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.update(users).set({ profile, updatedAt: new Date() }).where(eq(users.id, userId));
  return (await db.select().from(users).where(eq(users.id, userId)).limit(1))[0];
}

export async function listTeamsForAdmin(admin: User, departmentId?: number) {
  if (admin.role !== "admin") throw new Error("Only administrators can list teams");
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  return db.select().from(teams).where(departmentId ? and(eq(teams.departmentId, departmentId), eq(teams.active, 1)) : eq(teams.active, 1)).orderBy(asc(teams.name));
}

export async function listQueuesForAdmin(admin: User) {
  if (admin.role !== "admin") throw new Error("Only administrators can list queues");
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  return db.select().from(queues).where(eq(queues.active, 1)).orderBy(asc(queues.name));
}

export async function listManagerScopes(admin: User, userId: number) {
  if (admin.role !== "admin") throw new Error("Only administrators can list manager scopes");
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  return db.select().from(managerScopes).where(eq(managerScopes.userId, userId)).orderBy(asc(managerScopes.id));
}

export async function replaceManagerScopes(admin: User, userId: number, scopes: Array<{ departmentId?: number; teamId?: number }>) {
  if (admin.role !== "admin") throw new Error("Only administrators can change manager scopes");
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const target = (await db.select().from(users).where(eq(users.id, userId)).limit(1))[0];
  if (!target || target.profile !== "manager") throw new Error("O usuário precisa ter perfil gestor");
  const normalized = scopes.filter(scope => scope.departmentId || scope.teamId).map(scope => ({ userId, departmentId: scope.departmentId ?? null, teamId: scope.teamId ?? null }));
  for (const scope of normalized) {
    if (scope.teamId) {
      const team = (await db.select().from(teams).where(and(eq(teams.id, scope.teamId), eq(teams.active, 1))).limit(1))[0];
      if (!team || (scope.departmentId && team.departmentId !== scope.departmentId)) throw new Error("Escopo de equipe inválido");
    } else if (scope.departmentId) {
      const department = (await db.select().from(departments).where(and(eq(departments.id, scope.departmentId), eq(departments.active, 1))).limit(1))[0];
      if (!department) throw new Error("Escopo de setor inválido");
    }
  }
  await db.delete(managerScopes).where(eq(managerScopes.userId, userId));
  if (normalized.length) await db.insert(managerScopes).values(normalized);
  return listManagerScopes(admin, userId);
}

export async function createNotification(input: { userId: number; ticketId?: number; approvalId?: number; type: string; title: string; body: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.insert(notifications).values(input);
}

export async function listNotifications(user: User) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  return db.select().from(notifications).where(eq(notifications.userId, user.id)).orderBy(desc(notifications.createdAt)).limit(50);
}

export async function markNotificationRead(user: User, notificationId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.update(notifications).set({ readAt: new Date() }).where(and(eq(notifications.id, notificationId), eq(notifications.userId, user.id)));
}

export async function getFoundationSummary() {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");

  const [department] = await db.select({ name: departments.name }).from(departments).where(eq(departments.active, 1)).orderBy(asc(departments.name)).limit(1);
  const [queue] = await db.select({ name: queues.name }).from(queues).where(eq(queues.active, 1)).orderBy(asc(queues.name)).limit(1);
  return {
    department: department ?? { name: "Nenhum setor configurado" },
    queue: queue ?? { name: "Nenhuma fila configurada" },
  };
}

export async function listDepartments() {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  return db.select().from(departments).where(eq(departments.active, 1)).orderBy(asc(departments.name));
}

export async function listTicketTypes() {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  return db.select().from(ticketTypes).where(eq(ticketTypes.active, 1)).orderBy(asc(ticketTypes.name));
}

export async function listServiceCategories() {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  return db.select().from(serviceCategories).where(eq(serviceCategories.active, 1)).orderBy(asc(serviceCategories.sortOrder), asc(serviceCategories.name));
}

export async function listServices(categoryId?: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const clauses = [eq(services.active, 1)];
  if (categoryId) clauses.push(eq(services.categoryId, categoryId));
  return db.select().from(services).where(and(...clauses)).orderBy(asc(services.name));
}

export async function createDepartment(input: { name: string; code: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const code = input.code.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-") || `sector-${nanoid(5)}`;
  await db.insert(departments).values({ name: input.name.trim(), code, active: 1 });
  return (await listDepartments()).find(item => item.code === code);
}

export async function createTeam(admin: User, input: { name: string; departmentId: number }) {
  if (admin.role !== "admin") throw new Error("Only administrators can create teams");
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const department = (await db.select().from(departments).where(and(eq(departments.id, input.departmentId), eq(departments.active, 1))).limit(1))[0];
  if (!department) throw new Error("Setor não encontrado ou inativo");
  await db.insert(teams).values({ name: input.name.trim(), departmentId: input.departmentId, active: 1 });
  return db.select().from(teams).where(and(eq(teams.departmentId, input.departmentId), eq(teams.name, input.name.trim()))).orderBy(desc(teams.id)).limit(1).then(rows => rows[0]);
}

export async function createQueue(admin: User, input: { name: string; teamId: number }) {
  if (admin.role !== "admin") throw new Error("Only administrators can create queues");
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const team = (await db.select().from(teams).where(and(eq(teams.id, input.teamId), eq(teams.active, 1))).limit(1))[0];
  if (!team) throw new Error("Equipe não encontrada ou inativa");
  const [queue] = await db.insert(queues).values({ name: input.name.trim(), departmentId: team.departmentId, teamId: team.id, active: 1 }).returning({ id: queues.id });
  return (await db.select().from(queues).where(eq(queues.id, queue.id)).limit(1))[0];
}

export async function createTicketType(input: { name: string; description?: string; defaultQueueId?: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.insert(ticketTypes).values({ name: input.name.trim(), description: input.description?.trim() || null, defaultQueueId: input.defaultQueueId ?? null, active: 1 });
  return (await listTicketTypes()).find(item => item.name === input.name.trim());
}

export async function createServiceCategory(input: { name: string; code: string; description?: string; parentId?: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  if (input.parentId) {
    const parent = (await db.select().from(serviceCategories).where(and(eq(serviceCategories.id, input.parentId), eq(serviceCategories.active, 1))).limit(1))[0];
    if (!parent) throw new Error("Categoria pai não encontrada ou inativa");
  }
  const code = input.code.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-") || `category-${nanoid(5)}`;
  await db.insert(serviceCategories).values({ name: input.name.trim(), code, description: input.description?.trim() || null, parentId: input.parentId ?? null, active: 1 });
  return (await db.select().from(serviceCategories).where(eq(serviceCategories.code, code)).limit(1))[0];
}

export async function createService(input: { name: string; code: string; description?: string; categoryId: number; defaultTicketTypeId?: number; defaultQueueId?: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const category = (await db.select().from(serviceCategories).where(and(eq(serviceCategories.id, input.categoryId), eq(serviceCategories.active, 1))).limit(1))[0];
  if (!category) throw new Error("Categoria não encontrada ou inativa");
  if (input.defaultTicketTypeId) {
    const type = (await db.select().from(ticketTypes).where(and(eq(ticketTypes.id, input.defaultTicketTypeId), eq(ticketTypes.active, 1))).limit(1))[0];
    if (!type) throw new Error("Tipo padrão não encontrado ou inativo");
  }
  if (input.defaultQueueId) {
    const queue = (await db.select().from(queues).where(and(eq(queues.id, input.defaultQueueId), eq(queues.active, 1))).limit(1))[0];
    if (!queue) throw new Error("Fila padrão não encontrada ou inativa");
  }
  const code = input.code.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-") || `service-${nanoid(5)}`;
  await db.insert(services).values({ name: input.name.trim(), code, description: input.description?.trim() || null, categoryId: input.categoryId, defaultTicketTypeId: input.defaultTicketTypeId ?? null, defaultQueueId: input.defaultQueueId ?? null, active: 1 });
  return (await db.select().from(services).where(eq(services.code, code)).limit(1))[0];
}

export type TicketFilters = {
  search?: string;
  status?: TicketStatus;
  priority?: TicketPriority;
  assignedToMe?: boolean;
  myTickets?: boolean;
};

function userAreaPredicate(table: typeof users, departmentId: number, teamId: number) {
  return or(eq(table.teamId, teamId), eq(table.departmentId, departmentId))!;
}

async function managerScopePredicate(user: User) {
  if (user.role === "admin") return undefined;
  if (user.profile === "requester") return or(eq(tickets.requesterId, user.id), eq(tickets.assigneeId, user.id))!;
  if (user.profile === "agent" || user.profile === "approver") {
    const area = user.teamId ? eq(tickets.teamId, user.teamId) : user.departmentId ? eq(tickets.departmentId, user.departmentId) : undefined;
    return or(eq(tickets.requesterId, user.id), eq(tickets.assigneeId, user.id), area)!;
  }
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const scopes = await db.select().from(managerScopes).where(eq(managerScopes.userId, user.id));
  const scopedTickets = scopes.map(scope => scope.teamId ? eq(tickets.teamId, scope.teamId) : scope.departmentId ? eq(tickets.departmentId, scope.departmentId) : undefined).filter(Boolean);
  return or(eq(tickets.requesterId, user.id), eq(tickets.assigneeId, user.id), ...scopedTickets)!;
}

export async function listTickets(user: User, filters: TicketFilters = {}) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");

  const clauses = [];
  const access = await managerScopePredicate(user);
  const approvalRows = await db.select({ ticketId: ticketApprovals.ticketId }).from(ticketApprovals).where(or(eq(ticketApprovals.approverId, user.id), eq(ticketApprovals.requestedById, user.id)));
  const approvalAccess = approvalRows.map(row => eq(tickets.id, row.ticketId));
  if (access && approvalAccess.length) clauses.push(or(access, ...approvalAccess)!);
  else if (access) clauses.push(access);
  else if (approvalAccess.length) clauses.push(or(...approvalAccess)!);
  if (user.role !== "admin" && user.profile === "agent") clauses.push(or(eq(tickets.requesterId, user.id), eq(tickets.assigneeId, user.id), eq(tickets.approvalStatus, "approved"))!);
  if (filters.assignedToMe) {
    clauses.push(eq(tickets.assigneeId, user.id));
  }
  if (filters.myTickets) {
    clauses.push(or(eq(tickets.requesterId, user.id), eq(tickets.assigneeId, user.id))!);
  }
  if (filters.status) clauses.push(eq(tickets.status, filters.status));
  if (filters.priority) clauses.push(eq(tickets.priority, filters.priority));
  if (filters.search) {
    clauses.push(or(like(tickets.publicNumber, `%${filters.search}%`), like(tickets.title, `%${filters.search}%`))!);
  }

  return db
    .select()
    .from(tickets)
    .where(clauses.length ? and(...clauses) : undefined)
    .orderBy(desc(tickets.updatedAt));
}

export async function getTicketForUser(user: User, ticketId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const ticket = (await db.select().from(tickets).where(eq(tickets.id, ticketId)).limit(1))[0];
  if (!ticket) return null;
  if (user.role !== "admin" && user.profile === "agent" && ticket.requesterId !== user.id && ticket.assigneeId !== user.id && ticket.approvalStatus !== "approved") {
    await recordAudit({ actorId: user.id, ticketId, action: "ticket.access_denied", resource: "ticket", payload: { reason: "waiting_approval" } });
    return null;
  }
  if (user.role !== "admin" && ticket.requesterId !== user.id && ticket.assigneeId !== user.id) {
    const approvalAccess = (await db.select({ id: ticketApprovals.id }).from(ticketApprovals).where(and(eq(ticketApprovals.ticketId, ticketId), or(eq(ticketApprovals.approverId, user.id), eq(ticketApprovals.requestedById, user.id)))).limit(1)).length > 0;
    if (!approvalAccess && (user.profile !== "manager" || !(await managerHasTicketScope(user, ticket.departmentId, ticket.teamId)))) {
      await recordAudit({ actorId: user.id, ticketId, action: "ticket.access_denied", resource: "ticket", payload: { reason: "outside_scope" } });
      return null;
    }
  }
  return ticket;
}

async function managerHasTicketScope(user: User, departmentId: number, teamId: number) {
  if (user.role === "admin") return true;
  if ((user.profile === "agent" || user.profile === "approver") && (user.teamId ? user.teamId === teamId : user.departmentId === departmentId)) return true;
  if (user.profile !== "manager") return false;
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const scopes = await db.select().from(managerScopes).where(eq(managerScopes.userId, user.id));
  return scopes.some(scope => (scope.teamId && scope.teamId === teamId) || (!scope.teamId && scope.departmentId === departmentId));
}

export async function getTicketComments(ticketId: number, includeInternal: boolean) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const predicate = includeInternal
    ? eq(ticketComments.ticketId, ticketId)
    : and(eq(ticketComments.ticketId, ticketId), eq(ticketComments.visibility, "public"));
  return db.select().from(ticketComments).where(predicate).orderBy(asc(ticketComments.createdAt));
}

export async function getTicketEvents(ticketId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  return db.select().from(ticketEvents).where(eq(ticketEvents.ticketId, ticketId)).orderBy(asc(ticketEvents.createdAt));
}

export async function getTicketAttachments(ticketId: number, includeInternal = false) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const attachments = await db.select().from(ticketAttachments).where(eq(ticketAttachments.ticketId, ticketId)).orderBy(asc(ticketAttachments.createdAt));
  if (includeInternal) return attachments;
  const internalComments = await db.select({ id: ticketComments.id }).from(ticketComments).where(and(eq(ticketComments.ticketId, ticketId), eq(ticketComments.visibility, "internal")));
  const hiddenIds = new Set(internalComments.map(comment => comment.id));
  return attachments.filter(attachment => !attachment.commentId || !hiddenIds.has(attachment.commentId));
}

function decodeBase64File(data: string) {
  const match = data.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) throw new Error("Arquivo em formato inválido");
  return { contentType: match[1], buffer: Buffer.from(match[2], "base64") };
}

export type AttachmentInput = { fileName: string; contentType: string; fileSize: number; data: string };

export async function saveAttachments(input: { user: User; ticketId: number; commentId?: number; attachments: AttachmentInput[] }) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const ticket = await getTicketForUser(input.user, input.ticketId);
  if (!ticket) throw new Error("Ticket not found or not accessible");
  if (input.attachments.length > 5) throw new Error("Você pode enviar no máximo 5 arquivos por atualização.");
  const saved = [];
  for (const attachment of input.attachments) {
    if (attachment.fileSize > 10 * 1024 * 1024) throw new Error("Cada arquivo deve ter no máximo 10 MB.");
    const decoded = decodeBase64File(attachment.data);
    if (decoded.buffer.byteLength !== attachment.fileSize) throw new Error("O tamanho informado do arquivo não confere.");
    const safeName = attachment.fileName.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 180) || "arquivo";
    const uploaded = await storagePut(`ticketflow/tickets/${ticket.publicNumber}/${safeName}`, decoded.buffer, attachment.contentType);
    const [createdAttachment] = await db.insert(ticketAttachments).values({
      ticketId: input.ticketId,
      commentId: input.commentId,
      uploadedById: input.user.id,
      fileName: safeName,
      contentType: attachment.contentType,
      fileSize: attachment.fileSize,
      storageKey: uploaded.key,
      storageUrl: uploaded.url,
    }).returning({ id: ticketAttachments.id });
    saved.push((await db.select().from(ticketAttachments).where(eq(ticketAttachments.id, createdAttachment.id)).limit(1))[0]);
  }
  if (saved.length) await addEvent(input.ticketId, input.user.id, "ticket.attachments_added", { attachmentIds: saved.map(item => item.id) });
  return saved;
}

export async function getAttachmentDownload(user: User, attachmentId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const attachment = (await db.select().from(ticketAttachments).where(eq(ticketAttachments.id, attachmentId)).limit(1))[0];
  if (!attachment) throw new Error("Anexo não encontrado");
  const ticket = await getTicketForUser(user, attachment.ticketId);
  if (!ticket) throw new Error("Anexo não encontrado ou sem acesso");
  return { fileName: attachment.fileName, url: await storageGetSignedUrl(attachment.storageKey) };
}

export async function listAllAttachments(user: User) {
  if (user.role !== "admin") throw new Error("Only administrators can inspect all attachments");
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  return db.select().from(ticketAttachments).orderBy(desc(ticketAttachments.createdAt)).limit(100);
}

export async function recordAudit(input: { actorId?: number | null; ticketId?: number; action: string; resource: string; payload: Record<string, unknown> }) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.insert(auditLogs).values({ actorId: input.actorId ?? null, ticketId: input.ticketId, action: input.action, resource: input.resource, payload: JSON.stringify(input.payload) });
}

export async function listAuditLogs(user: User) {
  if (user.role !== "admin") throw new Error("Only administrators can inspect audit logs");
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  return db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(200);
}

async function addEvent(ticketId: number, actorId: number | null, eventType: string, payload: Record<string, unknown>) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.insert(ticketEvents).values({ ticketId, actorId, eventType, payload: JSON.stringify(payload) });
}

export async function createTicket(input: {
  user: User;
  title: string;
  description: string;
  priority: TicketPriority;
  ticketTypeId?: number;
  categoryId?: number;
  serviceId?: number;
  departmentId?: number;
  teamId?: number;
  queueId?: number;
  attachments?: AttachmentInput[];
}) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const departmentId = input.departmentId;
  if (!departmentId) throw new Error("Cadastre e selecione um setor antes de abrir chamados");
  const selectedDepartment = (await db.select().from(departments).where(and(eq(departments.id, departmentId), eq(departments.active, 1))).limit(1))[0];
  if (!selectedDepartment) throw new Error("Setor não encontrado ou inativo");
  const selectedTeam = input.teamId
    ? (await db.select().from(teams).where(eq(teams.id, input.teamId)).limit(1))[0]
    : (await db.select().from(teams).where(eq(teams.departmentId, departmentId)).orderBy(asc(teams.id)).limit(1))[0];
  if (!selectedTeam || selectedTeam.departmentId !== departmentId || !selectedTeam.active) throw new Error("O setor precisa ter uma equipe ativa responsável");
  const teamId = selectedTeam.id;
  const selectedQueue = input.queueId
    ? (await db.select().from(queues).where(eq(queues.id, input.queueId)).limit(1))[0]
    : (await db.select().from(queues).where(eq(queues.teamId, teamId)).orderBy(asc(queues.id)).limit(1))[0];
  if (!selectedQueue || selectedQueue.teamId !== teamId || selectedQueue.departmentId !== departmentId || !selectedQueue.active) throw new Error("A equipe precisa ter uma fila ativa responsável");
  const queueId = selectedQueue.id;
  const selectedType = input.ticketTypeId
    ? (await db.select().from(ticketTypes).where(and(eq(ticketTypes.id, input.ticketTypeId), eq(ticketTypes.active, 1))).limit(1))[0]
    : undefined;
  if (!selectedType) throw new Error("Cadastre e selecione um tipo de chamado antes de abrir chamados");
  const ticketTypeId = selectedType.id;
  const selectedCategory = input.categoryId
    ? (await db.select().from(serviceCategories).where(and(eq(serviceCategories.id, input.categoryId), eq(serviceCategories.active, 1))).limit(1))[0]
    : undefined;
  if (input.categoryId && !selectedCategory) throw new Error("Categoria não encontrada ou inativa");
  const selectedService = input.serviceId
    ? (await db.select().from(services).where(and(eq(services.id, input.serviceId), eq(services.active, 1))).limit(1))[0]
    : undefined;
  if (input.serviceId && !selectedService) throw new Error("Serviço não encontrado ou inativo");
  if (selectedService && input.categoryId && input.categoryId !== selectedService.categoryId) throw new Error("O serviço selecionado não pertence à categoria informada");
  const publicNumber = `TF-${new Date().getFullYear()}-${nanoid(8).toUpperCase()}`;

  const [createdTicket] = await db.insert(tickets).values({
    publicNumber,
    title: input.title.trim(),
    description: input.description.trim(),
    requesterId: input.user.id,
    departmentId,
    teamId,
    queueId,
    ticketTypeId,
    categoryId: selectedCategory?.id ?? selectedService?.categoryId ?? null,
    serviceId: selectedService?.id ?? null,
    priority: input.priority,
    status: "open",
    approvalStatus: "pending",
  }).returning({ id: tickets.id });
  const ticketId = createdTicket.id;
  await addEvent(ticketId, input.user.id, "ticket.created", { publicNumber, status: "open" });
  await createNotification({ userId: input.user.id, ticketId, type: "ticket_created", title: "Chamado aberto", body: `${publicNumber} foi criado e está aguardando atendimento.` });
  const firstApprover = (await db.select({ id: users.id }).from(users).where(and(
    eq(users.active, 1),
    or(eq(users.role, "admin"), and(eq(users.profile, "approver"), userAreaPredicate(users, departmentId, teamId))),
  )).orderBy(asc(users.id)).limit(5)).find(item => item.id !== input.user.id);
  if (firstApprover) {
    const [createdApproval] = await db.insert(ticketApprovals).values({ ticketId, approverId: firstApprover.id, requestedById: input.user.id, requestNote: "Aprovação inicial do chamado", status: "pending" }).returning({ id: ticketApprovals.id });
    const approvalId = createdApproval.id;
    await createNotification({ userId: firstApprover.id, ticketId, approvalId, type: "approval_requested", title: "Aprovação pendente", body: `${publicNumber} aguarda sua aprovação inicial.` });
  }
  if (input.attachments?.length) await saveAttachments({ user: input.user, ticketId, attachments: input.attachments });
  return getTicketForUser(input.user, ticketId);
}

export async function addComment(input: { user: User; ticketId: number; body: string; visibility: "public" | "internal"; attachments?: AttachmentInput[] }) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const ticket = await getTicketForUser(input.user, input.ticketId);
  if (!ticket) throw new Error("Ticket not found or not accessible");
  const [createdComment] = await db.insert(ticketComments).values({
    ticketId: input.ticketId,
    authorId: input.user.id,
    body: input.body.trim(),
    visibility: input.visibility,
  }).returning({ id: ticketComments.id });
  await addEvent(input.ticketId, input.user.id, input.visibility === "internal" ? "comment.internal" : "comment.public", { commentId: createdComment.id });
  if (input.attachments?.length) await saveAttachments({ user: input.user, ticketId: input.ticketId, commentId: createdComment.id, attachments: input.attachments });
  return db.select().from(ticketComments).where(eq(ticketComments.id, createdComment.id)).limit(1).then(rows => rows[0]);
}

const ALLOWED_TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  open: ["in_progress", "closed"],
  in_progress: ["waiting_requester", "resolved", "open"],
  waiting_requester: ["in_progress", "resolved"],
  resolved: ["closed", "in_progress"],
  closed: ["open"],
};

export function allowedTransitions(status: TicketStatus) {
  return ALLOWED_TRANSITIONS[status];
}

export async function transitionTicket(input: { user: User; ticketId: number; status: TicketStatus; comment?: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const ticket = await getTicketForUser(input.user, input.ticketId);
  if (!ticket) throw new Error("Ticket not found or not accessible");
  if (input.user.role !== "admin" && ticket.approvalStatus !== "approved") throw new Error("O chamado precisa ser validado pelo aprovador da área antes do atendimento");
  if (input.user.role !== "admin" && input.user.profile === "requester") {
    await recordAudit({ actorId: input.user.id, ticketId: input.ticketId, action: "ticket.transition_denied", resource: "ticket", payload: { reason: "requester_profile", requestedStatus: input.status } });
    throw new Error("You do not have permission to transition this ticket");
  }
  if (input.user.role !== "admin" && input.user.profile !== "manager" && ticket.assigneeId !== input.user.id) {
    await recordAudit({ actorId: input.user.id, ticketId: input.ticketId, action: "ticket.transition_denied", resource: "ticket", payload: { reason: "not_assignee", requestedStatus: input.status } });
    throw new Error("Somente o atendente atribuído pode alterar este chamado");
  }
  if (!ALLOWED_TRANSITIONS[ticket.status].includes(input.status)) {
    await recordAudit({ actorId: input.user.id, ticketId: input.ticketId, action: "ticket.invalid_transition", resource: "ticket", payload: { from: ticket.status, to: input.status } });
    throw new Error(`Invalid transition from ${ticket.status} to ${input.status}`);
  }

  await db.update(tickets).set({
    status: input.status,
    updatedAt: new Date(),
    resolvedAt: input.status === "resolved" ? new Date() : ticket.resolvedAt,
    closedAt: input.status === "closed" ? new Date() : ticket.closedAt,
  }).where(eq(tickets.id, input.ticketId));
  await addEvent(input.ticketId, input.user.id, "ticket.status_changed", { from: ticket.status, to: input.status, comment: input.comment ?? null });
  if (input.comment?.trim()) {
    await db.insert(ticketComments).values({ ticketId: input.ticketId, authorId: input.user.id, visibility: "public", body: input.comment.trim() });
  }
  return getTicketForUser(input.user, input.ticketId);
}

export async function assignTicket(input: { user: User; ticketId: number; assigneeId: number | null }) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  if (input.user.role !== "admin" && input.user.profile !== "manager") throw new Error("Somente administradores e gestores podem atribuir chamados");
  const ticket = await getTicketForUser(input.user, input.ticketId);
  if (!ticket) throw new Error("Ticket not found or not accessible");
  if (input.user.role !== "admin" && ticket.approvalStatus !== "approved") throw new Error("O chamado precisa ser validado pelo aprovador da área antes da atribuição");
  if (input.user.role !== "admin" && !(await managerHasTicketScope(input.user, ticket.departmentId, ticket.teamId))) throw new Error("Chamado fora do escopo do gestor");
  if (input.assigneeId) {
    const assignee = (await db.select().from(users).where(and(eq(users.id, input.assigneeId), eq(users.active, 1))).limit(1))[0];
    if (!assignee) throw new Error("Responsável não encontrado ou inativo");
    if (assignee.role !== "admin" && !["agent", "approver", "manager"].includes(assignee.profile)) throw new Error("O responsável precisa ter perfil operacional");
    if (assignee.role !== "admin" && !(assignee.teamId ? assignee.teamId === ticket.teamId : assignee.departmentId === ticket.departmentId)) throw new Error("O responsável não pertence à área do chamado");
  }
  await db.update(tickets).set({ assigneeId: input.assigneeId, updatedAt: new Date() }).where(eq(tickets.id, input.ticketId));
  await addEvent(input.ticketId, input.user.id, "ticket.assigned", { assigneeId: input.assigneeId });
  if (input.assigneeId) await createNotification({ userId: input.assigneeId, ticketId: input.ticketId, type: "ticket_assigned", title: "Chamado atribuído", body: `${ticket.publicNumber} foi atribuído a você.` });
  return getTicketForUser(input.user, input.ticketId);
}

export async function claimTicket(input: { user: User; ticketId: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  if (input.user.role !== "admin" && !["agent", "approver", "manager"].includes(input.user.profile)) throw new Error("Somente usuários operacionais podem assumir chamados");
  const ticket = await getTicketForUser(input.user, input.ticketId);
  if (!ticket) throw new Error("Ticket not found or not accessible");
  if (ticket.approvalStatus !== "approved") throw new Error("O chamado ainda aguarda validação do aprovador");
  if (ticket.assigneeId && ticket.assigneeId !== input.user.id) throw new Error("Este chamado já foi assumido por outro atendente");
  if (input.user.role !== "admin" && !(await managerHasTicketScope(input.user, ticket.departmentId, ticket.teamId))) throw new Error("Você não pertence à área responsável por este chamado");
  const result = await db.update(tickets).set({ assigneeId: input.user.id, status: ticket.status === "open" ? "in_progress" : ticket.status, updatedAt: new Date() }).where(and(eq(tickets.id, input.ticketId), isNull(tickets.assigneeId))).returning({ id: tickets.id });
  if (!result.length) throw new Error("Este chamado já foi assumido por outro atendente");
  await addEvent(input.ticketId, input.user.id, "ticket.claimed", { assigneeId: input.user.id });
  await createNotification({ userId: ticket.requesterId, ticketId: input.ticketId, type: "ticket_assigned", title: "Chamado em atendimento", body: `${ticket.publicNumber} foi assumido pela equipe responsável.` });
  return getTicketForUser(input.user, input.ticketId);
}

export async function requestApproval(input: { user: User; ticketId: number; approverId: number; note?: string }) {
  if (input.user.role !== "admin" && input.user.profile !== "agent" && input.user.profile !== "approver" && input.user.profile !== "manager") throw new Error("Perfil sem permissão para solicitar aprovação");
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const ticket = await getTicketForUser(input.user, input.ticketId);
  if (!ticket) throw new Error("Ticket not found or not accessible");
  const approver = (await db.select().from(users).where(and(eq(users.id, input.approverId), eq(users.active, 1))).limit(1))[0];
  if (!approver || (approver.role !== "admin" && approver.profile !== "approver")) throw new Error("Usuário não possui perfil de aprovador");
  if (approver.role !== "admin" && !(approver.teamId ? approver.teamId === ticket.teamId : approver.departmentId === ticket.departmentId)) throw new Error("O aprovador não pertence à área responsável pelo chamado");
  const existing = (await db.select().from(ticketApprovals).where(and(eq(ticketApprovals.ticketId, input.ticketId), eq(ticketApprovals.approverId, input.approverId), eq(ticketApprovals.status, "pending"))).limit(1))[0];
  if (existing) return existing;
  const [createdApproval] = await db.insert(ticketApprovals).values({ ticketId: input.ticketId, approverId: input.approverId, requestedById: input.user.id, requestNote: input.note?.trim() || null, status: "pending" }).returning({ id: ticketApprovals.id });
  const approvalId = createdApproval.id;
  await createNotification({ userId: input.approverId, ticketId: input.ticketId, approvalId, type: "approval_requested", title: "Aprovação pendente", body: `${ticket.publicNumber} aguarda sua aprovação.` });
  return (await db.select().from(ticketApprovals).where(eq(ticketApprovals.id, approvalId)).limit(1))[0];
}

export async function listApprovals(user: User) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  return db.select().from(ticketApprovals).where(user.role === "admin" ? undefined : or(eq(ticketApprovals.approverId, user.id), eq(ticketApprovals.requestedById, user.id))).orderBy(desc(ticketApprovals.createdAt)).limit(50);
}

export async function decideApproval(input: { user: User; approvalId: number; status: "approved" | "rejected"; note?: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const approval = (await db.select().from(ticketApprovals).where(eq(ticketApprovals.id, input.approvalId)).limit(1))[0];
  if (!approval || (input.user.role !== "admin" && approval.approverId !== input.user.id)) throw new Error("Aprovação não encontrada ou sem permissão");
  if (approval.status !== "pending") throw new Error("Esta aprovação já foi decidida");
  await db.update(ticketApprovals).set({ status: input.status, decisionNote: input.note?.trim() || null, decidedAt: new Date() }).where(eq(ticketApprovals.id, input.approvalId));
  await db.update(tickets).set({ approvalStatus: input.status, updatedAt: new Date() }).where(eq(tickets.id, approval.ticketId));
  await addEvent(approval.ticketId, input.user.id, "ticket.approval_decided", { approvalId: input.approvalId, status: input.status });
  await createNotification({ userId: approval.requestedById, ticketId: approval.ticketId, approvalId: input.approvalId, type: "approval_decided", title: input.status === "approved" ? "Solicitação aprovada" : "Solicitação rejeitada", body: `A aprovação do chamado foi ${input.status === "approved" ? "aprovada" : "rejeitada"}.` });
  const ticket = (await db.select({ requesterId: tickets.requesterId, assigneeId: tickets.assigneeId, publicNumber: tickets.publicNumber, departmentId: tickets.departmentId, teamId: tickets.teamId }).from(tickets).where(eq(tickets.id, approval.ticketId)).limit(1))[0];
  const recipients = new Set([ticket?.requesterId, ticket?.assigneeId, approval.requestedById].filter((id): id is number => Boolean(id) && id !== input.user.id));
  for (const userId of recipients) await createNotification({ userId, ticketId: approval.ticketId, approvalId: input.approvalId, type: "approval_decided", title: input.status === "approved" ? "Chamado aprovado" : "Chamado rejeitado", body: `${ticket?.publicNumber ?? "O chamado"} foi ${input.status === "approved" ? "aprovado" : "rejeitado"}.` });
  if (input.status === "approved" && ticket) {
    const areaUsers = await db.select({ id: users.id }).from(users).where(and(eq(users.active, 1), or(eq(users.role, "admin"), and(or(eq(users.profile, "agent"), eq(users.profile, "approver"), eq(users.profile, "manager")), userAreaPredicate(users, ticket.departmentId, ticket.teamId)))));
    for (const areaUser of areaUsers) {
      if (areaUser.id !== input.user.id) await createNotification({ userId: areaUser.id, ticketId: approval.ticketId, approvalId: input.approvalId, type: "ticket_ready_for_assignment", title: "Chamado liberado para atendimento", body: `${ticket.publicNumber} foi validado e está disponível para ser assumido pela área.` });
    }
  }
  return db.select().from(ticketApprovals).where(eq(ticketApprovals.id, input.approvalId)).limit(1).then(rows => rows[0]);
}

export async function createAiRequest(input: { ticketId: number; requesterId: number; operation: string; prompt: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const [createdRequest] = await db.insert(aiAssistanceRequests).values({
    ticketId: input.ticketId,
    requesterId: input.requesterId,
    operation: input.operation,
    prompt: input.prompt,
    status: "pending",
  }).returning({ id: aiAssistanceRequests.id });
  return createdRequest.id;
}

export async function completeAiRequest(id: number, response: string) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.update(aiAssistanceRequests).set({ status: "completed", response, completedAt: new Date() }).where(eq(aiAssistanceRequests.id, id));
}

export async function failAiRequest(id: number, errorMessage: string) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.update(aiAssistanceRequests).set({ status: "failed", errorMessage: errorMessage.slice(0, 500), completedAt: new Date() }).where(eq(aiAssistanceRequests.id, id));
}

export async function clearCatalogAndTickets(admin: User) {
  if (admin.role !== "admin") throw new Error("Acesso restrito a administradores");
  const db = await getDb();
  if (!db) throw new Error("Database is not available");

  await db.execute(sql`UPDATE "users" SET "departmentId" = NULL, "teamId" = NULL`);
  await db.execute(sql`UPDATE "userInvitations" SET "departmentId" = NULL, "teamId" = NULL`);
  await db.execute(sql`DELETE FROM "managerScopes"`);
  await db.execute(sql`DELETE FROM "userRoles"`);
  await db.execute(sql`DELETE FROM "aiAssistanceRequests"`);
  await db.execute(sql`DELETE FROM "ticketEvents"`);
  await db.execute(sql`DELETE FROM "ticketAttachments"`);
  await db.execute(sql`DELETE FROM "ticketComments"`);
  await db.execute(sql`DELETE FROM "ticketApprovals"`);
  await db.execute(sql`DELETE FROM "tickets"`);
  await db.execute(sql`DELETE FROM "services"`);
  await db.execute(sql`DELETE FROM "serviceCategories"`);
  await db.execute(sql`DELETE FROM "ticketTypes"`);
  await db.execute(sql`DELETE FROM "queues"`);
  await db.execute(sql`DELETE FROM "teams"`);
  await db.execute(sql`DELETE FROM "departments"`);

  return { success: true };
}
