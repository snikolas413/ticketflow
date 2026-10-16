import { useAuth } from "@/_core/hooks/useAuth";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { PRIORITY_LABELS, STATUS_LABELS, type TicketPriority, type TicketStatus } from "@shared/ticket-types";
import { ArrowUpRight, CheckCircle2, ChevronRight, CircleAlert, Clock3, FileText, Inbox, Loader2, Paperclip, Plus, Search, Sparkles, Ticket, X } from "lucide-react";
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

type PendingAttachment = { fileName: string; contentType: string; fileSize: number; data: string };

function readAttachment(file: File): Promise<PendingAttachment> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ fileName: file.name, contentType: file.type || "application/octet-stream", fileSize: file.size, data: String(reader.result) });
    reader.onerror = () => reject(new Error(`Não foi possível ler ${file.name}`));
    reader.readAsDataURL(file);
  });
}

function Metric({ icon: Icon, label, value, detail, tone }: { icon: typeof Inbox; label: string; value: number; detail: string; tone: string }) {
  return <Card className="metric-card"><CardContent className="p-5"><div className="flex items-start justify-between"><div><p className="text-xs font-medium text-[#6c7891]">{label}</p><p className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-[#15213d]">{value}</p></div><div className={`metric-icon ${tone}`}><Icon className="size-4" /></div></div><p className="mt-4 text-xs text-[#8791a5]">{detail}</p></CardContent></Card>;
}

export default function Home() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<TicketStatus | "all">("all");
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<TicketPriority>("medium");
  const [departmentId, setDepartmentId] = useState<number | undefined>();
  const [ticketTypeId, setTicketTypeId] = useState<number | undefined>();
  const [categoryId, setCategoryId] = useState<number | undefined>();
  const [serviceId, setServiceId] = useState<number | undefined>();
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const [sectorName, setSectorName] = useState("");
  const [sectorCode, setSectorCode] = useState("");
  const [newTypeName, setNewTypeName] = useState("");
  const [newTypeDescription, setNewTypeDescription] = useState("");

  const foundation = trpc.auth.bootstrap.useQuery(undefined, { enabled: Boolean(user), staleTime: 60_000 });
  const departments = trpc.catalog.departments.useQuery(undefined, { enabled: Boolean(user), staleTime: 60_000 });
  const ticketTypes = trpc.catalog.ticketTypes.useQuery(undefined, { enabled: Boolean(user), staleTime: 60_000 });
  const tickets = trpc.tickets.list.useQuery({ search: search || undefined, status: statusFilter === "all" ? undefined : statusFilter }, { enabled: Boolean(user), staleTime: 10_000 });
  const utils = trpc.useUtils();
  const createTicket = trpc.tickets.create.useMutation({
    onSuccess: (ticket) => { toast.success(`Chamado ${ticket?.publicNumber ?? ""} criado`); setTitle(""); setDescription(""); setPriority("medium"); setDepartmentId(undefined); setTicketTypeId(undefined); setCategoryId(undefined); setServiceId(undefined); setAttachments([]); setShowCreate(false); void utils.tickets.list.invalidate(); },
    onError: error => toast.error(error.message),
  });
  const createDepartment = trpc.catalog.createDepartment.useMutation({ onSuccess: () => { toast.success("Setor criado"); setSectorName(""); setSectorCode(""); void departments.refetch(); }, onError: error => toast.error(error.message) });
  const createTicketType = trpc.catalog.createTicketType.useMutation({ onSuccess: () => { toast.success("Tipo de chamado criado"); setNewTypeName(""); setNewTypeDescription(""); void ticketTypes.refetch(); }, onError: error => toast.error(error.message) });
  const categories = trpc.catalog.categories.useQuery(undefined, { enabled: Boolean(user), staleTime: 60_000 });
  const services = trpc.catalog.services.useQuery({ categoryId }, { enabled: Boolean(user), staleTime: 60_000 });

  const rows = tickets.data ?? [];
  const effectiveUser = foundation.data?.user ?? user;
  const selectedDepartmentId = departmentId;
  const selectedTicketTypeId = ticketTypeId;
  const selectedCategoryId = categoryId;
  const selectedServiceId = serviceId;
  const metrics = useMemo(() => ({
    open: rows.filter(t => t.status === "open").length,
    progress: rows.filter(t => t.status === "in_progress").length,
    waiting: rows.filter(t => t.status === "waiting_requester").length,
    resolved: rows.filter(t => t.status === "resolved" || t.status === "closed").length,
  }), [rows]);

  if (loading) return <div className="flex min-h-screen items-center justify-center bg-[#f6f7fb]"><Loader2 className="size-6 animate-spin text-[#3157d5]" /></div>;
  if (!user) return <Login />;

  return (
    <AppShell>
      <div className="mx-auto max-w-[1440px] px-5 py-7 sm:px-8 lg:px-10 lg:py-9">
        <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div><p className="eyebrow text-[#3157d5]">Painel de operações</p><h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-[#15213d] sm:text-4xl">O que precisa de atenção hoje</h1><p className="mt-2 text-sm text-[#6c7891]">Acompanhe solicitações, responsáveis e próximos movimentos do seu workspace.</p></div>
          <Button onClick={() => setShowCreate(true)} className="h-11 rounded-xl bg-[#3157d5] px-5 text-white shadow-lg shadow-[#3157d5]/15 hover:bg-[#2747b8]"><Plus className="mr-2 size-4" /> Novo chamado</Button>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Metric icon={Inbox} label="Abertos" value={metrics.open} detail="Aguardando triagem" tone="metric-blue" />
          <Metric icon={Clock3} label="Em atendimento" value={metrics.progress} detail="Com trabalho em andamento" tone="metric-amber" />
          <Metric icon={CircleAlert} label="Aguardando" value={metrics.waiting} detail="Dependem do solicitante" tone="metric-violet" />
          <Metric icon={CheckCircle2} label="Resolvidos" value={metrics.resolved} detail="Encerrados no seu escopo" tone="metric-green" />
        </div>

        <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <Card className="overflow-hidden border-[#e5e8f0] shadow-[0_12px_40px_rgba(25,42,78,0.05)]">
            <CardHeader className="border-b border-[#edf0f5] pb-4"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><div><CardTitle className="text-lg text-[#15213d]">Chamados recentes</CardTitle><p className="mt-1 text-xs text-[#8791a5]">Sua fila de trabalho e solicitações acompanhadas</p></div><div className="flex gap-2"><div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#9aa4b8]" /><Input value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar número ou título" className="h-9 w-full pl-9 text-xs sm:w-52" /></div><select value={statusFilter} onChange={event => setStatusFilter(event.target.value as TicketStatus | "all")} className="h-9 rounded-md border border-input bg-background px-2 text-xs text-[#526079]"><option value="all">Todos</option>{Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div></div></CardHeader>
            <CardContent className="p-0">
              {tickets.isLoading ? <div className="space-y-3 p-5"><div className="skeleton-line w-2/3" /><div className="skeleton-line w-full" /><div className="skeleton-line w-5/6" /></div> : rows.length === 0 ? <div className="flex flex-col items-center justify-center px-6 py-16 text-center"><div className="mb-4 rounded-2xl bg-[#eef2ff] p-3 text-[#3157d5]"><Ticket className="size-6" /></div><p className="font-medium text-[#253252]">Nenhum chamado encontrado</p><p className="mt-1 max-w-xs text-sm text-[#8791a5]">Crie o primeiro chamado ou ajuste os filtros para continuar.</p><Button variant="outline" className="mt-5" onClick={() => setShowCreate(true)}><Plus className="mr-2 size-4" /> Criar chamado</Button></div> : <div className="divide-y divide-[#edf0f5]">{rows.map(ticket => <button key={ticket.id} onClick={() => setLocation(`/tickets/${ticket.id}`)} className="ticket-row group flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-[#f8f9fc]"><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><span className="mono text-xs font-semibold text-[#3157d5]">{ticket.publicNumber}</span><Badge className={`${statusTone[ticket.status]} border-0`}>{STATUS_LABELS[ticket.status]}</Badge></div><p className="mt-1 truncate text-sm font-medium text-[#253252] group-hover:text-[#3157d5]">{ticket.title}</p><p className="mt-1 line-clamp-1 text-xs text-[#8791a5]">Atualizado {new Date(ticket.updatedAt).toLocaleDateString("pt-BR")} · {ticket.priority ? PRIORITY_LABELS[ticket.priority] : "Média"}{ticket.serviceId ? ` · ${services.data?.find(service => service.id === ticket.serviceId)?.name ?? `Serviço #${ticket.serviceId}`}` : ""}</p></div><span className={`priority-dot ${priorityTone[ticket.priority]}`} title={PRIORITY_LABELS[ticket.priority]} /><ChevronRight className="size-4 text-[#b5bdcb] transition-transform group-hover:translate-x-1 group-hover:text-[#3157d5]" /></button>)}</div>}
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card className="border-[#dce4ff] bg-[#eef2ff] shadow-none"><CardContent className="p-5"><div className="flex items-start justify-between"><div className="rounded-xl bg-[#3157d5] p-2 text-white"><Sparkles className="size-4" /></div><Badge className="border-0 bg-white/70 text-[#3157d5]">Manus AI</Badge></div><h3 className="mt-5 text-lg font-semibold tracking-[-0.02em] text-[#1c2e68]">Sugestões no contexto do ticket</h3><p className="mt-2 text-sm leading-6 text-[#5b6a91]">Resuma históricos ou rascunhe respostas mantendo a decisão nas mãos do time.</p><div className="mt-5 flex items-center gap-2 text-xs font-semibold text-[#3157d5]"><span>Disponível no detalhe</span><ArrowUpRight className="size-3.5" /></div></CardContent></Card>
            <Card className="border-[#e5e8f0] shadow-none"><CardHeader className="pb-3"><CardTitle className="text-sm text-[#253252]">Configuração ativa</CardTitle></CardHeader><CardContent className="space-y-3 text-xs"><div className="flex items-center justify-between"><span className="text-[#8791a5]">Setor</span><span className="font-medium text-[#526079]">{foundation.data?.foundation.department.name ?? "Nenhum setor configurado"}</span></div><div className="flex items-center justify-between"><span className="text-[#8791a5]">Fila principal</span><span className="font-medium text-[#526079]">{foundation.data?.foundation.queue.name ?? "Nenhuma fila configurada"}</span></div><div className="flex items-center justify-between"><span className="text-[#8791a5]">Seu perfil</span><Badge variant="outline" className="text-[10px]">{user.role === "admin" ? "Administrador" : "Solicitante"}</Badge></div></CardContent></Card>
            {effectiveUser?.role === "admin" && <Card className="border-[#e5e8f0] shadow-none"><CardHeader className="pb-3"><CardTitle className="text-sm text-[#253252]">Catálogo de atendimento</CardTitle><p className="text-xs text-[#8791a5]">Estruture setores e tipos como em uma central profissional.</p></CardHeader><CardContent className="space-y-4"><div className="space-y-2"><p className="field-label">Novo setor</p><Input value={sectorName} onChange={event => setSectorName(event.target.value)} placeholder="Ex.: Infraestrutura" className="h-9 text-xs" /><Input value={sectorCode} onChange={event => setSectorCode(event.target.value)} placeholder="Código interno" className="h-9 text-xs" /><Button className="h-9 w-full text-xs" disabled={createDepartment.isPending || sectorName.trim().length < 2 || sectorCode.trim().length < 2} onClick={() => createDepartment.mutate({ name: sectorName, code: sectorCode })}>Criar setor</Button></div><div className="border-t border-[#edf0f5] pt-4"><p className="field-label">Novo tipo de chamado</p><Input value={newTypeName} onChange={event => setNewTypeName(event.target.value)} placeholder="Ex.: Acesso a sistema" className="mt-2 h-9 text-xs" /><Input value={newTypeDescription} onChange={event => setNewTypeDescription(event.target.value)} placeholder="Descrição curta" className="mt-2 h-9 text-xs" /><Button variant="outline" className="mt-2 h-9 w-full text-xs" disabled={createTicketType.isPending || newTypeName.trim().length < 2} onClick={() => createTicketType.mutate({ name: newTypeName, description: newTypeDescription })}>Criar tipo</Button></div></CardContent></Card>}
          </div>
        </div>
      </div>

      {showCreate && <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#0d1730]/40 p-0 backdrop-blur-sm sm:items-center sm:p-6"><Card className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-b-none border-0 shadow-2xl sm:rounded-2xl"><CardHeader className="border-b border-[#edf0f5] pb-4"><div className="flex items-start justify-between"><div><p className="eyebrow text-[#3157d5]">Novo registro</p><CardTitle className="mt-2 text-2xl text-[#15213d]">Abrir chamado</CardTitle></div><Button variant="ghost" size="icon" onClick={() => setShowCreate(false)}><X className="size-4" /></Button></div></CardHeader><CardContent className="space-y-5 p-6">{(!departments.isLoading && !ticketTypes.isLoading && (!departments.data?.length || !ticketTypes.data?.length)) && <div className="rounded-xl border border-[#f1d9a8] bg-[#fff8e9] p-3 text-xs leading-5 text-[#8a5a12]">Configure setor, equipe, fila e tipo de chamado antes de abrir o primeiro chamado.</div>}<div><label className="field-label">Setor de atendimento</label><select value={selectedDepartmentId ?? ""} onChange={event => setDepartmentId(Number(event.target.value))} className="mt-2 flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="" disabled>Selecione um setor</option>{(departments.data ?? []).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div><div className="grid gap-4 sm:grid-cols-2"><div><label className="field-label">Categoria de serviço</label><select value={selectedCategoryId ?? ""} onChange={event => { setCategoryId(Number(event.target.value)); setServiceId(undefined); }} className="mt-2 flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="">Sem categoria</option>{(categories.data ?? []).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div><div><label className="field-label">Serviço</label><select value={selectedServiceId ?? ""} onChange={event => setServiceId(Number(event.target.value))} className="mt-2 flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="">Selecionar serviço</option>{(services.data ?? []).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div></div><div><label className="field-label">Tipo de chamado</label><select value={selectedTicketTypeId ?? ""} onChange={event => setTicketTypeId(Number(event.target.value))} className="mt-2 flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="" disabled>Selecione um tipo</option>{(ticketTypes.data ?? []).map(item => <option key={item.id} value={item.id}>{item.name} — {item.description}</option>)}</select></div><div><label className="field-label">Título</label><Input value={title} onChange={event => setTitle(event.target.value)} placeholder="Descreva o que precisa ser resolvido" className="mt-2" /></div><div><label className="field-label">Descrição</label><Textarea value={description} onChange={event => setDescription(event.target.value)} placeholder="Inclua contexto, impacto e o resultado esperado" className="mt-2 min-h-32" /></div><div><label className="field-label">Prioridade</label><select value={priority} onChange={event => setPriority(event.target.value as TicketPriority)} className="mt-2 flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="low">Baixa</option><option value="medium">Média</option><option value="high">Alta</option><option value="urgent">Urgente</option></select></div><div><label className="field-label">Anexos para o atendente <span className="font-normal text-[#8791a5]">(até 5 arquivos, 10 MB cada)</span></label><input type="file" multiple className="mt-2 block w-full text-xs text-[#526079] file:mr-3 file:rounded-lg file:border-0 file:bg-[#eef2ff] file:px-3 file:py-2 file:text-xs file:font-semibold file:text-[#3157d5]" onChange={async event => { try { const selected = Array.from(event.target.files ?? []); setAttachments((await Promise.all(selected.slice(0, 5).map(readAttachment))).slice(0, 5)); } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível ler o arquivo"); } }} />{attachments.length > 0 && <div className="mt-2 space-y-1">{attachments.map(file => <div key={`${file.fileName}-${file.fileSize}`} className="flex items-center gap-2 text-xs text-[#526079]"><FileText className="size-3.5 text-[#3157d5]" /><span className="truncate">{file.fileName}</span><span className="text-[#9aa4b8]">{(file.fileSize / 1024 / 1024).toFixed(2)} MB</span></div>)}</div>}</div><div className="flex justify-end gap-3 border-t border-[#edf0f5] pt-5"><Button variant="outline" onClick={() => setShowCreate(false)}>Cancelar</Button><Button disabled={createTicket.isPending || !selectedDepartmentId || !selectedTicketTypeId || title.trim().length < 4 || description.trim().length < 8} onClick={() => createTicket.mutate({ title, description, priority, departmentId: selectedDepartmentId, ticketTypeId: selectedTicketTypeId, categoryId: selectedCategoryId, serviceId: selectedServiceId, attachments })}>{createTicket.isPending && <Loader2 className="mr-2 size-4 animate-spin" />} Criar chamado</Button></div></CardContent></Card></div>}
    </AppShell>
  );
}
