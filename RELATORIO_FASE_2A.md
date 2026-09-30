# RELATÓRIO DE ENTREGA — FASE 2A
**Data:** 30/09/2026  
**Branch:** main (commit local, sem push)  
**Fase:** 2A — Migração M12A (D-10)

---

## 1. Objetivo

Substituir `anos_fiscais_config` (tabela flat, sem estados) por uma estrutura M12A-compatível (`fiscal_years`), com `fiscal-year.js` passando a ser o único leitor do AF ativo (R-FY-03), e `anos_fiscais_config` se tornando readonly via VIEW com INSTEAD OF triggers de compatibilidade.

---

## 2. O que foi entregue

### 2.1 SQL — `sql/2026-09-30_fase2a_fiscal_years.sql`
Idempotente. Executar UMA vez em produção antes do deploy.

| Passo | Ação |
|---|---|
| 1 | `CREATE TABLE fiscal_years` — 18 colunas; STATUS CHECK com 6 estados M12A |
| 2 | `CREATE TABLE fiscal_periods` — substitui `config_periodo_ano_fiscal` |
| 3 | Migra `anos_fiscais_config` → `fiscal_years` com mapeamento de estado |
| 4 | Migra `config_periodo_ano_fiscal` → `fiscal_periods` |
| 5 | Renomeia `anos_fiscais_config` → `anos_fiscais_config_legado` |
| 6 | Renomeia `config_periodo_ano_fiscal` → `config_periodo_ano_fiscal_legado` |
| 7 | Cria VIEW `anos_fiscais_config` sobre `fiscal_years` (mesmas colunas + `fy_status`, `fy_id`) |
| 8 | INSTEAD OF triggers INSERT/UPDATE/DELETE na VIEW (compatibilidade com código legado) |
| 9 | Cria VIEW `config_periodo_ano_fiscal` sobre `fiscal_periods` + trigger INSERT |

**Mapeamento de estado na migração:**

| Condição legada | Status M12A |
|---|---|
| `ano_fiscal_fechado = true` | CLOSED |
| `orcamento_fechado = true` (não fechado) | OPEN |
| `recebimento_demandas_aberto = true` (outros false) | PLANNING |
| Demais | PLANNING |

### 2.2 `js/core/fiscal-year.js` — reescrito
- `fiscalYearsCache = []` — cache global
- `async carregarFiscalYears()` — lê `anos_fiscais_config` (via VIEW), ordena por `ano_fiscal`
- `getAFAberto()` — retorna o FY com `fy_status='OPEN'` ou `orcamento_fechado=true && !ano_fiscal_fechado`
- `getAFEmPlanejamento()` — retorna FY em PLANNING/BUDGETING
- `getAFPorCodigo(codigo)` — lookup por código
- `getInfoAnoFiscal(dataRef)` — quando `dataRef` é omitido e o cache está carregado, `afAtualStr` vem do FY OPEN no banco (R-FY-03); fallback para cálculo por data mantido para retrocompatibilidade e chamadas com `dataRef` explícito
- `isOrcamentoGlobalFechado()` — consulta o cache; fallback para `projectsData` legado enquanto cache está vazio

### 2.3 `js/auth/auth.js`
Adicionada chamada `await carregarFiscalYears()` logo após `carregarConfigPeriodoAF()`, antes de qualquer `getInfoAnoFiscal()`.

### 2.4 5 arquivos de escrita migrados para `fiscal_years`
Todos os writes agora vão direto para `fiscal_years` (coluna PK: `codigo`), não mais para a view:

| Arquivo | Linha | Tipo | Mudança |
|---|---|---|---|
| `js/approvals/orcamento-af.js` | 293 | upsert | `anos_fiscais_config`/`ano_fiscal` → `fiscal_years`/`codigo`; `status:'OPEN'` explícito |
| `js/ano-fiscal/fechamento-af.js` | 161 | upsert | idem; `status:'CLOSED'` explícito |
| `js/config/ano-fiscal.js` | 188 | upsert | idem |
| `js/config/ano-fiscal.js` | 237 | upsert | idem; `onConflict:'codigo'` adicionado |
| `js/dev-tools/reset.js` | 270 | update | `fiscal_years`, `eq('codigo', ...)`, `status:'PLANNING'` |
| `js/dev-tools/limpeza-base.js` | 128+132 | delete+upsert | `fiscal_years`, `neq('codigo', ...)`/`codigo:` |
| `js/dev-tools/limpeza-base.js` | 250 | delete | `fiscal_years`, `neq('codigo', '')` |

---

## 3. O que ainda está pendente

- **SQL em produção**: o arquivo `.sql` foi criado mas não rodado — o usuário precisa executá-lo no Supabase SQL Editor.
- **`carregarFiscalYears()` no reload pós-escrita**: as funções de escrita chamam `carregarAnosFiscaisLista()` após o upsert (que lê da VIEW). O `fiscalYearsCache` não é re-sincronizado nesse momento. Em Fase 2B pode-se adicionar `await carregarFiscalYears()` junto com `carregarAnosFiscaisLista()` nessas funções.
- **INSTEAD OF triggers como safety net**: os triggers ainda estão ativos na VIEW. Após confirmar que todos os caminhos de escrita funcionam via `fiscal_years` direto em produção, os triggers podem ser dropados (DDL simples) para tornar a VIEW verdadeiramente readonly.
- **`filtro-af-visao.js` e outros leitores**: continuam lendo `anos_fiscais_config` (VIEW) — comportamento correto e intencional, sem mudança necessária.
- **D-13 sidebar, D-7 router pendências menores** (apontadas no RELATORIO_FASE_1.md): não fazem parte desta fase.

---

## 4. Sequência de deploy

1. Rodar `sql/2026-09-30_fase2a_fiscal_years.sql` no Supabase SQL Editor.  
   Esperado: `fiscal_years` e `fiscal_periods` com os registros migrados; tabelas legadas com sufixo `_legado`.  
   A consulta de verificação ao final do script confirma as contagens.
2. Fazer o push deste commit (quando autorizado).
3. Verificar no app: abrir Ano Fiscal, fechar orçamento, fechar AF — confirmar que as linhas vão para `fiscal_years` e o cache `getAFAberto()` reflete o estado correto.

---

## 5. Decisão pendente

O campo `status` em `fiscal_years` agora é a fonte canônica do estado do AF. Os campos legados (`orcamento_fechado`, `recebimento_demandas_aberto`, `ano_fiscal_fechado`) ainda coexistem e são mantidos em sincronia pelos triggers e pelo código de escrita. Em Fase 2B, avaliar se os campos legados podem ser deprecated (tornados nullable e ignorados por novas leituras), deixando apenas `status` como verdade.

**Recomendação**: manter os campos legados por pelo menos 1 ciclo de AF completo (abertura → fechamento de orçamento → fechamento de AF) para garantir que nenhuma leitura legada foi esquecida.
