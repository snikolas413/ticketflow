import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { ArrowRight, Loader2, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function Login() {
  const [mode, setMode] = useState<"login" | "setup">("login");
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

  return <main className="flex min-h-screen items-center justify-center bg-[#f6f7fb] px-5 py-10">
    <div className="grid w-full max-w-4xl overflow-hidden rounded-[28px] border border-[#e5e8f0] bg-white shadow-[0_20px_60px_rgba(21,33,61,0.08)] md:grid-cols-[1.05fr_0.95fr]">
      <section className="hidden flex-col justify-between bg-[#15213d] p-10 text-white md:flex">
        <div><div className="flex items-center gap-3"><div className="flex size-10 items-center justify-center rounded-2xl bg-[#3157d5] font-bold">TF</div><span className="text-xl font-semibold tracking-[-0.04em]">TicketFlow</span></div><p className="eyebrow mt-16 text-[#9fb2ff]">Central operacional</p><h1 className="mt-4 max-w-sm text-4xl font-semibold leading-tight tracking-[-0.05em]">Solicitações com destino, contexto e responsabilidade.</h1></div>
        <p className="max-w-sm text-sm leading-6 text-[#b8c2da]">Acesse somente com o e-mail e a senha da sua conta corporativa.</p>
      </section>
      <section className="p-7 sm:p-10"><div className="mx-auto max-w-sm">
        <div className="flex items-center gap-3 md:hidden"><div className="flex size-10 items-center justify-center rounded-2xl bg-[#3157d5] font-bold text-white">TF</div><span className="text-xl font-semibold text-[#15213d]">TicketFlow</span></div>
        <div className="mt-8 md:mt-0"><p className="eyebrow text-[#3157d5]">Acesso local</p><h2 className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-[#15213d]">{mode === "setup" ? "Criar primeira conta" : "Entrar na central"}</h2><p className="mt-2 text-sm leading-6 text-[#6c7891]">{mode === "setup" ? "A primeira conta será administradora da organização." : "Use o e-mail e a senha cadastrados pelo administrador."}</p></div>
        <form className="mt-8 space-y-4" onSubmit={event => { event.preventDefault(); if (mode === "setup") setup.mutate({ name, email, password }); else login.mutate({ email, password }); }}>
          {mode === "setup" && <div><label className="field-label">Nome completo</label><Input className="mt-2 h-11" value={name} onChange={event => setName(event.target.value)} placeholder="Seu nome" required /></div>}
          <div><label className="field-label">E-mail</label><Input className="mt-2 h-11" type="email" autoComplete="username" value={email} onChange={event => setEmail(event.target.value)} placeholder="nome@empresa.com.br" required /></div>
          <div><label className="field-label">Senha</label><Input className="mt-2 h-11" type="password" autoComplete={mode === "setup" ? "new-password" : "current-password"} value={password} onChange={event => setPassword(event.target.value)} placeholder="Mínimo de 8 caracteres" minLength={8} required /></div>
          <Button className="h-11 w-full bg-[#3157d5] hover:bg-[#2448bd]" disabled={isPending}>{isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : <ArrowRight className="mr-2 size-4" />}{mode === "setup" ? "Criar conta administradora" : "Entrar"}</Button>
        </form>
        <div className="mt-7 rounded-2xl border border-[#e5e8f0] bg-[#f8f9fc] p-4"><div className="flex gap-3"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-[#3157d5]" /><p className="text-xs leading-5 text-[#6c7891]">{mode === "setup" ? "Esta opção aparece apenas enquanto não existe nenhuma conta no banco." : "Se ainda não existe uma conta, use o primeiro acesso para criar o administrador."}</p></div></div>
        {((firstAccess && mode === "login") || mode === "setup") && <button type="button" onClick={() => setMode(mode === "setup" ? "login" : "setup")} className="mt-5 w-full text-xs font-semibold text-[#3157d5] hover:underline">{mode === "setup" ? "Voltar para entrar" : "Primeiro acesso: criar administrador"}</button>}
      </div></section>
    </div>
  </main>;
}
