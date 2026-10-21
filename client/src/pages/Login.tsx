import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { ArrowRight, Loader2, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function Login() {
  const [mode, setMode] = useState<"login" | "setup" | "forgot">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const setupStatus = trpc.auth.setupStatus.useQuery();
  const login = trpc.auth.login.useMutation({
    onSuccess: () => { window.location.href = "/"; },
    onError: error => toast.error(error.message),
  });
  const setup = trpc.auth.setup.useMutation({
    onSuccess: () => { window.location.href = "/"; },
    onError: error => toast.error(error.message),
  });
  const firstAccess = setupStatus.data?.needsSetup === true;
  const isPending = login.isPending || setup.isPending;

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#090b10] px-4 py-8 text-white sm:px-6">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-40 -top-40 size-[28rem] rounded-full bg-[#ed1b36]/15 blur-[100px]" />
        <div className="absolute -bottom-48 -right-24 size-[32rem] rounded-full bg-[#ed1b36]/10 blur-[120px]" />
        <div className="absolute inset-0 opacity-[0.07]" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,.16) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.16) 1px, transparent 1px)", backgroundSize: "48px 48px" }} />
      </div>
      <div className="relative grid w-full max-w-5xl overflow-hidden rounded-[28px] border border-white/10 bg-[#11141b]/95 shadow-[0_32px_100px_rgba(0,0,0,.45)] md:min-h-[620px] md:grid-cols-[1.08fr_.92fr]">
        <section className="relative hidden flex-col justify-between overflow-hidden border-r border-white/10 bg-gradient-to-br from-[#1b1d25] via-[#11141b] to-[#230b12] p-10 text-white md:flex lg:p-14">
          <div aria-hidden="true" className="absolute -right-20 top-28 size-72 rounded-full border border-white/[0.06]" />
          <div aria-hidden="true" className="absolute -right-8 top-40 size-48 rounded-full border border-[#ed1b36]/20" />
          <div className="relative">
            <div className="flex items-center gap-3"><span className="brand-mark"><span /><span /></span><div><p className="text-xl font-bold tracking-tight">Ticket<span className="text-[#ff4058]">Flow</span></p><p className="mt-0.5 text-[9px] font-semibold uppercase tracking-[.24em] text-slate-500">Fullbrands · Operações</p></div></div>
            <div className="mt-24 max-w-md"><p className="eyebrow text-[#ff6679]">Central operacional</p><h1 className="mt-5 text-4xl font-semibold leading-[1.12] tracking-[-.045em] lg:text-5xl">Cada solicitação.<br /><span className="text-[#ff4058]">Um fluxo claro.</span></h1><p className="mt-6 max-w-sm text-sm leading-7 text-slate-400">Organize demandas, acompanhe responsabilidades e mantenha cada chamado em movimento.</p></div>
          </div>
          <div className="relative flex items-center gap-3 border-t border-white/10 pt-5 text-xs text-slate-500"><span className="flex size-8 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04]"><ShieldCheck className="size-4 text-[#ff6679]" /></span><span>Ambiente corporativo<br /><span className="text-slate-600">Acesso seguro à operação</span></span><span className="ml-auto rounded-full border border-[#ed1b36]/25 bg-[#ed1b36]/10 px-3 py-1 text-[9px] font-bold uppercase tracking-widest text-[#ff6679]">Fullbrands</span></div>
        </section>
        <section className="flex items-center p-6 sm:p-10 lg:p-14">
          <div className="mx-auto w-full max-w-sm">
            <div className="mb-10 flex items-center gap-3 md:hidden"><span className="brand-mark"><span /><span /></span><div><p className="text-lg font-bold">Ticket<span className="text-[#ff4058]">Flow</span></p><p className="text-[9px] font-semibold uppercase tracking-[.2em] text-slate-500">Fullbrands · Operações</p></div></div>
            <div><p className="eyebrow text-[#ff6679]">{mode === "setup" ? "Primeiro acesso" : mode === "forgot" ? "Recuperação de acesso" : "Bem-vindo de volta"}</p><h2 className="mt-3 text-3xl font-semibold tracking-[-.04em] text-white">{mode === "setup" ? "Criar conta admin" : mode === "forgot" ? "Esqueci minha senha" : "Entrar na central"}</h2><p className="mt-3 text-sm leading-6 text-slate-400">{mode === "setup" ? "A primeira conta será administradora da organização." : mode === "forgot" ? "Informe seu e-mail para receber um link seguro de redefinição." : "Entre com os dados da sua conta corporativa."}</p></div>
            <form className="mt-8 space-y-5" onSubmit={event => { event.preventDefault(); if (mode === "setup") setup.mutate({ name, email, password }); else if (mode === "forgot") requestReset.mutate({ email }); else login.mutate({ email, password }); }}>
              {mode === "setup" && <div><label className="field-label !text-slate-300">Nome completo</label><Input className="mt-2 h-12 border-white/10 bg-[#090c12] text-white placeholder:text-slate-600 focus-visible:ring-[#ed1b36]" value={name} onChange={event => setName(event.target.value)} placeholder="Seu nome" required /></div>}
              <div><label className="field-label !text-slate-300">E-mail</label><Input className="mt-2 h-12 border-white/10 bg-[#090c12] text-white placeholder:text-slate-600 focus-visible:ring-[#ed1b36]" type="email" autoComplete="username" value={email} onChange={event => setEmail(event.target.value)} placeholder="nome@empresa.com.br" required /></div>
              {mode !== "forgot" && <div><label className="field-label !text-slate-300">Senha</label><Input className="mt-2 h-12 border-white/10 bg-[#090c12] text-white placeholder:text-slate-600 focus-visible:ring-[#ed1b36]" type="password" autoComplete={mode === "setup" ? "new-password" : "current-password"} value={password} onChange={event => setPassword(event.target.value)} placeholder="Mínimo de 8 caracteres" minLength={8} required /></div>}
              <Button className="h-12 w-full bg-[#ed1b36] font-semibold text-white shadow-[0_8px_24px_rgba(237,27,54,.2)] transition hover:bg-[#ff304b]" disabled={isPending}>{isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : <ArrowRight className="mr-2 size-4" />}{mode === "setup" ? "Criar conta administradora" : mode === "forgot" ? "Enviar link de recuperação" : "Entrar na central"}</Button>
            </form>
            <div className="mt-7 rounded-2xl border border-white/10 bg-white/[0.035] p-4"><div className="flex gap-3"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-[#ff6679]" /><p className="text-xs leading-5 text-slate-400">{mode === "setup" ? "Esta opção aparece apenas enquanto não existe nenhuma conta no banco." : mode === "forgot" ? "Por segurança, a tela sempre confirma a solicitação sem revelar se o e-mail existe." : "Se ainda não existe uma conta, use o primeiro acesso para criar o administrador."}</p></div></div>
            {mode === "login" && <button type="button" onClick={() => setMode("forgot")} className="mt-4 w-full text-xs font-semibold text-[#ff6679] transition hover:text-white">Esqueci minha senha</button>}
            {mode === "forgot" && <button type="button" onClick={() => setMode("login")} className="mt-4 w-full text-xs font-semibold text-[#ff6679] transition hover:text-white">Voltar para entrar</button>}
            {((firstAccess && mode === "login") || mode === "setup") && <button type="button" onClick={() => setMode(mode === "setup" ? "login" : "setup")} className="mt-5 w-full text-xs font-semibold text-[#ff6679] transition hover:text-white">{mode === "setup" ? "Voltar para entrar" : "Primeiro acesso: criar administrador"}</button>}
            <p className="mt-10 text-center text-[10px] uppercase tracking-[.18em] text-slate-600">TicketFlow · Fullbrands</p>
          </div>
        </section>
      </div>
    </main>
  );
}
