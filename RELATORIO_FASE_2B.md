# RELATÓRIO DE ENTREGA — FASE 2B
**Data:** 30/09/2026  
**Branch:** main (commit local, sem push)  
**Fase:** 2B — M12A Continuação: FY cleanup + bc_package_status + BC FK

---

## 1. Objetivo

Fechar os três itens pendentes da Fase 2A:
- Tornar a VIEW `anos_fiscais_config` estritamente read-only (dropar triggers INSTEAD OF)
- Persistir o status do pacote FY no `fiscal_years` (FY-09, elimina recálculo)
- Adicionar FK formal `business_cases.ano_fiscal → fiscal_years(codigo)` (BC-003 parcial)

---

## 2. SQL — `sql/2026-09-30_fase2b_fy_cleanup.sql`

| Passo | Ação |
|---|---|
| 1 | `DROP TRIGGER` trg_afc_insert/update/delete + `DROP FUNCTION` _fn_afc_insert/update/delete |
| 2 | `ALTER TABLE fiscal_years ADD COLUMN bc_package_status TEXT DEFAULT 'ABERTO'` + `CHECK (IN 'ABERTO','FECHADO')` |
| 2a | `UPDATE fiscal_years SET bc_package_status = 'FECHADO' WHERE EXISTS (SELECT 1 FROM pacotes_fy WHERE ...)` |
| 3 | `CREATE OR REPLACE VIEW anos_fiscais_config` — agora expõe `bc_package_status` |
| 4 | `ALTER TABLE business_cases ADD CONSTRAINT fk_bc_ano_fiscal FOREIGN KEY (ano_fiscal) REFERENCES fiscal_years(codigo) ON UPDATE CASCADE NOT VALID` |

**NOT VALID**: a FK aplica-se a novas linhas e updates. Para validar dados históricos: `ALTER TABLE business_cases VALIDATE CONSTRAINT fk_bc_ano_fiscal;` (rodar separadamente, após verificar que não há `ano_fiscal` órfão).

---

## 3. JS — `js/approvals/orcamento-af.js`

Payload do upsert em `fiscal_years` no fechamento do orçamento: adicionado `bc_package_status: 'FECHADO'`. Linha ~302.

`carregarFiscalYears()` (em `fiscal-year.js`) lê `*` da VIEW — vai receber `bc_package_status` automaticamente via `fiscalYearsCache` sem mudança de código.

---

## 4. O que ficou de fora (decisão explícita)

| Item | Motivo |
|---|---|
| Renomear `ORÇAMENTO REALIZADO` | Em uso em 10+ arquivos; rename sem caderno M05 é risco de regressão |
| `config_periodo_ano_fiscal` trigger | Não foi grep confirmado; manter como safety net |
| `VALIDATE CONSTRAINT fk_bc_ano_fiscal` | Rodar separadamente após verificar dados históricos em produção |
| Campos FISCAL_WINDOW / PROJECT_FISCAL_PLAN | Fase 3 (M12A avançado) |

---

## 5. Sequência de deploy

1. Rodar `sql/2026-09-30_fase2b_fy_cleanup.sql` em produção.  
   Resultado esperado: `fiscal_years_total, fy_com_pacote_fechado, bc_com_ano_fiscal, fk_criada` (fk_criada = 1).
2. Fazer push quando autorizado.
3. Verificar: fechar orçamento de um AF de teste — confirmar que `fiscal_years.bc_package_status` fica `'FECHADO'` e que a VIEW expõe o campo.

---

## 6. Próxima fase recomendada

**Fase 3A** — M12A avançado (FISCAL_WINDOW + PROJECT_FISCAL_PLAN) ou **Fase 2C** — Business Case M05 sub-status cleanup (`ORÇAMENTO REALIZADO` rename, com caderno M05 confirmado).
