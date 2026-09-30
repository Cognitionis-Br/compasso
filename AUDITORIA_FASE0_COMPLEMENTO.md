# Auditoria Fase 0 — Complemento
**Data:** 30/09/2026  
**Referência:** RESPOSTA_AUDITORIA_FASE0.md, seção 2 (correções 2.1–2.4)

---

## Seção 2.1 — Business Case × m05_campos.json e m05_pendencias.json

### 1. Tabela de campos (160 campos)

Legenda: **E** = Existe · **P** = Parcial · **N** = Não existe  
"Existe" = coluna/entidade no banco com semântica equivalente.  
"Parcial" = campo presente mas com tipo/modelo diferente do caderno (ex.: texto em vez de FK).

#### BUSINESS_CASE — 44 campos

| ID | Nome | Status | Onde está / observação |
|----|------|--------|------------------------|
| BC-001 | Nome do BC | E | `projetos.nome` |
| BC-002 | Código do BC | P | `projetos.codigo` (formato `PRJ-AAAA-NNN`); novo formato `BC-AAAA-NNNN` aguarda D1. Coluna `codigo_formato` a criar. |
| BC-003 | Ano Fiscal | P | `projetos.ano_fiscal` (TEXT); caderno exige FK → `FISCAL_YEAR` |
| BC-004 | Tipo de enquadramento | P | `projetos.is_adhoc` (BOOLEAN); caderno exige ENUM `REGULAR_FY / EXTRAORDINARY` |
| BC-005 | Iniciativas Estratégicas | N | Sem tabela ou coluna para múltiplas iniciativas |
| BC-006 | Objetivo | N | Não separado de BC-011 (Descrição) |
| BC-007 | Key Results | N | Entidade KEY_RESULT inexistente |
| BC-008 | Sponsor | P | `projetos.pessoa_solicitante` sem validação de papel Sponsor |
| BC-009 | History | N | Sem campo |
| BC-010 | Retorno / Benefícios (categorias) | N | Sem tabela de categorias vinculadas ao BC |
| BC-011 | Descrição | P | `projetos.descricao` sem estrutura de seções obrigatórias |
| BC-012 | Entregáveis | N | Entidade ENTREGAVEL inexistente |
| BC-013 | Cadeia de Valor | N | Entidade CADEIA_VALOR inexistente |
| BC-014 | Dependências | N | Entidade DEPENDENCIA inexistente |
| BC-015 | Aceite das áreas | N | Workflow de aceite inexistente |
| BC-016 | Impacto pelo não resultado | N | Entidade IMPACTO inexistente |
| BC-017 | Restrições | N | Entidade RESTRICAO inexistente |
| BC-017a | Declaração: sem restrições | N | Sem campo booleano |
| BC-018 | Benefícios | N | Entidade BENEFICIO inexistente |
| BC-019 | Observações | P | `projetos.observacoes` ou `notas` (coluna existe mas não confirmada) |
| BC-020 | Documentos | P | `project_documents` (FK `projeto_codigo`); sem classificação, hash, versionamento formal |
| BC-021 | Motivo extraordinário | P | Coluna existe parcialmente para adhoc; sem ENUM de motivos |
| BC-022 | Data limite extraordinária | P | `projetos.dt_prazo_adhoc` ou equivalente parcial |
| BC-023 | Motivo de não previsão no FY | N | Sem campo |
| BC-024 | Origem proposta de recursos | N | Sem campo |
| BC-025 | Owner do BC | P | `projetos.responsavel` ou `pessoa_responsavel`; sem validação de papel Owner |
| BC-026 | Área proponente | P | `projetos.area_responsavel` ou equivalente; sem FK estruturada |
| BC-027 | Produtos | P | `projetos.produto` (texto simples); caderno exige MULTI_LOOKUP |
| BC-028 | Natureza da demanda | N | Sem campo |
| BC-029 | BC ou Project de continuidade | N | Sem campo |
| BC-030 | Urgência (extraordinário) | N | Sem ENUM |
| BC-031 | Consequência de aguardar | N | Sem campo |
| BC-032 | Iniciativas repriorizadas | N | Sem multi-lookup |
| BC-033 | Riscos | N | Entidade RISCO inexistente |
| BC-034 | Editores | N | Sem suporte a múltiplos editores |
| BC-035 | Premissas | N | Entidade PREMISSA inexistente |
| BC-036 | BC de origem (retomada) | N | Sem campo |
| BC-037 | Motivo do cancelamento | P | Campo parcialmente implementado |
| BC-038 | Regime fiscal previsto | N | Sem campo `FY_BOUND / CROSS_FY` |
| BC-039 | Exercício de término previsto | N | Sem campo |
| SYS-01 | Estado | P | `etapa_atual` + `sub_status` (ver seção 1.3); modelo diferente do caderno |
| SYS-02 | Versão formal / revisão | N | Sem versionamento de BC |
| SYS-04 | Controle de concorrência | N | Sem `lock_version` por seção |
| SYS-05 | Contexto organizacional | N | Sem multi-tenancy implementado |

#### KEY_RESULT — 11 campos: todos N
Entidade KEY_RESULT não existe. Nenhum dos campos KR-01 a KR-13 está implementado.

| ID | Nome | Status |
|----|------|--------|
| KR-01 | ID | N |
| KR-02 | Descrição do resultado | N |
| KR-04 | Tipo | N |
| KR-05 | Indicador / KPI | N |
| KR-06 | Unidade | N |
| KR-07 | Baseline | N |
| KR-08 | Target | N |
| KR-09 | Direção | N |
| KR-10 | Prazo | N |
| KR-11 | Fonte de medição | N |
| KR-13 | Status | N |

#### ENTREGAVEL — 9 campos: todos N
Entidade ENTREGAVEL não existe. Nenhum dos campos ENT-01 a ENT-11 está implementado.

| ID | Nome | Status |
|----|------|--------|
| ENT-01 | ID | N |
| ENT-02 | Nome | N |
| ENT-03 | Descrição | N |
| ENT-05 | Ordem | N |
| ENT-07 | Prazo macro | N |
| ENT-08 | Área líder | N |
| ENT-10 | KRs relacionados | N |
| ENT-11 | Status | N |
| ENT-12 | Tipo de entregável | N |

#### CADEIA_VALOR — 7 campos: todos N
| ID | Nome | Status |
|----|------|--------|
| VCE-01 | ID da etapa | N |
| VCE-02 | Entregável | N |
| VCE-03 | Ordem | N |
| VCE-04 | Nome da etapa | N |
| VCE-05 | Áreas | N |
| VCE-06 | Sistema | N |
| VCE-07 | Observação | N |

#### DEPENDENCIA — 13 campos: todos N
| ID | Nome | Status |
|----|------|--------|
| DEP-01 | ID | N |
| DEP-02 | Tipo | N |
| DEP-03 | Área | N |
| DEP-04 | Fornecedor | N |
| DEP-05 | Responsável pelo aceite | N |
| DEP-06 | Entregáveis envolvidos | N |
| DEP-07 | O que a área deve fazer | N |
| DEP-09 | Natureza da dependência | N |
| DEP-11 | Prazo para resposta | N |
| DEP-12 | Status | N |
| DEP-13 | Revisão | N |
| DEP-14 | Interações | N |
| DEP-15 | Compliance do fornecedor | N |

#### IMPACTO — 7 campos: todos N
| ID | Nome | Status |
|----|------|--------|
| COD-01 | ID | N |
| COD-02 | Tipo de impacto | N |
| COD-03 | Descrição com dados | N |
| COD-05 | Valor estimado | N |
| COD-06 | Periodicidade do valor | N |
| COD-07 | Evidência | N |
| COD-08 | Título | N |

#### RESTRICAO — 4 campos: todos N
| ID | Nome | Status |
|----|------|--------|
| RES-01 | ID | N |
| RES-02 | Tipo | N |
| RES-04 | Descrição | N |
| RES-06 | Data limite | N |

#### RISCO — 4 campos: todos N
| ID | Nome | Status |
|----|------|--------|
| RSK-01 | ID | N |
| RSK-03 | Descrição | N |
| RSK-04 | Probabilidade / Impacto | N |
| RSK-05 | Mitigação | N |

#### PREMISSA — 2 campos: todos N
| ID | Nome | Status |
|----|------|--------|
| PRE-01 | ID | N |
| PRE-02 | Descrição | N |

#### BENEFICIO — 5 campos: todos N
| ID | Nome | Status |
|----|------|--------|
| BEN-01 | ID | N |
| BEN-02 | Nome | N |
| BEN-03 | Tipo | N |
| BEN-04 | Descrição | N |
| BEN-09 | KR relacionado | N |

#### DOCUMENTO — 9 campos
`project_documents` existe, mas com esquema diferente do caderno.

| ID | Nome | Status | Observação |
|----|------|--------|------------|
| DOC-02 | Tipo de documento | P | Coluna existe; sem catálogo PAR-06 |
| DOC-03 | Título | P | Provavelmente `nome` ou `titulo` |
| DOC-05 | Classificação | N | Sem ENUM INTERNO/RESTRITO/CONFIDENCIAL |
| DOC-06 | Vínculo | P | FK `projeto_codigo` mas sem polimorfismo (DEP, COD etc.) |
| DOC-07 | Versão | N | Sem versionamento formal |
| DOC-08 | Arquivo | E | URL do arquivo armazenado |
| DOC-09 | Hash SHA-256 | N | Sem hash |
| DOC-11 | Status da versão | N | Sem VIGENTE/SUBSTITUIDA/RETIRADA |
| DOC-13 | Resumo da alteração | N | Sem campo |

#### PLANEJAMENTO_TEC — 4 campos: todos N
Entidade inexistente. Tecnologia não tem tela de planejamento da avaliação.

| ID | Nome | Status |
|----|------|--------|
| PLA-01 | Coordenador da avaliação | N |
| PLA-02 | SLA aplicado | N |
| PLA-03 | Atividades | N |
| PLA-04 | Justificativa de prazo | N |

#### AVALIACAO_TEC — 9 campos: todos N
Entidade inexistente. Os campos TEC-* (complexidade, sistemas, disciplinas etc.) não existem no banco.

| ID | Nome | Status |
|----|------|--------|
| TEC-03 | Complexidade | N |
| TEC-04 | Justificativa da complexidade | N |
| TEC-05 | Sistemas impactados | N |
| TEC-05a | Declaração: sem sistema | N |
| TEC-07 | Disciplinas | N |
| TEC-10 | Riscos técnicos | N |
| TEC-11 | Parecer técnico | N |
| TEC-13 | Solicitações de complemento | N |
| TEC-14 | Tamanho por entregável | N |

#### ESTIMATIVA — 9 campos
`business_case_estimativas` existe (V4), com esquema diferente.

| ID | Nome | Status | Observação |
|----|------|--------|------------|
| E1-01 | Versão | P | Coluna `versao` em `business_case_estimativas` |
| E1-02 | Versão do BC | N | Sem versionamento de BC; FK implícita por `business_case_codigo` |
| E1-03 | Método / versão do motor | N | Sem snapshot do método |
| E1-06 | Horas | P | `itens` JSONB contém horas por papel, mas não por entregável × disciplina × fase |
| E1-08 | Valor calculado | P | `custo_estimado` existe |
| E1-09 | Contingência | N | Sem campo de contingência |
| E1-10 | Faixa de confiança | N | Sem campo |
| E1-12 | Status | N | Sem status SOLICITADA/CALCULADA/CONCLUIDA |
| E1-13 | Valor médio da hora | P | `rate_card_papeis.valor_hora` existe mas não é snapshot por FY |

#### ORCAMENTO — 11 campos
Sem entidade ORCAMENTO dedicada. Somente `business_cases.val_bc` e `horas_bc` (totais).

| ID | Nome | Status | Observação |
|----|------|--------|------------|
| BU-01 | Versão | N | Sem versionamento de orçamento |
| BU-02 | EST-01 de origem | N | Sem vínculo formal |
| BU-03 | Linhas (Categoria × CAPEX/OPEX) | N | Apenas total; sem linhas detalhadas |
| BU-05 | Distribuição por período | N | Sem grade Q1–Q4 |
| BU-06 | Rateio por Produto/Área | N | Sem rateio |
| BU-07 | Totais | P | `val_bc` / `horas_bc` em `business_cases` |
| BU-10 | Status | P | Mapeado parcialmente via `sub_status`; ver seção 1.3 |
| BU-11 | Classificação orçamentária | N | Derivado de `is_adhoc` mas sem ENUM formal |
| OD-01 | Decisão do Owner | P | `status_comite` em `projetos` (APROVADO/REPROVADO) |
| OD-02 | Observações | P | `observacao_comite` em `projetos` |
| OD-04 | Campos alterados no ajuste | N | Sem diff de versão |

#### PACOTE_FY — 5 campos
`pacotes_fy` e `pacote_fy_itens` existem (V4), mas com modelo simplificado.

| ID | Nome | Status | Observação |
|----|------|--------|------------|
| PKG-01 | FY | P | `pacotes_fy.ano_fiscal` (TEXT); caderno exige FK → FISCAL_YEAR |
| PKG-02 | Linhas | P | `pacote_fy_itens` tem `business_case_codigo` e `valor_incluido`; sem decisão por BC, versão, status no FY |
| PKG-03 | Totais | P | `pacotes_fy.valor_total` e `qtd_projetos` |
| FD-01 | Decisão por BC | N | Sem coluna APROVAR/DEVOLVER/POSTERGAR/REJEITAR em `pacote_fy_itens` |
| PKG-04 | Fechamento do pacote | P | `executarAprovacaoGlobalOrcamentoAF()` executa o fechamento; sem projeto criação via R-IN-03 |

#### TRADE_OFF — 7 campos: todos N
`js/adhoc/tradeoff.js` implementa fluxo parcial, mas sem entidade TRADE_OFF no banco.

| ID | Nome | Status |
|----|------|--------|
| TRD-01 | Posição do orçamento do FY | N |
| TRD-02 | Valor do extraordinário | N |
| TRD-03 | Impacto | N |
| TRD-04 | Opção | N |
| TRD-05 | Projetos afetados | N |
| TRD-06 | Saldo após a decisão | N |
| TRD-07 | Decisões de alçada | N |

#### Resumo por situação — campos

| Situação | Quantidade |
|----------|------------|
| Existe | 5 |
| Parcial | 26 |
| Não existe | 129 |
| **Total** | **160** |

---

### 2. Tabela de regras (84 regras)

| ID | Grupo | Regra (resumo) | Status | Onde está / observação |
|----|-------|----------------|--------|------------------------|
| P00.1 | V-00 | Campos obrigatórios do PAR-01 preenchidos | P | Validação básica de campos chave existe; não parametrizada via PAR-01 |
| P00.2 | V-00 | Limites do PAR-02 respeitados | P | Algumas validações de tamanho em forms; não via PAR-02 |
| P01.2 | V-01 | Nome não repete no mesmo FY | N | — |
| P01.3 | V-01 | Status do FY compatível com o tipo | N | — |
| P01.4 | V-01 | Sponsor ativo | N | — |
| P01.5 | V-01 | Owner ativo com e-mail | N | — |
| P01.9 | V-01 | BC regular em construção com FY fechado | N | — |
| P01.10 | V-01 | Regime fiscal previsto informado | N | — |
| P01.11 | V-01 | CROSS_FY com exercício de término posterior | N | — |
| P02.2 | V-02 | Máximo 5 iniciativas | N | — |
| P02.3 | V-02 | Iniciativa selecionada está ativa | N | — |
| P04.2 | V-04 | KR quantitativo com indicador/unidade/baseline/target | N | Entidade KEY_RESULT inexistente |
| P04.3 | V-04 | Target coerente com a direção | N | — |
| P04.4 | V-04 | Prazo do KR não anterior ao início do FY | N | — |
| P04.7 | V-04 | Indicador vem do cadastro | N | — |
| P05.2 | V-05 | Annual existing program exige BC-029 | N | — |
| P07.2 | V-07 | Descrição com seções Problema e Dados | N | — |
| P08.2 | V-08 | Entregável com tipo, nome e descrição | N | Entidade ENTREGAVEL inexistente |
| P08.3 | V-08 | Prazo macro dentro do horizonte | N | — |
| P08.4 | V-08 | Entregável ligado a um KR | N | — |
| P08.5 | V-08 | Tipo de entregável ativo no PAR-05 | N | — |
| P09.1 | V-09 | Todo entregável tem cadeia com ≥ 2 etapas | N | Entidade CADEIA_VALOR inexistente |
| P09.2 | V-09 | Toda etapa tem nome e ≥ 1 área | N | — |
| P09.5 | V-09 | Toda área da cadeia (exceto proponente) tem dependência | N | — |
| P09.6 | V-09 | Área que executa etapa tem REQUER_ACEITE | N | — |
| P10.1 | V-10 | Dependência com área e responsável | N | Entidade DEPENDENCIA inexistente |
| P10.2 | V-10 | Dependência com o que a área deve fazer | N | — |
| P10.3 | V-10 | Nenhuma dependência em RASCUNHO | N | — |
| P10.4 | V-10 | Nenhuma REQUER_ACEITE sem resposta | N | — |
| P10.5 | V-10 | Nenhuma com INFORMACOES_SOLICITADAS | N | — |
| P10.6 | V-10 | Nenhuma RECUSADA | N | — |
| P10.7 | V-10 | Fornecedor com compliance completo | N | — |
| P10.8 | V-10 | Prazo de resposta não vencido | N | — |
| P10.9 | V-10 | Dependência CONHECIMENTO com ciência | N | — |
| P10.10 | V-10 | Responsável com e-mail cadastrado | N | — |
| P11.2 | V-11 | Impacto com valor tem periodicidade | N | Entidade IMPACTO inexistente |
| P11.3 | V-11 | Impacto com valor tem evidência | N | — |
| P12.1 | V-12 | ≥ 1 restrição ou declaração BC-017a | N | — |
| P12.5 | V-12 | Risco P×I ALTOS com mitigação | N | Entidade RISCO inexistente |
| P13.2 | V-13 | Máximo 10 benefícios | N | Entidade BENEFICIO inexistente |
| P13.4 | V-13 | Benefício ligado a um KR | N | — |
| P13.6 | V-13 | Descrição do benefício ≤ 10 linhas | N | — |
| P14.1 | V-14 | Documento obrigatório presente e vigente | N | — |
| P14.2 | V-14 | Documento com classificação | N | — |
| P14.3 | V-14 | Documento retirado não citado como evidência | N | — |
| P15.1 | V-15 | Motivo extraordinário com texto | P | Campo parcial em `projetos`; sem ENUM de motivos (PAR-05) |
| P15.2 | V-15 | Urgência informada | P | Sem ENUM formal, mas campo existe parcialmente |
| P15.3 | V-15 | Data limite futura | P | `dt_prazo_adhoc` ou equivalente; sem validação formal de data futura |
| P15.4 | V-15 | Motivo de não previsão no FY | N | — |
| P15.5 | V-15 | Consequência de aguardar o próximo ciclo | N | — |
| P15.6 | V-15 | Origem proposta de recursos | N | — |
| P15.7 | V-15 | Repriorização com projetos cedentes | N | — |
| P16.1 | V-16 | Nenhum MASTER_DATA_GAP bloqueante | N | — |
| PC.1 | V-01 | Cancelamento com motivo e antes do registro final | P | Lógica parcial de cancelamento existe |
| PAJ.1 | AJ | Toda solicitação de complemento da Tecnologia atendida | N | — |
| PT.1 | VT | Complexidade e justificativa | N | Entidade AVALIACAO_TEC inexistente |
| PT.2 | VT | ≥ 1 sistema impactado ou declaração | N | — |
| PT.3 | VT | ≥ 1 disciplina | N | — |
| PT.4 | VT | Risco técnico ALTO com mitigação | N | — |
| PT.5 | VT | Parecer técnico com documento TD-06 | N | — |
| PT.6 | VT | Pedido de complemento com ≥ 1 solicitação | N | — |
| PT.7 | VT | Planejamento com coordenador e atividades | N | Entidade PLANEJAMENTO_TEC inexistente |
| PT.8 | VT | Atividade não vencida | N | — |
| PT.9 | VT | Todo entregável com tamanho | N | — |
| PE.1 | VE | Motor e versão ativos no PAR-04 | P | `business_case_estimativas` existe; motor não implementado |
| PE.2 | VE | Ajuste manual de horas justificado | N | — |
| PE.4 | VE | Contingência dentro da faixa | N | — |
| PE.5 | VE | Estimativa feita sobre a versão atual do BC | N | Sem versionamento de BC |
| PE.6 | VE | Valor médio da hora vigente para o FY | N | `rate_card_papeis` não é snapshot por FY |
| PE.7 | VE | Motor retornou com sucesso | N | — |
| PO.1 | VO | Orçamento baseado em estimativa CONCLUIDA | P | `comite.js` verifica se há valor antes de aprovar |
| PO.2 | VO | Distribuição por período soma o total | N | — |
| PO.3 | VO | Toda linha com categoria e CAPEX/OPEX | N | — |
| PO.4 | VO | Rateio por Produto/Área soma 100% | N | — |
| PO.7 | VO | Reprovar / solicitar ajustes com observações | P | `observacao_comite` obrigatório em `comite.js` ao reprovar |
| PO.8 | VO | Reenvio após ajustes: dependências e obrigatórios | N | — |
| PA.2 | VA | Zero pendências bloqueantes na versão aprovada | N | — |
| PA.4 | VA | FY com orçamento ainda não fechado | P | `orcamento-af.js` verifica se FY está aberto |
| PA.5 | VA | Decisão FY ≠ aprovar tem motivo | N | — |
| PA.6 | VA | Todos os níveis de alçada decididos | N | — |
| PA.8 | VA | Nenhum BC do pacote sem decisão no fechamento | P | `orcamento-af.js` verifica todos os 'APROVADO' antes de fechar |
| PA.9 | VA | Trade-off preenchido | N | — |
| PA.10 | VA | Compensação cobre o valor (REPRIORIZACAO) | N | — |
| PA.11 | VA | Owners dos projetos afetados deram ciência | N | — |

#### Resumo por situação — regras

| Situação | Quantidade |
|----------|------------|
| Existe | 0 |
| Parcial | 15 |
| Não existe | 69 |
| **Total** | **84** |

---

### 3. Estados: mapeamento sub_status real → M05

#### Evidência no código

| Arquivo | Linha(s) | sub_status escrito | Ação que provoca |
|---------|-----------|--------------------|------------------|
| `js/approvals/comite.js` | 171 | `PLANEJADO` | "Reavaliar" (futuramente "Validar diferencial" — D-02) |
| `js/approvals/comite.js` | 195 | `APROVADO` | Comitê aprova |
| `js/approvals/comite.js` | 196 | `REPROVADO` | Comitê reprova |
| `js/approvals/orcamento-af.js` | 164 | `DEVOLVIDO_FY` | FY devolve o BC ao Owner |
| `js/adhoc/tradeoff.js` | 560 | `APROVADO` | Trade-off extraordinário aprovado |

Valores observados em filtros (não escritos, mas lidos):
- `A PLANEJAR` — lido em `orcamento-af.js:209`
- `ORÇAMENTO REALIZADO` — lido em `comite.js:28` e `orcamento-af.js:209`

#### Mapeamento para M05

| sub_status atual | Estado M05 | Observação |
|-----------------|------------|------------|
| `A PLANEJAR` | DRAFT | BC criado, sem trabalho iniciado |
| `PLANEJADO` | DRAFT / TECH_ASSESSMENT | Em construção ou devolvido pela Tecnologia para ajuste |
| `ORÇAMENTO REALIZADO` | BUDGET_PROPOSED | Tecnologia concluiu a estimativa e enviou orçamento ao Owner/Comitê para decisão (BUD-10 = ENVIADO_OWNER) |
| `APROVADO` + `etapa_atual='BUSINESS CASE'` | READY_FOR_FY | Owner/comitê aprovou; aguarda inclusão no pacote do FY |
| `APROVADO` + `etapa_atual='REQUIREMENTS'` | CONVERTED_TO_PROJECT | FY fechou; BC convertido em Project (extraordinário via `tradeoff.js` ou pacote via `orcamento-af.js`) |
| `REPROVADO` | REJECTED_BY_OWNER | Comitê reprovou |
| `DEVOLVIDO_FY` | BUDGET_REVIEW | FY devolveu ao Owner com motivo |
| *(nenhum)* | TECH_ASSESSMENT (em avaliação) | Sem estado distinto para "Tecnologia em avaliação" |
| *(nenhum)* | ESTIMATION (motor calculando) | Sem estado distinto |
| *(nenhum)* | UNDER_FY_APPROVAL | Sem estado de "em aprovação pelo FY" |
| *(nenhum)* | EXTRAORDINARY_APPROVAL | Sem estado distinto para aprovação de extraordinário |
| *(nenhum)* | CANCELLED | Sem sub_status; apenas `etapa_atual` pode indicar cancelamento |
| *(nenhum)* | DEFERRED | Sem estado de postergamento |

**Contagens reais:** ver `fase0_contagens.sql` — queries `Q01a` e `Q01b`.

#### O que é ORÇAMENTO REALIZADO

`ORÇAMENTO REALIZADO` é o estado em que a Tecnologia concluiu a estimativa (EST-01) e enviou o orçamento ao Owner/Comitê para decisão de aprovação. Corresponde ao BUD-10 = `ENVIADO_OWNER` do caderno M05. É o estado imediatamente anterior à decisão do Owner — por isso a tela do Comitê (`comite.js:28`) exibe BCs com este status como "aguardando decisão", junto com os já `APROVADO` e `REPROVADO`. No caderno M05, esse estado é `BUDGET_PROPOSED`. Após a decisão favorável do Owner, o BC passa para `APROVADO` = `READY_FOR_FY`.

---

## Seção 2.2 — Administração × adm_views.json e adm_funcoes.json

### 1. Tabela de VIEWs (30 VIEWs × status)

Legenda de Status: **E** = entidade parcialmente implementada no legado · **N** = não existe como objeto estruturado no novo modelo ADM

| VIEW ID | SCR | Família | Status | Arquivo legado (se houver) |
|---------|-----|---------|--------|---------------------------|
| VIEW-CAD-ORG | SCR-23 | Estrutura Organizacional | N | `js/config/areas.js` (parcial, só áreas planas) |
| VIEW-CAD-CARGOS | SCR-23 | Estrutura Organizacional | N | `js/config/cargos.js` |
| VIEW-CAD-PESSOAS | SCR-23 | Pessoas e Entidades | N | `js/config/pessoas.js` |
| VIEW-CAD-FORNECEDORES | SCR-23 | Pessoas e Entidades | N | `js/contratos/fornecedores.js` |
| VIEW-CAD-PORTES | SCR-23 | Portfólio e Projetos | N | Sem equivalente |
| VIEW-CAD-CLASSIFICACOES | SCR-23 | Portfólio e Projetos | N | `js/config/tipos-projeto.js`, `js/config/funcoes.js` (parcial) |
| VIEW-CAD-ESTRATEGIA | SCR-23 | Estratégia | N | `js/config/planejamento-estrategico.js` (parcial) |
| VIEW-ADM-USUARIOS | SCR-24 | Acesso e Segurança | N | `js/config/usuarios.js` |
| VIEW-ADM-PERFIS | SCR-24 | Acesso e Segurança | N | `js/config/perfis-acesso.js` |
| VIEW-ADM-SESSOES | SCR-24 | Acesso e Segurança | N | Sem equivalente |
| VIEW-ADM-EQUIPES | SCR-24 | Organização do Trabalho | N | Sem equivalente |
| VIEW-ADM-APTIDOES | SCR-24 | Organização do Trabalho | N | Sem equivalente |
| VIEW-ADM-ALCADAS | SCR-24 | Governança de Autoridade | N | Alçadas dispersas nos módulos (ver seção 2.3) |
| VIEW-ADM-DELEGACOES | SCR-24 | Governança de Autoridade | N | Sem equivalente |
| VIEW-ADM-SOD | SCR-24 | Governança de Autoridade | N | Sem equivalente |
| VIEW-ADM-WORKFLOW | SCR-24 | Processos e SLA | N | Sem equivalente estruturado |
| VIEW-ADM-SLA | SCR-24 | Processos e SLA | N | `js/config/prazos.js` |
| VIEW-ADM-INTEGRACOES | SCR-24 | Integrações e Operação | N | `js/email-queue.js` (fila de e-mail parcial) |
| VIEW-ADM-AUDITORIA | SCR-24 | Auditoria | N | `js/config/auditoria.js` |
| VIEW-CFG-ORGANIZACAO | SCR-25 | Organização e Licença | N | `js/config/empresa-licenciada.js` (parcial) |
| VIEW-CFG-LICENCA | SCR-25 | Organização e Licença | N | `js/config/licenciamento.js` |
| VIEW-CFG-FY | SCR-25 | Planejamento e Projetos | N | `js/config/periodo-ano-fiscal.js` |
| VIEW-CFG-ESTIMATIVAS | SCR-25 | Planejamento e Projetos | N | Sem equivalente |
| VIEW-CFG-RATECARDS | SCR-25 | Planejamento e Projetos | N | `js/financeiro/rate-card.js` (criado V4) |
| VIEW-CFG-FINANCEIRO | SCR-25 | Financeiro | N | `js/config/controle-orcamentario.js` (parcial) |
| VIEW-CFG-NOTIFICACOES | SCR-25 | Comunicação | N | Sem equivalente |
| VIEW-CFG-EVENTOS | SCR-25 | Comunicação | N | `js/config/emails.js` (parcial) |
| VIEW-CFG-TEMPLATES | SCR-25 | Comunicação | N | `js/config/templates-email.js` (parcial) |
| VIEW-CFG-IA | SCR-25 | Inteligência Artificial | N | `js/ia/construcao-ia.js` (parcial) |
| VIEW-CFG-PARAMETROS | SCR-25 | Parâmetros do Sistema | N | Parâmetros dispersos em múltiplos `js/config/*.js` |

**Resumo:** 0 Existe · 0 Parcial · 30 Não existe (nenhuma VIEW do novo modelo ADM está implementada).

---

### 2. Tabela de funções (80 funções × status)

Nenhuma das 80 funções do catálogo ADM existe como controle RBAC no banco. O controle atual usa verificações booleanas no JavaScript (`ehAdministrador`, `ehProprietario`, `ehResponsavel` etc.), não um modelo RBAC baseado em `PROFILE · ROLE · PERMISSION`.

Resumo por SCR:

| SCR | Funções no catálogo | Status |
|-----|---------------------|--------|
| SCR-23 (Cadastros) | 16 | 0 E · 0 P · 16 N |
| SCR-24 (Administração) | 35 | 0 E · 0 P · 35 N |
| SCR-25 (Configurações) | 29 | 0 E · 0 P · 29 N |
| **Total** | **80** | **0 E · 0 P · 80 N** |

Tabela detalhada — todas as 80 funções têm status N (Não existe):

| Função | SCR | Família | Ação |
|--------|-----|---------|------|
| CAD.ORG.LER | SCR-23 | Estrutura Organizacional | LER |
| CAD.ORG.EDITAR | SCR-23 | Estrutura Organizacional | EDITAR |
| CAD.CARGOS.LER | SCR-23 | Estrutura Organizacional | LER |
| CAD.CARGOS.EDITAR | SCR-23 | Estrutura Organizacional | EDITAR |
| CAD.PESSOAS.LER | SCR-23 | Pessoas e Entidades | LER |
| CAD.PESSOAS.EDITAR | SCR-23 | Pessoas e Entidades | EDITAR |
| CAD.PESSOAS.EXPORTAR | SCR-23 | Pessoas e Entidades | EXPORTAR |
| CAD.FORNECEDORES.LER | SCR-23 | Pessoas e Entidades | LER |
| CAD.FORNECEDORES.EDITAR | SCR-23 | Pessoas e Entidades | EDITAR |
| CAD.PORTES.LER | SCR-23 | Portfólio e Projetos | LER |
| CAD.PORTES.EDITAR | SCR-23 | Portfólio e Projetos | EDITAR |
| CAD.PORTES.PUBLICAR | SCR-23 | Portfólio e Projetos | PUBLICAR |
| CAD.CLASSIFICACOES.LER | SCR-23 | Portfólio e Projetos | LER |
| CAD.CLASSIFICACOES.EDITAR | SCR-23 | Portfólio e Projetos | EDITAR |
| CAD.ESTRATEGIA.LER | SCR-23 | Estratégia | LER |
| CAD.ESTRATEGIA.EDITAR | SCR-23 | Estratégia | EDITAR |
| ADM.USUARIOS.LER | SCR-24 | Acesso e Segurança | LER |
| ADM.USUARIOS.EDITAR | SCR-24 | Acesso e Segurança | EDITAR |
| ADM.PERFIS.LER | SCR-24 | Acesso e Segurança | LER |
| ADM.PERFIS.EDITAR | SCR-24 | Acesso e Segurança | EDITAR |
| ADM.PERFIS.PUBLICAR | SCR-24 | Acesso e Segurança | PUBLICAR |
| ADM.PERFIS.APROVAR | SCR-24 | Acesso e Segurança | APROVAR |
| ADM.SESSOES.LER | SCR-24 | Acesso e Segurança | LER |
| ADM.SESSOES.EDITAR | SCR-24 | Acesso e Segurança | EDITAR |
| ADM.EQUIPES.LER | SCR-24 | Organização do Trabalho | LER |
| ADM.EQUIPES.EDITAR | SCR-24 | Organização do Trabalho | EDITAR |
| ADM.APTIDOES.LER | SCR-24 | Organização do Trabalho | LER |
| ADM.APTIDOES.EDITAR | SCR-24 | Organização do Trabalho | EDITAR |
| ADM.ALCADAS.LER | SCR-24 | Governança de Autoridade | LER |
| ADM.ALCADAS.EDITAR | SCR-24 | Governança de Autoridade | EDITAR |
| ADM.ALCADAS.PUBLICAR | SCR-24 | Governança de Autoridade | PUBLICAR |
| ADM.ALCADAS.APROVAR | SCR-24 | Governança de Autoridade | APROVAR |
| ADM.DELEGACOES.LER | SCR-24 | Governança de Autoridade | LER |
| ADM.DELEGACOES.EDITAR | SCR-24 | Governança de Autoridade | EDITAR |
| ADM.DELEGACOES.PUBLICAR | SCR-24 | Governança de Autoridade | PUBLICAR |
| ADM.SOD.LER | SCR-24 | Governança de Autoridade | LER |
| ADM.SOD.EDITAR | SCR-24 | Governança de Autoridade | EDITAR |
| ADM.SOD.PUBLICAR | SCR-24 | Governança de Autoridade | PUBLICAR |
| ADM.SOD.APROVAR | SCR-24 | Governança de Autoridade | APROVAR |
| ADM.WORKFLOW.LER | SCR-24 | Processos e SLA | LER |
| ADM.WORKFLOW.EDITAR | SCR-24 | Processos e SLA | EDITAR |
| ADM.WORKFLOW.PUBLICAR | SCR-24 | Processos e SLA | PUBLICAR |
| ADM.SLA.LER | SCR-24 | Processos e SLA | LER |
| ADM.SLA.EDITAR | SCR-24 | Processos e SLA | EDITAR |
| ADM.SLA.PUBLICAR | SCR-24 | Processos e SLA | PUBLICAR |
| ADM.INTEGRACOES.LER | SCR-24 | Integrações e Operação | LER |
| ADM.INTEGRACOES.EDITAR | SCR-24 | Integrações e Operação | EDITAR |
| ADM.INTEGRACOES.PUBLICAR | SCR-24 | Integrações e Operação | PUBLICAR |
| ADM.INTEGRACOES.APROVAR | SCR-24 | Integrações e Operação | APROVAR |
| ADM.AUDITORIA.LER | SCR-24 | Auditoria | LER |
| ADM.AUDITORIA.EXPORTAR | SCR-24 | Auditoria | EXPORTAR |
| CFG.ORGANIZACAO.LER | SCR-25 | Organização e Licença | LER |
| CFG.ORGANIZACAO.EDITAR | SCR-25 | Organização e Licença | EDITAR |
| CFG.LICENCA.LER | SCR-25 | Organização e Licença | LER |
| CFG.LICENCA.EDITAR | SCR-25 | Organização e Licença | EDITAR |
| CFG.LICENCA.PUBLICAR | SCR-25 | Organização e Licença | PUBLICAR |
| CFG.LICENCA.APROVAR | SCR-25 | Organização e Licença | APROVAR |
| CFG.FY.LER | SCR-25 | Planejamento e Projetos | LER |
| CFG.FY.EDITAR | SCR-25 | Planejamento e Projetos | EDITAR |
| CFG.FY.PUBLICAR | SCR-25 | Planejamento e Projetos | PUBLICAR |
| CFG.ESTIMATIVAS.LER | SCR-25 | Planejamento e Projetos | LER |
| CFG.ESTIMATIVAS.EDITAR | SCR-25 | Planejamento e Projetos | EDITAR |
| CFG.ESTIMATIVAS.PUBLICAR | SCR-25 | Planejamento e Projetos | PUBLICAR |
| CFG.RATECARDS.LER | SCR-25 | Planejamento e Projetos | LER |
| CFG.RATECARDS.EDITAR | SCR-25 | Planejamento e Projetos | EDITAR |
| CFG.FINANCEIRO.LER | SCR-25 | Financeiro | LER |
| CFG.FINANCEIRO.EDITAR | SCR-25 | Financeiro | EDITAR |
| CFG.FINANCEIRO.APROVAR | SCR-25 | Financeiro | APROVAR |
| CFG.NOTIFICACOES.LER | SCR-25 | Comunicação | LER |
| CFG.NOTIFICACOES.EDITAR | SCR-25 | Comunicação | EDITAR |
| CFG.EVENTOS.LER | SCR-25 | Comunicação | LER |
| CFG.EVENTOS.EDITAR | SCR-25 | Comunicação | EDITAR |
| CFG.TEMPLATES.LER | SCR-25 | Comunicação | LER |
| CFG.TEMPLATES.EDITAR | SCR-25 | Comunicação | EDITAR |
| CFG.TEMPLATES.PUBLICAR | SCR-25 | Comunicação | PUBLICAR |
| CFG.IA.LER | SCR-25 | Inteligência Artificial | LER |
| CFG.IA.EDITAR | SCR-25 | Inteligência Artificial | EDITAR |
| CFG.IA.PUBLICAR | SCR-25 | Inteligência Artificial | PUBLICAR |
| CFG.PARAMETROS.LER | SCR-25 | Parâmetros do Sistema | LER |
| CFG.PARAMETROS.EDITAR | SCR-25 | Parâmetros do Sistema | EDITAR |

---

### 3. Checagens de papel de negócio → VIEW-ADM-ALCADAS (D8)

A regra D8 estabelece que verificações de negócio passam para a VIEW-ADM-ALCADAS. As verificações de sistema (`ehAdministrador || ehProprietario` para acesso ao sistema e `ehProprietario` para licenciamento) permanecem fixas (R-ADM-23).

#### Candidatos a migrar para VIEW-ADM-ALCADAS

| Arquivo | Trecho | Decisão de negócio |
|---------|--------|-------------------|
| `js/approvals/comite.js` | Aprovação / reprovação de BC pelo comitê | Aprovar BC para FY (READY_FOR_FY) |
| `js/approvals/comite.js` | "Reavaliar" / futuramente "Validar diferencial" | Retornar BC para ajuste |
| `js/approvals/orcamento-af.js` | `ehAprovadorFY` ou lógica equivalente | Aprovar o pacote de BC do FY |
| `js/approvals/orcamento-af.js` | Devolução de BC individual pelo FY | Devolver BC ao Owner (BUDGET_REVIEW) |
| `js/adhoc/tradeoff.js` | Aprovação do extraordinário pelas alçadas | Aprovar BC extraordinário |
| `js/ano-fiscal/validacao-tradeoff.js` | Validação de alçada para trade-off | Validar trade-off de FY |
| `js/governanca/mudanca-orcamento.js` | Aprovação de Ajuste de Orçamento | Aprovar diferencial orçamentário |
| `js/contratos/pagamento-nf.js` | Aprovação de pagamento / NF | Aprovar pagamento de contrato |
| `js/contratos/pendencias.js` | Aprovação de pendências contratuais | Aprovar pendência de fornecedor |
| `js/retomar-hold.js` | Condições para retomada de Hold | Retirar projeto de Hold |
| `js/carryover.js` | Aprovação de Carryover para o FY seguinte | Aprovar transição de fronteira fiscal |
| `js/absorcao-carryover.js` | Absorção de Carryover no próximo FY | Absorver projeto em novo FY |

#### Verificações fixas que NÃO migram (R-ADM-23)

| Arquivo | Verificação | Motivo |
|---------|-------------|--------|
| Múltiplos | `ehAdministrador || ehProprietario` | Acesso ao sistema (portão, não alçada) |
| `js/config/licenciamento.js` | `ehProprietario` | Licenciamento (portão de sistema) |

---

## Seção 2.3 — Ano Fiscal × m12a_regras.json e m12a_readiness.json

### 1. Derivações por ano civil em fiscal-year.js

**Arquivo:** `js/core/fiscal-year.js`

| Linha | Código | Violação | Regra |
|-------|--------|----------|-------|
| 28 | `const hoje = dataRef ? new Date(dataRef) : new Date();` | Usa data do sistema como base | R-FY-03 |
| 29 | `const mes = hoje.getMonth() + 1;` | **Deriva mês do relógio do sistema** | R-FY-03 |
| 30 | `const ano = hoje.getFullYear();` | **Deriva ano civil do relógio do sistema** | R-FY-03 |
| 32 | `const mesInicio = (typeof mesInicioAnoFiscal === 'function') ? mesInicioAnoFiscal(dataRef) : 4;` | Lê `mesInicio` da config (mitigante); mas R-FY-03 proíbe derivação por data mesmo com mês parametrizado | R-FY-03 |
| 43 | `const anoFiscalCorrente = (mesInicio === 1) ? startYear : startYear + 1;` | Resultado calculado por aritmética de data, não por query `FISCAL_YEAR.status = 'OPEN'` | R-FY-03 |
| 54 | `return projectsData.some(p => p.etapa_atual && p.etapa_atual !== 'BUSINESS CASE');` | `isOrcamentoGlobalFechado()` usa proxy heurístico baseado em `projectsData`; deve usar `FISCAL_YEAR.bc_package_status` | R-FY-03 / M12A |

**Diagnóstico:** `getInfoAnoFiscal()` calcula qual FY está vigente por aritmética de data (getMonth + getFullYear). O R-FY-03 proíbe exatamente isso. O mês de início ser parametrizado (`mesInicioAnoFiscal`) é uma melhoria, mas não elimina a violação — o caderno exige: consultar `FISCAL_YEAR WHERE status = 'OPEN'`, não derivar da data. `isOrcamentoGlobalFechado()` usa `projectsData.some(...)` como proxy para detectar se o orçamento foi fechado; o correto é ler `FISCAL_YEAR.bc_package_status`.

**Os 16 arquivos que leem `anos_fiscais_config` diretamente** (via `getInfoAnoFiscal()` ou consulta direta) herdam a violação. Após Fase 2A, `fiscal-year.js` passa a ser o único leitor do FY, substituindo `getInfoAnoFiscal()` por uma query de `FISCAL_YEAR WHERE status='OPEN'`.

---

### 2. INSERT...SELECT em projects e tasks

**Resultado da busca em todo o código e SQL:**

```
Grep: INSERT.*SELECT — projetos, tasks, business_cases, projects, carryover, absorcao
Resultado: NENHUM encontrado no código JS ou arquivos SQL do repositório.
```

**Conclusão:** Não há clonagem de linhas por `INSERT...SELECT` em nenhum fluxo de projeto ou tarefa. O Carryover (`js/carryover.js`) e a Absorção de Carryover (`js/absorcao-carryover.js`) atualizam `etapa_atual` / `sub_status` na linha existente via `UPDATE`, não clonam registros. O modelo de closings do M12A (R-FC-04: "Não clona Projects nem TASKs") está naturalmente atendido.

---

### 3. Regras M12A (58 regras × status)

Legenda: **N** = Não existe · **P** = Parcial (lógica existe mas sem o modelo M12A)

| ID | Grupo | Regra (resumo) | Status | Observação |
|----|-------|----------------|--------|------------|
| R-FY-01 | R-FY | Exatamente 1 exercício operacional por org | N | `anos_fiscais_config` não tem índice de unicidade por status |
| R-FY-02 | R-FY | Próximo exercício em PLANNING/BUDGETING | N | Sem modelo FISCAL_YEAR |
| R-FY-03 | R-FY | Proibido derivar exercício por YEAR(data) | P | `fiscal-year.js:29-30` **viola** a regra; `mesInicio` é parametrizado (mitigante), mas aritmética de data persiste |
| R-FY-04 | R-FY | Ativar próximo exige anterior CLOSED e pacote FECHADO | N | — |
| R-FY-05 | R-FY | Transições de status válidas | N | Sem máquina de estados para FISCAL_YEAR |
| R-FY-06 | R-FY | Exercício CLOSED é somente leitura | N | `anos_fiscais_config.fechado` existe mas sem bloqueio formal |
| R-FY-07 | R-FY | Sem FY configurado mostra estado inicial | P | Tela de Abertura do FY existe; sem orientação de "nenhum FY configurado" |
| R-FY-08 | R-FY | Rotas usam fiscal_year_id imutável | N | Sem roteamento por URL (D7 da Fase 1) |
| R-FY-09 | R-FY | Budget ON/OFF altera só blocos monetários | P | `is_orcamento_ativo` em `anos_fiscais_config`; sem separação formal Budget ON/OFF |
| R-FY-10 | R-FY | Zero, N/A e erro exibidos de forma distinta | N | — |
| R-PE-01 | R-PE | Períodos dentro do exercício e sem sobreposição | N | — |
| R-PE-02 | R-PE | Período em uso só muda com Impact Preview | N | — |
| R-PE-03 | R-PE | Janelas operacionais separadas dos períodos | N | — |
| R-PE-04 | R-PE | Calendário ausente aparece como pendência | N | — |
| R-PE-05 | R-PE | Períodos cobrem o exercício sem lacunas | N | — |
| R-TR-01 | R-TR | Opções por regime (FY_BOUND/CROSS_FY) | N | Sem modelo de transição de fronteira fiscal |
| R-TR-02 | R-TR | Justificativa obrigatória para CARRYOVER/HOLD/TERMINATE | P | `carryover.js` exige motivo parcialmente |
| R-TR-03 | R-TR | CARRYOVER/HOLD/CROSS_FY exige próximo FY configurado | N | — |
| R-TR-04 | R-TR | Só FY_BOUND é elegível a CARRYOVER | N | — |
| R-TR-05 | R-TR | Segundo CARRYOVER consecutivo exige alçada superior | N | — |
| R-TR-06 | R-TR | HOLD com motivo, start_at e review_at | P | `retomar-hold.js` implementa parcialmente |
| R-TR-07 | R-TR | Retomada de HOLD exige condições atendidas | P | — |
| R-TR-08 | R-TR | CROSS_FY exige plano fiscal cobrindo o destino | N | — |
| R-TR-09 | R-TR | Preparador não aprova a mesma transição (SOD) | N | — |
| R-TR-10 | R-TR | Só transição APPROVED pode ser executada | N | — |
| R-TR-11 | R-TR | Uma transição ativa por Project e fronteira | N | — |
| R-TR-12 | R-TR | Datas não digitadas na transição (vai ao M08) | N | — |
| R-TR-13 | R-TR | COMPLETE exige conclusão prevista até o fim do FY | N | — |
| R-TR-14 | R-TR | TERMINATE encaminha ao Encerramento | N | — |
| R-TR-15 | R-TR | Pendência financeira não impede transição Core | N | — |
| R-TR-16 | R-TR | Carryover não injeta orçamento | N | — |
| R-FC-01 | R-FC | Validações finais no momento da execução do fechamento | N | — |
| R-FC-02 | R-FC | Mudança concorrente exige nova pré-validação | N | — |
| R-FC-03 | R-FC | Execução idempotente do fechamento | N | — |
| R-FC-04 | R-FC | Fechamento cria snapshot imutável; não clona | N | INSERT...SELECT confirmado ausente (seção 2) |
| R-FC-05 | R-FC | Transação de domínio precede notificações | N | — |
| R-FC-06 | R-FC | Readiness verde não fecha o FY automaticamente | N | — |
| R-RA-01 | R-RA | Fluxo CLOSED→REOPENED→CLOSED | N | — |
| R-RA-02 | R-RA | Só objetos do escopo aprovado ficam mutáveis | N | — |
| R-RA-03 | R-RA | Janela expirada bloqueia a execução | N | — |
| R-RA-04 | R-RA | Snapshots anteriores imutáveis e disponíveis | N | — |
| R-RA-05 | R-RA | Reabrir FY anterior não altera FY em execução | N | — |
| R-IN-01 | R-IN | Pacote de BC = aba da VIS-FY-03 | P | `js/approvals/orcamento-af.js` implementa fluxo parcial |
| R-IN-02 | R-IN | Submeter pacote leva FY de PLANNING para BUDGETING | N | Sem estado PLANNING/BUDGETING |
| R-IN-03 | R-IN | Fechar pacote converte BCs em Projects com PROJECT_FISCAL_PLAN e baseline V1 | P | `executarAprovacaoGlobalOrcamentoAF()` converte BCs, mas sem criar PROJECT_FISCAL_PLAN nem gravar baseline V1 (D-10) |
| R-IN-04 | R-IN | Pacote FECHADO bloqueia novo BC regular | P | `orcamento-af.js` verifica `ano_fiscal_fechado` parcialmente |
| R-IN-05 | R-IN | BC extraordinário cria Project com EXTRAORDINARY | P | `tradeoff.js` cria Project adhoc mas sem PROJECT_FISCAL_YEAR EXTRAORDINARY |
| R-IN-06 | R-IN | HOLD/cancelamento do trade-off vira PROJECT_FISCAL_TRANSITION | N | — |
| R-IN-07 | R-IN | Carryover/CROSS_FY aparecem na carteira do próximo FY como participações | N | — |
| R-IN-08 | R-IN | Composição do FY em linhas separadas (Budget ON) | N | — |
| R-IN-09 | R-IN | Budget OFF: fluxo segue por horas | N | — |
| R-IN-10 | R-IN | BCs postergados (DEFERRED) aparecem para reativação | N | — |
| R-SG-01 | R-SG | RBAC aplicado antes de consultas | P | `ehAdministrador` etc. fazem controle mínimo; sem RBAC baseado em PROFILE/ROLE |
| R-SG-02 | R-SG | row_version em toda mutação; conflito → 409 | N | — |
| R-SG-03 | R-SG | AUDIT_LOG append-only (actor, before/after, correlation_id) | N | Sem AUDIT_LOG estruturado; `registro_planejamento` tem append-only (seção 2.4) |
| R-SG-04 | R-SG | Logs técnicos separados de eventos fiscais | N | — |
| R-SG-05 | R-SG | Exportação respeita RBAC e escopo | N | — |
| R-SG-06 | R-SG | Pendência nunca é TASK artificial; WORK_ITEM é projeção | N | — |

**Resumo M12A regras:**

| Situação | Quantidade |
|----------|------------|
| Existe | 0 |
| Parcial | 12 |
| Não existe | 46 |
| **Total** | **58** |

---

### 4. Requisitos de Readiness (16 requisitos × status)

| ID | Requisito | Severidade | Status | Observação |
|----|-----------|------------|--------|------------|
| RD-01 | Destino definido para todo Project com destino obrigatório | Blocker | N | Sem modelo PROJECT_FISCAL_YEAR |
| RD-02 | Transição obrigatória executada | Blocker | N | — |
| RD-03 | Transição submetida com decisão (não expirada) | Blocker | N | — |
| RD-04 | Próximo exercício configurado em PLANNING/BUDGETING | Blocker | N | — |
| RD-05 | Carryover recorrente com alçada superior | Blocker | N | — |
| RD-06 | Hold com revisão agendada (review_at) | Blocker | N | — |
| RD-07 | CROSS_FY com plano fiscal cobrindo o próximo FY | Blocker | N | — |
| RD-08 | Aprovações fiscais sem pendência | Blocker | N | — |
| RD-09 | Períodos fiscais válidos e cobrindo o exercício | Blocker | N | — |
| RD-10 | Blocker com responsável e ação | Blocker | N | — |
| RD-11 | Calendário útil configurado | Aviso | N | — |
| RD-12 | Conclusão prevista compatível com COMPLETE | Aviso | N | — |
| RD-13 | TASKs abertas em Project com destino COMPLETE | Aviso | N | — |
| RD-14 | Dependências externas em acompanhamento | Aviso/Informativo | N | — |
| RD-15 | Pendências financeiras (Budget ON) | Informativo | N | — |
| RD-16 | Pacote de BC do próximo FY fechado | Informativo | N | — |

**Resumo:** 0 Existe · 0 Parcial · 16 Não existe

---

## Seção 2.4 — Registro de Planejamento

### Evidência de bloqueio no banco

**Arquivo:** `sql/2026-09-29_fase5_execucao_plano.sql`, linhas 64–80.

```sql
-- Trigger: bloqueia UPDATE e DELETE (append-only — D-12)
CREATE OR REPLACE FUNCTION _bloquear_registro_planejamento()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'registro_planejamento é somente inclusão (D-12): UPDATE e DELETE são proibidos.';
    RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_rp_no_update ON registro_planejamento;
CREATE TRIGGER trg_rp_no_update
    BEFORE UPDATE ON registro_planejamento
    FOR EACH ROW EXECUTE FUNCTION _bloquear_registro_planejamento();

DROP TRIGGER IF EXISTS trg_rp_no_delete ON registro_planejamento;
CREATE TRIGGER trg_rp_no_delete
    BEFORE DELETE ON registro_planejamento
    FOR EACH ROW EXECUTE FUNCTION _bloquear_registro_planejamento();
```

**Status:** Triggers definidos no SQL do repositório. Bloqueiam UPDATE e DELETE com EXCEPTION, tornando a tabela append-only. A confirmação de que este SQL foi executado em produção depende da query `Q07` no `fase0_contagens.sql`.

---

## Seção D9 — Módulos que leem projectsData (R3)

Após Fase 2, BCs usam `business_cases` e Projects usam `projects`. A view `projetos` fica como compatibilidade somente leitura até o fim da Fase 2.

| Módulo (arquivo JS) | Carga pós-Fase 2 | Critério |
|---------------------|-----------------|---------|
| `js/business-case/portfolio-bc.js` | `business_cases` | Exibe e edita BCs em `etapa_atual='BUSINESS CASE'` |
| `js/approvals/comite.js` | `business_cases` | Aprovação de BC antes da conversão em Project |
| `js/approvals/orcamento-af.js` | `business_cases` | Pacote FY: opera sobre BCs aprovados pelo Owner |
| `js/adhoc/tradeoff.js` | `business_cases` | BC extraordinário e seu trade-off |
| `js/ano-fiscal/validacao-tradeoff.js` | `business_cases` | Validação do trade-off de FY |
| `js/workspace-projeto/*.js` | `projects` | Workspace: Fases, RAID, Gates, Tarefas, Financeiro |
| `js/governanca/*.js` | `projects` | Aprovações, mudanças de orçamento de Project |
| `js/contratos/*.js` | `projects` | Contratos vinculados a Projects |
| `js/execucao/*.js` | `projects` | Registro de Planejamento, Execução |
| `js/encerramento/*.js` | `projects` | Fluxo de encerramento |
| `js/subprojetos/subprojetos.js` | `projects` | Subprojetos (sem BC de origem, `business_case_codigo = NULL`) |
| `js/home/home-pessoal.js` | Ambas | KPIs mesclam BCs e Projects |
| `js/dashboards/*.js` | Ambas | Dashboards agregam BCs + Projects por `etapa_atual` |
| `js/portfolio-executivo.js` | Ambas | Portfólio exibe BC + Project em funil |
| `js/financeiro-corporativo/financeiro-corporativo.js` | Ambas | Resumo orçamentário agrega ambos |
| `js/roadmap/*.js` | Ambas | Roadmap exibe BCs e Projects no mesmo timeline |
| `js/carryover.js` | `projects` | Carryover opera sobre Projects existentes |
| `js/absorcao-carryover.js` | `projects` | Absorção opera sobre Projects |
| `js/retomar-hold.js` | `projects` | Hold opera sobre Projects |

---

## Resumo executivo do complemento

| Módulo | Campos / regras do caderno | Existe | Parcial | Não existe |
|--------|--------------------------|--------|---------|------------|
| M05 — campos | 160 | 5 (3%) | 26 (16%) | 129 (81%) |
| M05 — regras | 84 | 0 | 15 (18%) | 69 (82%) |
| ADM — VIEWs | 30 | 0 | 0 | 30 (100%) |
| ADM — funções | 80 | 0 | 0 | 80 (100%) |
| M12A — regras | 58 | 0 | 12 (21%) | 46 (79%) |
| M12A — readiness | 16 | 0 | 0 | 16 (100%) |

O gap mais crítico para a Fase 1A é a ausência completa do modelo M12A (FISCAL_YEAR, FISCAL_PERIOD, PROJECT_FISCAL_PLAN, PROJECT_FISCAL_YEAR, PROJECT_FISCAL_TRANSITION). A Fase 2A endereça isso com migração de `anos_fiscais_config` e atualização de `fiscal-year.js`. O M05 tem 14 das 17 entidades completamente ausentes; o Business Case em si tem ~19 campos mapeados (5 existem, 14 parciais) e 25 campos ausentes. O ADM inteiro (30 VIEWs, 80 funções) é implementação nova sem equivalente estruturado.
