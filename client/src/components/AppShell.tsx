import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/contexts/ThemeContext";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import { BarChart3, Bell, ClipboardList, Inbox, LayoutDashboard, LogOut, Menu, Moon, Settings2, Sun, X } from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";

const navItems = [
  { label: "Visão geral", icon: LayoutDashboard, path: "/" },
  { label: "Meus chamados", icon: ClipboardList, path: "/my-tickets" },
  { label: "Fila geral", icon: Inbox, path: "/tickets" },
  { label: "KPIs", icon: BarChart3, path: "/kpis" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth({ redirectOnUnauthenticated: false });
  const { theme, toggleTheme } = useTheme();
  const bootstrap = trpc.auth.bootstrap.useQuery(undefined, { enabled: Boolean(user), staleTime: 60_000 });
  const currentUser = bootstrap.data?.user ?? user;
  const [location, setLocation] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const notifications = trpc.notifications.list.useQuery(undefined, { enabled: Boolean(user), refetchInterval: 30_000 });
  const markNotificationRead = trpc.notifications.markRead.useMutation({ onSuccess: () => void notifications.refetch() });

  const initials = (currentUser?.name || currentUser?.email || "U").slice(0, 2).toUpperCase();
  const activeDetail = location.startsWith("/tickets/");
  const activeAdmin = location.startsWith("/admin");
  const activeKpis = location.startsWith("/kpis");

  return (
    <div className="min-h-screen bg-[var(--app-background)] text-[var(--app-foreground)] transition-colors">
      <aside className={cn("fixed inset-y-0 left-0 z-50 flex w-[252px] flex-col border-r border-white/5 bg-[#101116] px-4 py-5 text-white transition-transform lg:translate-x-0", mobileOpen ? "translate-x-0" : "-translate-x-full")}>
        <div className="flex items-center justify-between px-2">
          <button className="flex items-center gap-3 text-left" onClick={() => { setLocation("/"); setMobileOpen(false); }} aria-label="Ir para visão geral">
            <span className="brand-mark"><span /><span /></span>
            <span className="text-[18px] font-bold tracking-tight">Ticket<span className="text-[#ff304b]">Flow</span><span className="ml-2 rounded border border-white/15 px-1.5 py-0.5 align-middle text-[9px] font-semibold uppercase tracking-[.16em] text-slate-400">Fullbrands</span></span>
          </button>
          <button className="rounded-lg p-2 text-slate-400 hover:bg-white/10 lg:hidden" onClick={() => setMobileOpen(false)} aria-label="Fechar menu"><X className="size-4" /></button>
        </div>
        <div className="mt-12 px-2 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Workspace</div>
        <nav className="mt-3 space-y-1">{navItems.map(item => {
          const active = location === item.path && !activeDetail;
          return <button key={item.label} onClick={() => { setLocation(item.path); setMobileOpen(false); }} className={cn("sidebar-link", active && "sidebar-link-active")}><item.icon className="size-[17px]" /><span>{item.label}</span></button>;
        })}</nav>
        <div className="mt-10 px-2 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Configuração</div>
        <nav className="mt-3 space-y-1">{currentUser?.role === "admin" && <button className={cn("sidebar-link", activeAdmin && "sidebar-link-active")} onClick={() => { setLocation("/admin"); setMobileOpen(false); }}><Settings2 className="size-[17px]" /><span>Configuração</span></button>}</nav>
        <div className="mt-auto space-y-3 border-t border-white/10 pt-4">
          <button onClick={toggleTheme} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-xs font-medium text-slate-300 transition hover:bg-white/[0.07] hover:text-white" aria-label={theme === "dark" ? "Ativar modo claro" : "Ativar modo escuro"}>
            {theme === "dark" ? <Sun className="size-4 text-[#ff6679]" /> : <Moon className="size-4 text-[#ff6679]" />}
            <span>{theme === "dark" ? "Modo claro" : "Modo escuro"}</span>
            <span className="ml-auto rounded-full border border-white/10 px-2 py-0.5 text-[9px] uppercase tracking-wider text-slate-500">{theme === "dark" ? "Dark" : "Light"}</span>
          </button>
          <div className="flex items-center gap-3 rounded-xl px-2 py-2">
            <Avatar className="size-9 border border-white/15 bg-white/10"><AvatarFallback className="bg-[#ed1b36] text-xs font-semibold text-white">{initials}</AvatarFallback></Avatar>
            <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-white">{currentUser?.name || "Usuário"}</p><p className="truncate text-xs text-slate-400">{currentUser?.email || "Conta"}</p></div>
            <button onClick={() => void logout()} className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white" aria-label="Sair"><LogOut className="size-4" /></button>
          </div>
        </div>
      </aside>
      {mobileOpen && <button className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden" onClick={() => setMobileOpen(false)} aria-label="Fechar menu" />}
      <main className="min-h-screen lg:pl-[252px]">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-[var(--app-border)] bg-[var(--app-background)]/90 px-5 py-3 backdrop-blur-xl sm:px-8">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Abrir menu"><Menu className="size-5" /></Button>
            <div className="hidden sm:block"><p className="text-[10px] font-bold uppercase tracking-[.2em] text-[#ed1b36]">FULLBRANDS · OPERAÇÕES</p><p className="mt-0.5 text-sm font-semibold text-[var(--app-foreground)]">{activeAdmin ? "Configuração" : activeDetail ? "Detalhes do chamado" : activeKpis ? "KPIs" : navItems.find(item => item.path === location)?.label ?? "TicketFlow"}</p></div>
            <span className="text-sm font-bold sm:hidden">Ticket<span className="text-[#ed1b36]">Flow</span></span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" className="border-[var(--app-border)] bg-[var(--app-card)]" onClick={toggleTheme} aria-label={theme === "dark" ? "Ativar modo claro" : "Ativar modo escuro"}>{theme === "dark" ? <Sun className="size-4 text-[#ff6679]" /> : <Moon className="size-4" />}</Button>
            <div className="relative"><Button variant="outline" size="icon" className="relative border-[var(--app-border)] bg-[var(--app-card)]" onClick={() => setNotificationOpen(open => !open)} aria-label="Notificações"><Bell className="size-4" />{(notifications.data ?? []).some(item => !item.readAt) && <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-[#ed1b36]" />}</Button>
              {notificationOpen && <div className="absolute right-0 mt-2 w-[min(340px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-[var(--app-border)] bg-[var(--app-popover)] shadow-2xl"><div className="flex items-center justify-between border-b border-[var(--app-border)] px-4 py-3"><div><p className="text-sm font-semibold">Notificações</p><p className="text-[11px] text-[var(--app-muted-foreground)]">Atualizações dos seus chamados e aprovações</p></div><span className="text-[10px] font-bold uppercase tracking-wider text-[#ed1b36]">{(notifications.data ?? []).filter(item => !item.readAt).length} novas</span></div><div className="max-h-[360px] overflow-y-auto">{(notifications.data ?? []).length === 0 ? <p className="px-4 py-8 text-center text-xs text-[var(--app-muted-foreground)]">Nenhuma notificação.</p> : (notifications.data ?? []).map(item => <button key={item.id} onClick={() => { markNotificationRead.mutate({ notificationId: item.id }); if (item.ticketId) setLocation(`/tickets/${item.ticketId}`); setNotificationOpen(false); }} className={cn("block w-full border-b border-[var(--app-border)] px-4 py-3 text-left hover:bg-[var(--app-secondary)]", !item.readAt && "bg-[#ed1b36]/10")}><p className="text-xs font-semibold">{item.title}</p><p className="mt-1 text-xs leading-5 text-[var(--app-muted-foreground)]">{item.body}</p><p className="mt-1 text-[10px] text-[var(--app-muted-foreground)]">{new Date(item.createdAt).toLocaleString("pt-BR")}</p></button>)}</div></div>}
          </div>
          </div>
        </header>
        {children}
      </main>
    </div>
  );
}
