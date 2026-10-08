# AUDITORIA_FASE0_COMPLEMENTO.md

**Produto:** Compasso 2.0  
**Revisão:** 2026-10-08  
**Responsável:** Sergio Albino / Cognitionis  
**Base:** RESPOSTA_AUDITORIA_FASE0.md (seções 2.1 a 2.4)  
**Dados:** `sql/2026-09-30_fase0_contagens.sql` rodado em produção (2026-10-08)

---

## 2.1 Business Case — Auditoria contra o caderno M05

### Inventário de dados reais

| Métrica | Valor |
|---|---|
| Total de BCs | 12 |
| BCs que se tornaram Projects (etapa_atual <> 'BUSINESS CASE') | 11 |
| BCs com val_bc = null ou 0 | 0 |
| BCs com horas_bc = null ou 0 | 0 |
| is_adhoc = true | 0 |

| sub_status em produção | qtd |
|---|---|
| A PLANEJAR | 3 |
| EM ANDAMENTO | 4 |
| HOLD | 4 |
| CANCELADO | 1 |
| APROVADO (READY_FOR_FY) | 0 |

### Mapeamento sub_status → estados M05

O caderno M05 não nomeia os estados do BC como "A PLANEJAR" ou "EM ANDAMENTO". Os estados canônicos derivam dos momentos definidos em `m05_pendencias.json`: CR, RF, PL, CA, CE, EO, DO, RT, IF, DF, FF, TO. As correspondências identificadas:

| sub_status em produção | Estado canônico M05 (aproximado) | Observação |
|---|---|---|
| A PLANEJAR | Pré-CR (RASCUNHO / EM_CONSTRUCAO) | Label legado, pré-registro formal |
| EM ANDAMENTO | RF a EO (faixa ampla) | Vago; cobre Avaliação, Estimativa e Orçamento |
| HOLD | HOLD | Coincide com o estado HOLD do BC-038 / M12A |
| CANCELADO | CN (cancelado, via PC.1) | Corresponde ao momento de cancelamento |

Nenhum BC está em APROVADO (sub_status que equivale a READY_FOR_FY, pré-IF). Isso confirma que o fluxo de pacote FY nunca foi acionado em produção: nenhum BC percorreu o caminho RF → PL → CA → CE → EO → DO → IF.

### ORÇAMENTO REALIZADO

A query de busca (`WHERE sub_status ILIKE '%REALIZADO%' OR sub_status ILIKE '%ORCAMENTO%'`) retornou zero linhas. O estado não existe em produção e não existe no vocabulário do M05 V3.2. Origem provável: terminologia de versão anterior ao M05 V3, descontinuada.

### val_bc / horas_bc (baseline financeira)

Todos os 11 Projects têm val_bc e horas_bc preenchidos (nenhum é null ou zero). Contudo, o motor EST-01 não está implementado — nenhuma tela de produção preenche esses campos pelo fluxo canônico (validado em `js/projects/core.js:349`, `saveBusinessCase()`). Os valores existentes foram gravados pelo seed de teste (`js/dev-tools/criar-teste.js:339`). Para efeito de auditoria M05, a entidade ESTIMATIVA (EST-01) não tem correspondência real em produção.

### bc_package_status — divergência de enum

A tabela `fiscal_years` usa `bc_package_status TEXT CHECK IN ('ABERTO', 'FECHADO')`, implementado na Fase 2B. O M12A (campo FY-09) define o enum como `NAO_INICIADO · EM_COMPOSICAO · EM_APROVACAO · FECHADO`. AF2026 (CLOSED) e AF2027 (PLANNING) mostram ambos o valor `ABERTO`, que não existe no vocabulário M12A. A Fase 1A deverá incluir a migração desse enum.

### Campos M05 auditados contra business_cases

| Código M05 | Nome | Coluna na tabela | Status |
|---|---|---|---|
| BC-001 | Nome do BC | nome | EXISTE |
| BC-002 | Código do BC | codigo | EXISTE (prefixo legado) |
| BC-003 | Ano Fiscal | ano_fiscal | EXISTE (TEXT) |
| BC-004 | Tipo de enquadramento | — | AUSENTE (REGULAR/EXTRAORDINARY não persistido) |
| BC-005 | Iniciativas Estratégicas | — | AUSENTE (sem tabela de vínculo) |
| BC-006 | Objetivo | descricao (parcial) | PARCIAL |
| BC-007 | Key Results | — | AUSENTE (sem entidade KEY_RESULT) |
| BC-008 | Sponsor | pessoa_solicitante | PARCIAL (sem papel Sponsor) |
| BC-009 | History | — | AUSENTE |
| BC-010 | Retorno / Benefícios | return_benefit (TEXT) | PARCIAL (sem MULTI_LOOKUP) |
| BC-011 | Descrição | descricao | PARCIAL (sem rich text) |
| BC-012 | Entregáveis | — | AUSENTE (sem entidade ENTREGAVEL) |
| BC-013 | Cadeia de Valor | — | AUSENTE (sem entidade CADEIA_VALOR) |
| BC-014 | Dependências | — | AUSENTE (sem entidade DEPENDENCIA) |
| BC-015 | Aceite das áreas | — | AUSENTE |
| BC-016 | Impacto (Cost of Delay) | — | AUSENTE |
| BC-017 | Restrições | — | AUSENTE (sem entidade RESTRICAO) |
| BC-018 | Benefícios | — | AUSENTE (sem entidade BENEFICIO) |
| BC-019 | Observações | observacoes | EXISTE |
| BC-020 | Documentos | — | AUSENTE |
| BC-025 | Owner do BC | criado_por | PARCIAL |
| BC-026 | Área proponente | area_solicitante_id | EXISTE |
| BC-027 | Produtos | produtos (TEXT) | PARCIAL |
| BC-028 | Natureza da demanda | — | AUSENTE |
| BC-033 | Riscos | — | AUSENTE (sem entidade RISCO) |
| BC-038 | Regime fiscal previsto | — | AUSENTE (FY_BOUND/CROSS_FY não persistido) |
| SYS-01 | Estado | sub_status + etapa_atual | PARCIAL (legado, não coincide com M05) |
| E1-x | ESTIMATIVA (EST-01) | val_bc / horas_bc (proxy) | PARCIAL (seed only; motor ausente) |
| BU-x | ORCAMENTO | — | AUSENTE |
| PKG-x | PACOTE_FY | — | AUSENTE (bc_package_status simplificado) |

O escopo da Fase 2 (M05) contemplará a criação das entidades ausentes. Esta auditoria fecha o inventário de lacunas para essa fase.

---

## 2.2 ADM — Correções e complementos

### 6ª família de Configurações

Confirmado no ADM_CADERNO_CONSTRUCAO_V1_0.md: a família "Parâmetros do Sistema" existe e é a 6ª família do SCR-25. O menu canônico completo é:

- Cadastros (SCR-23): Estrutura Organizacional · Pessoas e Entidades · Portfólio e Projetos · Estratégia
- Administração (SCR-24): Acesso e Segurança · Organização do Trabalho · Governança de Autoridade · Processos e SLA · Integrações e Operação · Auditoria
- Configurações (SCR-25): Organização e Licença · Planejamento e Projetos · Financeiro · Comunicação · Inteligência Artificial · Parâmetros do Sistema

A Fase 1A precisará implementar as três superfícies com as 30 VIEWs distribuídas pelas famílias.

### modulo_funcao — lacuna ADM

A tabela `modulo_funcao` tem hoje 62 entradas em 6 módulos (EMAIL=4, FINANCEIRO=12, IA=2, NUCLEO=19, PLANEJAMENTO_ESTRATEGICO=1, WORKFLOW=24). Nenhuma entrada existe para módulo ADM. O catálogo de funções administrativas definido em `adm_funcoes.json` precisará ser inserido via SQL na Fase 1A, conforme R-ADM-23 (modulo_funcao como fonte de verdade da licença).

### 30 VIEWs — distribuição por superfície

| Superfície | Família | VIEWs |
|---|---|---|
| SCR-23 Cadastros | Estrutura Organizacional | VIEW-CAD-ORG |
| | Pessoas e Entidades | VIEW-CAD-PESSOAS · VIEW-CAD-CARGOS · VIEW-CAD-PORTES · VIEW-CAD-FORNECEDORES |
| | Portfólio e Projetos | VIEW-CAD-CLASSIFICACOES |
| | Estratégia | VIEW-CAD-ESTRATEGIA |
| SCR-24 Administração | Acesso e Segurança | VIEW-ADM-USUARIOS · VIEW-ADM-PERFIS |
| | Organização do Trabalho | VIEW-ADM-EQUIPES · VIEW-ADM-APTIDOES |
| | Governança de Autoridade | VIEW-ADM-ALCADAS · VIEW-ADM-DELEGACOES · VIEW-ADM-SOD |
| | Processos e SLA | VIEW-ADM-WORKFLOW · VIEW-ADM-SLA |
| | Integrações e Operação | VIEW-ADM-INTEGRACOES · VIEW-ADM-SESSOES |
| | Auditoria | VIEW-ADM-AUDITORIA |
| SCR-25 Configurações | Organização e Licença | VIEW-CFG-ORGANIZACAO · VIEW-CFG-LICENCA |
| | Planejamento e Projetos | VIEW-CFG-FY |
| | Financeiro | VIEW-CFG-FINANCEIRO · VIEW-CFG-RATECARDS |
| | Comunicação | VIEW-CFG-TEMPLATES · VIEW-CFG-EVENTOS |
| | Inteligência Artificial | VIEW-CFG-IA |
| | Parâmetros do Sistema | VIEW-CFG-ESTIMATIVAS · VIEW-CFG-NOTIFICACOES |

Total: 7 (SCR-23) + 12 (SCR-24) + 11 (SCR-25) = 30 VIEWs.

### Destinos incorretos identificados no código legado (5 correções)

Os arquivos JS abaixo precisarão ser apontados para as VIEWs corretas durante a Fase 1A:

| Arquivo JS legado | Destino atual | VIEW destino correta |
|---|---|---|
| `js/config/cargos.js` | menu Parâmetros legado | VIEW-CAD-CARGOS (SCR-23) |
| `js/config/auditoria.js` | menu Parâmetros legado | VIEW-ADM-AUDITORIA (SCR-24) |
| `js/config/prazos.js` | menu Parâmetros legado | VIEW-ADM-SLA (SCR-24) |
| `js/rate-card/rate-card.js` | menu Financeiro legado | VIEW-CFG-RATECARDS (SCR-25) |
| `js/notifications/` | menu Parâmetros legado | VIEW-CFG-NOTIFICACOES (SCR-25) |

### Verificações de papel de negócio (VIEW-ADM-ALCADAS — D8)

As verificações fixas a seguir continuam no código conforme D8 (R-ADM-42, R-ADM-23); não são substituídas por VIEW-ADM-ALCADAS, mas precisam ter equivalente documentado como alçadas de referência naquela VIEW:

| Verificação no código | Localização | Natureza |
|---|---|---|
| `ehAdministrador` | `js/config/funcoes.js` + múltiplos | Flag RBAC do perfil |
| `ehProprietario` | `js/config/funcoes.js` + múltiplos | Flag de papel Proprietário |
| `ignoraRestricaoArea` | `js/core/state.js` | Flag de escopo organizacional |
| `restringePorAtividadeResponsavel` | `js/core/state.js` | Restrição por atividade |

---

## 2.3 Ano Fiscal — Auditoria contra o caderno M12A

### Inventário de dados reais

| Objeto | Estado |
|---|---|
| fiscal_years | 2 registros (AF2026 CLOSED, AF2027 PLANNING) |
| project_fiscal_transition | 0 linhas (tabela criada, sem dados) |
| fiscal_year_closing | 0 linhas (tabela criada, sem dados) |
| project_fiscal_plan | 0 linhas (tabela criada, sem dados) |

### Campos M12A FISCAL_YEAR auditados contra fiscal_years

| Campo M12A | ID | Coluna em fiscal_years | Status |
|---|---|---|---|
| fiscal_year_id | FY-01 | id (SERIAL, não UUID) | PARCIAL |
| tenant_id | FY-02 | — | AUSENTE (multi-tenant não implementado) |
| organization_scope_id | FY-03 | — | AUSENTE |
| code | FY-04 | codigo (TEXT) | EXISTE |
| name | FY-05 | — | AUSENTE (sem campo nome) |
| start_date | FY-06 | data_inicio (DATE) | EXISTE |
| end_date | FY-07 | data_fim (DATE) | EXISTE |
| status | FY-08 | status TEXT CHECK(...) | PARCIAL (enum correto, sem máquina de estados formal) |
| bc_package_status | FY-09 | bc_package_status TEXT | PARCIAL (enum ABERTO/FECHADO vs NAO_INICIADO/EM_COMPOSICAO/EM_APROVACAO/FECHADO) |
| previous_fiscal_year_id | FY-10 | — | AUSENTE |
| next_fiscal_year_id | FY-11 | — | AUSENTE |
| work_calendar_id | FY-12 | — | AUSENTE |
| policy_version | FY-13 | — | AUSENTE |
| fiscal_regimes_allowed | FY-14 | — | AUSENTE (FY_BOUND/CROSS_FY) |
| budget_capability | FY-15 | — | AUSENTE |
| budget_ceiling | FY-16 | — | AUSENTE |
| hour_rate_ref | FY-17 | — | AUSENTE |
| activated_at / activated_by | FY-18 | aberto_em / aberto_por | PARCIAL |
| current_closing_id | FY-19 | — | AUSENTE |
| reopen_count | FY-20 | — | AUSENTE |
| row_version | FY-21 | — | AUSENTE (sem controle de concorrência) |
| created_at/by, updated_at/by | FY-22 | created_at / updated_at | PARCIAL (sem by) |

As ausências são esperadas para esta fase de implementação simplificada (Fase 2A). A Fase correspondente ao M12A completo (classificada como Fase 3 no D11) cobrirá os campos faltantes.

### Objetos M12A criados mas vazios (esperado)

As tabelas `project_fiscal_transition`, `fiscal_year_closing` e `project_fiscal_plan` foram criadas nas Fases 3A a 3E, mas têm zero linhas porque o fluxo operacional completo (virada de exercício, carryover, transições) nunca foi executado em produção. Isso é o estado correto para o momento: schema pronto, dados aguardando o primeiro uso real.

### Anomalia: AF2026 CLOSED sem registro de fiscal_year_closing

O AF2026 tem `fy_status = CLOSED`, mas `fiscal_year_closing` tem zero linhas. Isso significa que o AF2026 foi marcado como fechado diretamente via UPDATE na coluna `status`, sem passar pela entidade de fechamento. A regra M12A R-FC-04 exige que o fechamento crie um `FISCAL_YEAR_CLOSING` com snapshot imutável. O fechamento do AF2026 existente é "bare" e não tem evidência fiscal auditável.

Essa anomalia não bloqueia a Fase 1A, mas precisará ser endereçada na Fase 3 (M12A completo): criar o registro retrospectivo de `fiscal_year_closing` para o AF2026, ou documentar formalmente que o exercício foi fechado pela via administrativa simplificada (pré-M12A) e está fora do escopo do snapshot.

### Anomalia: AF2026 CLOSED mas bc_package_status = ABERTO

O AF2026 está CLOSED. A regra M12A R-IN-04 diz que após o pacote FECHADO nenhum BC regular pode entrar no exercício. Se o bc_package_status permanece ABERTO para um FY já CLOSED, há inconsistência: ou o pacote deveria ter sido fechado antes do exercício, ou o campo reflete que o pacote nunca foi formalmente fechado (o FY foi encerrado sem ter completado o ciclo de BC). A situação é coerente com a anomalia anterior (sem fiscal_year_closing), confirmando que o AF2026 foi fechado de forma administrativa, não pelo fluxo M12A.

### Derivações de ano civil em fiscal-year.js

**Arquivo:** `js/core/fiscal-year.js`

O arquivo documenta explicitamente o R-FY-03 no cabeçalho (linha 13) e no comentário da linha 67. A análise linha a linha confirma:

| Situação | Comportamento | Linha(s) | R-FY-03 |
|---|---|---|---|
| `dataRef` passado explicitamente | Usa cálculo por data (histórico, mês de início parametrizado) | 54-65 | OK (exceção documentada: cálculo histórico) |
| Cache vazio, sem `dataRef` | Usa cálculo por `YEAR(date)` como fallback de inicialização | 82-86 | OK (exceção documentada: boot) |
| Cache populado, AF em OPEN | Lê `afAtualStr` do cache (banco); `proximoAFStr` do cache ou `AF${ano+1}` | 71-78 | PARCIAL (próximo FY fallback usa civil year) |
| Cache populado, **sem AF em OPEN** | Usa `AF${anoFiscalCorrente}` e `AF${anoFiscalCorrente + 1}` | 79-86 | VIOLAÇÃO RESIDUAL |

O cenário de violação residual é exatamente o estado atual de produção: AF2026 está CLOSED (não OPEN) e AF2027 está PLANNING (não OPEN). Quando qualquer tela chama `getInfoAnoFiscal()` sem `dataRef`, o código cai no bloco das linhas 79-86 e deriva `afAtualStr` e `proximoAFStr` por YEAR(date). Isso é um desvio do R-FY-03 que afeta a produção hoje.

**Recomendação:** `getAFAberto()` deveria ser estendida para também retornar um FY em PLANNING ou BUDGETING quando não há OPEN, de modo que `getInfoAnoFiscal()` nunca precise cair no cálculo por data para determinar o AF "atual" em ambiente de produção. A função `getAFEmPlanejamento()` (linha 42) já existe para esse propósito mas não é usada nesse path.

### Regras M12A — situação de implementação

Das 58 regras do `m12a_regras.json`, as pertencentes aos grupos R-FY e R-PE foram parcialmente implementadas via schema e código. Os grupos R-TR (transições), R-FC (fechamento) e R-RA (reabertura) têm as tabelas criadas mas sem lógica operacional, correspondendo ao estado "schema ready, lógica pendente" de Fases 3A a 3E.

### Readiness M12A — situação dos 16 requisitos

Dos 16 requisitos RD-01 a RD-16:

- RD-04 (próximo exercício configurado): ATENDIDO — AF2027 em PLANNING
- RD-09 (períodos fiscais válidos): NÃO AVALIÁVEL — tabela `fiscal_periods` não implementada nesta fase
- RD-11 (calendário útil): NÃO AVALIÁVEL — `work_calendar_id` ausente
- RD-16 (pacote de BC do próximo exercício fechado): NÃO ATENDIDO — AF2027 bc_package_status = ABERTO
- RD-01 a RD-03, RD-05 a RD-08, RD-10: NÃO APLICÁVEL nesta fase (dependem de PROJECT_FISCAL_YEAR e transições, que têm zero dados)

O RD-16 é Informativo (não Blocker), portanto não impede nada. O readiness completo só é avaliável após a Fase 3 (M12A operacional).

---

## 2.4 Registro de Planejamento — Bloqueio de UPDATE e DELETE

### Evidência da consulta SQL

```sql
-- Triggers confirmados em produção:
trigger_name          | event_manipulation | action_timing | action_statement
----------------------|--------------------|---------------|------------------------------------
trg_rp_no_delete      | DELETE             | BEFORE        | EXECUTE FUNCTION _bloquear_registro_planejamento()
trg_rp_no_update      | UPDATE             | BEFORE        | EXECUTE FUNCTION _bloquear_registro_planejamento()
```

```sql
-- Policies RLS em registro_planejamento:
(nenhuma linha retornada)
```

### Conclusão

UPDATE e DELETE na tabela `registro_planejamento` são bloqueados por dois triggers BEFORE que chamam `_bloquear_registro_planejamento()`. A proteção é no nível do banco de dados (triggers Postgres), independente de RLS ou de qualquer camada de aplicação. Não há RLS na tabela; a proteção é exclusivamente via trigger.

Esse mecanismo satisfaz o requisito da RESPOSTA_AUDITORIA_FASE0 seção 2.4: o registro de planejamento é append-only por construção de banco.

---

## Síntese executiva

| Seção | Status | Observação principal |
|---|---|---|
| 2.1 BC vs M05 | AUDITADO | 12 BCs em produção; sub_status legados mapeados; EST-01 ausente; bc_package_status com enum divergente do M12A |
| 2.2 ADM | AUDITADO | 30 VIEWs catalogadas; 5 destinos errados identificados; 6ª família confirmada (Parâmetros do Sistema); modulo_funcao sem entradas ADM |
| 2.3 AF vs M12A | AUDITADO | Schema simplificado esperado; 2 anomalias (AF2026 sem FYC, bc_package_status ABERTO); violação residual R-FY-03 em produção (fiscal-year.js linhas 79-86) |
| 2.4 Registro de Planejamento | CONFIRMADO | Proteção via 2 triggers BEFORE; append-only garantido no banco |

O complemento fecha o inventário da Fase 0. As anomalias identificadas não bloqueiam a Fase 1A (módulo ADM), que pode iniciar mediante aprovação deste documento.
