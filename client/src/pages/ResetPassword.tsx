import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { ArrowRight, Loader2, ShieldCheck } from "lucide-react";

export default function ResetPassword() {
  const [, setLocation] = useLocation();
  const token = new URLSearchParams(window.location.search).get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const reset = trpc.auth.resetPassword.useMutation({
    onSuccess: () => { toast.success("Senha redefinida. Você já pode entrar."); setLocation("/login"); },
    onError: error => toast.error(error.message),
  });
  const validToken = /^[a-f0-9]{64}$/i.test(token);
  return <main className="flex min-h-screen items-center justify-center bg-[#090b10] px-4 py-8 text-white">
    <section className="w-full max-w-md rounded-3xl border border-white/10 bg-[#11141b] p-7 shadow-2xl sm:p-10">
      <div className="flex items-center gap-3"><span className="brand-mark"><span /><span /></span><div><p className="text-xl font-bold">Ticket<span className="text-[#ff4058]">Flow</span></p><p className="text-[9px] uppercase tracking-[.2em] text-slate-500">Fullbrands · Operações</p></div></div>
      <div className="mt-8"><p className="eyebrow text-[#ff6679]">Segurança da conta</p><h1 className="mt-3 text-2xl font-semibold">Criar nova senha</h1><p className="mt-2 text-sm leading-6 text-slate-400">Escolha uma senha com pelo menos 8 caracteres.</p></div>
      {!validToken ? <div className="mt-6 rounded-xl border border-red-400/20 bg-red-400/5 p-4 text-sm text-slate-300">Este link está inválido. Solicite uma nova recuperação na tela de login.<Button className="mt-4 w-full" onClick={() => setLocation("/login")}>Voltar para entrar</Button></div> :
      <form className="mt-6 space-y-4" onSubmit={event => { event.preventDefault(); if (password !== confirmPassword) { toast.error("As senhas não conferem."); return; } reset.mutate({ token, password }); }}>
        <div><label className="field-label !text-slate-300">Nova senha</label><Input className="mt-2 h-12 border-white/10 bg-[#090c12] text-white" type="password" autoComplete="new-password" minLength={8} maxLength={200} value={password} onChange={event => setPassword(event.target.value)} required /></div>
        <div><label className="field-label !text-slate-300">Confirmar nova senha</label><Input className="mt-2 h-12 border-white/10 bg-[#090c12] text-white" type="password" autoComplete="new-password" minLength={8} maxLength={200} value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} required /></div>
        <Button className="h-12 w-full bg-[#ed1b36] text-white hover:bg-[#ff304b]" disabled={reset.isPending || password.length < 8}>{reset.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : <ArrowRight className="mr-2 size-4" />}Salvar nova senha</Button>
      </form>}
      <p className="mt-7 flex items-center justify-center gap-2 text-xs text-slate-500"><ShieldCheck className="size-4 text-[#ff6679]" />Link temporário de uso único</p>
    </section>
  </main>;
}
