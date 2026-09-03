# Auditoria de Módulos de Licenciamento — Fase 1

**Data:** 03/09/2026 · **Escopo:** Compasso (Cognitionis) · **Base:** código real + `MATRIZ_PERMISSOES.md`.

Objetivo: (1) cruzar cada tela do sistema com o módulo de licença; (2) listar
inconsistências; (3) desenhar a fonte única de verdade `modulo_funcao`;
(4) aplicar a realocação decidida (Orçamento por Produto/Área, Autorização
Extraordinária e Validação de Trade-off → FINANCEIRO; Período do Ano Fiscal e
cadastros mestres → NÚCLEO).

---

## 1. Como o gate de módulo funciona hoje

- **Eixo separado do RBAC.** `licenca_modulos` (4 linhas: `WORKFLOW`, `EMAIL`,
  `FINANCEIRO`, `PLANEJAMENTO_ESTRATEGICO`) → `js/core/licenca.js`
  (`carregarLicenca` / `moduloAtivo`).
- **O gate é por TELA (`tabId`), não por `activity_key` do catálogo.** O mapa
  `TAB_MODULO_MAP` (hardcoded em `js/core/licenca.js`) associa cada `tabId` a um
  módulo. `tabId` ausente do mapa = NÚCLEO (nunca bloqueado).
- **2 pontos de consumo:** `aplicarVisibilidadeMenu()` (esconde
  `link-<tabId>` / `view-btn-<tabId>`) e `switchTab()` (bloqueia o carregamento
  da view). Ambos via `moduloAtivo(moduloDoTab(tabId))`.
- **1 gate de comportamento fora do menu:** `moduloAtivo('FINANCEIRO')` em
  `js/requirements/requirements.js` + `js/config/bloqueio-orcamento.js` — decide
  se a variação de orçamento bloqueia o avanço de fase na conclusão de
  Requerimentos/Especificação.
- **Não há tabela de SKU.** Essencial / Comunicação / Financeiro / Enterprise
  existem só comercialmente — o sistema só conhece os 4 flags liga/desliga.

---

## 2. Mapa completo — situação atual × proposta

`tipo`: **N** = Núcleo (sempre disponível) · **L** = Licenciável (atrás de um módulo).
Coluna "Ação": `=` mantém · `→` realoca · `+` passa a ser explícito (era núcleo por omissão).

### Grupo ANO FISCAL

| tabId | Tela | Módulo hoje | Proposto | tipo | Ação |
|---|---|---|---|---|---|
| `ano_fiscal` | Abertura Ano Fiscal | WORKFLOW | **CONFIRMAR** (NÚCLEO?) | N/L | ❓ |
| `periodo_ano_fiscal` | Período do Ano Fiscal | (núcleo/omissão) | **NÚCLEO** | N | `+` |
| `fechamento_af` | Fechamento Ano Fiscal | WORKFLOW | WORKFLOW | L | `=` |
| `ajuste_orcamento` | Ajuste de Orçamento (registro) | WORKFLOW | **FINANCEIRO** (recom.) | L | `→` ❓ |
| `validacao_tradeoff` | Validação de Trade-off Extraordinário | WORKFLOW | **FINANCEIRO** | L | `→` |
| `controle_orcamento` | Controle Orçamentário (modo AF/Área/Produto) | (núcleo/omissão) | **FINANCEIRO** | L | `→` |

### Grupo BUSINESS CASE

| tabId | Tela | Hoje | Proposto | tipo | Ação |
|---|---|---|---|---|---|
| `f1_formalizacao` | Formalizar Demanda | WORKFLOW | WORKFLOW | L | `=` |
| `f1_orcamento` | Orçamentar Demanda | WORKFLOW | WORKFLOW | L | `=` |
| `aprov_comite` | Aprovar Orçamento por Projeto | FINANCEIRO | FINANCEIRO | L | `=` |
| `aprov_orcamento_af` | Aprovar Orçamento Ano Fiscal | FINANCEIRO | FINANCEIRO | L | `=` |
| `projetos_adhoc` | Aprovar Demanda Extraordinária | WORKFLOW | **FINANCEIRO** | L | `→` |

### Grupos REQUERIMENTOS / ESPECIFICAÇÃO / EXECUÇÃO

| tabId | Hoje | Proposto | tipo | Ação |
|---|---|---|---|---|
| `req_planejamento`, `req_aprov_negocio`, `req_aprov_ti`, `req_conclusao` | WORKFLOW | WORKFLOW | L | `=` |
| `fase_technical`, `tech_aval_negocio`, `tech_conclusao` | WORKFLOW | WORKFLOW | L | `=` |
| `fase_execution`, `fase_uat`, `fase_golive`, `conclusao_projeto` | WORKFLOW | WORKFLOW | L | `=` |

### Grupo GOVERNANÇA

| tabId | Tela | Hoje | Proposto | tipo | Ação |
|---|---|---|---|---|---|
| `governanca` | Cobrança de Ajustes | EMAIL | EMAIL | L | `=` |
| `retomar_hold` | Retomar Projetos em Hold | WORKFLOW | WORKFLOW | L | `=` |
| `mudanca_orcamento` | Mudança de Orçamento | FINANCEIRO | FINANCEIRO | L | `=` |

### Grupo CONTRATOS & TERCEIROS

| tabId | Hoje | Proposto | tipo | Ação |
|---|---|---|---|---|
| `empresas_terceirizadas`, `contratos_projeto`, `contratos_vinculos`, `registro_valores_contrato`, `relatorio_projetos_contratos` | FINANCEIRO | FINANCEIRO | L | `=` |

### Grupo PERFIS DE ACESSO (todos NÚCLEO — como autenticação)

| tabId | Hoje | Proposto | tipo | Ação |
|---|---|---|---|---|
| `usuarios`, `funcoes_permissoes`, `atribuicao_funcoes`, `restricao_area_atividades`, `responsaveis` | (núcleo/omissão) | **NÚCLEO** | N | `+` |

### Grupo PARÂMETROS E CADASTROS

| tabId | Tela | Hoje | Proposto | tipo | Ação |
|---|---|---|---|---|---|
| `areas` | Áreas Solicitantes | (núcleo) | **NÚCLEO** | N | `+` |
| `produtos` | Cadastro de Produtos | (núcleo) | **NÚCLEO** | N | `+` |
| `pessoas_solicitantes`, `portes`, `tipos_projeto`, `return_benefit`, `cargos` | cadastros mestres | (núcleo) | **NÚCLEO** | N | `+` |
| `planejamento_estrategico` | Pilares / Iniciativas | PLANEJAMENTO_ESTRATEGICO | PLANEJAMENTO_ESTRATEGICO | L | `=` |

> **Decisão (spec 1.3):** os *cadastros mestres* de Produto e Área ficam no
> NÚCLEO; só a *funcionalidade de orçamentação por Produto/Área*
> (`controle_orcamento`, `validacao_tradeoff`, trade-off) fica atrás do
> FINANCEIRO. Assim um cliente que licencie FINANCEIRO sem
> PLANEJAMENTO_ESTRATEGICO não fica com a função quebrada.

### Grupo ADMINISTRAÇÃO

| tabId | Tela | Hoje | Proposto | tipo | Ação |
|---|---|---|---|---|---|
| `workflow_etapas` | Fases e Etapas do Workflow | (núcleo/omissão) | **WORKFLOW** | L | `→` ⚠️ |
| `prazos` | SLA & Prazos | (núcleo/omissão) | **WORKFLOW** | L | `→` ⚠️ |
| `gestao_templates`, `gestao_fluxo_email`, `fila_email` | E-mail | EMAIL | EMAIL | L | `=` |
| `percentual_bloqueio_orcamento` | Percentual de Bloqueio | FINANCEIRO | FINANCEIRO | L | `=` |
| `responsaveis` | Responsáveis por Atividade | (núcleo) | **NÚCLEO** | N | `+` |
| `licenciamento_modulos` | Licenciamento de Módulos | (núcleo) | **NÚCLEO** | N | `+` |
| `dev_tools` | Ferramentas de Dev | (núcleo) | **NÚCLEO** | N | `+` |

### Barra superior (visões)

| tabId | Hoje | Proposto | tipo | Ação |
|---|---|---|---|---|
| `roadmap` | WORKFLOW | WORKFLOW | L | `=` |
| `cronograma_evolucao` | WORKFLOW | WORKFLOW | L | `=` |
| `visao_orcamento` | FINANCEIRO | FINANCEIRO | L | `=` |
| `alertas_orcamento` | FINANCEIRO | FINANCEIRO | L | `=` |
| `dashboard` | (núcleo/omissão) | **NÚCLEO** | N | `+` ⚠️ |
| `consultas` | (núcleo/omissão) | **NÚCLEO** | N | `+` ⚠️ |

---

## 3. As 3 listas pedidas

### 3.1 Itens órfãos (sem módulo — hoje NÚCLEO só por omissão)

`ano_fiscal` não está aqui (está mapeado). Órfãos = tudo que não aparece em
`TAB_MODULO_MAP`:

- **Classificados como NÚCLEO** (correto, mas passa a ser explícito):
  `usuarios`, `funcoes_permissoes`, `atribuicao_funcoes`,
  `restricao_area_atividades`, `responsaveis`, `licenciamento_modulos`,
  `dev_tools`, `areas`, `produtos`, `pessoas_solicitantes`, `portes`,
  `tipos_projeto`, `return_benefit`, `cargos`, `periodo_ano_fiscal`,
  `dashboard`, `consultas`.
- **Órfão que deveria ser LICENCIÁVEL — realocar:**
  `controle_orcamento` → FINANCEIRO (spec 1.2).

### 3.2 Gating no código sem correspondência 1:1 com `licenca_modulos`

1. **`moduloAtivo('FINANCEIRO')` dentro de telas WORKFLOW** (`req_conclusao`,
   `tech_conclusao`) — o bloqueio por variação de orçamento é um controle
   financeiro embutido no workflow. Acoplamento intencional, mas fica invisível
   no mapa. Ação: documentar em `modulo_funcao.observacao` e manter (é uma
   regra "se tem FINANCEIRO, aplica a trava").
2. **`validacao_tradeoff` estava em WORKFLOW no código** (`TAB_MODULO_MAP`,
   03/09) mas conceitualmente é FINANCEIRO (spec 1.2). Ação: realocar.
3. **Sem representação de SKU.** O sistema não sabe que "Essencial = WORKFLOW",
   "Financeiro = WORKFLOW+FINANCEIRO" etc. Só há os 4 flags. Se a composição de
   SKU precisar viver no sistema (ex.: ativar um SKU inteiro de uma vez, ou
   travar combinações inválidas), é preciso `sku` + `sku_modulo` — **fora do
   escopo da Fase 1**, registrado como recomendação.

### 3.3 Marcado NÚCLEO mas só faz sentido dentro de um módulo pago (vazamento)

- **`workflow_etapas` (Fases e Etapas do Workflow)** e **`prazos` (SLA & Prazos)** —
  configuram o motor de fases. Um cliente sem o módulo WORKFLOW não deveria
  abrir essas telas (não há workflow para configurar). Ação: **realocar para
  WORKFLOW**.
- `dashboard` / `consultas` — mostram projetos (conceito WORKFLOW), mas são a
  landing page e a busca base do portfólio. Recomendação: **manter NÚCLEO**
  (degradam para "nenhum projeto" sem quebrar), diferente de `roadmap` /
  `cronograma` que são análises mais ricas e já são WORKFLOW. Marcado ⚠️ para
  ciência — reavaliar se o SKU "Essencial" não incluir WORKFLOW.

---

## 4. Desenho — tabela `modulo_funcao` (fonte única)

```sql
CREATE TABLE IF NOT EXISTS modulo_funcao (
    activity_key  TEXT PRIMARY KEY,          -- tabId (o gate de módulo é por tela)
    modulo        TEXT NOT NULL,             -- NUCLEO | WORKFLOW | EMAIL | FINANCEIRO | PLANEJAMENTO_ESTRATEGICO
    tipo          TEXT NOT NULL DEFAULT 'LICENCIAVEL' CHECK (tipo IN ('NUCLEO','LICENCIAVEL')),
    observacao    TEXT,
    atualizado_por TEXT, atualizado_em TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE modulo_funcao DISABLE ROW LEVEL SECURITY;
-- Regra: modulo = 'NUCLEO'  <=>  tipo = 'NUCLEO'.
```

- **Seed** = `TAB_MODULO_MAP` atual **+** as realocações desta auditoria **+**
  uma linha por `tabId` órfão com `modulo='NUCLEO'`.
- **`js/core/licenca.js`:** `carregarLicenca()` passa a carregar também
  `modulo_funcao` para um cache `moduloPorTab`. `moduloDoTab(tabId)` lê o cache
  primeiro e **cai no `TAB_MODULO_MAP` hardcoded** se a linha não existir
  (resiliência / primeiro boot antes do SQL). `TAB_MODULO_MAP` deixa de ser
  editado à mão — vira o *default de emergência* + documentação; o SQL é a
  verdade.
- Mesmo padrão já usado para `config_periodo_ano_fiscal` /
  `config_controle_orcamento` (cache no boot, função síncrona).
- A tela "Licenciamento de Módulos" pode, no futuro, listar quais telas cada
  módulo destrava lendo `modulo_funcao` (não faz parte da Fase 1).

### Realocações que o seed aplica

| tabId | de | para |
|---|---|---|
| `controle_orcamento` | (núcleo) | FINANCEIRO |
| `validacao_tradeoff` | WORKFLOW | FINANCEIRO |
| `projetos_adhoc` | WORKFLOW | FINANCEIRO |
| `ajuste_orcamento` | WORKFLOW | FINANCEIRO *(a confirmar)* |
| `ano_fiscal` | WORKFLOW | NÚCLEO *(a confirmar)* |
| `periodo_ano_fiscal` | (núcleo/omissão) | NÚCLEO (explícito) |
| `workflow_etapas` | (núcleo/omissão) | WORKFLOW |
| `prazos` | (núcleo/omissão) | WORKFLOW |
| todos os demais órfãos | (núcleo/omissão) | NÚCLEO (explícito) |

---

## 5. Pontos a confirmar antes de gerar o SQL/código

1. **`ano_fiscal` (Abertura Ano Fiscal)** — a spec diz "Ano Fiscal no Núcleo".
   Isso vale para a tela de **abertura do ciclo** (mover para NÚCLEO) ou só para
   o **parâmetro Período** (`periodo_ano_fiscal`, já NÚCLEO)? Abrir/fechar ciclo
   é pré-requisito do Workflow, mas hoje está sob WORKFLOW.
2. **`ajuste_orcamento` (Ajuste de Orçamento — registro de autorizações)** —
   mover de WORKFLOW para FINANCEIRO junto com `controle_orcamento` /
   `validacao_tradeoff`? (Recomendação: sim, é 100% orçamentário.)
3. **`workflow_etapas` + `prazos`** — confirmar mover para WORKFLOW (hoje
   acessíveis mesmo sem o módulo).
4. **SKU no sistema** — deixar fora da Fase 1 (só os 4 flags), ou já criar
   `sku` / `sku_modulo`?
