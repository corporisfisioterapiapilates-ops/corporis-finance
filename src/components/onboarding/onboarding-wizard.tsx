"use client";

import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Banknote,
  Building2,
  Check,
  ChevronDown,
  ChevronRight,
  Loader2,
  PartyPopper,
  PiggyBank,
  PlusCircle,
  ShieldCheck,
  Sparkles,
  UploadCloud,
} from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import type * as React from "react";
import { useState } from "react";

import { completeOnboarding } from "@/actions/onboarding";
import { MoneyInput } from "@/components/money/money-input";
import { CORPORIS_PLAN_PREVIEW, CORPORIS_PLAN_TOTAL } from "@/lib/chart-of-accounts/corporis-plan";
import { formatBRL } from "@/lib/money";
import { cn } from "@/lib/utils";

type AccountType = "checking" | "savings" | "cash";

const STEP_LABELS = ["Boas-vindas", "Conta bancária", "Plano de contas", "Tudo pronto"];
const ACCOUNT_TYPES: { id: AccountType; label: string; icon: typeof Building2 }[] = [
  { id: "checking", label: "Conta Corrente", icon: Building2 },
  { id: "savings", label: "Poupança", icon: PiggyBank },
  { id: "cash", label: "Caixa Físico", icon: Banknote },
];
const BANKS = ["Itaú", "Nubank", "Bradesco", "Sicoob", "Sicredi", "Outro"];
const COLORS = [
  "#F08353",
  "#ACC095",
  "#D2B06E",
  "#6B635B",
  "#EAD7AC",
  "#C85A3E",
  "#F6A958",
  "#9A9189",
];

export function OnboardingWizard() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [orgName, setOrgName] = useState("");
  const [fullName, setFullName] = useState("");
  const [accType, setAccType] = useState<AccountType>("checking");
  const [accName, setAccName] = useState("");
  const [bank, setBank] = useState(BANKS[0]);
  const [color, setColor] = useState(COLORS[0]);
  const [balance, setBalance] = useState("0.00");
  const [balanceDate, setBalanceDate] = useState("");
  const [openGroup, setOpenGroup] = useState<string | null>("1");

  const step1Valid = orgName.trim().length > 0;
  const step2Valid = accName.trim().length > 0;

  function go(n: number) {
    setError(null);
    setStep(Math.min(Math.max(n, 1), 4));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function finish(target: string) {
    if (pending) return;
    setPending(true);
    setError(null);
    const res = await completeOnboarding({
      orgName,
      fullName,
      account: {
        name: accName,
        type: accType,
        bank_name: bank,
        color,
        opening_balance: balance,
        opening_balance_date: balanceDate || undefined,
      },
    });
    if (!res.ok) {
      setError(res.error);
      setPending(false);
      return;
    }
    router.push(target);
  }

  return (
    <div className="flex min-h-screen flex-col bg-base">
      {/* Header */}
      <header className="flex h-[68px] shrink-0 items-center justify-between border-b border-line px-12">
        <Image
          src="/logo/corporis-logo.png"
          alt="Corporis Fisioterapia & Pilates"
          width={2920}
          height={956}
          className="h-[42px] w-auto"
          priority
        />

        <div className="flex items-center gap-2">
          {STEP_LABELS.map((label, i) => {
            const n = i + 1;
            const state = n < step ? "done" : n === step ? "active" : "upcoming";
            return (
              <div key={label} className="flex items-center gap-2">
                <div className="flex items-center gap-2">
                  <div
                    className={cn(
                      "flex size-8 items-center justify-center rounded-full text-body-sm font-medium transition-all",
                      state === "done" && "bg-success text-white",
                      state === "active" && "bg-orange text-white shadow-focus-orange",
                      state === "upcoming" && "bg-sunken text-ink-tertiary",
                    )}
                  >
                    {state === "done" ? <Check size={14} strokeWidth={3} /> : n}
                  </div>
                  <span
                    className={cn(
                      "hidden text-[12px] font-medium md:inline",
                      state === "active" ? "text-ink" : "text-ink-tertiary",
                    )}
                  >
                    {label}
                  </span>
                </div>
                {n < 4 && (
                  <div
                    className={cn("h-[2px] w-9 rounded-full", n < step ? "bg-success" : "bg-line")}
                  />
                )}
              </div>
            );
          })}
        </div>

        {step < 4 ? (
          <button
            type="button"
            onClick={() => go(4)}
            className="text-body-sm text-ink-tertiary hover:text-ink-secondary"
          >
            Pular configuração →
          </button>
        ) : (
          <div className="w-[140px]" />
        )}
      </header>

      {/* Body */}
      <div className="flex flex-1 items-start justify-center overflow-y-auto px-6 pt-13 pb-10">
        <div className="w-full max-w-[600px] overflow-hidden rounded-[20px] border border-line bg-surface shadow-lg-warm">
          {/* STEP 1 */}
          {step === 1 && (
            <>
              <div
                className="h-2"
                style={{
                  background: "linear-gradient(90deg,#F08353,#F6A958,#D2B06E)",
                }}
              />
              <div className="px-11 py-10">
                <div className="mb-9 text-center">
                  <div className="mx-auto mb-6 flex size-[88px] items-center justify-center rounded-[24px] bg-gradient-to-br from-orange-soft to-warning-soft shadow-md-warm">
                    <Sparkles size={40} strokeWidth={1.2} className="text-orange" />
                  </div>
                  <div className="mb-[10px] font-display text-[30px] lowercase text-ink">
                    bem-vinda à corporis
                  </div>
                  <p className="mx-auto max-w-[420px] text-[15px] leading-[1.65] text-ink-tertiary">
                    Vamos configurar sua conta em{" "}
                    <strong className="text-orange">4 passos rápidos</strong> — leva menos de 3
                    minutos e você já terá controle total do seu caixa.
                  </p>
                </div>

                <Field label="Nome da sua clínica" hint="Como aparecerá nos relatórios e DFC">
                  <input
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                    placeholder="Ex: Corporis Pilates & Fisioterapia"
                    className={inputCls}
                  />
                </Field>
                <Field label="Seu nome">
                  <input
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Ex: Larissa Ferraz"
                    className={inputCls}
                  />
                </Field>

                <div className="mt-7 flex flex-wrap gap-[10px] rounded-xl bg-sunken p-5">
                  {[
                    "Dados seguros e criptografados",
                    "Sem compartilhamento com terceiros",
                    "Pode alterar tudo depois",
                  ].map((t) => (
                    <div
                      key={t}
                      className="flex items-center gap-[7px] text-body-sm text-ink-secondary"
                    >
                      <ShieldCheck size={15} strokeWidth={1.5} className="text-success" />
                      {t}
                    </div>
                  ))}
                </div>

                {error && <ErrorLine msg={error} />}

                <div className="mt-8 flex justify-end">
                  <button
                    type="button"
                    disabled={!step1Valid}
                    onClick={() => go(2)}
                    className={primaryBtn}
                  >
                    Próximo passo
                    <ArrowRight size={16} strokeWidth={2} />
                  </button>
                </div>
              </div>
            </>
          )}

          {/* STEP 2 */}
          {step === 2 && (
            <>
              <div
                className="h-2"
                style={{ background: "linear-gradient(90deg,#ACC095,#D2B06E)" }}
              />
              <div className="px-11 py-10">
                <div className="mb-7">
                  <div className="mb-2 text-[12px] font-medium uppercase tracking-[0.08em] text-orange">
                    Passo 2 de 4
                  </div>
                  <div className="mb-2 font-display text-[26px] lowercase text-ink">
                    cadastrar primeira conta
                  </div>
                  <p className="text-body text-ink-tertiary">
                    Adicione a conta bancária principal da sua clínica. Você pode adicionar mais
                    depois.
                  </p>
                </div>

                <Group label="Tipo de conta">
                  <div className="grid grid-cols-3 gap-[10px]">
                    {ACCOUNT_TYPES.map((t) => {
                      const Icon = t.icon;
                      const active = accType === t.id;
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setAccType(t.id)}
                          className={cn(
                            "rounded-[9px] border-[1.5px] p-3 text-center transition-all",
                            active
                              ? "border-orange bg-orange-soft"
                              : "border-line hover:border-line-strong",
                          )}
                        >
                          <Icon
                            size={20}
                            strokeWidth={1.5}
                            className={cn(
                              "mx-auto mb-[6px]",
                              active ? "text-orange" : "text-ink-tertiary",
                            )}
                          />
                          <div
                            className={cn(
                              "text-[12px] font-medium",
                              active ? "text-ink" : "text-ink-tertiary",
                            )}
                          >
                            {t.label}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </Group>

                <div className="grid grid-cols-2 gap-md">
                  <Field label="Nome da conta">
                    <input
                      value={accName}
                      onChange={(e) => setAccName(e.target.value)}
                      placeholder="Ex: Itaú PJ"
                      className={inputCls}
                    />
                  </Field>
                  <Field label="Banco">
                    <select
                      value={bank}
                      onChange={(e) => setBank(e.target.value)}
                      className={cn(inputCls, "cursor-pointer")}
                    >
                      {BANKS.map((b) => (
                        <option key={b}>{b}</option>
                      ))}
                    </select>
                  </Field>
                </div>

                <Group label="Cor de identificação">
                  <div className="flex flex-wrap gap-[10px]">
                    {COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        aria-label={`Cor ${c}`}
                        onClick={() => setColor(c)}
                        style={{ background: c }}
                        className={cn(
                          "size-[34px] rounded-full border-[2.5px] transition-transform",
                          color === c
                            ? "scale-110 border-ink"
                            : "border-transparent hover:scale-105",
                        )}
                      />
                    ))}
                  </div>
                </Group>

                <Field label="Saldo inicial" hint="Saldo da conta na data de início (abaixo)">
                  <MoneyInput value={balance} onValueChange={setBalance} />
                </Field>
                <Field
                  label="Data de início"
                  hint="Lançamentos anteriores a esta data não serão considerados"
                >
                  <input
                    type="date"
                    value={balanceDate}
                    onChange={(e) => setBalanceDate(e.target.value)}
                    className={inputCls}
                  />
                </Field>

                {error && <ErrorLine msg={error} />}

                <div className="mt-8 flex items-center justify-between">
                  <button type="button" onClick={() => go(1)} className={secondaryBtn}>
                    <ArrowLeft size={15} strokeWidth={2} />
                    Voltar
                  </button>
                  <button
                    type="button"
                    disabled={!step2Valid}
                    onClick={() => go(3)}
                    className={primaryBtn}
                  >
                    Próximo passo
                    <ArrowRight size={16} strokeWidth={2} />
                  </button>
                </div>
              </div>
            </>
          )}

          {/* STEP 3 */}
          {step === 3 && (
            <>
              <div
                className="h-2"
                style={{ background: "linear-gradient(90deg,#D2B06E,#EAD7AC)" }}
              />
              <div className="px-11 py-10">
                <div className="mb-6">
                  <div className="mb-2 text-[12px] font-medium uppercase tracking-[0.08em] text-orange">
                    Passo 3 de 4
                  </div>
                  <div className="mb-2 font-display text-[26px] lowercase text-ink">
                    plano de contas
                  </div>
                  <p className="text-body text-ink-tertiary">
                    A Corporis já preparou um plano de contas ideal para clínicas de fisio e
                    pilates. Revise antes de continuar.
                  </p>
                </div>

                <div className="mb-5 flex items-center gap-[9px] rounded-lg border border-beige bg-warning-soft px-[14px] py-[10px]">
                  <Sparkles size={15} strokeWidth={1.5} className="shrink-0 text-beige" />
                  <span className="text-body-sm text-ink-secondary">
                    {CORPORIS_PLAN_TOTAL} categorias criadas especificamente para clínicas de
                    fisioterapia e pilates.
                  </span>
                </div>

                <div className="max-h-[340px] overflow-y-auto rounded-[10px] border-[1.5px] border-line bg-base">
                  {CORPORIS_PLAN_PREVIEW.map((g) => {
                    const open = openGroup === g.code;
                    return (
                      <div key={g.code}>
                        <button
                          type="button"
                          onClick={() => setOpenGroup(open ? null : g.code)}
                          className="flex w-full items-center gap-[10px] border-b border-line bg-sunken px-[14px] py-[11px] text-[12px] font-medium uppercase tracking-[0.07em] text-ink-secondary hover:bg-line/40"
                        >
                          {open ? (
                            <ChevronDown size={14} strokeWidth={2} />
                          ) : (
                            <ChevronRight size={14} strokeWidth={2} />
                          )}
                          <span style={{ color: g.swatch }}>■</span>
                          {g.code}. {g.name}
                          <span className="ml-auto text-[11px] font-normal text-ink-tertiary">
                            {g.count} contas
                          </span>
                        </button>
                        {open &&
                          g.sample.map((s) => (
                            <div
                              key={s.code}
                              className="flex items-center gap-[10px] border-b border-line/60 bg-surface py-[9px] pr-[14px] pl-[38px] text-body-sm text-ink"
                            >
                              <span className="w-12 shrink-0 tabular-nums text-[11px] text-ink-tertiary">
                                {s.code}
                              </span>
                              {s.name}
                              <span
                                className={cn(
                                  "ml-auto rounded-sm px-[7px] py-[2px] text-[10px] font-medium uppercase tracking-[0.06em]",
                                  g.nature === "income"
                                    ? "bg-success-soft text-success"
                                    : "bg-danger-soft text-danger",
                                )}
                              >
                                {g.nature === "income" ? "Entrada" : "Saída"}
                              </span>
                            </div>
                          ))}
                      </div>
                    );
                  })}
                </div>

                {error && <ErrorLine msg={error} />}

                <div className="mt-7 flex items-center justify-between">
                  <button type="button" onClick={() => go(2)} className={secondaryBtn}>
                    <ArrowLeft size={15} strokeWidth={2} />
                    Voltar
                  </button>
                  <button type="button" onClick={() => go(4)} className={primaryBtn}>
                    Ficou ótimo, próximo!
                    <ArrowRight size={16} strokeWidth={2} />
                  </button>
                </div>
              </div>
            </>
          )}

          {/* STEP 4 */}
          {step === 4 && (
            <>
              <div
                className="h-2"
                style={{
                  background: "linear-gradient(90deg,#ACC095,#F08353,#D2B06E)",
                }}
              />
              <div className="px-11 py-10 text-center">
                <div className="mx-auto mb-6 flex size-24 items-center justify-center rounded-full bg-gradient-to-br from-success-soft to-orange-soft shadow-lg-warm">
                  <PartyPopper size={44} strokeWidth={1.2} className="text-orange" />
                </div>
                <div className="mb-[10px] font-display text-[30px] lowercase text-ink">
                  tudo pronto{fullName ? `, ${fullName.split(" ")[0]}` : ""}!
                </div>
                <p className="mx-auto mb-9 max-w-[400px] text-[15px] leading-[1.65] text-ink-tertiary">
                  Sua conta está configurada. Escolha como quer começar — você pode fazer os dois
                  depois.
                </p>

                <div className="mb-8 rounded-xl bg-sunken p-5 text-left">
                  <div className="mb-3 text-[12px] font-medium uppercase tracking-[0.07em] text-ink-tertiary">
                    Configurado agora
                  </div>
                  <div className="flex flex-col gap-2">
                    <SummaryLine>
                      Clínica: <strong className="text-ink">{orgName || "—"}</strong>
                    </SummaryLine>
                    <SummaryLine>
                      Conta:{" "}
                      <strong className="text-ink">
                        {accName || "—"} — {formatBRL(balance)}
                      </strong>
                    </SummaryLine>
                    <SummaryLine>
                      Plano de contas:{" "}
                      <strong className="text-ink">{CORPORIS_PLAN_TOTAL} categorias</strong>
                    </SummaryLine>
                  </div>
                </div>

                {error && <ErrorLine msg={error} />}

                <div className="mb-6 flex gap-[14px]">
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => finish("/importacoes")}
                    className="flex flex-1 flex-col items-center gap-3 rounded-xl border-[1.5px] border-line p-5 transition-all hover:-translate-y-0.5 hover:border-orange hover:bg-orange-soft disabled:opacity-60"
                  >
                    <span className="flex size-[52px] items-center justify-center rounded-[14px] bg-orange-soft">
                      <UploadCloud size={26} strokeWidth={1.5} className="text-orange" />
                    </span>
                    <span>
                      <span className="block text-body font-medium text-ink">Importar extrato</span>
                      <span className="mt-1 block text-body-sm text-ink-tertiary">
                        Suba OFX/PDF e deixe a IA categorizar
                      </span>
                    </span>
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => finish("/lancamentos")}
                    className="flex flex-1 flex-col items-center gap-3 rounded-xl border-[1.5px] border-line p-5 transition-all hover:-translate-y-0.5 hover:border-success hover:bg-success-soft disabled:opacity-60"
                  >
                    <span className="flex size-[52px] items-center justify-center rounded-[14px] bg-success-soft">
                      <PlusCircle size={26} strokeWidth={1.5} className="text-success" />
                    </span>
                    <span>
                      <span className="block text-body font-medium text-ink">
                        Lançar manualmente
                      </span>
                      <span className="mt-1 block text-body-sm text-ink-tertiary">
                        Adicione lançamentos um a um
                      </span>
                    </span>
                  </button>
                </div>

                <button
                  type="button"
                  disabled={pending}
                  onClick={() => finish("/dashboard")}
                  className="inline-flex items-center gap-2 text-body-sm text-ink-tertiary underline underline-offset-[3px] hover:text-ink-secondary disabled:opacity-60"
                >
                  {pending && <Loader2 size={14} strokeWidth={1.5} className="animate-spin" />}
                  Explorar o dashboard primeiro
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="h-1 shrink-0 bg-line">
        <div
          className="h-full rounded-full bg-gradient-to-r from-orange to-tangerine transition-all duration-500"
          style={{ width: `${(step / 4) * 100}%` }}
        />
      </div>
    </div>
  );
}

const inputCls =
  "w-full rounded-[10px] border-[1.5px] border-line bg-base px-[14px] py-3 text-body text-ink placeholder:text-ink-tertiary focus:border-orange focus:bg-surface focus:shadow-focus-orange focus:outline-none";
const primaryBtn =
  "inline-flex items-center gap-[9px] rounded-[10px] bg-orange px-7 py-[13px] text-[15px] font-medium text-white transition-all hover:bg-tangerine hover:-translate-y-px disabled:cursor-not-allowed disabled:opacity-50";
const secondaryBtn =
  "inline-flex items-center gap-[7px] rounded-[10px] border-[1.5px] border-line px-5 py-[13px] text-body text-ink-tertiary transition-all hover:border-line-strong hover:text-ink-secondary";

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: Field sempre envolve um input/select/MoneyInput
    <label className="mb-5 flex flex-col gap-[6px]">
      <span className="text-[12px] font-medium uppercase tracking-[0.07em] text-ink-secondary">
        {label}
      </span>
      {children}
      {hint && <span className="text-[12px] text-ink-tertiary">{hint}</span>}
    </label>
  );
}

// Grupos de botões (sem input): fieldset/legend é o semântico correto.
function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <fieldset className="mb-5 flex flex-col gap-[6px] border-0 p-0">
      <legend className="mb-[6px] text-[12px] font-medium uppercase tracking-[0.07em] text-ink-secondary">
        {label}
      </legend>
      {children}
    </fieldset>
  );
}

function ErrorLine({ msg }: { msg: string }) {
  return (
    <div className="mt-4 flex items-center gap-[6px] text-body-sm text-danger">
      <AlertCircle size={14} strokeWidth={2} />
      {msg}
    </div>
  );
}

function SummaryLine({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-[10px] text-body-sm text-ink-secondary">
      <Check size={15} strokeWidth={1.5} className="shrink-0 text-success" />
      {children}
    </div>
  );
}
