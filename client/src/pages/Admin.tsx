import { useAuth } from "@/_core/hooks/useAuth";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { Building2, CheckCircle2, ChevronRight, Download, FileText, FolderCog, Layers3, Loader2, Mail, Plus, Settings2, ShieldCheck, Tags, Trash2, Users, UserPlus } from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";

const profileLabels = { requester: "Solicitante", agent: "Atendente", approver: "Aprovador", manager: "Gestor" } as const;
type Profile = keyof typeof profileLabels;

function SectionIntro({ icon: Icon, eyebrow, title, description, tone = "blue" }: { icon: typeof Building2; eyebrow: string; title: string; description: string; tone?: "blue" | "green" | "amber" | "purple" }) {
  const tones = { blue: "bg-[#eef2ff] text-[#3157d5]", green: "bg-[#e7f8f1] text-[#147b55]", amber: "bg-[#fff4df] text-[#a96908]", purple: "bg-[#f0ebff] text-[#7051c4]" };
  return <div className="flex items-start gap-3"><div className={`rounded-xl p-2.5 ${tones[tone]}`}><Icon className="size-4" /></div><div><p className="eyebrow text-[#8791a5]">{eyebrow}</p><h2 className="mt-1 text-lg font-semibold text-[#253252]">{title}</h2><p className="mt-1 max-w-2xl text-xs leading-5 text-[#8791a5]">{description}</p></div></div>;
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl border border-dashed border-[#dfe4ee] bg-[#fbfcfe] px-4 py-6 text-center text-xs text-[#8791a5]">{children}</div>;
}

export default function Admin() {
  const { user, loading } = useAuth({ redirectOnUnauthenticated: false });
  const bootstrap = trpc.auth.bootstrap.useQuery(undefined, { enabled: Boolean(user), staleTime: 60_000 });
  const currentUser = bootstrap.data?.user ?? user;
  const [, setLocation] = useLocation();

  const [slaDrafts, setSlaDrafts] = useState<Record<string, { firstResponseHours: number; resolutionHours: number }>>({});
  const [sectorName, setSectorName] = useState("");
  const [sectorCode, setSectorCode] = useState("");
  const [teamName, setTeamName] = useState("");
  const [teamDepartmentId, setTeamDepartmentId] = useState<number>();
  const [queueName, setQueueName] = useState("");
  const [queueTeamId, setQueueTeamId] = useState<number>();
  const [typeName, setTypeName] = useState("");
  const [typeDescription, setTypeDescription] = useState("");
  const [categoryName, setCategoryName] = useState("");
  const [categoryCode, setCategoryCode] = useState("");
  const [categoryParentId, setCategoryParentId] = useState<number>();
  const [serviceName, setServiceName] = useState("");
  const [serviceCode, setServiceCode] = useState("");
  const [serviceCategoryId, setServiceCategoryId] = useState<number>();
  const [serviceDefaultTicketTypeId, setServiceDefaultTicketTypeId] = useState<number>();
  const [serviceDefaultQueueId, setServiceDefaultQueueId] = useState<number>();
  const [serviceRuleDrafts, setServiceRuleDrafts] = useState<Record<number, { defaultTicketTypeId: number | null; defaultQueueId: number | null }>>({});
  const [userEmail, setUserEmail] = useState("");
  const [userPassword, setUserPassword] = useState("");
  const [userProfile, setUserProfile] = useState<Profile>("requester");
  const [userDepartmentId, setUserDepartmentId] = useState<number>();
  const [userTeamId, setUserTeamId] = useState<number>();
  const [managerUserId, setManagerUserId] = useState<number>();
  const [managerDepartmentId, setManagerDepartmentId] = useState<number>();
  const [managerTeamId, setManagerTeamId] = useState<number>();
  const [activeTab, setActiveTab] = useState("structure");

  const enabled = currentUser?.role === "admin";
  const departments = trpc.catalog.departments.useQuery(undefined, { enabled });
  const teams = trpc.catalog.teams.useQuery(undefined, { enabled });
  const queues = trpc.catalog.queues.useQuery(undefined, { enabled });
  const ticketTypes = trpc.catalog.ticketTypes.useQuery(undefined, { enabled });
  const categories = trpc.catalog.categories.useQuery(undefined, { enabled });
  const services = trpc.catalog.services.useQuery(undefined, { enabled });
  const slaPolicies = trpc.admin.slaPolicies.useQuery(undefined, { enabled });
  const attachments = trpc.admin.attachments.useQuery(undefined, { enabled });
  const audit = trpc.admin.audit.useQuery(undefined, { enabled });
  const users = trpc.admin.users.useQuery(undefined, { enabled });
  const managerScopes = trpc.admin.managerScopes.useQuery({ userId: managerUserId ?? 0 }, { enabled: Boolean(enabled && managerUserId) });

  const updateSlaPolicy = trpc.admin.updateSlaPolicy.useMutation({ onSuccess: () => { toast.success("Política de SLA salva"); void slaPolicies.refetch(); }, onError: error => toast.error(error.message) });
  const createDepartment = trpc.catalog.createDepartment.useMutation({ onSuccess: () => { toast.success("Setor criado"); setSectorName(""); setSectorCode(""); void departments.refetch(); }, onError: error => toast.error(error.message) });
  const createTeam = trpc.catalog.createTeam.useMutation({ onSuccess: () => { toast.success("Equipe criada no setor"); setTeamName(""); setTeamDepartmentId(undefined); void teams.refetch(); }, onError: error => toast.error(error.message) });
  const createQueue = trpc.catalog.createQueue.useMutation({ onSuccess: () => { toast.success("Fila criada na equipe"); setQueueName(""); setQueueTeamId(undefined); void queues.refetch(); }, onError: error => toast.error(error.message) });
  const createTicketType = trpc.catalog.createTicketType.useMutation({ onSuccess: () => { toast.success("Tipo de chamado criado"); setTypeName(""); setTypeDescription(""); void ticketTypes.refetch(); }, onError: error => toast.error(error.message) });
  const createCategory = trpc.catalog.createCategory.useMutation({ onSuccess: () => { toast.success("Categoria criada"); setCategoryName(""); setCategoryCode(""); setCategoryParentId(undefined); void categories.refetch(); }, onError: error => toast.error(error.message) });
  const createService = trpc.catalog.createService.useMutation({ onSuccess: () => { toast.success("Serviço criado com regras de roteamento"); setServiceName(""); setServiceCode(""); setServiceCategoryId(undefined); setServiceDefaultTicketTypeId(undefined); setServiceDefaultQueueId(undefined); void services.refetch(); }, onError: error => toast.error(error.message) });
  const updateServiceRouting = trpc.catalog.updateServiceRouting.useMutation({ onSuccess: () => { toast.success("Regras de roteamento salvas"); setServiceRuleDrafts({}); void services.refetch(); void audit.refetch(); }, onError: error => toast.error(error.message) });
  const createUser = trpc.admin.createUser.useMutation({ onSuccess: () => { toast.success("Usuário criado e pronto para login"); setUserEmail(""); setUserPassword(""); setUserDepartmentId(undefined); setUserTeamId(undefined); void users.refetch(); }, onError: error => toast.error(error.message) });
  const setProfile = trpc.admin.setProfile.useMutation({ onSuccess: () => { toast.success("Perfil atualizado"); void users.refetch(); }, onError: error => toast.error(error.message) });
  const setUserActive = trpc.admin.setActive.useMutation({ onSuccess: () => { toast.success("Acesso atualizado"); void users.refetch(); }, onError: error => toast.error(error.message) });
  const setManagerScopes = trpc.admin.setManagerScopes.useMutation({ onSuccess: () => { toast.success("Escopo do gestor atualizado"); void managerScopes.refetch(); }, onError: error => toast.error(error.message) });
  const downloadAttachment = trpc.tickets.downloadAttachment.useMutation({ onSuccess: result => window.open(result.url, "_blank", "noopener,noreferrer"), onError: error => toast.error(error.message) });
  const clearCatalog = trpc.admin.clearCatalog.useMutation({
    onSuccess: () => {
      toast.success("Todos os setores, equipes, filas e tipos de chamado foram apagados do banco!");
      void departments.refetch();
      void teams.refetch();
      void queues.refetch();
      void ticketTypes.refetch();
      void categories.refetch();
      void services.refetch();
      void users.refetch();
    },
    onError: error => toast.error(error.message),
  });

  if (loading) return <div className="flex min-h-screen items-center justify-center bg-[#f6f7fb]"><Loader2 className="size-6 animate-spin text-[#3157d5]" /></div>;
  if (!user) return <div className="p-8 text-center">Faça login para acessar a administração.</div>;
  if (currentUser?.role !== "admin") return <AppShell><div className="mx-auto max-w-3xl px-6 py-16 text-center"><ShieldCheck className="mx-auto size-10 text-[#d78d1b]" /><h1 className="mt-4 text-2xl font-semibold text-[#15213d]">Acesso restrito</h1><p className="mt-2 text-sm text-[#6c7891]">A administração exige o perfil de administrador.</p><Button className="mt-6" onClick={() => setLocation("/")}>Voltar ao painel</Button></div></AppShell>;

  const departmentCount = departments.data?.length ?? 0;
  const teamCount = teams.data?.length ?? 0;
  const userCount = users.data?.length ?? 0;
  const categoryCount = categories.data?.length ?? 0;

  return <AppShell>
    <div className="mx-auto max-w-[1320px] px-5 py-7 sm:px-8 lg:px-10 lg:py-9">
      <div className="flex flex-col justify-between gap-5 border-b border-[#e5e8f0] pb-7 lg:flex-row lg:items-end"><div><p className="eyebrow text-[#3157d5]">Central de configuração</p><h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-[#15213d]">Organize o TicketFlow</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-[#6c7891]">Crie a estrutura, monte o catálogo e defina quem pode operar os chamados. Cada área abaixo tem um objetivo claro.</p></div><Badge className="w-fit border-0 bg-[#e4f7ef] px-3 py-1.5 text-[#147b55]"><ShieldCheck className="mr-1.5 size-3.5" /> Administrador total</Badge></div>

      <div className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><div className="rounded-2xl border border-[#e5e8f0] bg-white p-4 shadow-sm"><div className="flex items-center justify-between"><span className="text-xs text-[#8791a5]">Setores ativos</span><Building2 className="size-4 text-[#3157d5]" /></div><p className="mt-2 text-2xl font-semibold text-[#253252]">{departmentCount}</p><p className="mt-1 text-[11px] text-[#8791a5]">Estrutura organizacional</p></div><div className="rounded-2xl border border-[#e5e8f0] bg-white p-4 shadow-sm"><div className="flex items-center justify-between"><span className="text-xs text-[#8791a5]">Equipes</span><Users className="size-4 text-[#147b55]" /></div><p className="mt-2 text-2xl font-semibold text-[#253252]">{teamCount}</p><p className="mt-1 text-[11px] text-[#8791a5]">Distribuídas por setor</p></div><div className="rounded-2xl border border-[#e5e8f0] bg-white p-4 shadow-sm"><div className="flex items-center justify-between"><span className="text-xs text-[#8791a5]">Usuários</span><UserPlus className="size-4 text-[#7051c4]" /></div><p className="mt-2 text-2xl font-semibold text-[#253252]">{userCount}</p><p className="mt-1 text-[11px] text-[#8791a5]">Perfis e acessos</p></div><div className="rounded-2xl border border-[#e5e8f0] bg-white p-4 shadow-sm"><div className="flex items-center justify-between"><span className="text-xs text-[#8791a5]">Categorias</span><Layers3 className="size-4 text-[#a96908]" /></div><p className="mt-2 text-2xl font-semibold text-[#253252]">{categoryCount}</p><p className="mt-1 text-[11px] text-[#8791a5]">Base do catálogo</p></div></div>

      <div className="mt-6 rounded-2xl border border-[#e5e8f0] bg-white p-3 shadow-sm"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-semibold text-[#253252]">Ações rápidas</p><p className="mt-1 text-xs text-[#8791a5]">Acesse diretamente a configuração que você precisa fazer agora.</p></div><div className="grid grid-cols-2 gap-2 sm:flex"><Button variant="outline" size="sm" onClick={() => setActiveTab("structure")}><Building2 className="mr-1.5 size-3.5" /> Criar setor</Button><Button variant="outline" size="sm" onClick={() => setActiveTab("catalog")}><Layers3 className="mr-1.5 size-3.5" /> Montar catálogo</Button><Button size="sm" className="bg-[#147b55] hover:bg-[#0f6647]" onClick={() => setActiveTab("people")}><UserPlus className="mr-1.5 size-3.5" /> Criar acesso</Button><Button variant="outline" size="sm" onClick={() => setActiveTab("operations")}><Settings2 className="mr-1.5 size-3.5" /> Ver operação</Button></div></div></div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-8">
        <TabsList className="grid h-auto w-full grid-cols-2 gap-1 rounded-2xl border border-[#e5e8f0] bg-white p-1.5 sm:grid-cols-4"><TabsTrigger value="structure" className="gap-2 rounded-xl py-3 text-xs data-[state=active]:bg-[#eef2ff] data-[state=active]:text-[#3157d5]"><Building2 className="size-4" /> Estrutura</TabsTrigger><TabsTrigger value="catalog" className="gap-2 rounded-xl py-3 text-xs data-[state=active]:bg-[#fff4df] data-[state=active]:text-[#a96908]"><Layers3 className="size-4" /> Catálogo</TabsTrigger><TabsTrigger value="people" className="gap-2 rounded-xl py-3 text-xs data-[state=active]:bg-[#e7f8f1] data-[state=active]:text-[#147b55]"><Users className="size-4" /> Pessoas e acessos</TabsTrigger><TabsTrigger value="operations" className="gap-2 rounded-xl py-3 text-xs data-[state=active]:bg-[#f0ebff] data-[state=active]:text-[#7051c4]"><Settings2 className="size-4" /> Operação</TabsTrigger></TabsList>

        <TabsContent value="structure" className="mt-6 space-y-6"><Card className="border-[#e5e8f0] shadow-none"><CardHeader><SectionIntro icon={Building2} eyebrow="Passo 1 · Organização" title="Setores e equipes" description="Comece criando os setores da empresa. Depois, vincule cada equipe ao setor correto para que os chamados sejam roteados com segurança." /></CardHeader><CardContent><div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"><div className="rounded-2xl border border-[#edf0f5] bg-[#fbfcfe] p-4"><p className="text-sm font-semibold text-[#253252]">Novo setor</p><p className="mt-1 text-xs text-[#8791a5]">Ex.: Tecnologia, Financeiro ou Recursos Humanos.</p><div className="mt-4 grid gap-2 sm:grid-cols-[1fr_130px]"><Input value={sectorName} onChange={event => setSectorName(event.target.value)} placeholder="Nome do setor" /><Input value={sectorCode} onChange={event => setSectorCode(event.target.value)} placeholder="Código" /></div><Button className="mt-3 w-full" disabled={createDepartment.isPending || sectorName.trim().length < 2 || sectorCode.trim().length < 2} onClick={() => createDepartment.mutate({ name: sectorName, code: sectorCode })}><Plus className="mr-2 size-4" /> Criar setor</Button><div className="mt-5 space-y-2">{(departments.data ?? []).length === 0 ? <EmptyState>Nenhum setor cadastrado ainda.</EmptyState> : (departments.data ?? []).map(item => <div key={item.id} className="flex items-center justify-between rounded-xl border border-[#edf0f5] bg-white px-3 py-3"><div><p className="text-sm font-medium text-[#253252]">{item.name}</p><p className="mono mt-1 text-[10px] text-[#8791a5]">{item.code}</p></div><Badge variant="outline" className="border-[#b9e7d2] text-[10px] text-[#147b55]">Ativo</Badge></div>)}</div></div><div className="rounded-2xl border border-[#edf0f5] bg-[#fbfcfe] p-4"><p className="text-sm font-semibold text-[#253252]">Nova equipe</p><p className="mt-1 text-xs text-[#8791a5]">Uma equipe precisa pertencer a um setor ativo.</p><Input className="mt-4" value={teamName} onChange={event => setTeamName(event.target.value)} placeholder="Nome da equipe" /><select value={teamDepartmentId ?? ""} onChange={event => setTeamDepartmentId(Number(event.target.value) || undefined)} className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="">Selecione o setor</option>{(departments.data ?? []).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select><Button variant="outline" className="mt-3 w-full" disabled={createTeam.isPending || teamName.trim().length < 2 || !teamDepartmentId} onClick={() => createTeam.mutate({ name: teamName, departmentId: teamDepartmentId! })}><Plus className="mr-2 size-4" /> Criar equipe</Button><div className="mt-5 space-y-2">{(teams.data ?? []).length === 0 ? <EmptyState>Nenhuma equipe cadastrada ainda.</EmptyState> : (teams.data ?? []).map(item => <div key={item.id} className="flex items-center justify-between rounded-xl border border-[#edf0f5] bg-white px-3 py-3"><div><p className="text-sm font-medium text-[#253252]">{item.name}</p><p className="mt-1 text-xs text-[#8791a5]">{departments.data?.find(area => area.id === item.departmentId)?.name ?? `Setor #${item.departmentId}`}</p></div><ChevronRight className="size-4 text-[#b1b9c8]" /></div>)}</div></div></div></CardContent></Card></TabsContent>

        <TabsContent value="catalog" className="mt-6 space-y-6"><Card className="border-[#e5e8f0] shadow-none"><CardHeader><SectionIntro icon={Tags} eyebrow="Passo 2 · Classificação" title="Tipos de chamado" description="Defina as opções que o solicitante verá ao abrir um chamado, como Incidente, Requisição ou Problema." tone="purple" /></CardHeader><CardContent><div className="grid gap-3 rounded-2xl border border-[#edf0f5] bg-[#fbfcfe] p-4 md:grid-cols-[1fr_1.5fr_auto]"><Input value={typeName} onChange={event => setTypeName(event.target.value)} placeholder="Nome do tipo" /><Input value={typeDescription} onChange={event => setTypeDescription(event.target.value)} placeholder="Descrição curta para orientar o solicitante" /><Button disabled={createTicketType.isPending || typeName.trim().length < 2} onClick={() => createTicketType.mutate({ name: typeName, description: typeDescription })}><Plus className="mr-2 size-4" /> Criar tipo</Button></div><div className="mt-5 grid gap-3 md:grid-cols-2">{(ticketTypes.data ?? []).length === 0 ? <EmptyState>Nenhum tipo de chamado cadastrado.</EmptyState> : (ticketTypes.data ?? []).map(item => <div key={item.id} className="rounded-xl border border-[#edf0f5] bg-white p-4"><div className="flex items-center justify-between gap-3"><p className="text-sm font-semibold text-[#253252]">{item.name}</p><Badge variant="outline" className="border-[#b9e7d2] text-[10px] text-[#147b55]">Ativo</Badge></div><p className="mt-2 text-xs leading-5 text-[#8791a5]">{item.description || "Sem descrição cadastrada."}</p></div>)}</div></CardContent></Card><Card className="border-[#e5e8f0] shadow-none"><CardHeader><SectionIntro icon={Layers3} eyebrow="Passo 3 · Catálogo de serviços" title="Categorias e serviços" description="Categorias organizam o catálogo. Serviços são as opções específicas que direcionam o atendimento." tone="amber" /></CardHeader><CardContent><div className="grid gap-6 lg:grid-cols-2"><div className="rounded-2xl border border-[#edf0f5] bg-[#fbfcfe] p-4"><p className="text-sm font-semibold text-[#253252]">Nova categoria</p><div className="mt-4 grid gap-2 sm:grid-cols-[1fr_130px]"><Input value={categoryName} onChange={event => setCategoryName(event.target.value)} placeholder="Nome da categoria" /><Input value={categoryCode} onChange={event => setCategoryCode(event.target.value)} placeholder="Código" /></div><select value={categoryParentId ?? ""} onChange={event => setCategoryParentId(Number(event.target.value) || undefined)} className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="">Categoria raiz</option>{(categories.data ?? []).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select><Button className="mt-3 w-full" disabled={createCategory.isPending || categoryName.trim().length < 2 || categoryCode.trim().length < 2} onClick={() => createCategory.mutate({ name: categoryName, code: categoryCode, parentId: categoryParentId })}><Plus className="mr-2 size-4" /> Criar categoria</Button><div className="mt-5 space-y-2">{(categories.data ?? []).map(item => <div key={item.id} className="flex items-center justify-between rounded-xl border border-[#edf0f5] bg-white px-3 py-3"><div><p className="text-sm font-medium text-[#253252]">{item.parentId ? "↳ " : ""}{item.name}</p><p className="mono mt-1 text-[10px] text-[#8791a5]">{item.code}</p></div><Badge variant="outline" className="text-[10px]">Ativa</Badge></div>)}</div></div><div className="rounded-2xl border border-[#edf0f5] bg-[#fbfcfe] p-4"><p className="text-sm font-semibold text-[#253252]">Novo serviço</p><div className="mt-4 grid gap-2 sm:grid-cols-[1fr_130px]"><Input value={serviceName} onChange={event => setServiceName(event.target.value)} placeholder="Nome do serviço" /><Input value={serviceCode} onChange={event => setServiceCode(event.target.value)} placeholder="Código" /></div><select value={serviceCategoryId ?? ""} onChange={event => setServiceCategoryId(Number(event.target.value) || undefined)} className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="">Selecione a categoria</option>{(categories.data ?? []).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select><label className="mt-3 block text-xs font-medium text-[#526079]">Tipo padrão do chamado<select value={serviceDefaultTicketTypeId ?? ""} onChange={event => setServiceDefaultTicketTypeId(event.target.value ? Number(event.target.value) : undefined)} className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="">Solicitar seleção manual</option>{(ticketTypes.data ?? []).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label className="mt-3 block text-xs font-medium text-[#526079]">Fila padrão de atendimento<select value={serviceDefaultQueueId ?? ""} onChange={event => setServiceDefaultQueueId(event.target.value ? Number(event.target.value) : undefined)} className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="">Usar fila do tipo/setor</option>{(queues.data ?? []).map(item => <option key={item.id} value={item.id}>{item.name} · {teams.data?.find(team => team.id === item.teamId)?.name ?? "Equipe"}</option>)}</select></label><p className="mt-2 text-[11px] leading-5 text-[#8791a5]">Esses padrões serão aplicados pelo servidor ao abrir o chamado. A fila define automaticamente setor e equipe de destino.</p><Button className="mt-3 w-full" disabled={createService.isPending || serviceName.trim().length < 2 || serviceCode.trim().length < 2 || !serviceCategoryId} onClick={() => createService.mutate({ name: serviceName, code: serviceCode, categoryId: serviceCategoryId!, defaultTicketTypeId: serviceDefaultTicketTypeId, defaultQueueId: serviceDefaultQueueId })}><Plus className="mr-2 size-4" /> Criar serviço</Button><div className="mt-5 space-y-2">{(services.data ?? []).map(item => <div key={item.id} className="space-y-3 rounded-xl border border-[#edf0f5] bg-white p-4"><div><p className="text-sm font-medium text-[#253252]">{item.name}</p><p className="mono mt-1 text-[10px] text-[#8791a5]">{item.code} · {categories.data?.find(category => category.id === item.categoryId)?.name ?? `Categoria #${item.categoryId}`}</p></div><div className="grid gap-2 sm:grid-cols-2"><label className="text-[11px] font-medium text-[#526079]">Tipo padrão<select value={serviceRuleDrafts[item.id] ? (serviceRuleDrafts[item.id].defaultTicketTypeId ?? "") : (item.defaultTicketTypeId ?? "")} onChange={event => setServiceRuleDrafts(previous => ({ ...previous, [item.id]: { defaultTicketTypeId: event.target.value ? Number(event.target.value) : null, defaultQueueId: previous[item.id] ? previous[item.id].defaultQueueId : (item.defaultQueueId ?? null) } }))} className="mt-1 h-9 w-full rounded-md border border-input bg-background px-2 text-xs"><option value="">Seleção manual</option>{(ticketTypes.data ?? []).map(type => <option key={type.id} value={type.id}>{type.name}</option>)}</select></label><label className="text-[11px] font-medium text-[#526079]">Fila padrão<select value={serviceRuleDrafts[item.id] ? (serviceRuleDrafts[item.id].defaultQueueId ?? "") : (item.defaultQueueId ?? "")} onChange={event => setServiceRuleDrafts(previous => ({ ...previous, [item.id]: { defaultTicketTypeId: previous[item.id] ? previous[item.id].defaultTicketTypeId : (item.defaultTicketTypeId ?? null), defaultQueueId: event.target.value ? Number(event.target.value) : null } }))} className="mt-1 h-9 w-full rounded-md border border-input bg-background px-2 text-xs"><option value="">Automática por tipo/setor</option>{(queues.data ?? []).map(queue => <option key={queue.id} value={queue.id}>{queue.name} · {teams.data?.find(team => team.id === queue.teamId)?.name ?? "Equipe"}</option>)}</select></label></div><div className="flex justify-end"><Button size="sm" disabled={updateServiceRouting.isPending || !serviceRuleDrafts[item.id]} onClick={() => { const draft = serviceRuleDrafts[item.id]; updateServiceRouting.mutate({ serviceId: item.id, defaultTicketTypeId: draft?.defaultTicketTypeId ?? null, defaultQueueId: draft?.defaultQueueId ?? null }); }}><CheckCircle2 className="mr-1.5 size-3.5" /> Salvar regras</Button></div></div>)}</div></div></div></CardContent></Card></TabsContent>


        <TabsContent value="operations" className="mt-6 space-y-6">
          <Card className="border-[#e5e8f0] shadow-none">
            <CardHeader><SectionIntro icon={Settings2} eyebrow="Acordos de atendimento" title="Políticas de SLA por prioridade" description="Prazos iniciais em horas corridas, editáveis pela administração. Confirme os valores com o negócio antes de tratá-los como compromisso oficial." tone="purple" /></CardHeader>
            <CardContent>
              {slaPolicies.isLoading ? <Loader2 className="size-5 animate-spin text-[#3157d5]" /> : (
                <div className="space-y-3">
                  {(slaPolicies.data ?? []).map(policy => {
                    const draft = slaDrafts[policy.priority] ?? { firstResponseHours: policy.firstResponseHours, resolutionHours: policy.resolutionHours };
                    return <div key={policy.priority} className="grid gap-3 rounded-xl border border-[#edf0f5] p-3 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end">
                      <div><p className="mb-1 text-xs font-semibold capitalize text-[#253252]">Prioridade {policy.priority === "low" ? "baixa" : policy.priority === "medium" ? "média" : policy.priority === "high" ? "alta" : "urgente"}</p><p className="text-[10px] text-[#8791a5]">Horas corridas</p></div>
                      <label className="text-xs text-[#526079]">1ª resposta (h)<Input inputType="number" min={0.25} step={0.25} value={String(draft.firstResponseHours)} onChange={event => setSlaDrafts(prev => ({ ...prev, [policy.priority]: { ...draft, firstResponseHours: Number(event.target.value) } }))} /></label>
                      <label className="text-xs text-[#526079]">Resolução (h)<Input inputType="number" min={0.25} step={0.25} value={String(draft.resolutionHours)} onChange={event => setSlaDrafts(prev => ({ ...prev, [policy.priority]: { ...draft, resolutionHours: Number(event.target.value) } }))} /></label>
                      <Button size="sm" disabled={updateSlaPolicy.isPending || draft.firstResponseHours <= 0 || draft.resolutionHours <= 0} onClick={() => updateSlaPolicy.mutate({ priority: policy.priority as "low" | "medium" | "high" | "urgent", ...draft })}>Salvar</Button>
                    </div>;
                  })}
                </div>
              )}
            </CardContent>
          </Card>
          <Card className="border-[#fecaca] bg-[#fff8f8] shadow-none">
            <CardHeader>
              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-[#fee2e2] p-2.5 text-[#dc2626]">
                  <Trash2 className="size-4" />
                </div>
                <div>
                  <p className="eyebrow text-[#dc2626]">Zona de gerenciamento de dados</p>
                  <h2 className="mt-1 text-lg font-semibold text-[#991b1b]">Limpeza de catálogo e dados operacionais</h2>
                  <p className="mt-1 max-w-2xl text-xs leading-5 text-[#b91c1c]">
                    Apaga todos os setores, equipes, filas de atendimento, tipos de chamado, categorias e serviços do banco de dados, além de chamados de teste. As contas de usuário são mantidas intactas.
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Button
                variant="destructive"
                className="bg-[#dc2626] hover:bg-[#b91c1c] text-white"
                disabled={clearCatalog.isPending}
                onClick={() => {
                  if (window.confirm("Atenção: Tem certeza de que deseja apagar todos os setores, equipes, filas e tipos de chamado do banco de dados?")) {
                    clearCatalog.mutate();
                  }
                }}
              >
                {clearCatalog.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Trash2 className="mr-2 size-4" />}
                Apagar todos os setores, equipes e tipos de chamado
              </Button>
            </CardContent>
          </Card>
          <Card className="border-[#e5e8f0] shadow-none"><CardHeader><SectionIntro icon={FolderCog} eyebrow="Controle e rastreabilidade" title="Arquivos e auditoria" description="Acompanhe anexos persistidos e eventos de segurança sem misturar essas tarefas com os cadastros do dia a dia." tone="purple" /></CardHeader><CardContent><div className="grid gap-6 lg:grid-cols-2"><div><h3 className="text-sm font-semibold text-[#253252]">Arquivos dos chamados</h3><p className="mt-1 text-xs text-[#8791a5]">Índice operacional dos anexos armazenados.</p><div className="mt-4 space-y-2">{attachments.isLoading ? <Loader2 className="size-5 animate-spin text-[#3157d5]" /> : (attachments.data ?? []).length === 0 ? <EmptyState>Nenhum anexo cadastrado.</EmptyState> : (attachments.data ?? []).map(file => <div key={file.id} className="flex items-center gap-3 rounded-xl border border-[#edf0f5] bg-white p-3"><FileText className="size-4 shrink-0 text-[#3157d5]" /><span className="min-w-0 flex-1 truncate text-xs text-[#526079]">{file.fileName}</span><span className="text-[10px] text-[#8791a5]">#{file.ticketId}</span><Button variant="ghost" size="sm" onClick={() => downloadAttachment.mutate({ attachmentId: file.id })}><Download className="mr-1.5 size-3.5" /> Baixar</Button></div>)}</div></div><div><h3 className="text-sm font-semibold text-[#253252]">Auditoria operacional</h3><p className="mt-1 text-xs text-[#8791a5]">Acessos negados, transições inválidas e eventos de segurança.</p><div className="mt-4 divide-y divide-[#edf0f5] rounded-xl border border-[#edf0f5] bg-white px-3">{audit.isLoading ? <Loader2 className="my-5 size-5 animate-spin text-[#3157d5]" /> : (audit.data ?? []).length === 0 ? <p className="py-6 text-center text-xs text-[#8791a5]">Nenhum evento registrado.</p> : (audit.data ?? []).slice(0, 12).map(item => <div key={item.id} className="flex flex-col gap-1 py-3"><p className="text-xs font-semibold text-[#253252]">{item.action}</p><p className="mono text-[10px] text-[#8791a5]">{item.resource}{item.ticketId ? ` · ticket #${item.ticketId}` : ""} · {new Date(item.createdAt).toLocaleString("pt-BR")}</p></div>)}</div></div></div></CardContent></Card></TabsContent>
        <TabsContent value="people" className="mt-6 space-y-6">
          <Card className="border-[#e5e8f0] shadow-none">
            <CardHeader>
              <SectionIntro icon={Users} eyebrow="Pessoas e acessos" title="Criar usuário" description="Cadastre uma conta local e defina o perfil e a área de atendimento. A senha é armazenada como hash no servidor." tone="green" />
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 rounded-2xl border border-[#edf0f5] bg-[#fbfcfe] p-4 md:grid-cols-2">
                <label className="space-y-1.5 text-xs font-medium text-[#526079]">E-mail corporativo
                  <Input type="email" autoComplete="email" value={userEmail} onChange={event => setUserEmail(event.target.value)} placeholder="nome@empresa.com.br" />
                </label>
                <label className="space-y-1.5 text-xs font-medium text-[#526079]">Senha inicial
                  <Input type="password" autoComplete="new-password" value={userPassword} onChange={event => setUserPassword(event.target.value)} placeholder="Mínimo de 8 caracteres" />
                </label>
                <label className="space-y-1.5 text-xs font-medium text-[#526079]">Perfil
                  <select className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={userProfile} onChange={event => setUserProfile(event.target.value as Profile)}>
                    {Object.entries(profileLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </label>
                {userProfile !== "requester" && <>
                  <label className="space-y-1.5 text-xs font-medium text-[#526079]">Setor
                    <select className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={userDepartmentId ?? ""} onChange={event => { setUserDepartmentId(event.target.value ? Number(event.target.value) : undefined); setUserTeamId(undefined); }}>
                      <option value="">Selecione um setor</option>
                      {(departments.data ?? []).map(department => <option key={department.id} value={department.id}>{department.name}</option>)}
                    </select>
                  </label>
                  <label className="space-y-1.5 text-xs font-medium text-[#526079]">Equipe (opcional)
                    <select className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={userTeamId ?? ""} disabled={!userDepartmentId} onChange={event => setUserTeamId(event.target.value ? Number(event.target.value) : undefined)}>
                      <option value="">Todas as equipes do setor</option>
                      {(teams.data ?? []).filter(team => team.departmentId === userDepartmentId).map(team => <option key={team.id} value={team.id}>{team.name}</option>)}
                    </select>
                  </label>
                </>}
                {userProfile !== "requester" && <p className="text-xs leading-5 text-[#8791a5] md:col-span-2">Atendentes, aprovadores e gestores precisam estar vinculados a um setor.</p>}
                <div className="md:col-span-2">
                  <Button className="w-full sm:w-auto" disabled={createUser.isPending || !userEmail.includes("@") || userPassword.length < 8 || (userProfile !== "requester" && !userDepartmentId)} onClick={() => createUser.mutate({ email: userEmail, password: userPassword, profile: userProfile, departmentId: userDepartmentId, teamId: userTeamId })}>
                    {createUser.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : <UserPlus className="mr-2 size-4" />}
                    Criar usuário
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-[#e5e8f0] shadow-none">
            <CardHeader>
              <CardTitle className="text-base text-[#253252]">Usuários cadastrados</CardTitle>
            </CardHeader>
            <CardContent>
              {users.isLoading ? <Loader2 className="my-5 size-5 animate-spin text-[#3157d5]" /> : users.isError ? <EmptyState>Não foi possível carregar os usuários. Atualize a lista para tentar novamente.</EmptyState> : (users.data ?? []).length === 0 ? <EmptyState>Nenhum usuário cadastrado.</EmptyState> : <div className="divide-y divide-[#edf0f5] rounded-xl border border-[#edf0f5] bg-white px-3">
                {(users.data ?? []).map(account => <div key={account.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[#253252]">{account.name || account.email}</p>
                    <p className="mt-1 truncate text-xs text-[#8791a5]">{account.email}</p>
                    <p className="mt-1 text-[11px] text-[#8791a5]">{departments.data?.find(department => department.id === account.departmentId)?.name ?? "Sem setor"}{account.teamId ? ` · ${teams.data?.find(team => team.id === account.teamId)?.name ?? "Equipe"}` : ""}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {account.role === "admin" && <Badge variant="outline">Administrador</Badge>}
                    <select aria-label={`Perfil de ${account.email ?? account.id}`} className="h-9 rounded-md border border-input bg-background px-2 text-xs" value={account.profile} onChange={event => setProfile.mutate({ userId: account.id, profile: event.target.value as Profile })} disabled={setProfile.isPending}>
                      {Object.entries(profileLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                    <Button variant="outline" size="sm" disabled={setUserActive.isPending || account.id === currentUser?.id} onClick={() => setUserActive.mutate({ userId: account.id, active: account.active !== 1 })}>
                      {account.active === 1 ? "Desativar" : "Ativar"}
                    </Button>
                    <Badge variant="outline" className={account.active === 1 ? "border-[#b9e7d2] text-[#147b55]" : "border-[#e5e8f0] text-[#8791a5]"}>{account.active === 1 ? "Ativo" : "Inativo"}</Badge>
                  </div>
                </div>)}
              </div>}
            </CardContent>
          </Card>
        </TabsContent>
        {activeTab === "structure" && <Card className="mt-6 border-[#e5e8f0] shadow-none"><CardHeader><SectionIntro icon={Layers3} eyebrow="Passo 1 · Roteamento" title="Filas de atendimento" description="Crie as filas de cada equipe para definir o destino dos chamados." /></CardHeader><CardContent><div className="grid gap-3 rounded-2xl border border-[#edf0f5] bg-[#fbfcfe] p-4 sm:grid-cols-[1fr_1fr_auto]"><Input value={queueName} onChange={event => setQueueName(event.target.value)} placeholder="Nome da fila" /><select aria-label="Equipe da fila" className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={queueTeamId ?? ""} onChange={event => setQueueTeamId(event.target.value ? Number(event.target.value) : undefined)}><option value="">Selecione uma equipe</option>{(teams.data ?? []).map(team => <option key={team.id} value={team.id}>{team.name} · {departments.data?.find(department => department.id === team.departmentId)?.name ?? "Setor"}</option>)}</select><Button disabled={createQueue.isPending || queueName.trim().length < 2 || !queueTeamId} onClick={() => createQueue.mutate({ name: queueName, teamId: queueTeamId! })}>{createQueue.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Plus className="mr-2 size-4" />}Criar fila</Button></div><div className="mt-4 space-y-2">{queues.isLoading ? <Loader2 className="size-5 animate-spin text-[#3157d5]" /> : (queues.data ?? []).length === 0 ? <EmptyState>Nenhuma fila cadastrada ainda.</EmptyState> : (queues.data ?? []).map(queue => <div key={queue.id} className="flex items-center justify-between rounded-xl border border-[#edf0f5] bg-white px-3 py-3"><div><p className="text-sm font-medium text-[#253252]">{queue.name}</p><p className="mt-1 text-xs text-[#8791a5]">{teams.data?.find(team => team.id === queue.teamId)?.name ?? "Equipe"} · {departments.data?.find(department => department.id === queue.departmentId)?.name ?? "Setor"}</p></div><Badge variant="outline" className="border-[#b9e7d2] text-[10px] text-[#147b55]">Ativa</Badge></div>)}</div></CardContent></Card>}
      </Tabs>
    </div>
  </AppShell>;
}
