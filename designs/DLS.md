# DLS.md — Design Language System
## Corporis Finance

> Este arquivo é a referência visual do projeto para o Claude Code.
> Toda decisão de UI — cor, espaçamento, tipografia, componente — começa aqui.
> Se não está aqui, consulte o mockup da tela em `/design/mockups/` antes de inventar.

---

## 1. Paleta de cores

Use **apenas** estas cores. Nenhum azul, roxo, preto puro (#000) ou branco puro (#FFF).

### Cores da marca

| Token | Hex | Uso |
|---|---|---|
| `orange` | `#F08353` | Cor principal — CTAs, links, foco, destaques, saldo positivo |
| `tangerine` | `#F6A958` | Hover do laranja, variações quentes |
| `beige` | `#D2B06E` | Accent dourado — títulos editoriais, dados premium |
| `beige-light` | `#EAD7AC` | Cards de destaque, ícone do logo |
| `green` | `#ACC095` | Entradas, positivo, saúde |
| `gray` | `#D3D2CD` | Bordas, disabled, divisores |

### Neutros derivados (valores fixos — não alterar)

| Token | Hex | Uso |
|---|---|---|
| `bg-base` | `#FAFAF8` | Fundo geral da aplicação |
| `bg-surface` | `#FFFFFF` | Cards, modais, painéis sobre o fundo |
| `bg-sunken` | `#F3F2EE` | Áreas rebaixadas, linhas alternadas de tabela |
| `text-primary` | `#3A3530` | Texto principal |
| `text-secondary` | `#6B635B` | Labels, texto de suporte |
| `text-tertiary` | `#9A9189` | Placeholder, meta-informações |
| `border-subtle` | `#E8E5DF` | Bordas de cards e inputs |
| `border-strong` | `#D3D2CD` | Bordas em hover/focus |

### Cores funcionais (semânticas)

| Token | Hex | Fundo | Uso |
|---|---|---|---|
| `success` | `#7A9264` | `#EEF2E8` | Entradas, valores positivos, variação favorável |
| `danger` | `#C85A3E` | `#FBE9E3` | Saídas, valores negativos, variação desfavorável, erros |
| `warning` | `#D2B06E` | `#F7F0DD` | Alertas, atenção |
| `info` | `#6B635B` | `#F0EEE9` | Informação neutra |

---

## 2. Tipografia

Duas famílias apenas. Nunca usar outra.

### Display & Headlines — Fraunces (substituto de Olicy)

```css
font-family: 'Fraunces', Georgia, serif;
font-weight: 400;
text-transform: lowercase;   /* sempre lowercase em headlines */
letter-spacing: 0.01em;
```

### Body & UI — Ubuntu

```css
font-family: 'Ubuntu', system-ui, sans-serif;
font-weight: 400 - 500;
line-height: 1.55 - 1.65;
```

### Import no `layout.tsx` raiz

```tsx
import { Fraunces, Ubuntu } from 'next/font/google'

const fraunces = Fraunces({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-display',
})

const ubuntu = Ubuntu({
  subsets: ['latin'],
  weight: ['300', '400', '500', '700'],
  variable: '--font-sans',
})
```

### Escala tipográfica

| Nome | Tamanho | Família | Peso | Uso |
|---|---|---|---|---|
| `display-1` | 48px | Fraunces | 400 | Valores R$ gigantes do dashboard |
| `display-2` | 36px | Fraunces | 400 | Títulos de página |
| `h1` | 28px | Fraunces | 400 | Títulos de seção principal |
| `h2` | 22px | Fraunces | 400 | Títulos de card grande |
| `h3` | 18px | Ubuntu | 500 | Títulos de card pequeno, subseções |
| `body-lg` | 16px | Ubuntu | 400 | Corpo padrão |
| `body` | 14px | Ubuntu | 400 | Tabelas, formulários |
| `body-sm` | 13px | Ubuntu | 400 | Texto auxiliar |
| `label` | 12px | Ubuntu | 500 | Labels de campo, cabeçalhos de tabela (uppercase + tracking) |
| `meta` | 11px | Ubuntu | 400 | Meta-informações, timestamps |

**Valores monetários:** sempre `font-variant-numeric: tabular-nums` para alinhar números em tabelas.

---

## 3. Espaçamento

Sistema baseado em múltiplos de 8pt. Use os tokens — não invente valores intermediários.

| Token | Valor | Uso típico |
|---|---|---|
| `xs` | 4px | Entre ícone e label |
| `sm` | 8px | Padding interno de componentes compactos |
| `md` | 16px | Espaçamento padrão entre elementos |
| `lg` | 24px | Margem entre seções relacionadas |
| `xl` | 40px | Separação entre seções principais |
| `2xl` | 64px | Padding de página, margens externas |

---

## 4. Raios de borda

| Token | Valor | Uso |
|---|---|---|
| `radius-sm` | 4px | Badges, tags, chips |
| `radius-md` | 6px | Inputs, cards pequenos |
| `radius-lg` | 8px | Botões, cards médios |
| `radius-xl` | 12px | Cards grandes, modais, painéis |
| `radius-full` | 999px | Pills, avatares, toggles |

---

## 5. Sombras

Sutis e quentes — nunca sombras azuladas ou genéricas.

```css
--shadow-sm:    0 1px 2px rgba(58, 53, 48, 0.04);
--shadow-md:    0 2px 8px rgba(58, 53, 48, 0.06), 0 1px 2px rgba(58, 53, 48, 0.04);
--shadow-lg:    0 8px 24px rgba(58, 53, 48, 0.08), 0 2px 6px rgba(58, 53, 48, 0.04);
--shadow-focus: 0 0 0 3px rgba(240, 131, 83, 0.18);   /* anel de foco laranja */
```

---

## 6. Configuração do Tailwind

Cole em `tailwind.config.ts`:

```ts
import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Marca
        orange:     { DEFAULT: '#F08353', soft: '#FBE9E3' },
        tangerine:  '#F6A958',
        beige:      { DEFAULT: '#D2B06E', light: '#EAD7AC', soft: '#F7F0DD' },
        green:      { DEFAULT: '#ACC095', soft: '#EEF2E8', strong: '#7A9264' },
        // Neutros
        base:       '#FAFAF8',
        surface:    '#FFFFFF',
        sunken:     '#F3F2EE',
        ink: {
          DEFAULT:   '#3A3530',
          secondary: '#6B635B',
          tertiary:  '#9A9189',
        },
        line: {
          DEFAULT: '#E8E5DF',
          strong:  '#D3D2CD',
        },
        // Funcionais
        success:  { DEFAULT: '#7A9264', soft: '#EEF2E8' },
        danger:   { DEFAULT: '#C85A3E', soft: '#FBE9E3' },
        warning:  { DEFAULT: '#D2B06E', soft: '#F7F0DD' },
      },
      fontFamily: {
        display: ['var(--font-display)', 'Georgia', 'serif'],
        sans:    ['var(--font-sans)', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        'display-1': ['48px', { lineHeight: '1.1', letterSpacing: '0.01em' }],
        'display-2': ['36px', { lineHeight: '1.15', letterSpacing: '0.01em' }],
        'h1':        ['28px', { lineHeight: '1.2' }],
        'h2':        ['22px', { lineHeight: '1.25' }],
        'h3':        ['18px', { lineHeight: '1.3' }],
        'body-lg':   ['16px', { lineHeight: '1.6' }],
        'body':      ['14px', { lineHeight: '1.55' }],
        'body-sm':   ['13px', { lineHeight: '1.5' }],
        'label':     ['12px', { lineHeight: '1.4', letterSpacing: '0.08em' }],
        'meta':      ['11px', { lineHeight: '1.4' }],
      },
      borderRadius: {
        sm:   '4px',
        md:   '6px',
        lg:   '8px',
        xl:   '12px',
        full: '999px',
      },
      boxShadow: {
        'sm-warm':     '0 1px 2px rgba(58, 53, 48, 0.04)',
        'md-warm':     '0 2px 8px rgba(58, 53, 48, 0.06), 0 1px 2px rgba(58, 53, 48, 0.04)',
        'lg-warm':     '0 8px 24px rgba(58, 53, 48, 0.08), 0 2px 6px rgba(58, 53, 48, 0.04)',
        'focus-orange':'0 0 0 3px rgba(240, 131, 83, 0.18)',
      },
      spacing: {
        xs:  '4px',
        sm:  '8px',
        md:  '16px',
        lg:  '24px',
        xl:  '40px',
        '2xl': '64px',
      },
    },
  },
  plugins: [],
}

export default config
```

---

## 7. Componentes — especificação

### Button

```tsx
// Variantes: primary | secondary | ghost | danger
// Tamanhos: sm | md (padrão) | lg

// Primary
<button className="
  bg-orange text-white font-sans font-medium text-body
  px-md py-[10px] rounded-lg
  hover:bg-tangerine
  focus-visible:outline-none focus-visible:shadow-focus-orange
  disabled:opacity-40 disabled:cursor-not-allowed
  transition-colors duration-150
">

// Secondary
<button className="
  bg-transparent text-orange border border-orange font-sans font-medium text-body
  px-md py-[10px] rounded-lg
  hover:bg-orange-soft
  focus-visible:shadow-focus-orange
">

// Ghost
<button className="
  bg-transparent text-ink-secondary font-sans font-medium text-body
  px-md py-[10px] rounded-lg
  hover:bg-sunken
  focus-visible:shadow-focus-orange
">
```

### Input

```tsx
<input className="
  w-full bg-surface text-ink border border-line rounded-lg
  px-md py-[10px] text-body font-sans
  placeholder:text-ink-tertiary
  hover:border-line-strong
  focus:outline-none focus:border-orange focus:shadow-focus-orange
  disabled:bg-sunken disabled:cursor-not-allowed
  transition-colors duration-150
" />
```

### Card

```tsx
<div className="
  bg-surface border border-line rounded-xl
  p-lg shadow-sm-warm
">
```

### Badge / CategoryBadge

Mapeamento de cores por grupo do plano de contas:

```tsx
const GROUP_COLORS = {
  '1': { bg: 'bg-success-soft', text: 'text-success' },          // Receita Bruta
  '2': { bg: 'bg-warning-soft', text: 'text-warning' },          // Impostos
  '3': { bg: 'bg-danger-soft',  text: 'text-danger' },           // Custos
  '4': { bg: 'bg-danger-soft',  text: 'text-danger' },           // Despesas Operacionais
  '5': { bg: 'bg-[#F0EEE9]',   text: 'text-ink-secondary' },    // Rec/Desp Financeira
  '6': { bg: 'bg-beige-soft',  text: 'text-beige' },             // Não Operacional
  '7': { bg: 'bg-beige-soft',  text: 'text-beige' },             // Investimento
  '8': { bg: 'bg-orange-soft', text: 'text-orange' },            // Financeiro
} as const

// Badge base
<span className={`
  inline-flex items-center
  px-sm py-xs rounded-sm
  font-sans font-medium text-label uppercase tracking-widest
  ${GROUP_COLORS[group].bg} ${GROUP_COLORS[group].text}
`}>
  {name}
</span>
```

### MoneyDisplay

```tsx
// Sempre tabular-nums. Cor por sinal.
// positivo → text-success | negativo → text-danger | neutro → text-ink

type MoneyDisplayProps = {
  value: number | string   // aceita string do Postgres numeric
  showSign?: boolean       // mostra + explícito em positivos
  size?: 'sm' | 'md' | 'lg' | 'display'
}

// Implementação em src/components/money/money-display.tsx
// Usar src/lib/money.ts:formatBRL() para formatar
```

### KPICard

```tsx
// Card de métrica para o Dashboard
// Estrutura: label (text-label uppercase) | valor (display-2 font-display) | delta (text-sm com seta)

<div className="bg-surface border border-line rounded-xl p-lg shadow-sm-warm">
  <p className="text-label text-ink-tertiary uppercase tracking-widest mb-sm">
    Entradas do Mês
  </p>
  <p className="font-display text-display-2 text-ink lowercase mb-sm tnum">
    R$ 32.450,00
  </p>
  <p className="text-body-sm text-success flex items-center gap-xs">
    <TrendingUp size={14} strokeWidth={1.5} />
    +12% vs. outubro
  </p>
</div>
```

### Sidebar

```tsx
// Largura: 240px expandida | 64px colapsada
// Fundo: bg-base | Borda direita: border-r border-line
// Logo: topo, p-lg

// Item de menu
<a className="
  flex items-center gap-md
  px-md py-[10px] rounded-lg mx-sm
  text-body text-ink-secondary font-sans
  hover:bg-sunken hover:text-ink
  transition-colors duration-150
  // Ativo:
  [&.active]:bg-orange-soft [&.active]:text-orange
  [&.active]:border-l-[3px] [&.active]:border-orange [&.active]:pl-[13px]
">
  <Icon size={18} strokeWidth={1.5} />
  <span>Dashboard</span>
</a>

// Label de seção
<p className="
  text-meta text-ink-tertiary uppercase tracking-[0.1em] font-sans font-medium
  px-md pt-lg pb-xs
">
  Análise
</p>
```

**Itens do menu (ordem fixa, não alterar):**

```
── GERAL ──
Dashboard               /dashboard              (LayoutDashboard)
Lançamentos             /lancamentos            (ArrowLeftRight)
Contas e Cartões        /contas                 (Wallet)

── ANÁLISE ──
DFC                     /dfc                    (TrendingUp)
Orçado x Realizado      /orcamento/realizado    (Target)
Projeção de Caixa       /projecao               (LineChart)

── ASSISTENTE ──
Consultor IA            /consultor              (Sparkles)  + badge "beta"

── CONFIGURAÇÕES ──
Plano de Contas         /plano-de-contas        (ListTree)
Importações             /importacoes            (Upload)
Configurações           /configuracoes          (Settings)
```

### Topbar

```tsx
// Altura: 64px | Fundo: bg-base | Borda inferior: border-b border-line

// Esquerda: título da página (font-display text-h2 text-ink lowercase)
// Direita: [busca] [+ Novo Lançamento] [notificações] [avatar]
```

### DataTable

Base: TanStack Table v8.

```tsx
// Cabeçalho: bg-sunken | text-label uppercase tracking-widest text-ink-tertiary
// Linha: bg-surface hover:bg-[#FDFCF9] border-b border-line
// Linha alternada (opcional): bg-sunken
// Paginação: botões ghost, text-body-sm
// Total no rodapé: text-body font-medium text-ink-secondary
```

### Empty State

```tsx
<div className="flex flex-col items-center justify-center py-2xl text-center">
  <div className="text-line-strong mb-lg">
    <Icon size={64} strokeWidth={1} />   {/* ícone temático, cor cinza */}
  </div>
  <h3 className="font-display text-h2 text-ink lowercase mb-sm">
    nenhum lançamento ainda
  </h3>
  <p className="text-body text-ink-secondary max-w-xs mb-lg">
    Registre sua primeira movimentação manualmente ou importe um extrato bancário.
  </p>
  <Button variant="primary">+ novo lançamento</Button>
</div>
```

### Loading State

```tsx
// Skeleton com animação pulse, mesma estrutura do componente
// Cor: bg-sunken animate-pulse rounded-md
// Nunca usar spinners genéricos em telas inteiras — preferir skeleton
```

---

## 8. Iconografia

Biblioteca: **lucide-react**

```tsx
import { TrendingUp, Wallet, ArrowLeftRight } from 'lucide-react'

// Padrões
strokeWidth={1.5}        // sempre 1.5 — nunca 2 (muito pesado) nem 1 (muito fino)
size={18}               // UI padrão
size={16}               // dentro de tabelas
size={20}               // topbar, headers de card
size={24}               // empty states, ilustrações de onboarding
size={64}               // empty states grandes, ilustrações
```

---

## 9. Valores monetários — regras rígidas

```tsx
// NUNCA usar number para cálculos — usar string do Postgres ou Decimal.js
// Helpers em src/lib/money.ts

formatBRL('12450.00')     // → "R$ 12.450,00"
formatBRL('-3200.00')     // → "−R$ 3.200,00"
parseBRL('R$ 1.234,56')  // → "1234.56" (string para o banco)

// Display de valores com cor:
// positivo  → className="text-success tnum"
// negativo  → className="text-danger tnum"
// neutro    → className="text-ink tnum"

// Sinal explícito de variação (delta):
// +R$ 1.200,00  → text-success com TrendingUp icon
// −R$ 800,00    → text-danger com TrendingDown icon
```

---

## 10. Tom e microcopy

A Corporis é uma clínica acolhedora. O sistema de gestão financeira segue o mesmo tom.

| ❌ Não usar | ✅ Usar |
|---|---|
| "Cliente" | "Aluna" |
| "Paciente" | "Aluna" |
| "Transação" | "Lançamento" ou "Movimentação" |
| "Deletar" | "Remover" ou "Excluir" |
| "Error" | "Algo deu errado" |
| "Save" / "Cancel" | "Salvar" / "Cancelar" |
| "No data found" | "Nenhum lançamento encontrado" |
| "Loading..." | "Carregando..." |

**Mensagens de erro:** sempre explicativas e orientadas à ação.
```
❌ "Erro 422"
✅ "Não foi possível salvar o lançamento. Verifique se todos os campos estão preenchidos."
```

**Confirmações de exclusão:**
```
❌ "Tem certeza?"
✅ "Remover este lançamento? Esta ação não pode ser desfeita."
```

---

## 11. Acessibilidade mínima

- Todo elemento interativo deve ter `focus-visible` com `shadow-focus-orange`
- Contraste mínimo AA: texto sobre fundo (`#3A3530` sobre `#FAFAF8` = 9.6:1 ✅)
- Inputs sempre têm `<label>` associado via `htmlFor` + `id`
- Ícones decorativos: `aria-hidden="true"`
- Ícones funcionais (sem texto): `aria-label` descritivo
- Tabelas: `<th scope="col">` nos cabeçalhos
- Modais: foco capturado dentro do modal enquanto aberto (`focus-trap`)

---

## 12. Checklist de revisão de UI

Antes de qualquer PR com mudança visual:

- [ ] Cores usadas estão na paleta Corporis (sem azul, roxo, preto puro, branco puro)
- [ ] Fundo é `#FAFAF8`, não `#FFFFFF`
- [ ] Headlines em Fraunces lowercase
- [ ] Valores monetários com `tabular-nums` e cor por sinal
- [ ] Ícones Lucide com `strokeWidth={1.5}`
- [ ] Espaçamentos são múltiplos de 8px
- [ ] Estado vazio implementado
- [ ] Estado de loading implementado (skeleton)
- [ ] Mensagens de erro em pt-BR e orientadas à ação
- [ ] Foco visível em todos os elementos interativos
- [ ] Mockup da tela correspondente aberto lado a lado para comparação

---

*DLS v1.0 — Corporis Finance | Baseado no DLS Primitives da Corporis Fisioterapia & Pilates*
