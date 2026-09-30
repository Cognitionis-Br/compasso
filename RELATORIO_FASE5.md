# RELATORIO_FASE5.md — Execução e Plano de Entrega (D-12, D-10)

**Commit:** a ser gerado  
**Data:** 2026-09-29

---

## O que foi entregue

### Arquivos novos
| Arquivo | Descrição |
|---|---|
| `sql/2026-09-29_fase5_execucao_plano.sql` | `exec_estado` em `projects`; tabelas `plano_entrega`, `plano_entrega_bloco`, `registro_planejamento`; trigger append-only (D-12); recria view + triggers |
| `js/execucao/workspace-exec.js` | Workspace completo de Execução (SCR-03): tab bar D-03, resumo, Plano de Entrega D-12, stubs das demais abas |

### Arquivos modificados
| Arquivo | Mudança |
|---|---|
| `js/workspace-projeto/etapa-dispatcher.js` | Roteamento de `etapa_execucao` para `renderWorkspaceExec` |
| `index.html` | `<script>` para `workspace-exec.js` |

---

## Acceptance Criteria — auditoria

| # | Critério | Estado |
|---|---|---|
| AC-1 | Workspace de Execução renderiza ao clicar na aba Execução | ✅ `renderEtapaProjeto` despacha para `renderWorkspaceExec` via `etapa-dispatcher.js` |
| AC-2 | Tab bar com grupos D-03 (Planejamento · Trabalho · Controle · Decisão · Registro) | ✅ Tab bar com 10 abas agrupadas, separadores visuais, labels de grupo em `#93a4c3` |
| AC-3 | Aba Resumo mostra estado do projeto e ação contextual | ✅ `READY_FOR_EXECUTION` sem plano → "Criar Plano"; com plano → "Iniciar Execução"; `IN_EXECUTION` → "Liberar para UAT" |
| AC-4 | Criação do Plano de Entrega inicial (3 blocos) | ✅ Formulário com início/fim/responsável por bloco; validação; INSERT em `plano_entrega` + `plano_entrega_bloco`; registro em `registro_planejamento` |
| AC-5 | Timeline Gantt relativa dos 3 blocos (D-12) | ✅ Escala proporcional ao span total de datas; barras coloridas por bloco; marcador "Hoje"; legenda; rótulos de data nos extremos |
| AC-6 | Tabela Registro de Planejamento append-only (D-12) | ✅ Renderiza `registro_planejamento` com badge por ação; nota "Nenhuma linha é alterada ou apagada (D-12)"; trigger no banco bloqueia UPDATE/DELETE |
| AC-7 | "Iniciar Execução" marca plano como baseline (D-10) | ✅ `eh_baseline = true` em `plano_entrega`; `exec_estado = 'IN_EXECUTION'` em `projetos`; cache em memória atualizado |
| AC-8 | Ratificação de bloco sem alteração | ✅ `status = 'RATIFICADO'` em `plano_entrega_bloco`; linha inserida em `registro_planejamento` |

---

## SQL a rodar em produção

Rodar **uma vez** no Supabase SQL Editor:

```
sql/2026-09-29_fase5_execucao_plano.sql
```

Resumo:
```sql
ALTER TABLE projects ADD COLUMN IF NOT EXISTS exec_estado TEXT DEFAULT 'READY_FOR_EXECUTION';

CREATE TABLE IF NOT EXISTS plano_entrega (...);
CREATE TABLE IF NOT EXISTS plano_entrega_bloco (...);
CREATE TABLE IF NOT EXISTS registro_planejamento (...);

-- Trigger append-only em registro_planejamento (bloqueia UPDATE/DELETE)
CREATE TRIGGER trg_rp_no_update ...
CREATE TRIGGER trg_rp_no_delete ...

-- + recria view projetos + 3 triggers INSTEAD OF (padrão Fase 3/4)
```

**O app funciona sem o SQL** — aba Resumo mostra o estado `READY_FOR_EXECUTION` sem dados de plano; a aba Plano de Entrega mostra o formulário de criação. O SQL é necessário para persistir dados reais.

---

## Arquitetura do Workspace de Execução

```
etapa-dispatcher.js
    renderEtapaProjeto('etapa_execucao', ...) → renderWorkspaceExec(projeto, bodyId)

workspace-exec.js
    renderWorkspaceExec()
        ↳ _execCarregarPlano()        — carrega plano_entrega + blocos + registro
        ↳ _execRenderStepper()        — stepper de 6 fases (Req → Spec → Exec → UAT → Go Live → Encerramento)
        ↳ _execRenderInfoStrip()      — cabeçalho: código, nome, estado, versão do plano, owner, FY, valor
        ↳ _execRenderTabBar()         — 10 abas em 5 grupos
        ↳ mudarAbaExec(aba)
            ↳ _execRenderResumo()         — KPI cards + ação contextual por estado
            ↳ _execRenderPlanoEntrega()
                ↳ _execRenderFormCriarPlano()     — quando plano=null
                ↳ _execRenderTimelinePlano()      — Gantt relativo 3 blocos + legenda
                ↳ _execRenderRegistroPlanejamento() — tabela append-only
            ↳ _execRenderStub(aba)     — 8 abas stub com ícone
    Ações assíncronas:
        _execSalvarPlano()        — INSERT plano_entrega + plano_entrega_bloco + registro
        _execIniciarExecucao()    — marca baseline + muda exec_estado
        _execRatificarBloco()     — UPDATE status + INSERT registro
        _execAbrirFormRetificacao() — stub (Fase 5+)
```

---

## Limitações / Fase 6+

- **Retificação de bloco**: botão presente, abre alerta explicativo; implementação real (nova versão do plano, propagação de `REQUER_RATIFICACAO` para blocos dependentes) fica para Fase 6.
- **Abas stub** (Pacotes de Trabalho, Cronograma, Tarefas, Times, Financeiro, RAID, Mudanças, Liberação para UAT, Histórico): exibem "Em desenvolvimento — Fase 5+" com ícone.
- **`exec_estado`** gravado via `UPDATE projetos` passa pelo trigger INSTEAD OF da view — roteia corretamente para `projects` sem mudança de código.
- **Cache `projectsData`**: atualizado in-place ao Iniciar Execução (`exec_estado: 'IN_EXECUTION'`); sem reload da página necessário.

---

## Badges e Status dos Blocos

| status | Badge |
|---|---|
| PLANEJADO | cinza — "Planejado" |
| RATIFICADO | verde — "Ratificado" |
| RETIFICADO | âmbar — "Retificado" |
| REQUER_RATIFICACAO | vermelho — ⚠ "Requer ratificação" (barra tracejada na timeline) |
