import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import { Bell, ClipboardList, Inbox, LayoutDashboard, LogOut, Menu, Settings2, X } from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";

const navItems = [
  { label: "Visão geral", icon: LayoutDashboard, path: "/" },
  { label: "Meus chamados", icon: ClipboardList, path: "/my-tickets" },
  { label: "Fila geral", icon: Inbox, path: "/tickets" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth({ redirectOnUnauthenticated: false });
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

  return (
    <div className="min-h-screen bg-[#f6f7fb] text-[#15213d]">
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 flex w-[252px] flex-col bg-[#0d1730] px-4 py-5 text-white transition-transform lg:translate-x-0",
        mobileOpen ? "translate-x-0" : "-translate-x-full",
      )}>
        <div className="flex items-center justify-between px-2">
          <button className="flex items-center gap-3 text-left" onClick={() => { setLocation("/"); setMobileOpen(false); }}>
            <span className="brand-mark"><span /><span /></span>
            <span className="text-[18px] font-semibold tracking-tight">Ticket<span className="text-[#86a4ff]">Flow</span></span>
          </button>
          <button className="rounded-lg p-2 text-slate-400 hover:bg-white/10 lg:hidden" onClick={() => setMobileOpen(false)} aria-label="Fechar menu"><X className="size-4" /></button>
        </div>

        <div className="mt-12 px-2 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Workspace</div>
        <nav className="mt-3 space-y-1">
          {navItems.map(item => {
            const active = location === item.path && !activeDetail;
            return (
              <button key={item.label} onClick={() => { setLocation(item.path); setMobileOpen(false); }} className={cn("sidebar-link", active && "sidebar-link-active")}>
                <item.icon className="size-[17px]" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="mt-10 px-2 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Configuração</div>
        <nav className="mt-3 space-y-1">
          {currentUser?.role === "admin" && <button className={cn("sidebar-link", activeAdmin && "sidebar-link-active")} onClick={() => { setLocation("/admin"); setMobileOpen(false); }}><Settings2 className="size-[17px]" /><span>Configuração</span></button>}
        </nav>

        <div className="mt-auto border-t border-white/10 pt-4">
          <div className="flex items-center gap-3 rounded-xl px-2 py-2">
            <Avatar className="size-9 border border-white/15 bg-white/10"><AvatarFallback className="bg-[#3157d5] text-xs font-semibold text-white">{initials}</AvatarFallback></Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-white">{currentUser?.name || "Usuário"}</p>
              <p className="truncate text-xs text-slate-400">{currentUser?.email || "Conta Manus"}</p>
            </div>
            <button onClick={() => void logout()} className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white" aria-label="Sair"><LogOut className="size-4" /></button>
          </div>
        </div>
      </aside>

      {mobileOpen && <button className="fixed inset-0 z-40 bg-[#0d1730]/50 lg:hidden" onClick={() => setMobileOpen(false)} aria-label="Fechar menu" />}
      <main className="min-h-screen lg:pl-[252px]">
        <div className="fixed right-5 top-4 z-30"><Button variant="outline" size="icon" className="relative border-[#e5e8f0] bg-white shadow-sm" onClick={() => setNotificationOpen(open => !open)} aria-label="Notificações"><Bell className="size-4 text-[#526079]" />{(notifications.data ?? []).some(item => !item.readAt) && <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-[#d64d4d]" />}</Button>{notificationOpen && <div className="absolute right-0 mt-2 w-[340px] overflow-hidden rounded-2xl border border-[#e5e8f0] bg-white shadow-xl"><div className="flex items-center justify-between border-b border-[#edf0f5] px-4 py-3"><div><p className="text-sm font-semibold text-[#253252]">Notificações</p><p className="text-[11px] text-[#8791a5]">Atualizações dos seus chamados e aprovações</p></div><span className="text-[10px] font-bold uppercase tracking-wider text-[#3157d5]">{(notifications.data ?? []).filter(item => !item.readAt).length} novas</span></div><div className="max-h-[360px] overflow-y-auto">{(notifications.data ?? []).length === 0 ? <p className="px-4 py-8 text-center text-xs text-[#8791a5]">Nenhuma notificação.</p> : (notifications.data ?? []).map(item => <button key={item.id} onClick={() => { markNotificationRead.mutate({ notificationId: item.id }); if (item.ticketId) setLocation(`/tickets/${item.ticketId}`); setNotificationOpen(false); }} className={cn("block w-full border-b border-[#f0f2f6] px-4 py-3 text-left hover:bg-[#f8f9fc]", !item.readAt && "bg-[#f4f6ff]")}><p className="text-xs font-semibold text-[#253252]">{item.title}</p><p className="mt-1 text-xs leading-5 text-[#6c7891]">{item.body}</p><p className="mt-1 text-[10px] text-[#a2aabd]">{new Date(item.createdAt).toLocaleString("pt-BR")}</p></button>)}</div></div>}</div>
        <div className="flex items-center justify-between border-b border-[#e5e8f0] bg-white/80 px-5 py-4 backdrop-blur lg:hidden">
          <Button variant="ghost" size="icon" onClick={() => setMobileOpen(true)} aria-label="Abrir menu"><Menu className="size-5" /></Button>
          <span className="text-sm font-semibold">TicketFlow</span>
          <span className="size-9" />
        </div>
        {children}
      </main>
    </div>
  );
}
