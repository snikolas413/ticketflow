import { useMemo, useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { calculateTicketSla } from "@shared/sla";
import { PRIORITY_LABELS, STATUS_LABELS, type TicketPriority, type TicketStatus } from "@shared/ticket-types";
import {
  AlertCircle, CheckCircle2, Clock3, Gauge, Inbox, RefreshCw, ShieldCheck, Ticket,
  Download, Timer, Users, UserX, Workflow,
} from "lucide-react";
import {
  Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

type Period = "30" | "90" | "all";

const statusColors: Record<TicketStatus, string> = {
  open: "#64748b",
  in_progress: "#3b82f6",
  waiting_requester: "#f59e0b",
  resolved: "#8b5cf6",
  closed: "#10b981",
};
const priorityColors: Record<TicketPriority, string> = {
  low: "#94a3b8", medium: "#3b82f6", high: "#f97316", urgent: "#ef4444",
};

function MetricCard({ title, value, detail, icon: Icon, tone = "blue" }: {
  title: string; value: string | number; detail: string; icon: typeof Ticket; tone?: "blue" | "green" | "amber" | "red" | "purple";
}) {
  const tones = {
    blue: "bg-blue-500/10 text-blue-500", green: "bg-emerald-500/10 text-emerald-500",
    amber: "bg-amber-500/10 text-amber-500", red: "bg-red-500/10 text-red-500",
    purple: "bg-violet-500/10 text-violet-500",
  };
  return <Card className="border-[var(--app-border)] bg-[var(--app-card)]">
    <CardContent className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0"><p className="text-xs font-medium text-[var(--app-muted-foreground)]">{title}</p><p className="mt-2 text-3xl font-bold tracking-tight">{value}</p></div>
        <span className={`rounded-xl p-2.5 ${tones[tone]}`}><Icon className="size-5" /></span>
      </div>
      <p className="mt-3 text-xs text-[var(--app-muted-foreground)]">{detail}</p>
    </CardContent>
  </Card>;
}

export default function KPIs() {
  const { user, loading } = useAuth({ redirectOnUnauthenticated: false });
  const [period, setPeriod] = useState<Period>("30");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [teamFilter, setTeamFilter] = useState("all");
  const departmentsQuery = trpc.catalog.departments.useQuery(undefined, { enabled: Boolean(user), staleTime: 60_000 });
  const teamsQuery = trpc.catalog.teams.useQuery(departmentFilter === "all" ? undefined : { departmentId: Number(departmentFilter) }, { enabled: Boolean(user), staleTime: 60_000 });
  const ticketsQuery = trpc.tickets.list.useQuery(undefined, { enabled: Boolean(user), refetchInterval: 60_000 });
  const policiesQuery = trpc.tickets.slaPolicies.useQuery(undefined, { enabled: Boolean(user), staleTime: 60_000 });
  const workflowEventsQuery = trpc.tickets.workflowEvents.useQuery(undefined, { enabled: Boolean(user), refetchInterval: 60_000 });
  const assigneeNamesQuery = trpc.tickets.assigneeNames.useQuery(undefined, { enabled: Boolean(user), staleTime: 60_000 });
  const rows = ticketsQuery.data ?? [];

  const data = useMemo(() => {
    const now = Date.now();
    const days = period === "all" ? null : Number(period);
    const cutoff = days === null ? null : now - days * 24 * 60 * 60 * 1000;
    const tickets = rows.filter(ticket =>
      (cutoff === null || new Date(ticket.createdAt).getTime() >= cutoff) &&
      (departmentFilter === "all" || ticket.departmentId === Number(departmentFilter)) &&
      (teamFilter === "all" || ticket.teamId === Number(teamFilter))
    );
    const count = (status: TicketStatus) => tickets.filter(ticket => ticket.status === status).length;
    const active = tickets.filter(ticket => ticket.status !== "resolved" && ticket.status !== "closed");
    const completed = tickets.filter(ticket => ticket.status === "resolved" || ticket.status === "closed");
    const responded = tickets.filter(ticket => Boolean(ticket.firstRespondedAt));
    const validResolved = completed.filter(ticket => {
      if (!ticket.resolvedAt) return false;
      const created = new Date(ticket.createdAt).getTime();
      const resolved = new Date(ticket.resolvedAt).getTime();
      return Number.isFinite(created) && Number.isFinite(resolved) && resolved >= created;
    });
    const averageResolutionHours = validResolved.length
      ? validResolved.reduce((sum, ticket) => sum + (new Date(ticket.resolvedAt!).getTime() - new Date(ticket.createdAt).getTime()), 0) / validResolved.length / 3_600_000
      : null;
    const unassigned = active.filter(ticket => !ticket.assigneeId).length;
    const urgentActive = active.filter(ticket => ticket.priority === "urgent" || ticket.priority === "high").length;
    const pendingApproval = tickets.filter(ticket => ticket.approvalStatus === "pending").length;

    const ticketIds = new Set(tickets.map(ticket => ticket.id));
    const workflowEvents = (workflowEventsQuery.data ?? [])
      .filter(event => ticketIds.has(event.ticketId))
      .map(event => {
        let payload: { from?: string; to?: string } = {};
        try { payload = JSON.parse(event.payload) as { from?: string; to?: string }; } catch { /* Ignore malformed legacy events. */ }
        return { ...event, payload };
      });
    const reopenedCount = workflowEvents.filter(event => event.payload.from === "resolved" && event.payload.to === "in_progress").length;
    const requesterValidationDurations: number[] = [];
    const eventsByTicket = new Map<number, typeof workflowEvents>();
    for (const event of workflowEvents) {
      const list = eventsByTicket.get(event.ticketId) ?? [];
      list.push(event);
      eventsByTicket.set(event.ticketId, list);
    }
    for (const events of eventsByTicket.values()) {
      let lastResolvedAt: number | null = null;
      for (const event of events) {
        const timestamp = new Date(event.createdAt).getTime();
        if (!Number.isFinite(timestamp)) continue;
        if (event.payload.to === "resolved") lastResolvedAt = timestamp;
        if (event.payload.from === "resolved" && event.payload.to === "closed" && lastResolvedAt !== null && timestamp >= lastResolvedAt) {
          requesterValidationDurations.push((timestamp - lastResolvedAt) / 3_600_000);
          lastResolvedAt = null;
        }
        if (event.payload.from === "resolved" && event.payload.to === "in_progress") lastResolvedAt = null;
      }
    }
    const averageRequesterValidationHours = requesterValidationDurations.length
      ? requesterValidationDurations.reduce((sum, hours) => sum + hours, 0) / requesterValidationDurations.length
      : null;


    let breached = 0;
    let monitored = 0;
    let atRisk = 0;
    const policies = policiesQuery.data ?? [];
    for (const ticket of active) {
      const policy = policies.find(item => item.priority === ticket.priority);
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
        if (deadline.state === "breached") breached += 1;
        if (deadline.state === "at_risk") atRisk += 1;
      }
    }

    const assigneeNames = new Map((assigneeNamesQuery.data ?? []).map(item => [item.id, item.name?.trim() || "Usuário sem nome"]));
    const assigneeGroups = new Map<number, typeof tickets>();
    for (const ticket of tickets) {
      if (ticket.assigneeId == null) continue;
      const group = assigneeGroups.get(ticket.assigneeId) ?? [];
      group.push(ticket);
      assigneeGroups.set(ticket.assigneeId, group);
    }
    const assigneeBreakdown = Array.from(assigneeGroups.entries()).map(([id, group]) => {
      const resolved = group.filter(ticket => ticket.resolvedAt && new Date(ticket.resolvedAt).getTime() >= new Date(ticket.createdAt).getTime());
      const avgHours = resolved.length ? resolved.reduce((sum, ticket) => sum + (new Date(ticket.resolvedAt!).getTime() - new Date(ticket.createdAt).getTime()), 0) / resolved.length / 3_600_000 : null;
      return { id, name: assigneeNames.get(id) ?? "Atendente", linked: group.length, active: group.filter(ticket => ticket.status !== "resolved" && ticket.status !== "closed").length, resolved: group.filter(ticket => ticket.status === "resolved").length, closed: group.filter(ticket => ticket.status === "closed").length, avgHours };
    }).sort((a, b) => b.linked - a.linked || a.name.localeCompare(b.name));

    const departmentNames = new Map((departmentsQuery.data ?? []).map(item => [item.id, item.name]));
    const teamNames = new Map((teamsQuery.data ?? []).map(item => [item.id, item.name]));
    const buildBreakdown = (key: "departmentId" | "teamId", names: Map<number, string>) => {
      const groups = new Map<number, typeof tickets>();
      for (const ticket of tickets) {
        const id = ticket[key];
        if (id == null) continue;
        const group = groups.get(id) ?? [];
        group.push(ticket);
        groups.set(id, group);
      }
      return Array.from(groups.entries()).map(([id, group]) => {
        const resolved = group.filter(ticket => ticket.resolvedAt && new Date(ticket.resolvedAt).getTime() >= new Date(ticket.createdAt).getTime());
        const avgHours = resolved.length ? resolved.reduce((sum, ticket) => sum + (new Date(ticket.resolvedAt!).getTime() - new Date(ticket.createdAt).getTime()), 0) / resolved.length / 3_600_000 : null;
        return { id, name: names.get(id) ?? (key === "departmentId" ? "Setor não identificado" : "Equipe não identificada"), total: group.length, active: group.filter(ticket => ticket.status !== "resolved" && ticket.status !== "closed").length, closed: group.filter(ticket => ticket.status === "closed").length, avgHours };
      }).sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
    };
    const departmentBreakdown = buildBreakdown("departmentId", departmentNames);
    const teamBreakdown = buildBreakdown("teamId", teamNames);

    const statusData = (["open", "in_progress", "waiting_requester", "resolved", "closed"] as TicketStatus[])
      .map(status => ({ name: STATUS_LABELS[status], value: count(status), color: statusColors[status] }));
    const priorityData = (["urgent", "high", "medium", "low"] as TicketPriority[])
      .map(priority => ({ name: PRIORITY_LABELS[priority], value: tickets.filter(ticket => ticket.priority === priority).length, color: priorityColors[priority] }));
    const trend = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(now);
      date.setDate(date.getDate() - (6 - index));
      const key = date.toLocaleDateString("sv-SE");
      return {
        day: date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
        created: tickets.filter(ticket => new Date(ticket.createdAt).toLocaleDateString("sv-SE") === key).length,
        closed: tickets.filter(ticket => ticket.status === "closed" && ticket.updatedAt && new Date(ticket.updatedAt).toLocaleDateString("sv-SE") === key).length,
      };
    });
    return {
      tickets, total: tickets.length, active: active.length, completed: completed.length, open: count("open"),
      inProgress: count("in_progress"), waiting: count("waiting_requester"), resolved: count("resolved"), closed: count("closed"),
      resolutionRate: tickets.length ? Math.round(completed.length / tickets.length * 100) : 0,
      responseRate: tickets.length ? Math.round(responded.length / tickets.length * 100) : 0,
      averageResolutionHours, averageRequesterValidationHours, reopenedCount, unassigned, urgentActive, pendingApproval, breached, monitored, atRisk,
      slaCompliance: monitored ? Math.round((monitored - breached) / monitored * 100) : null,
      statusData, priorityData, trend, departmentBreakdown, teamBreakdown, assigneeBreakdown,
    };
  }, [rows, period, departmentFilter, teamFilter, departmentsQuery.data, teamsQuery.data, assigneeNamesQuery.data, policiesQuery.data, workflowEventsQuery.data]);


  const exportManagementReport = () => {
    const escapeHtml = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]!));
    const number = (value: number | null, suffix = "") => value === null ? "N/D" : `${value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}${suffix}`;
    const periodLabel = period === "30" ? "Últimos 30 dias" : period === "90" ? "Últimos 90 dias" : "Todo o período";
    const departmentLabel = departmentFilter === "all" ? "Todos os setores" : (departmentsQuery.data ?? []).find(item => String(item.id) === departmentFilter)?.name ?? "Setor selecionado";
    const teamLabel = teamFilter === "all" ? "Todas as equipes" : (teamsQuery.data ?? []).find(item => String(item.id) === teamFilter)?.name ?? "Equipe selecionada";
    const barRows = (items: { name: string; value: number; color?: string }[]) => items.map(item => {
      const width = Math.max(0, Math.min(100, data.total ? item.value / Math.max(...items.map(entry => entry.value), 1) * 100 : 0));
      return `<div class="bar-row"><div class="bar-label">${escapeHtml(item.name)}</div><div class="bar-track"><div class="bar-fill" style="width:${width}%;background:${item.color ?? "#ed1b36"}"></div></div><strong>${item.value}</strong></div>`;
    }).join("");
    const table = (headers: string[], rows: (string | number)[][]) => `<table><thead><tr>${headers.map(h => `<th>${escapeHtml(h)}</th>`).join("")}</tr></thead><tbody>${rows.length ? rows.map(row => `<tr>${row.map(cell => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`).join("") : `<tr><td colspan="${headers.length}" class="empty">Sem dados para os filtros selecionados</td></tr>`}</tbody></table>`;
    const summary = [
      ["Chamados recebidos", data.total, "blue"], ["Backlog ativo", data.active, data.active ? "amber" : "green"],
      ["Resolvidos ou encerrados", data.completed, "green"], ["Taxa de resolução", number(data.resolutionRate, "%"), "purple"],
      ["Tempo médio até resolução", data.averageResolutionHours === null ? "N/D" : number(data.averageResolutionHours, " h"), "blue"],
      ["Conformidade de SLA ativo", number(data.slaCompliance, "%"), data.slaCompliance !== null && data.slaCompliance < 90 ? "red" : "green"],
    ];
    const attention = [
      data.unassigned ? `${data.unassigned} chamado(s) ativo(s) sem atendente atribuído.` : "",
      data.breached ? `${data.breached} prazo(s) de SLA vencido(s) no backlog monitorado.` : "",
      data.atRisk ? `${data.atRisk} prazo(s) de SLA em risco.` : "",
      data.urgentActive ? `${data.urgentActive} chamado(s) ativo(s) de prioridade alta ou urgente.` : "",
      data.pendingApproval ? `${data.pendingApproval} chamado(s) aguardando aprovação.` : "",
      data.reopenedCount ? `${data.reopenedCount} reabertura(s) registrada(s) no período.` : "",
    ].filter(Boolean);
    const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Relatório gerencial TicketFlow</title><style>
      :root{--ink:#172033;--muted:#64748b;--line:#e2e8f0;--accent:#ed1b36;--paper:#fff;--bg:#f1f5f9}*{box-sizing:border-box}body{margin:0;background:var(--bg);font:14px/1.5 Inter,Segoe UI,Arial,sans-serif;color:var(--ink)}.page{max-width:1120px;margin:24px auto;background:var(--paper);padding:42px 48px;box-shadow:0 8px 30px #0f172a12}.top{display:flex;justify-content:space-between;gap:24px;border-bottom:3px solid var(--accent);padding-bottom:24px}.eyebrow{color:var(--accent);font-size:11px;font-weight:800;letter-spacing:2px}.top h1{font-size:30px;margin:7px 0}.muted{color:var(--muted)}.meta{text-align:right;font-size:12px;color:var(--muted)}.actions{display:flex;justify-content:flex-end;margin:16px 0}.actions button{border:0;border-radius:8px;background:var(--accent);color:white;padding:11px 18px;font-weight:700;cursor:pointer}.section{margin-top:30px;break-inside:avoid}.section h2{font-size:18px;margin:0 0 14px;border-bottom:1px solid var(--line);padding-bottom:9px}.cards{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.metric{border:1px solid var(--line);border-radius:10px;padding:16px;border-top:3px solid #3b82f6}.metric.green{border-top-color:#10b981}.metric.amber{border-top-color:#f59e0b}.metric.red{border-top-color:#ef4444}.metric.purple{border-top-color:#8b5cf6}.metric span{display:block;color:var(--muted);font-size:12px}.metric strong{display:block;font-size:25px;margin-top:5px}.grid2{display:grid;grid-template-columns:1fr 1fr;gap:28px}.bar-row{display:grid;grid-template-columns:130px 1fr 34px;gap:10px;align-items:center;margin:12px 0}.bar-label{font-size:12px}.bar-track{height:12px;background:#f1f5f9;border-radius:20px;overflow:hidden}.bar-fill{height:100%;border-radius:20px}.bar-row strong{text-align:right;font-size:12px}table{width:100%;border-collapse:collapse;font-size:12px}th{background:#f1f5f9;text-align:left;font-weight:700}th,td{padding:10px;border-bottom:1px solid var(--line)}.empty{text-align:center;color:var(--muted)}.notice{padding:16px;border-radius:8px;background:#fff7ed;border:1px solid #fed7aa}.notice.good{background:#f0fdf4;border-color:#bbf7d0}.notice ul{margin:8px 0 0;padding-left:20px}.foot{margin-top:36px;padding-top:14px;border-top:1px solid var(--line);font-size:11px;color:var(--muted);display:flex;justify-content:space-between}@media(max-width:700px){.page{margin:0;padding:22px}.top,.grid2{display:block}.meta{text-align:left;margin-top:14px}.cards{grid-template-columns:repeat(2,1fr)}}@media print{@page{size:A4;margin:12mm}body{background:#fff;font-size:11px}.page{margin:0;padding:0;max-width:none;box-shadow:none}.actions{display:none}.section{margin-top:22px}.metric{padding:10px}.metric strong{font-size:20px}.top h1{font-size:25px}.cards{gap:8px}.grid2{gap:16px}th,td{padding:7px;print-color-adjust:exact;-webkit-print-color-adjust:exact}.bar-track,.bar-fill,.metric,th{print-color-adjust:exact;-webkit-print-color-adjust:exact}}</style></head><body><main class="page">
      <header class="top"><div><div class="eyebrow">TICKETFLOW · GESTÃO DE OPERAÇÕES</div><h1>Relatório gerencial de chamados</h1><div class="muted">Visão executiva de volume, eficiência, atendimento e cumprimento de prazos.</div></div><div class="meta"><strong>Período:</strong> ${escapeHtml(periodLabel)}<br><strong>Setor:</strong> ${escapeHtml(departmentLabel)}<br><strong>Equipe:</strong> ${escapeHtml(teamLabel)}<br><strong>Gerado em:</strong> ${new Date().toLocaleString("pt-BR")}</div></header>
      <div class="actions"><button onclick="window.print()">Imprimir / Salvar em PDF</button></div>
      <section class="section"><h2>1. Resumo executivo</h2><div class="cards">${summary.map(([label,value,tone]) => `<div class="metric ${tone}"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`).join("")}</div></section>
      <section class="section grid2"><div><h2>2. Situação dos chamados</h2>${barRows(data.statusData)}</div><div><h2>3. Distribuição por prioridade</h2>${barRows(data.priorityData)}</div></section>
      <section class="section"><h2>4. Desempenho por atendente</h2>${table(["Atendente","Vinculados","Ativos","Resolvidos","Encerrados","Média até resolução (h)"],data.assigneeBreakdown.map(item=>[item.name,item.linked,item.active,item.resolved,item.closed,item.avgHours===null?"N/D":item.avgHours.toLocaleString("pt-BR",{maximumFractionDigits:1})]))}<p class="muted">Observação: a distribuição considera o atendente atualmente vinculado ao chamado, não necessariamente todas as pessoas que participaram do fluxo.</p></section>
      <section class="section grid2"><div><h2>5. Desempenho por setor</h2>${table(["Setor","Recebidos","Ativos","Encerrados","Média (h)"],data.departmentBreakdown.map(item=>[item.name,item.total,item.active,item.closed,item.avgHours===null?"N/D":item.avgHours.toLocaleString("pt-BR",{maximumFractionDigits:1})]))}</div><div><h2>6. Desempenho por equipe</h2>${table(["Equipe","Recebidos","Ativos","Encerrados","Média (h)"],data.teamBreakdown.map(item=>[item.name,item.total,item.active,item.closed,item.avgHours===null?"N/D":item.avgHours.toLocaleString("pt-BR",{maximumFractionDigits:1})]))}</div></section>
      <section class="section"><h2>7. Qualidade do fluxo e pontos de atenção</h2><div class="notice ${attention.length ? "" : "good"}"><strong>${attention.length ? "Pontos que merecem acompanhamento" : "Nenhum alerta automático identificado nos indicadores atuais"}</strong>${attention.length ? `<ul>${attention.map(item=>`<li>${escapeHtml(item)}</li>`).join("")}</ul>` : "<p>Não há chamados ativos sem responsável, prazos vencidos ou em risco, prioridades altas/urgentes ativas ou aprovações pendentes nos dados filtrados.</p>"}</div><div class="grid2" style="margin-top:18px"><div><strong>Chamados reabertos</strong><p>${data.reopenedCount}</p><strong>Tempo médio de validação do solicitante</strong><p>${data.averageRequesterValidationHours===null?"N/D":number(data.averageRequesterValidationHours," h")}</p></div><div><strong>Prazos vencidos</strong><p>${data.breached}</p><strong>Prazos em risco</strong><p>${data.atRisk}</p><strong>Chamados sem atendente</strong><p>${data.unassigned}</p></div></div></section>
      <footer class="foot"><span>TicketFlow · Relatório gerencial</span><span>Documento gerado com base nos filtros e dados disponíveis no momento da exportação.</span></footer></main></body></html>`;
    const blob = new Blob(["\\uFEFF", html], { type: "text/html;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `ticketflow-relatorio-gerencial-${new Date().toISOString().slice(0, 10)}.html`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const exportCsv = () => {
    const rows: string[][] = [
      ["Tipo", "Indicador", "Valor"],
      ["Resumo", "Chamados recebidos", String(data.total)],
      ["Resumo", "Backlog ativo", String(data.active)],
      ["Resumo", "Resolvidos ou encerrados", String(data.completed)],
      ["Resumo", "Taxa de resolução (%)", String(data.resolutionRate)],
      ["Resumo", "Tempo médio até resolução (h)", data.averageResolutionHours === null ? "N/D" : data.averageResolutionHours.toFixed(1)],
      ["Resumo", "Chamados reabertos", String(data.reopenedCount)],
      ["Resumo", "Tempo médio de validação (h)", data.averageRequesterValidationHours === null ? "N/D" : data.averageRequesterValidationHours.toFixed(1)],
      ["Resumo", "Conformidade SLA ativo (%)", data.slaCompliance === null ? "N/D" : String(data.slaCompliance)],
      ["Resumo", "Prazos vencidos", String(data.breached)],
      ["Resumo", "Prazos em risco", String(data.atRisk)],
      ["Atendente", "Nome", "Vinculados", "Ativos", "Resolvidos", "Encerrados", "Média resolução (h)"],
      ...data.assigneeBreakdown.map(item => ["Atendente", item.name, String(item.linked), String(item.active), String(item.resolved), String(item.closed), item.avgHours === null ? "N/D" : item.avgHours.toFixed(1)]),
      ["Setor", "Nome", "Recebidos", "Ativos", "Encerrados", "Média resolução (h)"],
      ...data.departmentBreakdown.map(item => ["Setor", item.name, String(item.total), String(item.active), String(item.closed), item.avgHours === null ? "N/D" : item.avgHours.toFixed(1)]),
      ["Equipe", "Nome", "Recebidos", "Ativos", "Encerrados", "Média resolução (h)"],
      ...data.teamBreakdown.map(item => ["Equipe", item.name, String(item.total), String(item.active), String(item.closed), item.avgHours === null ? "N/D" : item.avgHours.toFixed(1)]),
    ];
    const csv = rows.map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(";")).join("\r\n");
    const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `ticketflow-kpis-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  if (loading) return <div className="p-10 text-sm text-[var(--app-muted-foreground)]">Carregando indicadores…</div>;
  if (!user) return <div className="p-10 text-sm">Entre no TicketFlow para acessar os KPIs.</div>;

  return <AppShell>
    <div className="mx-auto max-w-[1440px] space-y-7 px-5 py-7 sm:px-8 lg:px-10 lg:py-9">
      <div className="flex flex-col justify-between gap-4 border-b border-[var(--app-border)] pb-6 sm:flex-row sm:items-end">
        <div>
          <p className="eyebrow text-[#ed1b36]">GESTÃO · INDICADORES</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">KPIs do fluxo de chamados</h1>
          <p className="mt-2 max-w-2xl text-sm text-[var(--app-muted-foreground)]">Visão ponta a ponta: entrada, atendimento, aprovação, resolução, validação do solicitante e cumprimento de SLA.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={exportManagementReport} className="inline-flex h-10 items-center gap-2 rounded-md bg-[#ed1b36] px-3 text-sm font-semibold text-white transition-colors hover:opacity-90"><Download className="size-4" />Relatório gerencial</button>
          <button type="button" onClick={exportCsv} className="inline-flex h-10 items-center gap-2 rounded-md border border-[var(--app-border)] px-3 text-sm font-medium transition-colors hover:bg-[var(--app-muted)]"><Download className="size-4" />Exportar CSV</button>
          <div className="flex items-center gap-2"><span className="text-xs text-[var(--app-muted-foreground)]">Setor</span>
            <Select value={departmentFilter} onValueChange={value => { setDepartmentFilter(value); setTeamFilter("all"); }}>
              <SelectTrigger className="w-44"><SelectValue placeholder="Todos os setores" /></SelectTrigger>
              <SelectContent><SelectItem value="all">Todos os setores</SelectItem>{(departmentsQuery.data ?? []).map(item => <SelectItem key={item.id} value={String(item.id)}>{item.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2"><span className="text-xs text-[var(--app-muted-foreground)]">Equipe</span>
            <Select value={teamFilter} onValueChange={setTeamFilter}>
              <SelectTrigger className="w-44"><SelectValue placeholder="Todas as equipes" /></SelectTrigger>
              <SelectContent><SelectItem value="all">Todas as equipes</SelectItem>{(teamsQuery.data ?? []).map(item => <SelectItem key={item.id} value={String(item.id)}>{item.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <span className="text-xs text-[var(--app-muted-foreground)]">Período</span>
          <Select value={period} onValueChange={value => setPeriod(value as Period)}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Período" /></SelectTrigger>
            <SelectContent><SelectItem value="30">Últimos 30 dias</SelectItem><SelectItem value="90">Últimos 90 dias</SelectItem><SelectItem value="all">Todo o período</SelectItem></SelectContent>
          </Select>
        </div>
      </div>

      {(ticketsQuery.isLoading || policiesQuery.isLoading || workflowEventsQuery.isLoading || assigneeNamesQuery.isLoading || departmentsQuery.isLoading || teamsQuery.isLoading) && <div className="text-xs text-[var(--app-muted-foreground)]">Atualizando indicadores…</div>}
      {(ticketsQuery.isError || policiesQuery.isError || workflowEventsQuery.isError || assigneeNamesQuery.isError || departmentsQuery.isError || teamsQuery.isError) && <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-500">Não foi possível carregar todos os indicadores. Atualize a página ou tente novamente.</div>}

      <section>
        <div className="mb-3 flex items-center gap-2"><Gauge className="size-4 text-[#ed1b36]" /><h2 className="text-sm font-semibold">Resumo executivo</h2><Badge variant="outline">{data.total} chamados no período</Badge></div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard title="Chamados recebidos" value={data.total} detail="Total aberto no período selecionado" icon={Inbox} />
          <MetricCard title="Backlog ativo" value={data.active} detail="Abertos, em atendimento ou aguardando" icon={Workflow} tone="amber" />
          <MetricCard title="Resolvidos ou encerrados" value={data.completed} detail={`${data.resolutionRate}% do volume do período`} icon={CheckCircle2} tone="green" />
          <MetricCard title="Tempo médio até resolução" value={data.averageResolutionHours === null ? "N/D" : `${data.averageResolutionHours.toFixed(1)} h`} detail="Somente chamados com resolvedAt válido" icon={Timer} tone="purple" />
        </div>
      </section>


      <section>
        <div className="mb-3 flex items-center gap-2"><Users className="size-4 text-[#ed1b36]" /><h2 className="text-sm font-semibold">Desempenho por atendente</h2></div>
        <Card className="border-[var(--app-border)] bg-[var(--app-card)]">
          <CardHeader><CardTitle className="text-base">Chamados por responsável atual</CardTitle><p className="text-xs text-[var(--app-muted-foreground)]">Atribuição atual do chamado, não necessariamente quem realizou todas as etapas. O tempo médio considera criação até resolução registrada.</p></CardHeader>
          <CardContent><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-[var(--app-border)] text-left text-xs text-[var(--app-muted-foreground)]"><th className="py-2 pr-3">Atendente</th><th className="py-2 px-2 text-right">Vinculados</th><th className="py-2 px-2 text-right">Ativos</th><th className="py-2 px-2 text-right">Resolvidos</th><th className="py-2 px-2 text-right">Encerrados</th><th className="py-2 pl-2 text-right">Média resolução</th></tr></thead><tbody>{data.assigneeBreakdown.length ? data.assigneeBreakdown.map(item => <tr key={item.id} className="border-b border-[var(--app-border)] last:border-0"><td className="py-3 pr-3 font-medium">{item.name}</td><td className="px-2 text-right tabular-nums">{item.linked}</td><td className="px-2 text-right tabular-nums">{item.active}</td><td className="px-2 text-right tabular-nums">{item.resolved}</td><td className="px-2 text-right tabular-nums">{item.closed}</td><td className="pl-2 text-right tabular-nums">{item.avgHours === null ? "N/D" : item.avgHours.toFixed(1) + " h"}</td></tr>) : <tr><td colSpan={6} className="py-6 text-center text-xs text-[var(--app-muted-foreground)]">Sem chamados atribuídos para os filtros selecionados.</td></tr>}</tbody></table></div></CardContent>
        </Card>
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <Card className="border-[var(--app-border)] bg-[var(--app-card)]">
          <CardHeader><CardTitle className="text-base">Desempenho por setor</CardTitle><p className="text-xs text-[var(--app-muted-foreground)]">Volume, backlog e tempo médio de resolução por setor, no período e filtros selecionados.</p></CardHeader>
          <CardContent><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-[var(--app-border)] text-left text-xs text-[var(--app-muted-foreground)]"><th className="py-2 pr-3">Setor</th><th className="py-2 px-2 text-right">Recebidos</th><th className="py-2 px-2 text-right">Ativos</th><th className="py-2 px-2 text-right">Encerrados</th><th className="py-2 pl-2 text-right">Média resolução</th></tr></thead><tbody>{data.departmentBreakdown.length ? data.departmentBreakdown.map(item => <tr key={item.id} className="border-b border-[var(--app-border)] last:border-0"><td className="py-3 pr-3 font-medium">{item.name}</td><td className="px-2 text-right tabular-nums">{item.total}</td><td className="px-2 text-right tabular-nums">{item.active}</td><td className="px-2 text-right tabular-nums">{item.closed}</td><td className="pl-2 text-right tabular-nums">{item.avgHours === null ? "N/D" : item.avgHours.toFixed(1) + " h"}</td></tr>) : <tr><td colSpan={5} className="py-6 text-center text-xs text-[var(--app-muted-foreground)]">Sem dados para os filtros selecionados.</td></tr>}</tbody></table></div></CardContent>
        </Card>
        <Card className="border-[var(--app-border)] bg-[var(--app-card)]">
          <CardHeader><CardTitle className="text-base">Desempenho por equipe</CardTitle><p className="text-xs text-[var(--app-muted-foreground)]">Comparativo das equipes visíveis para o usuário autenticado.</p></CardHeader>
          <CardContent><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-[var(--app-border)] text-left text-xs text-[var(--app-muted-foreground)]"><th className="py-2 pr-3">Equipe</th><th className="py-2 px-2 text-right">Recebidos</th><th className="py-2 px-2 text-right">Ativos</th><th className="py-2 px-2 text-right">Encerrados</th><th className="py-2 pl-2 text-right">Média resolução</th></tr></thead><tbody>{data.teamBreakdown.length ? data.teamBreakdown.map(item => <tr key={item.id} className="border-b border-[var(--app-border)] last:border-0"><td className="py-3 pr-3 font-medium">{item.name}</td><td className="px-2 text-right tabular-nums">{item.total}</td><td className="px-2 text-right tabular-nums">{item.active}</td><td className="px-2 text-right tabular-nums">{item.closed}</td><td className="pl-2 text-right tabular-nums">{item.avgHours === null ? "N/D" : item.avgHours.toFixed(1) + " h"}</td></tr>) : <tr><td colSpan={5} className="py-6 text-center text-xs text-[var(--app-muted-foreground)]">Sem dados para os filtros selecionados.</td></tr>}</tbody></table></div></CardContent>
        </Card>
      </section>

      <section>
        <div className="mb-3 flex items-center gap-2"><RefreshCw className="size-4 text-[#ed1b36]" /><h2 className="text-sm font-semibold">Validação do solicitante</h2></div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard title="Chamados reabertos" value={data.reopenedCount} detail="Eventos reais de reabertura no período" icon={RefreshCw} tone="amber" />
          <MetricCard title="Tempo médio de validação" value={data.averageRequesterValidationHours === null ? "N/D" : data.averageRequesterValidationHours.toFixed(1) + " h"} detail="Da resolução até o encerramento pelo solicitante" icon={Timer} tone="purple" />
          <MetricCard title="Aguardando validação" value={data.resolved} detail="Resolvidos que aguardam ação do solicitante" icon={Users} tone="amber" />
          <MetricCard title="Encerrados" value={data.closed} detail="Chamados encerrados após validação" icon={CheckCircle2} tone="green" />
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center gap-2"><Clock3 className="size-4 text-[#ed1b36]" /><h2 className="text-sm font-semibold">Controle operacional e SLA</h2></div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard title="SLA cumprido (ativo)" value={data.slaCompliance === null ? "N/D" : `${data.slaCompliance}%`} detail={`${data.breached} prazos vencidos de ${data.monitored} prazos monitorados`} icon={ShieldCheck} tone={data.breached ? "red" : "green"} />
          <MetricCard title="Em risco de estourar SLA" value={data.atRisk} detail="Prazos ativos próximos do limite" icon={AlertCircle} tone="amber" />
          <MetricCard title="Alta prioridade no backlog" value={data.urgentActive} detail="Chamados de prioridade alta ou urgente" icon={AlertCircle} tone="red" />
          <MetricCard title="Sem responsável" value={data.unassigned} detail="Chamados ativos ainda não atribuídos" icon={UserX} tone="amber" />
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <Card className="border-[var(--app-border)] bg-[var(--app-card)]">
          <CardHeader><CardTitle className="text-base">Distribuição por etapa</CardTitle><p className="text-xs text-[var(--app-muted-foreground)]">Onde os chamados estão no fluxo agora, dentro do período.</p></CardHeader>
          <CardContent><div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%"><BarChart data={data.statusData} margin={{ top: 8, right: 8, left: -18, bottom: 8 }}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--app-border)" /><XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} /><YAxis allowDecimals={false} tick={{ fontSize: 11 }} /><Tooltip /><Bar dataKey="value" name="Chamados" radius={[5, 5, 0, 0]}>{data.statusData.map(item => <Cell key={item.name} fill={item.color} />)}</Bar></BarChart></ResponsiveContainer>
          </div></CardContent>
        </Card>
        <Card className="border-[var(--app-border)] bg-[var(--app-card)]">
          <CardHeader><CardTitle className="text-base">Volume por prioridade</CardTitle><p className="text-xs text-[var(--app-muted-foreground)]">Distribuição do volume recebido por nível de prioridade.</p></CardHeader>
          <CardContent><div className="flex h-[280px] items-center">
            <div className="h-full min-w-0 flex-1"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={data.priorityData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={95} innerRadius={55} paddingAngle={3}>{data.priorityData.map(item => <Cell key={item.name} fill={item.color} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer></div>
            <div className="space-y-3 pr-3">{data.priorityData.map(item => <div key={item.name} className="flex items-center gap-2 text-xs"><span className="size-2.5 rounded-full" style={{ backgroundColor: item.color }} /><span className="text-[var(--app-muted-foreground)]">{item.name}</span><strong className="ml-auto">{item.value}</strong></div>)}</div>
          </div></CardContent>
        </Card>
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <Card className="border-[var(--app-border)] bg-[var(--app-card)]">
          <CardHeader><CardTitle className="text-base">Entradas e encerramentos recentes</CardTitle><p className="text-xs text-[var(--app-muted-foreground)]">Últimos 7 dias. Encerramentos usam updatedAt como aproximação, não como data oficial de fechamento.</p></CardHeader>
          <CardContent><div className="h-[260px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={data.trend} margin={{ top: 8, right: 8, left: -18, bottom: 8 }}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--app-border)" /><XAxis dataKey="day" tick={{ fontSize: 11 }} /><YAxis allowDecimals={false} tick={{ fontSize: 11 }} /><Tooltip /><Bar dataKey="created" name="Abertos" fill="#ed1b36" radius={[4, 4, 0, 0]} /><Bar dataKey="closed" name="Encerrados (estimado)" fill="#10b981" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div></CardContent>
        </Card>
        <Card className="border-[var(--app-border)] bg-[var(--app-card)]">
          <CardHeader><CardTitle className="text-base">Indicadores por etapa</CardTitle><p className="text-xs text-[var(--app-muted-foreground)]">Leitura rápida do fluxo e pontos que podem exigir ação.</p></CardHeader>
          <CardContent className="space-y-4">
            {[
              { label: "Abertos aguardando triagem", value: data.open, icon: Inbox },
              { label: "Em atendimento", value: data.inProgress, icon: Users },
              { label: "Aguardando solicitante", value: data.waiting, icon: Clock3 },
              { label: "Resolvidos aguardando validação", value: data.resolved, icon: CheckCircle2 },
              { label: "Encerrados pelo solicitante", value: data.closed, icon: ShieldCheck },
              { label: "Aguardando aprovação", value: data.pendingApproval, icon: AlertCircle },
              { label: "Primeira resposta registrada", value: `${data.responseRate}%`, icon: RefreshCw },
            ].map(item => <div key={item.label} className="flex items-center justify-between gap-3 border-b border-[var(--app-border)] pb-3 last:border-0 last:pb-0"><div className="flex items-center gap-2 text-sm"><item.icon className="size-4 text-[var(--app-muted-foreground)]" /><span>{item.label}</span></div><strong className="text-sm tabular-nums">{item.value}</strong></div>)}
            <p className="pt-1 text-[11px] leading-5 text-[var(--app-muted-foreground)]">Os indicadores respeitam o escopo de chamados que o usuário autenticado pode visualizar. Reaberturas e tempo de validação usam o histórico de status; eventos antigos ausentes podem não ser contabilizados.</p>
          </CardContent>
        </Card>
      </section>
      <div className="flex items-center gap-2 text-xs text-[var(--app-muted-foreground)]"><Clock3 className="size-3.5" />Atualização automática a cada 60 segundos. Valores calculados com os dados disponíveis no TicketFlow.</div>
    </div>
  </AppShell>;
}
