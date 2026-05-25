# SCREENS.md — Corporis Finance
> Índice de todas as telas do produto. O Claude Code **não implementa** telas sem status `✅ aprovado`.
> Atualize este arquivo após cada revisão com o produto.

---

## Status de aprovação

| # | Tela | Arquivo HTML | PNG | Etapa | Status |
|---|---|---|---|---|---|
| 01 | Dashboard | `01-dashboard.html` | `01-dashboard.png` | 5 | ✔️ implementado |
| 02 | Lançamentos — Listagem | `02-lancamentos-listagem.html` | `02-lancamentos-listagem.png` | 4 | ✔️ implementado |
| 03 | Lançamentos — Modal Novo/Editar | `03-lancamentos-modal.html` | `03-lancamentos-modal.png` | 4 | ✔️ implementado |
| 04 | Importação — Upload | `04-importacao-upload.html` | `04-importacao-upload.png` | 7 | ✔️ implementado |
| 05 | Importação — Conciliação (IA) | `05-importacao-conciliacao.html` | `05-importacao-conciliacao.png` | 7 | ✔️ implementado |
| 06 | Contas e Cartões — Listagem | `06-contas-listagem.html` | `06-contas-listagem.png` | 3 | ✔️ implementado |
| 07 | Cadastro/Edição de Conta | `07-contas-cadastro.html` | `07-contas-cadastro.png` | 3 | ✔️ implementado |
| 08 | DFC — Relatório | `08-dfc.html` | `08-dfc.png` | 6 | ✔️ implementado |
| 09 | Orçado x Realizado | `09-orcado-realizado.html` | `09-orcado-realizado.png` | 8 | ✔️ implementado |
| 10 | Orçamento Anual — Edição | `10-orcamento-editor.html` | `10-orcamento-editor.png` | 8 | ✔️ implementado |
| 11 | Projeção de Caixa | `11-projecao.html` | `11-projecao.png` | 9 | ✔️ implementado |
| 12 | Consultor IA (Chat) | `12-consultor-ia.html` | `12-consultor-ia.png` | 10 | ✔️ implementado |
| 13 | Plano de Contas — Edição | `13-plano-de-contas.html` | `13-plano-de-contas.png` | 3 | ✔️ implementado |
| 14 | Importações — Histórico | `14-importacoes-historico.html` | `14-importacoes-historico.png` | 10 | ✔️ implementado |
| 15 | Configurações | `15-configuracoes.html` | `15-configuracoes.png` | 10 | ✔️ implementado |
| 16 | Login | `16-login.html` | `16-login.png` | 2 | ✔️ implementado |
| 17 | Onboarding (4 passos) | `17-onboarding.html` | `17-onboarding.png` | 2 | ✔️ implementado |

<!-- 16/17 aprovados pelo usuário em 2026-05-17 (mockups gerados previamente, SCREENS.md estava desatualizado). Sem ajustes solicitados — implementados fiéis ao HTML. Backend validado por smoke test. Desvio aprovado: botão Google renderizado desabilitado ("em breve"); /signup adicionado (rota escondida) pois critério ETAPA 2 exige fluxo do zero. -->
<!-- Todos os mockups existentes foram confirmados como gerados e aprovados pelo usuário em 2026-05-17. -->
<!-- AppShell da ETAPA 1 foi derivado do mockup 01-dashboard.html; decisão posterior removeu o cabeçalho global e manteve apenas a sidebar. Sino de notificações fica na sidebar como popover in-app real, com badge, lista e ações. -->
<!-- 01 Dashboard validado visualmente pelo usuário em 2026-05-17. -->
<!-- 02/03 Lançamentos validados visualmente pelo usuário em 2026-05-24. -->
<!-- 04/05 Importação validadas visualmente pelo usuário em 2026-05-24. PDF requer ANTHROPIC_API_KEY no .env.local. -->
<!-- 08 DFC validado visualmente pelo usuário em 2026-05-24. -->
<!-- 09/10 Orçamento validados visualmente pelo usuário em 2026-05-24. -->
<!-- 11 Projeção de Caixa validada visualmente pelo usuário em 2026-05-24. -->
<!-- 12 Consultor IA validado visualmente pelo usuário em 2026-05-24. -->
<!-- 14 Importações — Histórico validado visualmente pelo usuário em 2026-05-24. -->
<!-- 15 Configurações validada visualmente pelo usuário em 2026-05-24. Decisão de produto: somente "Perfil e clínica" e "Segurança e acesso" ficam visíveis no MVP; demais seções permanecem ocultas até terem comportamento real. -->


---

## Legenda de status

| Ícone | Significado |
|---|---|
| 🔲 aguardando geração | Mockup ainda não foi gerado com o Prompt 1 |
| 🔄 revisão | Mockup gerado, aguardando revisão e aprovação do produto |
| ✅ aprovado | Revisado, aprovado — pode ser implementado |
| 🚧 implementando | Em desenvolvimento no Claude Code |
| ✔️ implementado | Tela funcional no app, validada contra o mockup |

---

## Como atualizar este arquivo

**Após gerar o mockup (Prompt 1):**
```
🔲 aguardando geração → 🔄 revisão
```
Salve o HTML em `/design/mockups/` com o nome exato da tabela.
Tire um screenshot e salve o PNG no mesmo diretório.

**Após revisar e aprovar o mockup:**
```
🔄 revisão → ✅ aprovado
```
Adicione uma linha de comentário com o que foi ajustado (ex: "ajustado filtro de período, removido campo X").

**Ao iniciar implementação:**
```
✅ aprovado → 🚧 implementando
```
Informe ao Claude Code qual tela está sendo construída e qual mockup usar.

**Ao validar a tela implementada no browser:**
```
🚧 implementando → ✔️ implementado
```
A validação é visual — abra o mockup HTML e o app lado a lado e confirme que são equivalentes.

---

## Ordem de geração recomendada (Prompt 1)

Gere os mockups nesta ordem para que a revisão ocorra junto com a etapa de implementação:

```
Etapa 1 (fundação — gerar antes de começar o código):
  → 16 Login
  → 17 Onboarding

Etapa 2–3 (estrutura do domínio):
  → 06 Contas e Cartões
  → 07 Cadastro de Conta
  → 13 Plano de Contas

Etapa 4 (core do produto):
  → 02 Lançamentos — Listagem
  → 03 Lançamentos — Modal

Etapa 5:
  → 01 Dashboard

Etapa 6:
  → 08 DFC

Etapa 7:
  → 04 Importação — Upload
  → 05 Importação — Conciliação

Etapa 8:
  → 09 Orçado x Realizado
  → 10 Orçamento — Editor

Etapa 9:
  → 11 Projeção de Caixa

Etapa 10:
  → 12 Consultor IA
  → 14 Importações — Histórico
  → 15 Configurações
```

---

*Atualizado em: [data da última revisão]*
