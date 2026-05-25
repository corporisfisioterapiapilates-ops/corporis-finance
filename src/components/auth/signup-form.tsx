"use client";

import { AlertCircle, Eye, EyeOff, Loader2, Lock, Mail, UserPlus } from "lucide-react";
import Link from "next/link";
import { useActionState, useState } from "react";

import { type AuthState, signup } from "@/actions/auth";

export function SignupForm() {
  const [state, formAction, pending] = useActionState<AuthState, FormData>(signup, {});
  const [showPwd, setShowPwd] = useState(false);

  return (
    <div className="relative flex flex-1 items-center justify-center bg-base px-8 py-12 lg:px-16">
      <div className="w-full max-w-[380px]">
        <div className="mb-9">
          <div className="mb-[10px] text-[12px] font-medium uppercase tracking-[0.1em] text-ink-tertiary">
            Primeiro acesso
          </div>
          <h1 className="mb-2 font-display text-[30px] lowercase leading-[1.1] text-ink">
            criar sua conta
          </h1>
          <p className="text-body text-ink-tertiary">
            Use seu e-mail e defina uma senha para começar.
          </p>
        </div>

        <form action={formAction} noValidate>
          <div className="mb-[10px] flex flex-col gap-md">
            <div className="flex flex-col gap-[6px]">
              <label
                htmlFor="email"
                className="text-[12px] font-medium uppercase tracking-[0.07em] text-ink-secondary"
              >
                E-mail
              </label>
              <div className="relative">
                <Mail
                  size={16}
                  strokeWidth={1.5}
                  className="pointer-events-none absolute top-1/2 left-[14px] -translate-y-1/2 text-ink-tertiary"
                />
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="voce@suaclinica.com.br"
                  className="w-full rounded-[10px] border-[1.5px] border-line bg-surface py-[13px] pr-[14px] pl-[44px] text-body text-ink placeholder:text-ink-tertiary focus:border-orange focus:shadow-focus-orange focus:outline-none"
                />
              </div>
            </div>

            <div className="flex flex-col gap-[6px]">
              <label
                htmlFor="password"
                className="text-[12px] font-medium uppercase tracking-[0.07em] text-ink-secondary"
              >
                Senha
              </label>
              <div className="relative">
                <Lock
                  size={16}
                  strokeWidth={1.5}
                  className="pointer-events-none absolute top-1/2 left-[14px] -translate-y-1/2 text-ink-tertiary"
                />
                <input
                  id="password"
                  name="password"
                  type={showPwd ? "text" : "password"}
                  required
                  autoComplete="new-password"
                  placeholder="mínimo 8 caracteres"
                  className="w-full rounded-[10px] border-[1.5px] border-line bg-surface py-[13px] pr-[44px] pl-[44px] text-body text-ink placeholder:text-ink-tertiary focus:border-orange focus:shadow-focus-orange focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd((v) => !v)}
                  aria-label={showPwd ? "Ocultar senha" : "Mostrar senha"}
                  className="absolute top-1/2 right-3 -translate-y-1/2 rounded-sm p-1 text-ink-tertiary hover:text-ink-secondary"
                >
                  {showPwd ? (
                    <EyeOff size={16} strokeWidth={1.5} />
                  ) : (
                    <Eye size={16} strokeWidth={1.5} />
                  )}
                </button>
              </div>
            </div>
          </div>

          {state.error && (
            <div className="mt-3 flex items-center gap-[5px] text-[12px] text-danger">
              <AlertCircle size={12} strokeWidth={2} />
              {state.error}
            </div>
          )}

          <button
            type="submit"
            disabled={pending}
            className="mt-7 flex w-full items-center justify-center gap-[9px] rounded-[10px] bg-orange px-5 py-[14px] text-[15px] font-medium text-white transition-all hover:bg-tangerine hover:-translate-y-px disabled:opacity-80"
          >
            {pending ? (
              <>
                <Loader2 size={17} strokeWidth={1.5} className="animate-spin" />
                Criando conta…
              </>
            ) : (
              <>
                <UserPlus size={17} strokeWidth={1.5} />
                Criar conta
              </>
            )}
          </button>
        </form>

        <div className="mt-7 text-center text-body-sm text-ink-tertiary">
          Já tem uma conta?
          <Link href="/login" className="ml-1 font-medium text-orange hover:underline">
            Entrar
          </Link>
        </div>
      </div>
    </div>
  );
}
