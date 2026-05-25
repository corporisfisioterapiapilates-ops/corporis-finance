"use client";

import { AlertCircle, Eye, EyeOff, Loader2, Lock, LogIn, Mail } from "lucide-react";
import Link from "next/link";
import { useActionState, useState } from "react";

import { type AuthState, login, type ResetState, requestPasswordReset } from "@/actions/auth";

export function LoginForm() {
  const [state, formAction, pending] = useActionState<AuthState, FormData>(login, {});
  const [showPwd, setShowPwd] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [reset, resetAction, resetPending] = useActionState<ResetState, FormData>(
    requestPasswordReset,
    {},
  );

  return (
    <div className="relative flex flex-1 items-center justify-center bg-base px-8 py-12 lg:px-16">
      <div className="w-full max-w-[380px]">
        <div className="mb-9">
          <div className="mb-[10px] text-[12px] font-medium uppercase tracking-[0.1em] text-ink-tertiary">
            Bem-vinda de volta
          </div>
          <h1 className="mb-2 font-display text-[30px] lowercase leading-[1.1] text-ink">
            acesse sua conta
          </h1>
          <p className="text-body text-ink-tertiary">Insira seu e-mail e senha para continuar.</p>
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
                  placeholder="larissa@corporis.com.br"
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
                  autoComplete="current-password"
                  placeholder="••••••••••"
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

          <div className="mt-[10px] mb-7 flex items-center justify-end">
            <button
              type="button"
              onClick={() => setShowForgot((v) => !v)}
              className="text-body-sm text-ink-tertiary hover:text-orange"
            >
              Esqueci minha senha
            </button>
          </div>

          <button
            type="submit"
            disabled={pending}
            className="flex w-full items-center justify-center gap-[9px] rounded-[10px] bg-orange px-5 py-[14px] text-[15px] font-medium text-white transition-all hover:bg-tangerine hover:-translate-y-px disabled:opacity-80"
          >
            {pending ? (
              <>
                <Loader2 size={17} strokeWidth={1.5} className="animate-spin" />
                Entrando…
              </>
            ) : (
              <>
                <LogIn size={17} strokeWidth={1.5} />
                Entrar na Corporis
              </>
            )}
          </button>
        </form>

        {showForgot && (
          <div className="mt-6 rounded-[10px] border border-beige bg-warning-soft p-[18px]">
            {reset.sent ? (
              <p className="text-body-sm text-ink-secondary">
                Se houver conta com esse e-mail, enviamos um link de redefinição. Verifique sua
                caixa de entrada.
              </p>
            ) : (
              <form action={resetAction}>
                <div className="mb-1 text-body-sm font-medium text-ink">Recuperar senha</div>
                <div className="mb-3 text-[12px] text-ink-tertiary">
                  Enviaremos um link de redefinição para o e-mail cadastrado.
                </div>
                <div className="flex gap-2">
                  <input
                    name="email"
                    type="email"
                    required
                    placeholder="seu@email.com.br"
                    className="flex-1 rounded-[7px] border border-beige bg-surface px-3 py-[9px] text-body-sm text-ink focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={resetPending}
                    className="whitespace-nowrap rounded-[7px] bg-orange px-[14px] py-[9px] text-body-sm font-medium text-white hover:bg-tangerine disabled:opacity-70"
                  >
                    Enviar link
                  </button>
                </div>
                {reset.error && <div className="mt-2 text-[12px] text-danger">{reset.error}</div>}
              </form>
            )}
          </div>
        )}

        <div className="my-[22px] flex items-center gap-[14px] before:h-px before:flex-1 before:bg-line after:h-px after:flex-1 after:bg-line">
          <span className="whitespace-nowrap text-[12px] text-ink-tertiary">ou continue com</span>
        </div>

        <button
          type="button"
          disabled
          title="Em breve"
          className="flex w-full cursor-not-allowed items-center justify-center gap-[10px] rounded-[10px] border-[1.5px] border-line bg-surface px-5 py-3 text-body text-ink-tertiary"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
            <path
              d="M17.64 9.2045C17.64 8.5664 17.5827 7.9527 17.4764 7.3636H9V10.845H13.8436C13.635 11.97 13.0009 12.9232 12.0477 13.5614V15.8195H14.9564C16.6582 14.2527 17.64 11.9455 17.64 9.2045Z"
              fill="#9A9189"
            />
            <path
              d="M9 18C11.43 18 13.4673 17.1941 14.9564 15.8195L12.0477 13.5614C11.2418 14.1014 10.2109 14.4204 9 14.4204C6.65591 14.4204 4.67182 12.8373 3.96409 10.71H0.957275V13.0418C2.43818 15.9832 5.48182 18 9 18Z"
              fill="#9A9189"
            />
            <path
              d="M3.96409 10.71C3.78409 10.17 3.68182 9.5932 3.68182 9C3.68182 8.4068 3.78409 7.83 3.96409 7.29V4.9582H0.957275C0.347727 6.1732 0 7.5477 0 9C0 10.4523 0.347727 11.8268 0.957275 13.0418L3.96409 10.71Z"
              fill="#9A9189"
            />
            <path
              d="M9 3.5795C10.3214 3.5795 11.5077 4.0336 12.4405 4.9255L15.0218 2.3441C13.4632 0.8918 11.4259 0 9 0C5.48182 0 2.43818 2.0168 0.957275 4.9582L3.96409 7.29C4.67182 5.1627 6.65591 3.5795 9 3.5795Z"
              fill="#9A9189"
            />
          </svg>
          Entrar com Google (em breve)
        </button>

        <div className="mt-7 text-center text-body-sm text-ink-tertiary">
          Ainda não tem uma conta?
          <Link href="/signup" className="ml-1 font-medium text-orange hover:underline">
            Criar conta
          </Link>
        </div>
      </div>

      <div className="absolute bottom-8 left-0 right-0 flex justify-center">
        <p className="text-[12px] text-ink-tertiary">
          © 2025 Corporis Finance · Privacidade · Termos
        </p>
      </div>
    </div>
  );
}
