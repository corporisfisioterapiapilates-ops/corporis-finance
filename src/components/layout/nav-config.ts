import type { LucideIcon } from "lucide-react";
import {
  ArrowLeftRight,
  LayoutDashboard,
  LineChart,
  ListTree,
  Settings,
  Sparkles,
  Target,
  TrendingUp,
  Upload,
  Wallet,
} from "lucide-react";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  badge?: string;
};

export type NavSection = { title: string; items: NavItem[] };

// Ordem fiel ao mockup 01-dashboard.html (sidebar).
export const NAV_SECTIONS: NavSection[] = [
  {
    title: "Geral",
    items: [
      { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
      { label: "Lançamentos", href: "/lancamentos", icon: ArrowLeftRight },
      { label: "Contas e Cartões", href: "/contas", icon: Wallet },
    ],
  },
  {
    title: "Análise",
    items: [
      { label: "DFC", href: "/dfc", icon: TrendingUp },
      { label: "Orçado x Realizado", href: "/orcamento", icon: Target },
      { label: "Projeção de Caixa", href: "/projecao", icon: LineChart },
    ],
  },
  {
    title: "Assistente",
    items: [
      {
        label: "Consultor IA",
        href: "/consultor",
        icon: Sparkles,
        badge: "beta",
      },
    ],
  },
  {
    title: "Configurações",
    items: [
      { label: "Plano de Contas", href: "/plano-de-contas", icon: ListTree },
      { label: "Importações", href: "/importacoes", icon: Upload },
      { label: "Configurações", href: "/configuracoes", icon: Settings },
    ],
  },
];
