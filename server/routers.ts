import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { authenticateLocalUser, createAiRequest, addComment, allowedTransitions, assignTicket, claimTicket, completeAiRequest, createDepartment, createInitialLocalAdmin, createQueue, createService, createServiceCategory, createTeam, createTicket, createTicketType, createUserInvitation, decideApproval, ensureFirstAdmin, getFoundationSummary, failAiRequest, getAttachmentDownload, getTicketAttachments, getTicketComments, getTicketEvents, getTicketForUser, listAllAttachments, listApprovals, listApproverUsers, listAuditLogs, listDepartments, listManagerScopes, listNotifications, listQueuesForAdmin, listServiceCategories, listServices, listTeamsForAdmin, listTicketTypes, listTickets, listUsersForAdmin, localSetupStatus, markNotificationRead, replaceManagerScopes, requestApproval, setUserActive, setUserProfile, transitionTicket } from "./db";
import { invokeLLM } from "./_core/llm";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { sdk } from "./_core/sdk";
import { PRIORITIES, TICKET_STATUSES } from "@shared/ticket-types";

const ticketInput = z.object({
  title: z.string().trim().min(4).max(180),
  description: z.string().trim().min(8).max(10000),
  priority: z.enum(PRIORITIES).default("medium"),
  ticketTypeId: z.number().int().positive().optional(),
  categoryId: z.number().int().positive().optional(),
  serviceId: z.number().int().positive().optional(),
  departmentId: z.number().int().positive().optional(),
  teamId: z.number().int().positive().optional(),
  queueId: z.number().int().positive().optional(),
  attachments: z.array(z.object({ fileName: z.string().trim().min(1).max(255), contentType: z.string().trim().min(1).max(120), fileSize: z.number().int().positive().max(10 * 1024 * 1024), data: z.string().min(20).max(15_000_000) })).max(5).optional(),
});

const attachmentInput = z.array(z.object({ fileName: z.string().trim().min(1).max(255), contentType: z.string().trim().min(1).max(120), fileSize: z.number().int().positive().max(10 * 1024 * 1024), data: z.string().min(20).max(15_000_000) })).max(5).optional();
const profileInput = z.enum(["requester", "agent", "approver", "manager"]);
const adminOnly = (role: string) => { if (role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Acesso restrito à administração." }); };

const getTicketOrThrow = async (user: NonNullable<Parameters<typeof getTicketForUser>[0]>, ticketId: number) => {
  const ticket = await getTicketForUser(user, ticketId);
  if (!ticket) throw new TRPCError({ code: "NOT_FOUND", message: "Chamado não encontrado ou sem acesso." });
  return ticket;
};

export const appRouter = router({
  system: router({
    health: publicProcedure.query(() => ({ status: "ok", service: "ticketflow" })),
  }),
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    setupStatus: publicProcedure.query(() => localSetupStatus()),
    setup: publicProcedure.input(z.object({ name: z.string().trim().min(2).max(160), email: z.string().email().max(320), password: z.string().min(8).max(200) })).mutation(async ({ ctx, input }) => {
      const user = await createInitialLocalAdmin(input);
      const token = await sdk.createSessionToken(user.openId, { name: user.name ?? "", expiresInMs: 1000 * 60 * 60 * 12 });
      ctx.res.cookie(COOKIE_NAME, token, { ...getSessionCookieOptions(ctx.req), maxAge: 1000 * 60 * 60 * 12 });
      return { id: user.id, name: user.name, email: user.email, role: user.role, profile: user.profile };
    }),
    login: publicProcedure.input(z.object({ email: z.string().email().max(320), password: z.string().min(1).max(200) })).mutation(async ({ ctx, input }) => {
      const user = await authenticateLocalUser(input.email, input.password);
      if (!user) throw new TRPCError({ code: "UNAUTHORIZED", message: "E-mail ou senha inválidos, ou conta inativa." });
      const token = await sdk.createSessionToken(user.openId, { name: user.name ?? "", expiresInMs: 1000 * 60 * 60 * 12 });
      ctx.res.cookie(COOKIE_NAME, token, { ...getSessionCookieOptions(ctx.req), maxAge: 1000 * 60 * 60 * 12 });
      return { id: user.id, name: user.name, email: user.email, role: user.role, profile: user.profile };
    }),
    bootstrap: protectedProcedure.query(async ({ ctx }) => {
      const user = await ensureFirstAdmin(ctx.user);
      const foundation = await getFoundationSummary();
      return { user, foundation };
    }),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  catalog: router({
    departments: protectedProcedure.query(() => listDepartments()),
    teams: protectedProcedure.input(z.object({ departmentId: z.number().int().positive().optional() }).optional()).query(({ ctx, input }) => listTeamsForAdmin(ctx.user, input?.departmentId)),
    createTeam: protectedProcedure.input(z.object({ name: z.string().trim().min(2).max(120), departmentId: z.number().int().positive() })).mutation(({ ctx, input }) => { adminOnly(ctx.user.role); return createTeam(ctx.user, input); }),
    queues: protectedProcedure.query(({ ctx }) => listQueuesForAdmin(ctx.user)),
    createQueue: protectedProcedure.input(z.object({ name: z.string().trim().min(2).max(120), teamId: z.number().int().positive() })).mutation(({ ctx, input }) => { adminOnly(ctx.user.role); return createQueue(ctx.user, input); }),
    ticketTypes: protectedProcedure.query(() => listTicketTypes()),
    categories: protectedProcedure.query(() => listServiceCategories()),
    services: protectedProcedure.input(z.object({ categoryId: z.number().int().positive().optional() }).optional()).query(({ input }) => listServices(input?.categoryId)),
    approvers: protectedProcedure.query(() => listApproverUsers()),
    createDepartment: protectedProcedure.input(z.object({ name: z.string().trim().min(2).max(120), code: z.string().trim().min(2).max(40) })).mutation(({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Somente administradores podem criar setores." });
      return createDepartment(input);
    }),
    createTicketType: protectedProcedure.input(z.object({ name: z.string().trim().min(2).max(120), description: z.string().trim().max(255).optional() })).mutation(({ ctx, input }) => {
      if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Somente administradores podem criar tipos de chamado." });
      return createTicketType(input);
    }),
    createCategory: protectedProcedure.input(z.object({ name: z.string().trim().min(2).max(120), code: z.string().trim().min(2).max(60), description: z.string().trim().max(255).optional(), parentId: z.number().int().positive().optional() })).mutation(({ ctx, input }) => { adminOnly(ctx.user.role); return createServiceCategory(input); }),
    createService: protectedProcedure.input(z.object({ name: z.string().trim().min(2).max(160), code: z.string().trim().min(2).max(60), description: z.string().trim().max(500).optional(), categoryId: z.number().int().positive(), defaultTicketTypeId: z.number().int().positive().optional(), defaultQueueId: z.number().int().positive().optional() })).mutation(({ ctx, input }) => { adminOnly(ctx.user.role); return createService(input); }),
  }),
  admin: router({
    users: protectedProcedure.query(({ ctx }) => { adminOnly(ctx.user.role); return listUsersForAdmin(ctx.user); }),
    createUser: protectedProcedure.input(z.object({ email: z.string().email().max(320), password: z.string().min(8).max(200), profile: profileInput, departmentId: z.number().int().positive().optional(), teamId: z.number().int().positive().optional() })).mutation(({ ctx, input }) => { adminOnly(ctx.user.role); return createUserInvitation({ admin: ctx.user, ...input }); }),
    setProfile: protectedProcedure.input(z.object({ userId: z.number().int().positive(), profile: profileInput })).mutation(({ ctx, input }) => { adminOnly(ctx.user.role); return setUserProfile(ctx.user, input.userId, input.profile); }),
    setActive: protectedProcedure.input(z.object({ userId: z.number().int().positive(), active: z.boolean() })).mutation(({ ctx, input }) => { adminOnly(ctx.user.role); return setUserActive(ctx.user, input.userId, input.active); }),
    managerScopes: protectedProcedure.input(z.object({ userId: z.number().int().positive() })).query(({ ctx, input }) => { adminOnly(ctx.user.role); return listManagerScopes(ctx.user, input.userId); }),
    setManagerScopes: protectedProcedure.input(z.object({ userId: z.number().int().positive(), scopes: z.array(z.object({ departmentId: z.number().int().positive().optional(), teamId: z.number().int().positive().optional() })).max(30) })).mutation(({ ctx, input }) => { adminOnly(ctx.user.role); return replaceManagerScopes(ctx.user, input.userId, input.scopes); }),
    attachments: protectedProcedure.query(async ({ ctx }) => {
      adminOnly(ctx.user.role);
      return listAllAttachments(ctx.user);
    }),
    audit: protectedProcedure.query(({ ctx }) => { adminOnly(ctx.user.role); return listAuditLogs(ctx.user); }),
  }),
  notifications: router({
    list: protectedProcedure.query(({ ctx }) => listNotifications(ctx.user)),
    markRead: protectedProcedure.input(z.object({ notificationId: z.number().int().positive() })).mutation(({ ctx, input }) => markNotificationRead(ctx.user, input.notificationId)),
  }),
  approvals: router({
    list: protectedProcedure.query(({ ctx }) => listApprovals(ctx.user)),
    request: protectedProcedure.input(z.object({ ticketId: z.number().int().positive(), approverId: z.number().int().positive(), note: z.string().trim().max(2000).optional() })).mutation(({ ctx, input }) => requestApproval({ user: ctx.user, ...input })),
    decide: protectedProcedure.input(z.object({ approvalId: z.number().int().positive(), status: z.enum(["approved", "rejected"]), note: z.string().trim().max(2000).optional() })).mutation(({ ctx, input }) => decideApproval({ user: ctx.user, ...input })),
  }),
  tickets: router({
    list: protectedProcedure.input(z.object({
      search: z.string().trim().max(80).optional(),
      status: z.enum(TICKET_STATUSES).optional(),
      priority: z.enum(PRIORITIES).optional(),
      assignedToMe: z.boolean().optional(),
    }).optional()).query(({ ctx, input }) => listTickets(ctx.user, input ?? {})),
    create: protectedProcedure.input(ticketInput).mutation(({ ctx, input }) => createTicket({ user: ctx.user, ...input })),
    detail: protectedProcedure.input(z.object({ ticketId: z.number().int().positive() })).query(async ({ ctx, input }) => {
      const ticket = await getTicketOrThrow(ctx.user, input.ticketId);
      const [comments, events, attachments] = await Promise.all([
        getTicketComments(ticket.id, ctx.user.role === "admin" || ctx.user.profile === "manager" || ticket.assigneeId === ctx.user.id),
        getTicketEvents(ticket.id),
        getTicketAttachments(ticket.id, ctx.user.role === "admin" || ctx.user.profile === "manager" || ticket.assigneeId === ctx.user.id),
      ]);
      return { ticket, comments, events, attachments, allowedTransitions: allowedTransitions(ticket.status) };
    }),
    comment: protectedProcedure.input(z.object({ ticketId: z.number().int().positive(), body: z.string().trim().min(1).max(5000), visibility: z.enum(["public", "internal"]).default("public"), attachments: attachmentInput })).mutation(async ({ ctx, input }) => {
      if (input.visibility === "internal" && ctx.user.role !== "admin" && ctx.user.profile === "requester") throw new TRPCError({ code: "FORBIDDEN", message: "Notas internas exigem perfil operacional, aprovador ou gestor." });
      return addComment({ user: ctx.user, ...input });
    }),
    downloadAttachment: protectedProcedure.input(z.object({ attachmentId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      try {
        return await getAttachmentDownload(ctx.user, input.attachmentId);
      } catch (error) {
        throw new TRPCError({ code: "FORBIDDEN", message: error instanceof Error ? error.message : "Não foi possível baixar o anexo." });
      }
    }),
    transition: protectedProcedure.input(z.object({ ticketId: z.number().int().positive(), status: z.enum(TICKET_STATUSES), comment: z.string().trim().max(5000).optional() })).mutation(async ({ ctx, input }) => {
      try {
        return await transitionTicket({ user: ctx.user, ...input });
      } catch (error) {
        throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "Não foi possível alterar o status." });
      }
    }),
    assign: protectedProcedure.input(z.object({ ticketId: z.number().int().positive(), assigneeId: z.number().int().positive().nullable() })).mutation(async ({ ctx, input }) => {
      try {
        return await assignTicket({ user: ctx.user, ...input });
      } catch (error) {
        throw new TRPCError({ code: "FORBIDDEN", message: error instanceof Error ? error.message : "Não foi possível atribuir o chamado." });
      }
    }),
    claim: protectedProcedure.input(z.object({ ticketId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      try {
        return await claimTicket({ user: ctx.user, ...input });
      } catch (error) {
        throw new TRPCError({ code: "FORBIDDEN", message: error instanceof Error ? error.message : "Não foi possível assumir o chamado." });
      }
    }),
    assist: protectedProcedure.input(z.object({ ticketId: z.number().int().positive(), operation: z.enum(["summarize", "suggest_reply"]) })).mutation(async ({ ctx, input }) => {
      const ticket = await getTicketOrThrow(ctx.user, input.ticketId);
      const comments = await getTicketComments(ticket.id, ctx.user.role === "admin" || ctx.user.profile === "manager" || ticket.assigneeId === ctx.user.id);
      const context = comments.map(comment => `${comment.visibility === "internal" ? "Nota interna" : "Comentário"}: ${comment.body}`).join("\n");
      const prompt = input.operation === "summarize"
        ? `Resuma este chamado em português brasileiro em até 5 linhas, destacando problema, contexto e próxima ação.\nTítulo: ${ticket.title}\nDescrição: ${ticket.description}\nHistórico:\n${context}`
        : `Sugira uma resposta profissional em português brasileiro para o solicitante. Não invente informações, não prometa prazo e indique o que ainda falta esclarecer.\nTítulo: ${ticket.title}\nDescrição: ${ticket.description}\nHistórico:\n${context}`;
      const requestId = await createAiRequest({ ticketId: ticket.id, requesterId: ctx.user.id, operation: input.operation, prompt });
      try {
        const result = await invokeLLM({
          messages: [
            { role: "system", content: "Você é um assistente de operações de tickets. Produza somente uma sugestão revisável, nunca uma decisão automática." },
            { role: "user", content: prompt },
          ],
          maxTokens: 500,
        });
        const response = typeof result.choices?.[0]?.message?.content === "string" ? result.choices[0].message.content.trim() : "";
        if (!response) throw new Error("A assistência de IA não retornou texto.");
        await completeAiRequest(requestId, response);
        return { response, operation: input.operation, requestId };
      } catch (error) {
        await failAiRequest(requestId, error instanceof Error ? error.message : "Erro desconhecido");
        throw new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "A assistência de IA está indisponível no momento." });
      }
    }),
  }),
});

export type AppRouter = typeof appRouter;
