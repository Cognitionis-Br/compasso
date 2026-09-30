# RELATORIO_FASE6.md — UAT, Go Live e Encerramento

**Commit:** a ser gerado  
**Data:** 2026-09-29/30

---

## O que foi entregue

### Arquivos novos
| Arquivo | Descrição |
|---|---|
| `sql/2026-09-29_fase6_uat_golive_encerramento.sql` | 3 colunas de estado em `projects`; tabelas `uat_ciclos`, `uat_casos_teste`, `uat_defeitos`, `golive_criterios_rollback`, `golive_tentativas`, `golive_ocorrencias_v2`, `encerramento_pendencias`; recria view + triggers |
| `js/uat/workspace-uat.js` | Workspace completo de UAT (SCR-11): ciclos, defeitos, aceite UAV-01 a 06 + stubs |
| `js/golive/workspace-golive.js` | Workspace completo de Go Live (SCR-12): critérios RF-06, go/no-go, tentativas, aceite GLV-01 a 07 + stubs |
| `js/encerramento/workspace-encerramento.js` | Workspace completo de Encerramento (SCR-14): pendências ENV-02, checklist ENV-01 a 08, aprovação, reabertura CMP-01 + stubs |

### Arquivos modificados
| Arquivo | Mudança |
|---|---|
| `js/workspace-projeto/etapa-dispatcher.js` | Roteamento de `etapa_uat`, `etapa_golive`, `etapa_encerramento` |
| `index.html` | 3 `<script>` para os novos workspaces |

---

## Acceptance Criteria — auditoria

### UAT
| # | Critério | Estado |
|---|---|---|
| AC-1 | Workspace UAT renderiza ao clicar na aba UAT | ✅ Dispatcher roteia para `renderWorkspaceUat` |
| AC-2 | Tab bar com grupos (Resumo · Preparação · Execução · Decisão · Registro) | ✅ 7 abas agrupadas com separadores |
| AC-3 | Aba Ciclos com banner D-12 (ratificar/retificar bloco do Plano de Entrega) | ✅ Banner âmbar quando `REQUER_RATIFICACAO`; tabela de ciclos com badges de status |
| AC-4 | Aba Defeitos com grid de severidade/status | ✅ Grid com badges CRITICA/ALTA/MEDIA/BAIXA e status workflow |
| AC-5 | Aba Aceite com checklist UAV-01 a 06 | ✅ 6 critérios; botões Aceitar / Aceitar com restrições desbloqueados só quando todos ✅ |
| AC-6 | Aceite registra `uat_estado` em `projetos` + cache | ✅ UPDATE via view; cache `projectsData` atualizado in-place |

### Go Live
| # | Critério | Estado |
|---|---|---|
| AC-7 | Workspace Go Live renderiza ao clicar na aba Go Live | ✅ Dispatcher roteia para `renderWorkspaceGolive` |
| AC-8 | RF-06: go/no-go bloqueado sem critérios de rollback | ✅ Mensagem bloqueante em `_glRenderTentativas`; botão desabilitado |
| AC-9 | Aba Rollback com nota âmbar RF-06 e tabela de critérios | ✅ Banner explicativo + tabela Critério/Limite/Efeito + "+ Critério" |
| AC-10 | Aba Tentativas com fluxo go/no-go | ✅ Banner de bloqueio por bloco; tabela de tentativas com resultado badges |
| AC-11 | Aba Aceite com checklist GLV-01 a 07 | ✅ 7 critérios; aceite bloqueado se bloco requer ratificação |
| AC-12 | Propagação de bloqueio UAT→Go Live | ✅ `_glBlocoRequerRatificacao` visível no info strip e no resumo |

### Encerramento
| # | Critério | Estado |
|---|---|---|
| AC-13 | Workspace Encerramento renderiza ao clicar na aba Encerramento | ✅ Dispatcher roteia para `renderWorkspaceEncerramento` |
| AC-14 | Aba Resumo com checklist ENV-01 a 08 + KPI cards | ✅ 8 critérios; ENV-01 verifica golive_estado; ENV-02 verifica pendências |
| AC-15 | Aba Pendências com ENV-02 banner + Resolver/Transferir/Cancelar | ✅ Banner âmbar com contagem; botões de tratamento por linha; modal simples via `prompt()` |
| AC-16 | ENV-02 bloqueia submissão (aba Aprovação) | ✅ Botão "Submeter" visível apenas quando `semTrat === 0 && glAceito` |
| AC-17 | Aba Reabertura com CMP-01: justificativa + Impact Preview + autoridade | ✅ Formulário completo; Impact Preview (stub informativo) |
| AC-18 | Encerrado fica somente leitura | ✅ Banner em Aprovação; estado `CLOSED` detectado em cada aba |

---

## SQL a rodar em produção

Rodar **uma vez** no Supabase SQL Editor:

```
sql/2026-09-29_fase6_uat_golive_encerramento.sql
```

Resumo:
```sql
ALTER TABLE projects
    ADD COLUMN IF NOT EXISTS uat_estado     TEXT DEFAULT 'UAT_PLANNING',
    ADD COLUMN IF NOT EXISTS golive_estado  TEXT DEFAULT 'GO_LIVE_PLANNING',
    ADD COLUMN IF NOT EXISTS enc_estado     TEXT DEFAULT 'CLOSING';

CREATE TABLE IF NOT EXISTS uat_ciclos (...);
CREATE TABLE IF NOT EXISTS uat_casos_teste (...);
CREATE TABLE IF NOT EXISTS uat_defeitos (...);

CREATE TABLE IF NOT EXISTS golive_criterios_rollback (...);
CREATE TABLE IF NOT EXISTS golive_tentativas (...);
CREATE TABLE IF NOT EXISTS golive_ocorrencias_v2 (...);

CREATE TABLE IF NOT EXISTS encerramento_pendencias (...);

-- + recria view projetos + 3 triggers INSTEAD OF (padrão Fase 3/4/5)
```

---

## Arquitetura dos 3 Workspaces

```
etapa-dispatcher.js
    etapa_uat         → renderWorkspaceUat(projeto, bodyId)
    etapa_golive      → renderWorkspaceGolive(projeto, bodyId)
    etapa_encerramento → renderWorkspaceEncerramento(projeto, bodyId)

workspace-uat.js
    renderWorkspaceUat()
        ↳ _uatCarregarDados()        — uat_ciclos + uat_defeitos
        ↳ _uatRenderStepper()
        ↳ _uatRenderInfoStrip()      — estado, badge bloco requer ratificação
        ↳ mudarAbaUat(aba)
            ↳ _uatRenderResumo()          — KPIs + ação contextual
            ↳ _uatRenderCiclos()          — banner D-12 + tabela ciclos
            ↳ _uatRenderDefeitos()        — grid com severidade/status
            ↳ _uatRenderAceite()          — UAV-01..06 + botões aceite
            ↳ _uatRenderStub(aba)         — 3 stubs

workspace-golive.js
    renderWorkspaceGolive()
        ↳ _glCarregarDados()         — criterios + tentativas
        ↳ mudarAbaGolive(aba)
            ↳ _glRenderResumo()           — banner bloco/bloqueio
            ↳ _glRenderRollback()         — nota RF-06 + tabela critérios
            ↳ _glRenderTentativas()       — go/no-go bloqueado sem critério
            ↳ _glRenderAceite()           — GLV-01..07 + botões aceite
            ↳ _glRenderStub(aba)          — 3 stubs

workspace-encerramento.js
    renderWorkspaceEncerramento()
        ↳ _encCarregarDados()        — encerramento_pendencias
        ↳ mudarAbaEncerramento(aba)
            ↳ _encRenderResumo()          — ENV-01..08 checklist + KPIs
            ↳ _encRenderPendencias()      — ENV-02 banner + Resolver/Transferir/Cancelar
            ↳ _encRenderAprovacao()       — submissão + decisão; somente leitura se CLOSED
            ↳ _encRenderReabertura()      — CMP-01 form (justif + Impact Preview + autoridade)
            ↳ _encRenderStub(aba)         — 3 stubs (Resultados, Documentos, Histórico)
```

---

## Limitações / Fase 7+

- **Aba Plano de UAT / Casos de Teste**: stubs — implementação real na próxima fase.
- **Aba Plano de Go Live / Ocorrências**: stubs.
- **Aba Resultados / Documentos / Histórico (Encerramento)**: stubs.
- **Impact Preview (RAV-02)**: exibe texto estático explicativo; cálculo automático real (etapa destino, FY, contratos) fica para Fase 7+.
- **Retificação de bloco UAT/Go Live**: abre alerta explicativo; nova versão real do plano fica para Fase 7+.
- **Casos de teste no UAT**: tabela `uat_casos_teste` criada no banco mas a UI de cadastro/execução fica para Fase 7+.
- **ENV-03 a ENV-08**: detectados como `false` (checklist visual); integração com dados reais (financeiro, contratos, KRs) fica para Fase 7+.
