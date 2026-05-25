"use client";

import {
  AlertTriangle,
  Calendar,
  CalendarClock,
  Check,
  CheckCircle,
  CreditCard,
  Download,
  File,
  FileSpreadsheet,
  FileText,
  KeyRound,
  Landmark,
  Shield,
  Sparkles,
  Star,
  Trash2,
  TrendingDown,
  UploadCloud,
  XCircle,
} from "lucide-react";
import { useState, useTransition } from "react";

import { requestPasswordReset } from "@/actions/auth";
import { type OrganizationSettingsInput, updateOrganizationSettings } from "@/actions/settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type SettingsManagerProps = {
  email: string;
  fullName: string;
  organization: {
    name: string;
    locale: string;
    timezone: string;
    currency: string;
  };
};

const SETTINGS_SECTIONS = [
  { id: "perfil", label: "Perfil e clínica", group: "Conta", color: "bg-orange" },
  { id: "plano", label: "Plano e cobrança", group: "Conta", color: "bg-gold" },
  { id: "seguranca", label: "Segurança e acesso", group: "Conta", color: "bg-ink-tertiary" },
  { id: "aparencia", label: "Aparência", group: "Preferências", color: "bg-green" },
  { id: "notificacoes", label: "Notificações", group: "Preferências", color: "bg-orange-light" },
  { id: "financeiro", label: "Preferências financeiras", group: "Preferências", color: "bg-ink" },
  { id: "integracoes", label: "Integrações", group: "Dados", color: "bg-danger" },
  { id: "exportar", label: "Exportar dados", group: "Dados", color: "bg-ink-tertiary" },
  { id: "perigo", label: "Zona de perigo", group: "Avançado", color: "bg-danger" },
] as const;

const BACKLOG_SETTINGS_SECTIONS_ENABLED = false;
const ACTIVE_SETTINGS_SECTION_IDS = new Set(["perfil", "seguranca"]);
// Seções já desenhadas, mas ainda sem comportamento completo. Mantidas ocultas até virarem feature real.

const THEME_SWATCHES = [
  { name: "Laranja Corporis", color: "bg-orange" },
  { name: "Verde Salva", color: "bg-green" },
  { name: "Bege Dourado", color: "bg-gold" },
  { name: "Terra", color: "bg-ink-secondary" },
  { name: "Azul Sereno", color: "bg-[#5B7FA6]" },
  { name: "Lilás", color: "bg-[#7B61C4]" },
] as const;

export function SettingsManager({ email, fullName, organization }: SettingsManagerProps) {
  const [activeSection, setActiveSection] = useState("perfil");
  const [toast, setToast] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState<OrganizationSettingsInput>({
    full_name: fullName || "Usuária Corporis",
    organization_name: organization.name,
    locale: "pt-BR",
    timezone: "America/Sao_Paulo",
    currency: "BRL",
  });
  const [selectedTheme, setSelectedTheme] = useState("Laranja Corporis");
  const [toggles, setToggles] = useState<Record<string, boolean>>({
    twoFactor: false,
    invoiceApp: true,
    invoiceEmail: true,
    invoicePush: false,
    budgetApp: true,
    budgetEmail: false,
    budgetPush: false,
    importApp: true,
    importEmail: true,
    importPush: true,
    balanceApp: true,
    balanceEmail: true,
    balancePush: true,
    weeklyApp: false,
    weeklyEmail: true,
    weeklyPush: false,
    aiApp: true,
    aiEmail: false,
    aiPush: false,
    includePendingDfc: true,
  });

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(null), 2500);
  }

  function saveProfile() {
    startTransition(async () => {
      const result = await updateOrganizationSettings(form);
      showToast(result.ok ? result.message : result.error);
    });
  }

  function sendPasswordReset() {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("email", email);
      const result = await requestPasswordReset({}, formData);
      showToast(
        result.sent
          ? "Enviamos um link de redefinição para seu e-mail."
          : (result.error ?? "Não foi possível enviar o link agora."),
      );
    });
  }

  function jumpTo(id: string) {
    setActiveSection(id);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function toggle(key: string) {
    setToggles((current) => ({ ...current, [key]: !current[key] }));
  }

  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden rounded-xl border border-line bg-surface shadow-sm-warm">
      <nav className="hidden w-[220px] shrink-0 overflow-y-auto border-r border-line bg-base px-sm py-lg lg:block">
        {groupedSections(visibleSections()).map(([group, sections]) => (
          <div key={group}>
            <div className="px-sm pt-md pb-xs text-[10px] font-medium tracking-[0.1em] text-ink-tertiary uppercase first:pt-0">
              {group}
            </div>
            {sections.map((section) => (
              <button
                key={section.id}
                type="button"
                onClick={() => jumpTo(section.id)}
                className={cn(
                  "mb-[2px] flex w-full items-center gap-sm rounded-lg px-sm py-[9px] text-left text-body-sm text-ink-secondary transition-colors hover:bg-sunken",
                  activeSection === section.id && "bg-orange-soft font-medium text-orange",
                )}
              >
                <span className={cn("size-[7px] rounded-full", section.color)} />
                {section.label}
              </button>
            ))}
          </div>
        ))}
      </nav>

      <div className="min-w-0 flex-1 overflow-y-auto px-lg py-xl lg:px-2xl">
        <SettingsSection
          id="perfil"
          title="perfil e clínica"
          subtitle="Informações pessoais e da sua clínica. Aparecem nos relatórios e exportações."
        >
          <SettingRow label="Nome completo" description="Seu nome como proprietária da clínica.">
            <Input
              value={form.full_name}
              onChange={(event) =>
                setForm((current) => ({ ...current, full_name: event.target.value }))
              }
              className="w-[240px]"
            />
          </SettingRow>

          <SettingRow label="E-mail" description="Usado para login e notificações.">
            <div className="flex flex-wrap items-center gap-sm">
              <Input value={email} readOnly className="w-[240px] bg-base" />
              <span className="inline-flex items-center gap-[3px] text-meta font-medium text-success">
                <CheckCircle size={12} strokeWidth={2} />
                Verificado
              </span>
            </div>
          </SettingRow>

          <SettingRow
            label="Nome da clínica"
            description="Aparece no cabeçalho dos relatórios exportados."
          >
            <Input
              value={form.organization_name}
              onChange={(event) =>
                setForm((current) => ({ ...current, organization_name: event.target.value }))
              }
              className="w-[280px]"
            />
          </SettingRow>

          <SettingRow
            label="Cidade e estado"
            description="Usada para fuso horário e relatórios regionais."
          >
            <div className="grid w-[280px] grid-cols-[1fr_80px] gap-sm">
              <Input value="Xanxerê" readOnly className="bg-base" />
              <Select value="SC" onChange={() => undefined}>
                <option>SC</option>
              </Select>
            </div>
          </SettingRow>

          <SettingRow
            label="Idioma, moeda e fuso"
            description="Base usada em datas, valores e exportações."
          >
            <div className="grid w-[280px] gap-sm">
              <Select
                value={form.locale}
                onChange={(locale) =>
                  setForm((current) => ({ ...current, locale: locale as "pt-BR" }))
                }
              >
                <option value="pt-BR">Português (Brasil)</option>
              </Select>
              <Select
                value={form.currency}
                onChange={(currency) =>
                  setForm((current) => ({ ...current, currency: currency as "BRL" }))
                }
              >
                <option value="BRL">Real brasileiro (BRL)</option>
              </Select>
              <Select
                value={form.timezone}
                onChange={(timezone) =>
                  setForm((current) => ({ ...current, timezone: timezone as "America/Sao_Paulo" }))
                }
              >
                <option value="America/Sao_Paulo">America/Sao_Paulo</option>
              </Select>
            </div>
          </SettingRow>

          <div className="mt-md flex justify-end gap-sm">
            <Button type="button" variant="ghost" className="border border-line">
              Descartar
            </Button>
            <Button type="button" onClick={saveProfile} disabled={isPending}>
              <Check size={14} strokeWidth={2} />
              Salvar perfil
            </Button>
          </div>
        </SettingsSection>

        <SectionDivider />

        {BACKLOG_SETTINGS_SECTIONS_ENABLED ? (
          <>
            <SettingsSection
              id="plano"
              title="plano e cobrança"
              subtitle="Gerencie sua assinatura Corporis Finance."
            >
              <div className="mb-lg flex flex-wrap items-center gap-lg rounded-xl border border-line bg-surface p-lg">
                <div className="flex size-[52px] items-center justify-center rounded-[14px] bg-gradient-to-br from-orange to-gold text-white">
                  <Star size={24} strokeWidth={1.5} />
                </div>
                <div className="min-w-[220px] flex-1">
                  <div className="mb-xs flex items-center gap-sm">
                    <div className="text-[16px] font-semibold text-ink">Corporis Pro</div>
                    <span className="rounded-full border border-gold bg-warning-soft px-sm py-xs text-meta font-medium text-warning">
                      Ativo
                    </span>
                  </div>
                  <p className="text-body-sm text-ink-tertiary">Cobrança mensal · R$ 97/mês</p>
                  <p className="mt-[2px] text-body-sm text-ink-tertiary">
                    Cartão cadastrado no portal de cobrança
                  </p>
                </div>
                <div className="flex flex-col gap-sm">
                  <Button type="button" variant="ghost" className="border border-line">
                    <CreditCard size={13} strokeWidth={1.5} />
                    Alterar cartão
                  </Button>
                  <Button type="button" variant="ghost" className="text-ink-tertiary">
                    <FileText size={13} strokeWidth={1.5} />
                    Ver faturas
                  </Button>
                </div>
              </div>

              <div className="mb-lg rounded-lg bg-base p-md">
                <div className="mb-sm text-label font-medium tracking-[0.07em] text-ink-tertiary uppercase">
                  Incluído no seu plano
                </div>
                <div className="grid gap-sm md:grid-cols-2">
                  {[
                    "DFC, Orçado x Realizado, Projeção",
                    "Importação OFX, CSV e PDF",
                    "Categorização automática por IA",
                    "Consultor IA (beta)",
                    "Exportação CSV e JSON",
                    "Suporte por e-mail prioritário",
                  ].map((item) => (
                    <div
                      key={item}
                      className="flex items-center gap-xs text-body-sm text-ink-secondary"
                    >
                      <CheckCircle size={14} strokeWidth={1.5} className="text-success" />
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            </SettingsSection>

            <SectionDivider />
          </>
        ) : null}

        <SettingsSection
          id="seguranca"
          title="segurança e acesso"
          subtitle="Senha, autenticação de dois fatores e sessões ativas."
        >
          <SettingRow
            label="Senha"
            description="Use a recuperação de senha por e-mail para trocar suas credenciais."
          >
            <Button
              type="button"
              variant="ghost"
              className="border border-line"
              onClick={sendPasswordReset}
              disabled={isPending}
            >
              <KeyRound size={13} strokeWidth={1.5} />
              Enviar redefinição
            </Button>
          </SettingRow>
          <SettingRow
            label="Autenticação de dois fatores (2FA)"
            description="Funcionalidade planejada para uma etapa futura."
          >
            <div className="flex items-center gap-sm text-body-sm text-ink-tertiary">
              Em breve
              <Toggle enabled={false} disabled />
            </div>
          </SettingRow>
        </SettingsSection>

        <SectionDivider />

        {BACKLOG_SETTINGS_SECTIONS_ENABLED ? (
          <>
            <SettingsSection
              id="aparencia"
              title="aparência"
              subtitle="Personalize a interface da Corporis."
            >
              <SettingRow
                label="Tema de cor"
                description="Cor de destaque usada em botões, links e KPIs."
              >
                <div className="flex flex-wrap gap-sm">
                  {THEME_SWATCHES.map((swatch) => (
                    <button
                      key={swatch.name}
                      type="button"
                      title={swatch.name}
                      onClick={() => {
                        setSelectedTheme(swatch.name);
                        showToast("Tema atualizado.");
                      }}
                      className={cn(
                        "flex size-10 items-center justify-center rounded-[10px] border-[2.5px] border-transparent transition-transform hover:scale-105",
                        swatch.color,
                        selectedTheme === swatch.name && "scale-110 border-ink",
                      )}
                    />
                  ))}
                </div>
              </SettingRow>
              <SettingRow label="Modo escuro" description="Disponível em breve.">
                <div className="flex items-center gap-sm text-body-sm text-ink-tertiary">
                  Em breve
                  <Toggle enabled={false} disabled />
                </div>
              </SettingRow>
              <SettingRow
                label="Densidade da tabela"
                description="Controla o espaçamento das linhas nas tabelas."
              >
                <Select value="comfortable" onChange={() => showToast("Preferência atualizada.")}>
                  <option value="comfortable">Confortável</option>
                  <option value="compact">Compacta</option>
                  <option value="spacious">Espaçada</option>
                </Select>
              </SettingRow>
            </SettingsSection>

            <SectionDivider />

            <SettingsSection
              id="notificacoes"
              title="notificações"
              subtitle="Escolha quando e como a Corporis deve te alertar."
            >
              <div className="mb-xs flex items-center gap-sm border-b border-line py-sm">
                <div className="flex-1 text-label font-medium tracking-[0.07em] text-ink-tertiary uppercase">
                  Evento
                </div>
                <div className="grid w-[168px] grid-cols-3 gap-md text-center text-label font-medium tracking-[0.07em] text-ink-tertiary uppercase">
                  <span>App</span>
                  <span>E-mail</span>
                  <span>Push</span>
                </div>
              </div>
              <NotificationRow
                icon={CalendarClock}
                tone="orange"
                title="Vencimento de fatura de cartão"
                subtitle="3 dias antes do vencimento de cada fatura"
                keys={["invoiceApp", "invoiceEmail", "invoicePush"]}
                toggles={toggles}
                onToggle={toggle}
              />
              <NotificationRow
                icon={TrendingDown}
                tone="danger"
                title="Desvio do orçado"
                subtitle="Quando uma categoria ultrapassa o orçado em +20%"
                keys={["budgetApp", "budgetEmail", "budgetPush"]}
                toggles={toggles}
                onToggle={toggle}
              />
              <NotificationRow
                icon={UploadCloud}
                tone="green"
                title="Importação concluída"
                subtitle="Quando um extrato ou fatura termina de ser processado"
                keys={["importApp", "importEmail", "importPush"]}
                toggles={toggles}
                onToggle={toggle}
              />
              <NotificationRow
                icon={AlertTriangle}
                tone="gold"
                title="Saldo baixo"
                subtitle="Quando o saldo de alguma conta cair abaixo de R$ 5.000"
                keys={["balanceApp", "balanceEmail", "balancePush"]}
                toggles={toggles}
                onToggle={toggle}
              />
              <NotificationRow
                icon={Calendar}
                tone="neutral"
                title="Resumo semanal"
                subtitle="Relatório de entradas, saídas e resultado toda segunda às 8h"
                keys={["weeklyApp", "weeklyEmail", "weeklyPush"]}
                toggles={toggles}
                onToggle={toggle}
              />
              <NotificationRow
                icon={Sparkles}
                tone="neutral"
                title="Insights da IA"
                subtitle="Quando o Consultor IA detectar anomalias ou oportunidades"
                keys={["aiApp", "aiEmail", "aiPush"]}
                toggles={toggles}
                onToggle={toggle}
              />
            </SettingsSection>

            <SectionDivider />

            <SettingsSection
              id="financeiro"
              title="preferências financeiras"
              subtitle="Parâmetros que afetam cálculos de DFC, projeções e alertas."
            >
              <SettingRow
                label="Saldo mínimo de caixa"
                description="Abaixo deste valor a Corporis emite alerta de saldo baixo."
              >
                <div className="flex items-center gap-sm">
                  <span className="font-display text-body text-ink-tertiary">R$</span>
                  <Input defaultValue="5.000,00" className="w-[120px] text-right" />
                </div>
              </SettingRow>
              <SettingRow
                label="Horizonte padrão de projeção"
                description="Número de meses exibidos por padrão na Projeção de Caixa."
              >
                <Select value="6" onChange={() => undefined}>
                  <option value="3">3 meses</option>
                  <option value="6">6 meses</option>
                  <option value="12">12 meses</option>
                </Select>
              </SettingRow>
              <SettingRow
                label="Cenário padrão de projeção"
                description="Cenário exibido ao abrir a Projeção de Caixa."
              >
                <Select value="realistic" onChange={() => undefined}>
                  <option value="conservative">Conservador</option>
                  <option value="realistic">Realista</option>
                  <option value="optimistic">Otimista</option>
                </Select>
              </SettingRow>
              <SettingRow
                label="Mostrar lançamentos pendentes no DFC"
                description="Inclui itens com status Pendente no fluxo de caixa."
              >
                <Toggle
                  enabled={Boolean(toggles.includePendingDfc)}
                  onClick={() => toggle("includePendingDfc")}
                />
              </SettingRow>
            </SettingsSection>

            <SectionDivider />

            <SettingsSection
              id="integracoes"
              title="integrações"
              subtitle="Conecte a Corporis com outras ferramentas."
            >
              <IntegrationCard
                icon={Landmark}
                title="Open Finance (Banco Central)"
                subtitle="Importação automática de extratos via Open Finance BR"
                status="Disponível em breve"
              />
              <IntegrationCard
                icon={FileSpreadsheet}
                title="Google Sheets"
                subtitle="Exportar relatórios automaticamente para uma planilha"
                status="Conectado"
                connected
              />
              <IntegrationCard
                icon={Calendar}
                title="Google Calendar"
                subtitle="Adicionar vencimentos automaticamente ao calendário"
                status="Disponível"
                action="Conectar"
              />
              <IntegrationCard
                icon={Shield}
                title="Regras de IA"
                subtitle="Padrões aprendidos para categorização de importações"
                status="Ativo"
                connected
              />
            </SettingsSection>

            <SectionDivider />

            <SettingsSection
              id="exportar"
              title="exportar dados"
              subtitle="Baixe seus dados financeiros em diferentes formatos."
            >
              <div className="grid gap-md md:grid-cols-3">
                <ExportCard
                  icon={FileSpreadsheet}
                  title="DFC completo (.csv)"
                  subtitle="Todos os meses do ano em planilha"
                />
                <ExportCard
                  icon={FileText}
                  title="Lançamentos (.csv)"
                  subtitle="Todos os lançamentos do período"
                />
                <ExportCard
                  icon={File}
                  title="Backup completo (.json)"
                  subtitle="Todos os dados da sua conta"
                />
              </div>
            </SettingsSection>

            <SectionDivider />

            <SettingsSection
              id="perigo"
              title="zona de perigo"
              subtitle="Ações irreversíveis. Proceda com atenção."
            >
              <div className="rounded-xl border border-danger/30 bg-danger-soft p-lg">
                <DangerRow
                  title="Apagar todos os lançamentos"
                  description="Remove todos os lançamentos da sua conta. Plano de contas e contas bancárias são mantidos."
                  action="Apagar lançamentos"
                  icon={Trash2}
                />
                <div className="my-lg h-px bg-danger/20" />
                <DangerRow
                  title="Excluir conta permanentemente"
                  description="Todos os seus dados serão apagados imediatamente e a assinatura cancelada. Exporte seus dados antes de continuar."
                  action="Excluir conta"
                  icon={XCircle}
                />
              </div>
            </SettingsSection>
          </>
        ) : null}
      </div>

      {toast ? (
        <div className="fixed bottom-xl left-1/2 z-[60] flex -translate-x-1/2 items-center gap-sm rounded-xl bg-ink px-lg py-sm text-body-sm font-medium text-white shadow-lg">
          <CheckCircle size={18} strokeWidth={1.5} className="text-success" />
          {toast}
        </div>
      ) : null}
    </div>
  );
}

function visibleSections() {
  return BACKLOG_SETTINGS_SECTIONS_ENABLED
    ? SETTINGS_SECTIONS
    : SETTINGS_SECTIONS.filter((section) => ACTIVE_SETTINGS_SECTION_IDS.has(section.id));
}

function groupedSections(sections: readonly (typeof SETTINGS_SECTIONS)[number][]) {
  const groups = new Map<string, (typeof SETTINGS_SECTIONS)[number][]>();
  for (const section of sections) {
    groups.set(section.group, [...(groups.get(section.group) ?? []), section]);
  }
  return Array.from(groups.entries());
}

function SettingsSection({
  id,
  title,
  subtitle,
  children,
}: {
  id: string;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-lg">
      <h2 className="font-display text-h2 lowercase text-ink">{title}</h2>
      <p className="mt-xs mb-lg max-w-[720px] text-body-sm leading-relaxed text-ink-tertiary">
        {subtitle}
      </p>
      {children}
    </section>
  );
}

function SettingRow({
  label,
  description,
  children,
}: {
  label: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-md border-b border-[#F0EEE9] py-lg last:border-b-0 md:flex-row md:items-start md:justify-between">
      <div>
        <div className="mb-[3px] text-body font-medium text-ink">{label}</div>
        <div className="max-w-[420px] text-body-sm leading-relaxed text-ink-tertiary">
          {description}
        </div>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function SectionDivider() {
  return <div className="my-xl h-px bg-line" />;
}

function Select({
  value,
  onChange,
  children,
}: {
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="w-full rounded-lg border border-line bg-surface px-md py-[10px] text-body text-ink outline-none focus:border-orange focus:shadow-focus-orange"
    >
      {children}
    </select>
  );
}

function Toggle({
  enabled,
  onClick,
  disabled = false,
}: {
  enabled: boolean;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "relative h-6 w-11 rounded-full transition-colors disabled:opacity-40",
        enabled ? "bg-orange" : "bg-line-strong",
      )}
    >
      <span
        className={cn(
          "absolute top-[3px] size-[18px] rounded-full bg-white shadow-sm transition-[left]",
          enabled ? "left-[23px]" : "left-[3px]",
        )}
      />
    </button>
  );
}

function NotificationRow({
  icon: Icon,
  tone,
  title,
  subtitle,
  keys,
  toggles,
  onToggle,
}: {
  icon: typeof Calendar;
  tone: "orange" | "danger" | "green" | "gold" | "neutral";
  title: string;
  subtitle: string;
  keys: string[];
  toggles: Record<string, boolean>;
  onToggle: (key: string) => void;
}) {
  const toneClass = {
    orange: "bg-orange-soft text-orange",
    danger: "bg-danger-soft text-danger",
    green: "bg-success-soft text-success",
    gold: "bg-warning-soft text-warning",
    neutral: "bg-sunken text-ink-tertiary",
  }[tone];

  return (
    <div className="flex items-center gap-md border-b border-[#F0EEE9] py-sm last:border-b-0">
      <div className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", toneClass)}>
        <Icon size={17} strokeWidth={1.5} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-body-sm font-medium text-ink">{title}</div>
        <div className="text-meta leading-relaxed text-ink-tertiary">{subtitle}</div>
      </div>
      <div className="grid w-[168px] grid-cols-3 gap-md">
        {keys.map((key) => (
          <div key={key} className="flex justify-center">
            <Toggle enabled={Boolean(toggles[key])} onClick={() => onToggle(key)} />
          </div>
        ))}
      </div>
    </div>
  );
}

function IntegrationCard({
  icon: Icon,
  title,
  subtitle,
  status,
  connected = false,
  action,
}: {
  icon: typeof Landmark;
  title: string;
  subtitle: string;
  status: string;
  connected?: boolean;
  action?: string;
}) {
  return (
    <div className="mb-sm flex flex-wrap items-center gap-md rounded-lg border border-line bg-surface px-lg py-md transition-shadow hover:shadow-sm-warm">
      <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-base text-orange">
        <Icon size={21} strokeWidth={1.5} />
      </div>
      <div className="min-w-[220px] flex-1">
        <div className="text-body font-medium text-ink">{title}</div>
        <div className="text-body-sm text-ink-tertiary">{subtitle}</div>
      </div>
      <span
        className={cn(
          "rounded-full px-sm py-xs text-meta font-medium",
          connected ? "bg-success-soft text-success" : "bg-sunken text-ink-tertiary",
        )}
      >
        {status}
      </span>
      {action ? <Button type="button">{action}</Button> : null}
    </div>
  );
}

function ExportCard({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: typeof File;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex flex-col gap-sm rounded-lg border border-line bg-surface p-lg">
      <div className="flex size-9 items-center justify-center rounded-lg bg-success-soft text-success">
        <Icon size={18} strokeWidth={1.5} />
      </div>
      <div>
        <div className="mb-[3px] text-body-sm font-medium text-ink">{title}</div>
        <div className="text-meta text-ink-tertiary">{subtitle}</div>
      </div>
      <Button type="button" variant="ghost" className="border border-line">
        <Download size={13} strokeWidth={1.5} />
        Baixar
      </Button>
    </div>
  );
}

function DangerRow({
  title,
  description,
  action,
  icon: Icon,
}: {
  title: string;
  description: string;
  action: string;
  icon: typeof Trash2;
}) {
  return (
    <div className="flex flex-col gap-md md:flex-row md:items-start md:justify-between">
      <div>
        <div className="mb-xs text-body font-medium text-ink">{title}</div>
        <div className="max-w-[420px] text-body-sm leading-relaxed text-ink-tertiary">
          {description}
        </div>
      </div>
      <Button type="button" variant="ghost" className="border border-danger/40 text-danger">
        <Icon size={13} strokeWidth={1.5} />
        {action}
      </Button>
    </div>
  );
}
