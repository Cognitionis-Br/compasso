# Investigação — "Projeção Final" (Passo 0 da tarefa de Agrupamento de Orçamento)

**Data:** 2026-09-01
**Escopo:** só levantamento. **Nada alterado.**

---

## 1. Onde aparece

| Item | Local |
|---|---|
| Rótulo na tela | `index.html:457` — KPI card `<span>Projeção Final</span>` com `<div id="kpiProjecao">` |
| Tela | **Dashboard**, no bloco de KPIs de orçamento (`#view-dashboard`) |
| Onde é calculado/escrito | `js/dashboards/dashboard.js:207`, dentro de `renderDashboardMetrics()` |

**Não existe em Visão de Orçamento.** Essa tela tem `visaoKpiOrcAprovado`,
`visaoKpiOrcUtilizado` e `visaoKpiSaldo` (`js/budget-overview/visao-orcamento.js`),
mas **nenhum equivalente de "Projeção Final"**.

---

## 2. Fórmula exata

```js
// js/dashboards/dashboard.js:207
document.getElementById('kpiProjecao').innerText =
    `R$ ${(totR * 1.15).toLocaleString('pt-BR', {minimumFractionDigits:2})}`;
```

**Projeção Final = `totR` × 1.15** — ou seja, **Realizado Total × 1,15** (acréscimo
fixo de 15 % sobre o que já foi realizado).

- O `1.15` é **constante hardcoded**, sem comentário nem origem documentada. É uma
  heurística ingênua: "o gasto final deve ficar ~15 % acima do realizado até agora".
- Não usa orçamento, nem SLA, nem variação real por fase — só o realizado × 1,15.

### O que é `totR`

```js
let totR = 0;
...
projectsDataFiltrado.forEach(p => {
    const real = Number(p.realizado) || 0;
    totR += real;               // soma o campo `realizado` de TODOS os projetos da visão
    ...
});
```

- `totR` = soma bruta de `projetos.realizado` sobre `projectsDataFiltrado`
  (a lista já filtrada por **Ano Fiscal selecionado** + **restrição de área**).
- A soma acontece **antes** do filtro de `sub_status`, então `totR` inclui projetos
  `CANCELADO` / `REPROVADO` / `HOLD` também.

### KPIs vizinhos (mesmo bloco, Dashboard)

| KPI | id | Fórmula |
|---|---|---|
| Orçamento Fechado AF | `kpiOrcAprovado` | `displayOrcamento = totOrcamentoOficial + totOrcamentoEmConstrucao` |
| Orçamento Extraordinário | `kpiOrcAdhoc` | `totAdhoc` = Σ `val_bc`/`previsto` dos projetos `is_adhoc` |
| Realizado Total | `kpiOrcUtilizado` | `totR` |
| **Projeção Final** | `kpiProjecao` | **`totR * 1.15`** |
| Saldo Remanescente | `kpiSaldo` | `displayOrcamento - totR` |

---

## 3. Como se encaixa (ou não) no quadro novo

A tabela nova (item 6 da spec) tem as linhas:

> Total de Projetos · Orçamento Fechado · Orçamento Projetos Extraordinário ·
> Orçamento Carry Over · Orçamento Atual · **Valores Já Realizados** ·
> **Orçamento a Realizar**

**Não há linha "Projeção Final".** Duas leituras possíveis:

- **(A) — remover.** A spec lista os cálculos a reaproveitar (`totOrcamentoOficial`,
  `totAdhoc`, carryover, `totR`) e **não** cita o `× 1.15`. "Orçamento a Realizar"
  (`Orçamento Atual − Valores Já Realizados`) é um número real de saldo a executar,
  e substitui com vantagem a estimativa de 15 %.
- **(B) — manter como linha extra.** Se o "× 1,15" tem valor de negócio (algum
  acordo de que o gasto estoura ~15 %), dá pra manter "Projeção Final" como uma
  8ª linha da tabela, também quebrada CAPEX/OPEX (`totR_capex * 1.15` / `totR_opex * 1.15`).

**Recomendação:** **(A) remover** — o `1.15` não tem origem rastreável e "Orçamento
a Realizar" cobre a intenção com um número exato. Mas é decisão sua.

### Pergunta aberta pra você

1. Remover "Projeção Final" (opção A) ou manter como linha extra (opção B)?
2. Se manter: quebrar CAPEX/OPEX também? O `1,15` continua fixo ou vira parâmetro
   (tipo `percentual_bloqueio_variacao`)?
