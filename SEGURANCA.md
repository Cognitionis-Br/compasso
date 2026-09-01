# Segurança — Controle de Acesso do Compasso

Log das fases do endurecimento de RBAC/RLS pedido em 2026-09-01.
Cada fase só começa depois da anterior aprovada.

---

## Fase 0 — Reconciliação do catálogo (2026-09-01) — **CONCLUÍDA e APROVADA**

- Lida a planilha `docs/CONTROLE DE ACESSO - FUNÇÕES.xlsx` (85 linhas, 81 folhas/atividades).
- Comparada com `catalogo_atividades` ao vivo (84 linhas) e `funcao_atividades` (131 concessões).
- Resultado em [`RECONCILIACAO_CATALOGO.md`](RECONCILIACAO_CATALOGO.md):
  - **0** atividades genuinamente novas na planilha.
  - **3** linhas no catálogo sem correspondente na planilha (`mudanca_orcamento`,
    `percentual_bloqueio_orcamento`, `responsaveis:criar`) — decisão pendente.
  - **8** conflitos com decisões já aplicadas nesta semana (DEPARA) — C1–C8.
  - **~13** renomes de rótulo/subgrupo e **4** de grupo pendentes de decisão.
  - Confirmado: "Cargos" e "Retorno / Benefícios de Projeto" **já existem** no
    catálogo (não são itens novos).
- **Nenhum** `INSERT` / `UPDATE` / `DELETE` executado.
- Colunas `grupo` / `subgrupo`: já existem como `grupo_funcao` / `funcao`;
  proposta de rename registrada (Opção A), pendente de aprovação.

### Pendente para liberar a Fase 1
~~Aprovação das 6 decisões~~ — aprovadas 2026-09-01 (`RECONCILIACAO_CATALOGO.md` §5).

---

## Fase 1 — Reconciliação + colunas grupo/subgrupo (2026-09-01) — **CÓDIGO PRONTO, aguardando rodar o SQL**

- Script: [`sql/2026-09-01_reconciliacao_catalogo_fase1.sql`](sql/2026-09-01_reconciliacao_catalogo_fase1.sql)
  - `ALTER TABLE catalogo_atividades RENAME COLUMN grupo_funcao → grupo`, `funcao → subgrupo` (idempotente).
  - `UPDATE`s: R1, R2, R3, R4, R7, R8, M1, M2, M4 (atividade/subgrupo); G1, G2, G3 (grupo/subgrupo).
  - **Zero `DELETE`, zero `INSERT`.** C1–C8 mantidos como estão.
- Front: `js/config/funcoes.js` passa a ler `a.grupo ?? a.grupo_funcao` e
  `a.subgrupo ?? a.funcao` (3 pontos) — sobrevive ao intervalo entre deploy e SQL,
  em qualquer ordem. `index.html`: menu/`<h2>`/aviso "Usuários & Perfis" → "Usuários" (R3/R4).
- **Pendente:** rodar o SQL no Supabase.

## Fase 2 — Colunas CRUD em `funcao_atividades` — *não iniciada*
`pode_consultar`, `pode_incluir`, `pode_alterar`, `pode_deletar`.
Migração das concessões existentes: `pode_consultar = true`, demais `false`.

## Fase 3 — Remover do catálogo comum os itens de administração — *não iniciada*

Estas 4 telas saem de `catalogo_atividades` (deixam de ser concedíveis por
função comum) e passam a ser checadas por *flag* de papel — nos **dois**
pontos: visibilidade no menu lateral **e** bloqueio de rota em `switchTab()`.

| Tela | Regra de visibilidade / acesso |
|---|---|
| `Funções e Permissões` (`funcoes_permissoes`) | `ehAdministrador === true` **OU** `ehProprietario === true` |
| `Atribuição de Funções aos Usuários` (`atribuicao_funcoes`) | `ehAdministrador === true` **OU** `ehProprietario === true` |
| `Restrição de Área por Atividade` (`restricao_area_atividades`) | `ehAdministrador === true` **OU** `ehProprietario === true` |
| `Licenciamento de Módulos` (`licenciamento_modulos`) | **só** `ehProprietario === true` — Administrador **não** vê |

**Hierarquia:** Proprietário é um nível **acima** de Administrador
(superconjunto de poder), não um papel paralelo. Proprietário enxerga e
acessa tudo que Administrador enxerga e acessa — nunca menos. Por isso as
3 primeiras telas usam a checagem combinada `OU`, não `ehAdministrador`
sozinho. (Hoje todo PROPRIETARIO também tem `acesso_irrestrito = true`, mas
o `OU` explícito garante o acesso mesmo que uma função PROPRIETARIO futura
seja criada sem essa flag.)

## Fase 4 — Habilitar RLS — *não iniciada*

Leitura livre para qualquer usuário autenticado nas 5 tabelas.

| Tabela | Escrita (INSERT / UPDATE / DELETE) permitida quando |
|---|---|
| `funcoes` | `acesso_irrestrito = true` **OU** `eh_proprietario = true` |
| `funcao_atividades` | `acesso_irrestrito = true` **OU** `eh_proprietario = true` |
| `usuario_funcoes` | `acesso_irrestrito = true` **OU** `eh_proprietario = true` |
| `catalogo_atividades` | `acesso_irrestrito = true` **OU** `eh_proprietario = true` |
| `licenca_modulos` | **só** `eh_proprietario = true` |

A condição é avaliada via função SQL de apoio (`SECURITY DEFINER`) que
resolve as funções do `auth.uid()` atual contra `usuario_funcoes` +
`funcoes`. Mesma lógica de hierarquia da Fase 3: Proprietário escreve em
tudo que Administrador escreve, e ainda em `licenca_modulos`.
