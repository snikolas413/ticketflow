import { useAuth } from "@/_core/hooks/useAuth";
import { getTicketAge } from "@shared/ticket-age";
import { calculateTicketSla } from "@shared/sla";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { PRIORITY_LABELS, STATUS_LABELS, type TicketPriority, type TicketStatus } from "@shared/ticket-types";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  ClipboardList,
  Clock3,
  FileText,
  Filter,
  Inbox,
  LayoutDashboard,
  Loader2,
  Plus,
  Search,
  Ticket,
  UserCheck,
  UserRound,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import Login from "./Login";

const statusTone: Record<TicketStatus, string> = {
  open: "status-open",
  in_progress: "status-progress",
  waiting_requester: "status-waiting",
  resolved: "status-resolved",
  closed: "status-closed",
};

const priorityTone: Record<TicketPriority, string> = {
  low: "priority-low",
  medium: "priority-medium",
  high: "priority-high",
  urgent: "priority-urgent",
};

const priorityBg: Record<TicketPriority, string> = {
  urgent: "bg-red-500",
  high: "bg-orange-500",
  medium: "bg-blue-500",
  low: "bg-slate-400",
};



type PendingAttachment = { fileName: string; contentType: string; fileSize: number; data: string };

function readAttachment(file: File): Promise<PendingAttachment> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ fileName: file.name, contentType: file.type || "application/octet-stream", fileSize: file.size, data: String(reader.result) });
    reader.onerror = () => reject(new Error(`Não foi possível ler ${file.name}`));
    reader.readAsDataURL(file);
  });
}

function StatCard({
  icon: Icon,
  label,
  value,
  detail,
  tone,
  badge,
}: {
  icon: typeof Inbox;
  label: string;
  value: number;
  detail: string;
  tone: string;
  badge?: string;
}) {
  return (
    <Card className="metric-card border-[#e5e8f0] shadow-[0_4px_20px_rgba(25,42,78,0.03)] hover:shadow-md transition-shadow">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-[#6c7891]">{label}</p>
            <p className="mt-2 text-3xl font-bold tracking-tight text-[#15213d]">{value}</p>
          </div>
          <div className={`metric-icon ${tone}`}>
            <Icon className="size-5" />
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between text-xs text-[#8791a5]">
          <span>{detail}</span>
          {badge && <span className="font-medium text-[#3157d5]">{badge}</span>}
        </div>
      </CardContent>
    </Card>
  );
}

export default function Home() {
  const { user, loading } = useAuth();
  const [location, setLocation] = useLocation();

  // Tab selection based on current route
  const currentTab: "overview" | "my_tickets" | "all_tickets" =
    location === "/my-tickets" ? "my_tickets" : location === "/tickets" ? "all_tickets" : "overview";

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<TicketStatus | "all">("all");
  const [priorityFilter, setPriorityFilter] = useState<TicketPriority | "all">("all");

  // Create ticket form state
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<TicketPriority>("medium");
  const [departmentId, setDepartmentId] = useState<number | undefined>();
  const [ticketTypeId, setTicketTypeId] = useState<number | undefined>();
  const [categoryId, setCategoryId] = useState<number | undefined>();
  const [serviceId, setServiceId] = useState<number | undefined>();
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);

  // TRPC Queries
  const foundation = trpc.auth.bootstrap.useQuery(undefined, { enabled: Boolean(user), staleTime: 60_000 });
  const departments = trpc.catalog.departments.useQuery(undefined, { enabled: Boolean(user), staleTime: 60_000 });
  const ticketTypes = trpc.catalog.ticketTypes.useQuery(undefined, { enabled: Boolean(user), staleTime: 60_000 });
  const categories = trpc.catalog.categories.useQuery(undefined, { enabled: Boolean(user), staleTime: 60_000 });
  const services = trpc.catalog.services.useQuery({ categoryId }, { enabled: Boolean(user), staleTime: 60_000 });
  const slaPolicies = trpc.tickets.slaPolicies.useQuery(undefined, { enabled: Boolean(user), staleTime: 60_000 });

  // Query for general tickets (overview & all tickets)
  const allTicketsQuery = trpc.tickets.list.useQuery(
    {
      search: currentTab === "all_tickets" && search ? search : undefined,
      status: currentTab === "all_tickets" && statusFilter !== "all" ? statusFilter : undefined,
      priority: currentTab === "all_tickets" && priorityFilter !== "all" ? priorityFilter : undefined,
    },
    { enabled: Boolean(user), staleTime: 10_000 }
  );

  // Query for ONLY tickets assigned to the logged-in user
  const myTicketsQuery = trpc.tickets.list.useQuery(
    {
      assignedToMe: true,
      search: currentTab === "my_tickets" && search ? search : undefined,
      status: currentTab === "my_tickets" && statusFilter !== "all" ? statusFilter : undefined,
      priority: currentTab === "my_tickets" && priorityFilter !== "all" ? priorityFilter : undefined,
    },
    { enabled: Boolean(user), staleTime: 10_000 }
  );

  const utils = trpc.useUtils();
  const createTicket = trpc.tickets.create.useMutation({
    onSuccess: (ticket) => {
      toast.success(`Chamado ${ticket?.publicNumber ?? ""} criado com sucesso!`);
      setTitle("");
      setDescription("");
      setPriority("medium");
      setDepartmentId(undefined);
      setTicketTypeId(undefined);
      setCategoryId(undefined);
      setServiceId(undefined);
      setAttachments([]);
      setShowCreate(false);
      void utils.tickets.list.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const effectiveUser = foundation.data?.user ?? user;
  const allRows = allTicketsQuery.data ?? [];
  const myRows = useMemo(() => {
    const data = myTicketsQuery.data ?? [];
    if (!effectiveUser?.id) return data;
    // Strict client guarantee: only tickets assigned to the logged in user
    return data.filter((t) => t.assigneeId === effectiveUser.id);
  }, [myTicketsQuery.data, effectiveUser?.id]);

  // Overall metrics
  const metrics = useMemo(() => {
    const total = allRows.length;
    const open = allRows.filter((t) => t.status === "open").length;
    const progress = allRows.filter((t) => t.status === "in_progress").length;
    const waiting = allRows.filter((t) => t.status === "waiting_requester").length;
    const resolved = allRows.filter((t) => t.status === "resolved" || t.status === "closed").length;
    const resolutionRate = total > 0 ? Math.round((resolved / total) * 100) : 0;

    const urgent = allRows.filter((t) => t.priority === "urgent").length;
    const high = allRows.filter((t) => t.priority === "high").length;
    const medium = allRows.filter((t) => t.priority === "medium").length;
    const low = allRows.filter((t) => t.priority === "low").length;

    const criticalTickets = allRows.filter(
      (t) => (t.priority === "urgent" || t.priority === "high") && t.status !== "resolved" && t.status !== "closed"
    );

    const myAssignedCount = allRows.filter((t) => t.assigneeId === effectiveUser?.id).length;
    const unassignedCount = allRows.filter((t) => !t.assigneeId && t.status !== "closed").length;
    const pendingApprovalCount = allRows.filter((t) => t.approvalStatus === "pending").length;

    return {
      total,
      open,
      progress,
      waiting,
      resolved,
      resolutionRate,
      urgent,
      high,
      medium,
      low,
      criticalTickets,
      myAssignedCount,
      unassignedCount,
      pendingApprovalCount,
    };
  }, [allRows, effectiveUser?.id]);

  // Resolution-time KPI uses only completed tickets with a valid resolvedAt timestamp.
  // This avoids treating updatedAt or closedAt as a resolution timestamp.
  const resolutionInsights = useMemo(() => {
    const completedWithResolution = allRows.filter((ticket) => {
      if (ticket.status !== "resolved" && ticket.status !== "closed") return false;
      if (!ticket.resolvedAt) return false;
      const createdMs = new Date(ticket.createdAt).getTime();
      const resolvedMs = new Date(ticket.resolvedAt).getTime();
      return Number.isFinite(createdMs) && Number.isFinite(resolvedMs) && resolvedMs >= createdMs;
    });
    const totalResolutionMs = completedWithResolution.reduce((sum, ticket) =>
      sum + (new Date(ticket.resolvedAt!).getTime() - new Date(ticket.createdAt).getTime()), 0);
    const averageHours = completedWithResolution.length > 0
      ? totalResolutionMs / completedWithResolution.length / 3_600_000
      : null;
    return { sampleSize: completedWithResolution.length, averageHours };
  }, [allRows]);

  // SLA health summary for the management dashboard. Only active deadlines are counted.
  const slaSummary = useMemo(() => {
    let overdue = 0;
    let atRisk = 0;
    let onTrack = 0;
    let monitored = 0;

    for (const ticket of allRows) {
      if (ticket.status === "resolved" || ticket.status === "closed") continue;
      const policy = slaPolicies.data?.find((item) => item.priority === ticket.priority);
      if (!policy) continue;
      const sla = calculateTicketSla({
        createdAt: ticket.createdAt,
        status: ticket.status,
        priority: ticket.priority,
        policy,
        firstRespondedAt: ticket.firstRespondedAt,
      });
      if (!sla) continue;

      for (const deadline of [sla.firstResponse, sla.resolution]) {
        if (!deadline) continue;
        monitored += 1;
        if (deadline.state === "breached") overdue += 1;
        else if (deadline.state === "at_risk") atRisk += 1;
        else if (deadline.state === "on_track") onTrack += 1;
      }
    }

    return { overdue, atRisk, onTrack, monitored };
  }, [allRows, slaPolicies.data]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f6f7fb]">
        <Loader2 className="size-6 animate-spin text-[#3157d5]" />
      </div>
    );
  }

  if (!user) return <Login />;

  return (
    <AppShell>
      <div className="mx-auto max-w-[1440px] px-5 py-7 sm:px-8 lg:px-10 lg:py-9">
        {/* Header with Greeting & Quick Action */}
        <div className="flex flex-col justify-between gap-5 border-b border-[#e5e8f0] pb-6 md:flex-row md:items-center">
          <div>
            <div className="flex items-center gap-2">
              <span className="eyebrow text-[#3157d5]">TicketFlow Operations</span>
              <Badge variant="outline" className="border-[#d5ddf0] text-xs font-semibold text-[#526079]">
                {effectiveUser?.role === "admin"
                  ? "Administrador"
                  : effectiveUser?.profile === "manager"
                  ? "Gestor"
                  : effectiveUser?.profile === "agent"
                  ? "Atendente"
                  : effectiveUser?.profile === "approver"
                  ? "Aprovador"
                  : "Solicitante"}
              </Badge>
            </div>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-[#15213d] sm:text-3xl">
              Olá, {effectiveUser?.name || effectiveUser?.email}
            </h1>
            <p className="mt-1 text-sm text-[#6c7891]">
              Acompanhe suas solicitações, métricas operacionais e fila de atendimento.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              onClick={() => setShowCreate(true)}
              className="h-10 rounded-xl bg-[#3157d5] px-5 font-medium text-white shadow-md shadow-[#3157d5]/20 hover:bg-[#2747b8]"
            >
              <Plus className="mr-2 size-4" /> Novo chamado
            </Button>
          </div>
        </div>

        {/* Navigation Tabs Bar */}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-b border-[#e5e8f0]">
          <div className="flex gap-2">
            <button
              onClick={() => setLocation("/")}
              className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition-colors ${
                currentTab === "overview"
                  ? "border-[#3157d5] text-[#3157d5]"
                  : "border-transparent text-[#6c7891] hover:text-[#15213d]"
              }`}
            >
              <LayoutDashboard className="size-4" />
              <span>Visão geral</span>
            </button>

            <button
              onClick={() => setLocation("/my-tickets")}
              className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition-colors ${
                currentTab === "my_tickets"
                  ? "border-[#3157d5] text-[#3157d5]"
                  : "border-transparent text-[#6c7891] hover:text-[#15213d]"
              }`}
            >
              <ClipboardList className="size-4" />
              <span>Meus chamados</span>
              <span
                className={`ml-1 rounded-full px-2 py-0.5 text-xs font-bold ${
                  currentTab === "my_tickets" ? "bg-[#3157d5] text-white" : "bg-[#e5e8f0] text-[#526079]"
                }`}
              >
                {metrics.myAssignedCount}
              </span>
            </button>

            <button
              onClick={() => setLocation("/tickets")}
              className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition-colors ${
                currentTab === "all_tickets"
                  ? "border-[#3157d5] text-[#3157d5]"
                  : "border-transparent text-[#6c7891] hover:text-[#15213d]"
              }`}
            >
              <Inbox className="size-4" />
              <span>Fila geral</span>
              <span className="ml-1 rounded-full bg-[#e5e8f0] px-2 py-0.5 text-xs font-bold text-[#526079]">
                {metrics.total}
              </span>
            </button>
          </div>

          {/* Quick counters summary */}
          <div className="hidden items-center gap-4 py-2 text-xs text-[#6c7891] md:flex">
            <span>
              <strong className="text-[#15213d]">{metrics.myAssignedCount}</strong> designados a você
            </span>
            <span>·</span>
            <span>
              <strong className="text-[#15213d]">{metrics.unassignedCount}</strong> sem responsável
            </span>
            <span>·</span>
            <span>
              <strong className="text-[#15213d]">{metrics.resolutionRate}%</strong> taxa de resolução
            </span>
          </div>
        </div>

        {/* =========================================================================
            TAB 1: VISÃO GERAL (Comprehensive, beautiful Dashboard)
            ========================================================================= */}
        {currentTab === "overview" && (
          <div className="mt-8 space-y-8">
            {/* Top 5 KPI Cards */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <StatCard
                icon={Ticket}
                label="Total no Escopo"
                value={metrics.total}
                detail="Chamados monitorados"
                tone="metric-blue"
              />
              <StatCard
                icon={Inbox}
                label="Abertos"
                value={metrics.open}
                detail="Aguardando triagem"
                tone="metric-blue"
              />
              <StatCard
                icon={Clock3}
                label="Em Atendimento"
                value={metrics.progress}
                detail="Em andamento com analistas"
                tone="metric-amber"
              />
              <StatCard
                icon={CircleAlert}
                label="Aguardando"
                value={metrics.waiting}
                detail="Dependem de retorno"
                tone="metric-violet"
              />
              <StatCard
                icon={CheckCircle2}
                label="Resolvidos"
                value={metrics.resolved}
                detail={`${metrics.resolutionRate}% resolvidos`}
                tone="metric-green"
                badge={`${metrics.resolutionRate}%`}
              />
            </div>

            {/* SLA health summary */}
            <Card className="border-[#e5e8f0] shadow-sm">
              <CardHeader className="border-b border-[#edf0f5] pb-4">
                <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                  <div>
                    <CardTitle className="text-base text-[#15213d]">Saúde dos SLAs</CardTitle>
                    <p className="mt-1 text-xs text-[#8791a5]">Prazos ativos de primeira resposta e resolução</p>
                  </div>
                  <Badge variant="outline" className="w-fit border-[#d5ddf0] text-[#526079]">
                    {slaSummary.monitored} prazos monitorados
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="grid gap-3 p-4 sm:grid-cols-3">
                <div className="rounded-xl border border-red-100 bg-red-50/70 p-4">
                  <p className="text-xs font-medium text-red-700">Vencidos</p>
                  <p className="mt-1 text-2xl font-bold text-red-700">{slaSummary.overdue}</p>
                  <p className="mt-1 text-[11px] text-red-600">Exigem ação prioritária</p>
                </div>
                <div className="rounded-xl border border-amber-100 bg-amber-50/70 p-4">
                  <p className="text-xs font-medium text-amber-800">Em risco</p>
                  <p className="mt-1 text-2xl font-bold text-amber-800">{slaSummary.atRisk}</p>
                  <p className="mt-1 text-[11px] text-amber-700">Vencem em até 1 hora</p>
                </div>
                <div className="rounded-xl border border-emerald-100 bg-emerald-50/70 p-4">
                  <p className="text-xs font-medium text-emerald-800">Dentro do prazo</p>
                  <p className="mt-1 text-2xl font-bold text-emerald-800">{slaSummary.onTrack}</p>
                  <p className="mt-1 text-[11px] text-emerald-700">Prazos sem risco imediato</p>
                </div>
              </CardContent>
              <div className="px-4 pb-4 text-[11px] text-[#8791a5]">
                Cálculo atual em horas corridas, conforme as políticas configuradas por prioridade.
              </div>
            </Card>

            {/* Resolution performance KPI */}
            <Card className="border-[#e5e8f0] shadow-sm">
              <CardHeader className="border-b border-[#edf0f5] pb-3">
                <CardTitle className="text-base text-[#15213d]">Tempo médio de resolução</CardTitle>
                <p className="text-xs text-[#8791a5]">Tempo entre a abertura e a resolução registrada</p>
              </CardHeader>
              <CardContent className="flex flex-col gap-2 p-5 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-3xl font-bold tracking-tight text-[#15213d]">
                    {resolutionInsights.averageHours === null
                      ? "Sem dados"
                      : resolutionInsights.averageHours < 24
                        ? `${resolutionInsights.averageHours.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} h`
                        : `${(resolutionInsights.averageHours / 24).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} dias`}
                  </p>
                  <p className="mt-1 text-xs text-[#6c7891]">
                    Base: {resolutionInsights.sampleSize} chamado(s) concluído(s) com data de resolução registrada.
                  </p>
                </div>
                <Badge variant="outline" className="w-fit border-[#d5ddf0] text-[#526079]">
                  Métrica histórica
                </Badge>
              </CardContent>
            </Card>

            {/* Analytical Insights Row */}
            <div className="grid gap-6 lg:grid-cols-3">
              {/* Distribution by Priority Card */}
              <Card className="border-[#e5e8f0] shadow-sm">
                <CardHeader className="border-b border-[#edf0f5] pb-4">
                  <CardTitle className="text-base text-[#15213d]">Distribuição por Prioridade</CardTitle>
                  <p className="text-xs text-[#8791a5]">Impacto e urgência das demandas ativas</p>
                </CardHeader>
                <CardContent className="space-y-4 p-5">
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs font-medium">
                      <span className="flex items-center gap-1.5 text-red-600 font-semibold">
                        <span className="size-2 rounded-full bg-red-500" /> Urgente
                      </span>
                      <span className="text-[#526079]">
                        {metrics.urgent} ({metrics.total > 0 ? Math.round((metrics.urgent / metrics.total) * 100) : 0}%)
                      </span>
                    </div>
                    <Progress
                      value={metrics.total > 0 ? (metrics.urgent / metrics.total) * 100 : 0}
                      className="h-2 bg-red-100 [&>div]:bg-red-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs font-medium">
                      <span className="flex items-center gap-1.5 text-orange-600 font-semibold">
                        <span className="size-2 rounded-full bg-orange-500" /> Alta
                      </span>
                      <span className="text-[#526079]">
                        {metrics.high} ({metrics.total > 0 ? Math.round((metrics.high / metrics.total) * 100) : 0}%)
                      </span>
                    </div>
                    <Progress
                      value={metrics.total > 0 ? (metrics.high / metrics.total) * 100 : 0}
                      className="h-2 bg-orange-100 [&>div]:bg-orange-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs font-medium">
                      <span className="flex items-center gap-1.5 text-blue-600 font-semibold">
                        <span className="size-2 rounded-full bg-blue-500" /> Média
                      </span>
                      <span className="text-[#526079]">
                        {metrics.medium} ({metrics.total > 0 ? Math.round((metrics.medium / metrics.total) * 100) : 0}%)
                      </span>
                    </div>
                    <Progress
                      value={metrics.total > 0 ? (metrics.medium / metrics.total) * 100 : 0}
                      className="h-2 bg-blue-100 [&>div]:bg-blue-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs font-medium">
                      <span className="flex items-center gap-1.5 text-slate-600 font-semibold">
                        <span className="size-2 rounded-full bg-slate-400" /> Baixa
                      </span>
                      <span className="text-[#526079]">
                        {metrics.low} ({metrics.total > 0 ? Math.round((metrics.low / metrics.total) * 100) : 0}%)
                      </span>
                    </div>
                    <Progress
                      value={metrics.total > 0 ? (metrics.low / metrics.total) * 100 : 0}
                      className="h-2 bg-slate-100 [&>div]:bg-slate-400"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Operational Status Card */}
              <Card className="border-[#e5e8f0] shadow-sm">
                <CardHeader className="border-b border-[#edf0f5] pb-4">
                  <CardTitle className="text-base text-[#15213d]">Status Operacional</CardTitle>
                  <p className="text-xs text-[#8791a5]">Fluxo de trabalho e saúde do atendimento</p>
                </CardHeader>
                <CardContent className="space-y-3 p-5 text-sm">
                  <div className="flex items-center justify-between rounded-lg bg-[#f8f9fc] p-3">
                    <div className="flex items-center gap-2.5">
                      <UserCheck className="size-4 text-[#3157d5]" />
                      <span className="text-xs font-medium text-[#253252]">Designados a Você</span>
                    </div>
                    <span className="rounded-full bg-[#3157d5]/10 px-2.5 py-0.5 text-xs font-bold text-[#3157d5]">
                      {metrics.myAssignedCount}
                    </span>
                  </div>

                  <div className="flex items-center justify-between rounded-lg bg-[#f8f9fc] p-3">
                    <div className="flex items-center gap-2.5">
                      <UserRound className="size-4 text-[#d97706]" />
                      <span className="text-xs font-medium text-[#253252]">Sem Atribuição (Fila Livre)</span>
                    </div>
                    <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-800">
                      {metrics.unassignedCount}
                    </span>
                  </div>

                  <div className="flex items-center justify-between rounded-lg bg-[#f8f9fc] p-3">
                    <div className="flex items-center gap-2.5">
                      <AlertTriangle className="size-4 text-[#a855f7]" />
                      <span className="text-xs font-medium text-[#253252]">Aguardando Validação/Aprovação</span>
                    </div>
                    <span className="rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-bold text-purple-800">
                      {metrics.pendingApprovalCount}
                    </span>
                  </div>

                  <div className="pt-2">
                    <Button
                      variant="outline"
                      className="w-full text-xs font-semibold text-[#3157d5] hover:bg-[#eef2ff]"
                      onClick={() => setLocation("/my-tickets")}
                    >
                      Ver Meus Chamados Atribuídos <ArrowRight className="ml-1 size-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Workspace / Context Info Card */}
              <Card className="border-[#e5e8f0] shadow-sm">
                <CardHeader className="border-b border-[#edf0f5] pb-4">
                  <CardTitle className="text-base text-[#15213d]">Seu Espaço de Trabalho</CardTitle>
                  <p className="text-xs text-[#8791a5]">Parâmetros do seu perfil e setor</p>
                </CardHeader>
                <CardContent className="space-y-3.5 p-5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[#8791a5]">Setor Ativo</span>
                    <span className="font-semibold text-[#15213d]">
                      {foundation.data?.foundation.department.name ?? "Configuração Geral"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[#8791a5]">Fila Padrão</span>
                    <span className="font-semibold text-[#15213d]">
                      {foundation.data?.foundation.queue.name ?? "Triagem Central"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[#8791a5]">Perfil Operacional</span>
                    <Badge variant="outline" className="border-[#3157d5]/30 bg-[#eef2ff] text-[11px] text-[#3157d5]">
                      {effectiveUser?.role === "admin" ? "Administrador Geral" : "Operador"}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[#8791a5]">E-mail Corporativo</span>
                    <span className="font-mono text-[#526079]">{effectiveUser?.email}</span>
                  </div>

                  <div className="pt-2">
                    <Button
                      onClick={() => setShowCreate(true)}
                      className="w-full bg-[#3157d5] text-xs font-semibold text-white hover:bg-[#2747b8]"
                    >
                      <Plus className="mr-1.5 size-3.5" /> Abrir Novo Chamado
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Critical Tickets & Recent Tickets Row */}
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Critical Attention Card */}
              <Card className="border-[#e5e8f0] shadow-sm">
                <CardHeader className="border-b border-[#edf0f5] pb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2 text-base text-[#15213d]">
                        <AlertTriangle className="size-4 text-orange-500" /> Chamados Críticos & Urgentes
                      </CardTitle>
                      <p className="mt-1 text-xs text-[#8791a5]">Demandas de prioridade alta/urgente em aberto</p>
                    </div>
                    <Badge variant="outline" className="border-orange-200 bg-orange-50 text-xs font-bold text-orange-700">
                      {metrics.criticalTickets.length} pendentes
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  {metrics.criticalTickets.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-8 text-center">
                      <CheckCircle2 className="size-8 text-emerald-500" />
                      <p className="mt-2 text-sm font-semibold text-[#15213d]">Tudo sob controle!</p>
                      <p className="mt-1 text-xs text-[#8791a5]">
                        Nenhum chamado urgente ou de alta prioridade pendente.
                      </p>
                    </div>
                  ) : (
                    <div className="divide-y divide-[#edf0f5]">
                      {metrics.criticalTickets.slice(0, 5).map((t) => (
                        <button
                          key={t.id}
                          onClick={() => setLocation(`/tickets/${t.id}`)}
                          className="flex w-full items-center justify-between gap-3 p-4 text-left transition hover:bg-[#f8f9fc]"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="mono text-xs font-bold text-[#3157d5]">{t.publicNumber}</span>
                              <Badge className={`${statusTone[t.status]} border-0 text-[10px]`}>
                                {STATUS_LABELS[t.status]}
                              </Badge>
                              <span
                                className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase text-white ${
                                  priorityBg[t.priority]
                                }`}
                              >
                                {PRIORITY_LABELS[t.priority]}
                              </span>
                            </div>
                            <p className="mt-1 truncate text-xs font-semibold text-[#253252]">{t.title}</p>
                          </div>
                          <ChevronRight className="size-4 text-[#b5bdcb]" />
                        </button>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Recent Activity Card */}
              <Card className="border-[#e5e8f0] shadow-sm">
                <CardHeader className="border-b border-[#edf0f5] pb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base text-[#15213d]">Últimos Chamados Movimentados</CardTitle>
                      <p className="mt-1 text-xs text-[#8791a5]">Atividades recentes no workspace</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs text-[#3157d5] hover:bg-[#eef2ff]"
                      onClick={() => setLocation("/tickets")}
                    >
                      Ver fila completa →
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  {allRows.length === 0 ? (
                    <div className="p-8 text-center text-xs text-[#8791a5]">Nenhum chamado registrado ainda.</div>
                  ) : (
                    <div className="divide-y divide-[#edf0f5]">
                      {allRows.slice(0, 5).map((t) => (
                        <button
                          key={t.id}
                          onClick={() => setLocation(`/tickets/${t.id}`)}
                          className="flex w-full items-center justify-between gap-3 p-4 text-left transition hover:bg-[#f8f9fc]"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="mono text-xs font-semibold text-[#3157d5]">{t.publicNumber}</span>
                              <Badge className={`${statusTone[t.status]} border-0 text-[10px]`}>
                                {STATUS_LABELS[t.status]}
                              </Badge>
                            </div>
                            <p className="mt-1 truncate text-xs font-medium text-[#253252]">{t.title}</p>
                            <p className="mt-0.5 text-[11px] text-[#8791a5]">
                              Atualizado {new Date(t.updatedAt).toLocaleDateString("pt-BR")}
                            </p>
                          </div>
                          <ChevronRight className="size-4 text-[#b5bdcb]" />
                        </button>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* =========================================================================
            TAB 2: MEUS CHAMADOS (Only tickets designated/assigned to the logged-in user)
            ========================================================================= */}
        {currentTab === "my_tickets" && (
          <div className="mt-8 space-y-6">
            {/* Banner explaining strict assignment scope */}
            <div className="flex flex-col justify-between gap-4 rounded-2xl border border-[#d5ddf0] bg-[#f8faff] p-5 md:flex-row md:items-center">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-[#3157d5] p-2.5 text-white">
                  <UserCheck className="size-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-[#15213d]">Meus Chamados Designados</h2>
                  <p className="mt-0.5 text-xs text-[#6c7891]">
                    Exibindo exclusivamente os chamados sob sua responsabilidade direta (atribuídos a{" "}
                    <strong>{effectiveUser?.name || effectiveUser?.email}</strong>).
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-[#3157d5] shadow-sm">
                  {myRows.length} chamado{myRows.length !== 1 ? "s" : ""} atribuído{myRows.length !== 1 ? "s" : ""}
                </span>
              </div>
            </div>

            {/* Filter toolbar */}
            <Card className="border-[#e5e8f0] shadow-sm">
              <CardContent className="p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="relative min-w-0 flex-1">
                    <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#9aa4b8]" />
                    <Input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Buscar por número ou título nos meus chamados..."
                      className="h-9 w-full pl-9 text-xs"
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value as TicketStatus | "all")}
                      className="h-9 rounded-md border border-input bg-background px-3 text-xs text-[#526079]"
                    >
                      <option value="all">Todos os status</option>
                      {Object.entries(STATUS_LABELS).map(([val, lbl]) => (
                        <option key={val} value={val}>
                          {lbl}
                        </option>
                      ))}
                    </select>

                    <select
                      value={priorityFilter}
                      onChange={(e) => setPriorityFilter(e.target.value as TicketPriority | "all")}
                      className="h-9 rounded-md border border-input bg-background px-3 text-xs text-[#526079]"
                    >
                      <option value="all">Todas as prioridades</option>
                      {Object.entries(PRIORITY_LABELS).map(([val, lbl]) => (
                        <option key={val} value={val}>
                          Prioridade {lbl}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* My Tickets List / Table */}
            <Card className="overflow-hidden border-[#e5e8f0] shadow-sm">
              <CardContent className="p-0">
                {myTicketsQuery.isLoading ? (
                  <div className="space-y-3 p-6">
                    <div className="skeleton-line w-2/3" />
                    <div className="skeleton-line w-full" />
                    <div className="skeleton-line w-5/6" />
                  </div>
                ) : myRows.length === 0 ? (
                  <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
                    <div className="mb-4 rounded-2xl bg-[#eef2ff] p-4 text-[#3157d5]">
                      <ClipboardList className="size-8" />
                    </div>
                    <p className="text-base font-bold text-[#253252]">Nenhum chamado designado a você</p>
                    <p className="mt-1 max-w-sm text-xs text-[#8791a5]">
                      No momento você não possui chamados sob sua responsabilidade direta. Você pode consultar a fila
                      geral para assumir novos chamados ou abrir uma solicitação.
                    </p>
                    <div className="mt-5 flex gap-3">
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs"
                        onClick={() => setLocation("/tickets")}
                      >
                        <Inbox className="mr-1.5 size-3.5" /> Ir para Fila Geral
                      </Button>
                      <Button
                        size="sm"
                        className="bg-[#3157d5] text-xs text-white hover:bg-[#2747b8]"
                        onClick={() => setShowCreate(true)}
                      >
                        <Plus className="mr-1.5 size-3.5" /> Abrir Chamado
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="divide-y divide-[#edf0f5]">
                    {myRows.map((ticket) => (
                      <button
                        key={ticket.id}
                        onClick={() => setLocation(`/tickets/${ticket.id}`)}
                        className="ticket-row group flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-[#f8f9fc]"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="mono text-xs font-bold text-[#3157d5]">{ticket.publicNumber}</span>
                            <Badge className={`${statusTone[ticket.status]} border-0 text-[10px]`}>
                              {STATUS_LABELS[ticket.status]}
                            </Badge>
                            <Badge
                              variant="outline"
                              className={`text-[10px] ${
                                ticket.priority === "urgent"
                                  ? "border-red-300 text-red-600"
                                  : ticket.priority === "high"
                                  ? "border-orange-300 text-orange-600"
                                  : "text-[#526079]"
                              }`}
                            >
                              Prioridade {PRIORITY_LABELS[ticket.priority]}
                            </Badge>
                            <Badge
                              variant="outline"
                              className={
                                ticket.approvalStatus === "approved"
                                  ? "border-[#b9e7d2] text-[#147b55]"
                                  : ticket.approvalStatus === "rejected"
                                  ? "border-[#f2c3c3] text-[#b64747]"
                                  : "border-[#f5d9a7] text-[#a96908]"
                              }
                            >
                              {ticket.approvalStatus === "approved"
                                ? "Validado"
                                : ticket.approvalStatus === "rejected"
                                ? "Rejeitado"
                                : "Pendente"}
                            </Badge>
                          </div>
                          <p className="mt-1 truncate text-sm font-semibold text-[#253252] group-hover:text-[#3157d5]">
                            {ticket.title}
                          </p>
                          <p className="mt-1 text-xs text-[#8791a5]">
                            Atualizado em {new Date(ticket.updatedAt).toLocaleDateString("pt-BR")} · Criado em{" "}
                            {new Date(ticket.createdAt).toLocaleDateString("pt-BR")}
                          </p>
                          {(() => {
                            const age = getTicketAge(ticket.createdAt, ticket.status);
                            if (!age) return null;
                            const toneClass = age.tone === "critical" ? "text-red-600" : age.tone === "warning" ? "text-amber-600" : "text-[#8791a5]";
                            return <p className={`mt-1 text-[11px] font-medium ${toneClass}`}>{age.label}</p>;
                          })()}
                          {ticket.firstRespondedAt && (
                            <p className="mt-1 text-[11px] font-medium text-emerald-700">
                              1ª resposta registrada em {new Date(ticket.firstRespondedAt).toLocaleString("pt-BR")}
                            </p>
                          )}
                          {(() => {
                            const policy = slaPolicies.data?.find((item) => item.priority === ticket.priority);
                            if (!policy) return null;
                            const sla = calculateTicketSla({
                              createdAt: ticket.createdAt,
                              status: ticket.status,
                              priority: ticket.priority,
                              policy,
                              firstRespondedAt: ticket.firstRespondedAt,
                            });
                            if (!sla) return null;
                            const deadlines = [
                              { label: "1ª resposta", deadline: sla.firstResponse },
                              { label: "Resolução", deadline: sla.resolution },
                            ].filter((item) => item.deadline !== null);
                            if (deadlines.length === 0) return null;
                            return (
                              <div className="mt-2 flex flex-wrap gap-1">
                                {deadlines.map(({ label, deadline }) => {
                                  if (!deadline) return null;
                                  const text = deadline.state === "breached"
                                    ? "Vencido"
                                    : deadline.state === "at_risk"
                                    ? "Em risco"
                                    : `Em dia · ${Math.ceil(deadline.remainingMs / 3_600_000)}h restantes`;
                                  const tone = deadline.state === "breached"
                                    ? "border-red-200 bg-red-50 text-red-700"
                                    : deadline.state === "at_risk"
                                    ? "border-amber-200 bg-amber-50 text-amber-700"
                                    : "border-emerald-200 bg-emerald-50 text-emerald-700";
                                  return <Badge key={label} variant="outline" className={`text-[10px] ${tone}`}>{label}: {text}</Badge>;
                                })}
                              </div>
                            );
                          })()}
                        </div>
                        <ChevronRight className="size-4 text-[#b5bdcb] transition-transform group-hover:translate-x-1 group-hover:text-[#3157d5]" />
                      </button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* =========================================================================
            TAB 3: FILA GERAL / TODOS OS CHAMADOS
            ========================================================================= */}
        {currentTab === "all_tickets" && (
          <div className="mt-8 space-y-6">
            {/* Filter toolbar */}
            <Card className="border-[#e5e8f0] shadow-sm">
              <CardContent className="p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="relative min-w-0 flex-1">
                    <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#9aa4b8]" />
                    <Input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Buscar número público, título ou termos..."
                      className="h-9 w-full pl-9 text-xs"
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value as TicketStatus | "all")}
                      className="h-9 rounded-md border border-input bg-background px-3 text-xs text-[#526079]"
                    >
                      <option value="all">Todos os status</option>
                      {Object.entries(STATUS_LABELS).map(([val, lbl]) => (
                        <option key={val} value={val}>
                          {lbl}
                        </option>
                      ))}
                    </select>

                    <select
                      value={priorityFilter}
                      onChange={(e) => setPriorityFilter(e.target.value as TicketPriority | "all")}
                      className="h-9 rounded-md border border-input bg-background px-3 text-xs text-[#526079]"
                    >
                      <option value="all">Todas as prioridades</option>
                      {Object.entries(PRIORITY_LABELS).map(([val, lbl]) => (
                        <option key={val} value={val}>
                          Prioridade {lbl}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* All Tickets List */}
            <Card className="overflow-hidden border-[#e5e8f0] shadow-sm">
              <CardContent className="p-0">
                {allTicketsQuery.isLoading ? (
                  <div className="space-y-3 p-6">
                    <div className="skeleton-line w-2/3" />
                    <div className="skeleton-line w-full" />
                    <div className="skeleton-line w-5/6" />
                  </div>
                ) : allRows.length === 0 ? (
                  <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
                    <div className="mb-4 rounded-2xl bg-[#eef2ff] p-4 text-[#3157d5]">
                      <Ticket className="size-8" />
                    </div>
                    <p className="text-base font-bold text-[#253252]">Nenhum chamado encontrado</p>
                    <p className="mt-1 max-w-xs text-xs text-[#8791a5]">
                      Crie o primeiro chamado ou ajuste os filtros para visualizar resultados.
                    </p>
                    <Button
                      className="mt-5 bg-[#3157d5] text-xs font-semibold text-white hover:bg-[#2747b8]"
                      onClick={() => setShowCreate(true)}
                    >
                      <Plus className="mr-1.5 size-3.5" /> Criar Chamado
                    </Button>
                  </div>
                ) : (
                  <div className="divide-y divide-[#edf0f5]">
                    {allRows.map((ticket) => (
                      <button
                        key={ticket.id}
                        onClick={() => setLocation(`/tickets/${ticket.id}`)}
                        className="ticket-row group flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-[#f8f9fc]"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="mono text-xs font-bold text-[#3157d5]">{ticket.publicNumber}</span>
                            <Badge className={`${statusTone[ticket.status]} border-0 text-[10px]`}>
                              {STATUS_LABELS[ticket.status]}
                            </Badge>
                            <Badge
                              variant="outline"
                              className={`text-[10px] ${
                                ticket.priority === "urgent"
                                  ? "border-red-300 text-red-600"
                                  : ticket.priority === "high"
                                  ? "border-orange-300 text-orange-600"
                                  : "text-[#526079]"
                              }`}
                            >
                              Prioridade {PRIORITY_LABELS[ticket.priority]}
                            </Badge>
                            {ticket.assigneeId === effectiveUser?.id && (
                              <Badge className="border-0 bg-[#3157d5]/10 text-[10px] font-semibold text-[#3157d5]">
                                Atribuído a você
                              </Badge>
                            )}
                          </div>
                          <p className="mt-1 truncate text-sm font-semibold text-[#253252] group-hover:text-[#3157d5]">
                            {ticket.title}
                          </p>
                          <p className="mt-1 text-xs text-[#8791a5]">
                            Atualizado em {new Date(ticket.updatedAt).toLocaleDateString("pt-BR")}
                            {ticket.assigneeId ? ` · Responsável #${ticket.assigneeId}` : " · Sem responsável atribuído"}
                          </p>
                          {ticket.firstRespondedAt && (
                            <p className="mt-1 text-[11px] font-medium text-emerald-700">
                              1ª resposta registrada em {new Date(ticket.firstRespondedAt).toLocaleString("pt-BR")}
                            </p>
                          )}
                          {(() => {
                            const policy = slaPolicies.data?.find((item) => item.priority === ticket.priority);
                            if (!policy) return null;
                            const sla = calculateTicketSla({
                              createdAt: ticket.createdAt,
                              status: ticket.status,
                              priority: ticket.priority,
                              policy,
                              firstRespondedAt: ticket.firstRespondedAt,
                            });
                            if (!sla) return null;
                            const deadlines = [
                              { label: "1ª resposta", deadline: sla.firstResponse },
                              { label: "Resolução", deadline: sla.resolution },
                            ].filter((item) => item.deadline !== null);
                            if (deadlines.length === 0) return null;
                            return (
                              <div className="mt-2 flex flex-wrap gap-1">
                                {deadlines.map(({ label, deadline }) => {
                                  if (!deadline) return null;
                                  const text = deadline.state === "breached"
                                    ? "Vencido"
                                    : deadline.state === "at_risk"
                                    ? "Em risco"
                                    : `Em dia · ${Math.ceil(deadline.remainingMs / 3_600_000)}h restantes`;
                                  const tone = deadline.state === "breached"
                                    ? "border-red-200 bg-red-50 text-red-700"
                                    : deadline.state === "at_risk"
                                    ? "border-amber-200 bg-amber-50 text-amber-700"
                                    : "border-emerald-200 bg-emerald-50 text-emerald-700";
                                  return <Badge key={label} variant="outline" className={`text-[10px] ${tone}`}>{label}: {text}</Badge>;
                                })}
                              </div>
                            );
                          })()}
                        </div>
                        <ChevronRight className="size-4 text-[#b5bdcb] transition-transform group-hover:translate-x-1 group-hover:text-[#3157d5]" />
                      </button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Modal: Criar Chamado */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#0d1730]/40 p-0 backdrop-blur-sm sm:items-center sm:p-6">
          <Card className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-b-none border-0 shadow-2xl sm:rounded-2xl">
            <CardHeader className="border-b border-[#edf0f5] pb-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="eyebrow text-[#3157d5]">Novo registro</p>
                  <CardTitle className="mt-2 text-2xl text-[#15213d]">Abrir chamado</CardTitle>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setShowCreate(false)}>
                  <X className="size-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-5 p-6">
              {!departments.isLoading &&
                !ticketTypes.isLoading &&
                (!departments.data?.length || !ticketTypes.data?.length) && (
                  <div className="rounded-xl border border-[#f1d9a8] bg-[#fff8e9] p-3 text-xs leading-5 text-[#8a5a12]">
                    Configure setor, equipe, fila e tipo de chamado no menu administrativo antes de abrir o primeiro
                    chamado.
                  </div>
                )}

              <div>
                <label className="field-label">Setor de atendimento</label>
                <select
                  value={departmentId ?? ""}
                  onChange={(event) => setDepartmentId(Number(event.target.value))}
                  className="mt-2 flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="" disabled>
                    Selecione um setor
                  </option>
                  {(departments.data ?? []).map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="field-label">Categoria de serviço</label>
                  <select
                    value={categoryId ?? ""}
                    onChange={(event) => {
                      setCategoryId(Number(event.target.value));
                      setServiceId(undefined);
                    }}
                    className="mt-2 flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="">Sem categoria</option>
                    {(categories.data ?? []).map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="field-label">Serviço</label>
                  <select
                    value={serviceId ?? ""}
                    onChange={(event) => {
                      const nextServiceId = Number(event.target.value) || undefined;
                      setServiceId(nextServiceId);
                      const configuredService = (services.data ?? []).find(item => item.id === nextServiceId);
                      if (configuredService?.defaultTicketTypeId) setTicketTypeId(configuredService.defaultTicketTypeId);
                    }}
                    className="mt-2 flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="">Selecionar serviço</option>
                    {(services.data ?? []).map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="field-label">Tipo de chamado</label>
                <select
                  value={ticketTypeId ?? ""}
                  onChange={(event) => setTicketTypeId(Number(event.target.value))}
                  className="mt-2 flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="" disabled>
                    Selecione um tipo
                  </option>
                  {(ticketTypes.data ?? []).map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} — {item.description}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="field-label">Título</label>
                <Input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Descreva o que precisa ser resolvido"
                  className="mt-2"
                />
              </div>

              <div>
                <label className="field-label">Descrição</label>
                <Textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Inclua contexto, impacto e o resultado esperado"
                  className="mt-2 min-h-32"
                />
              </div>

              <div>
                <label className="field-label">Prioridade</label>
                <select
                  value={priority}
                  onChange={(event) => setPriority(event.target.value as TicketPriority)}
                  className="mt-2 flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="low">Baixa</option>
                  <option value="medium">Média</option>
                  <option value="high">Alta</option>
                  <option value="urgent">Urgente</option>
                </select>
              </div>

              <div>
                <label className="field-label">
                  Anexos para o atendente <span className="font-normal text-[#8791a5]">(até 5 arquivos, 10 MB cada)</span>
                </label>
                <input
                  type="file"
                  multiple
                  className="mt-2 block w-full text-xs text-[#526079] file:mr-3 file:rounded-lg file:border-0 file:bg-[#eef2ff] file:px-3 file:py-2 file:text-xs file:font-semibold file:text-[#3157d5]"
                  onChange={async (event) => {
                    try {
                      const selected = Array.from(event.target.files ?? []);
                      setAttachments((await Promise.all(selected.slice(0, 5).map(readAttachment))).slice(0, 5));
                    } catch (error) {
                      toast.error(error instanceof Error ? error.message : "Não foi possível ler o arquivo");
                    }
                  }}
                />
                {attachments.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {attachments.map((file) => (
                      <div
                        key={`${file.fileName}-${file.fileSize}`}
                        className="flex items-center gap-2 text-xs text-[#526079]"
                      >
                        <FileText className="size-3.5 text-[#3157d5]" />
                        <span className="truncate">{file.fileName}</span>
                        <span className="text-[#9aa4b8]">{(file.fileSize / 1024 / 1024).toFixed(2)} MB</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 border-t border-[#edf0f5] pt-5">
                <Button variant="outline" onClick={() => setShowCreate(false)}>
                  Cancelar
                </Button>
                <Button
                  disabled={
                    createTicket.isPending ||
                    (!departmentId && !(services.data ?? []).find(item => item.id === serviceId)?.defaultQueueId) ||
                    (!ticketTypeId && !(services.data ?? []).find(item => item.id === serviceId)?.defaultTicketTypeId) ||
                    title.trim().length < 4 ||
                    description.trim().length < 8
                  }
                  onClick={() =>
                    createTicket.mutate({
                      title,
                      description,
                      priority,
                      departmentId,
                      ticketTypeId,
                      categoryId,
                      serviceId,
                      attachments,
                    })
                  }
                >
                  {createTicket.isPending && <Loader2 className="mr-2 size-4 animate-spin" />} Criar chamado
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </AppShell>
  );
}
