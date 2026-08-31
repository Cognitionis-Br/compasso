// =========================================================================
// dashboards/dashboard.js
// KPIs principais do portfólio e tabela de consolidação por fase.
// Depende de dashboards/graphs.js (chamada no fim de
// renderTabelaConsolidacaoPortfolio) — carregar graphs.js antes ou depois
// não importa, contanto que ambos estejam prontos antes do primeiro clique
// na aba Dashboard (mesmo esquema de escopo compartilhado dos demais
// módulos clássicos).
// =========================================================================
// NOVO 10/08/2026: popula os selects de filtro (Área/Status) do Status
// Detalhado da Carteira, preservando a seleção atual entre re-renders.
function popularFiltrosStatusDetalhado() {
    const selArea = document.getElementById('dashFiltroArea');
    if (selArea) {
        const atual = selArea.value;
        const areasUnicas = [...new Set(projectsData.map(p => p.area).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
        selArea.innerHTML = '<option value="">-- Todas --</option>' + areasUnicas.map(a => `<option value="${a}" ${a === atual ? 'selected' : ''}>${a}</option>`).join('');
    }

    const selStatus = document.getElementById('dashFiltroStatus');
    if (selStatus) {
        const atual = selStatus.value;
        const statusUnicos = [...new Set(projectsData.map(p => p.sub_status).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
        selStatus.innerHTML = '<option value="">-- Todos --</option>' + statusUnicos.map(s => `<option value="${s}" ${s === atual ? 'selected' : ''}>${s}</option>`).join('');
    }
}

// Compartilhado (Dashboard e Visão de Orçamento — itens 3/4/6 do
// relatório de testes): calcula orçado/realizado por classificação
// financeira (CAPEX/OPEX).
// AJUSTADO (a pedido do usuário 24/08/2026): ganhou o parâmetro opcional
// `valorExtractor` — por padrão continua lendo val_bc/previsto (nenhum
// call site existente precisa mudar), mas agora também é reaproveitável
// pro pool de Carry Over (que quebra por CAPEX/OPEX usando
// valor_carryover, não val_bc — ver calcularPoolCarryover em
// carryover.js).
function calcularCapexOpex(lista, valorExtractor) {
    const extrator = valorExtractor || ((p) => Number(p.val_bc) || Number(p.previsto) || 0);
    const resultado = { capex: { orcado: 0, realizado: 0 }, opex: { orcado: 0, realizado: 0 } };
    lista.forEach(p => {
        const tipo = (p.tipo_orcamento || '').toUpperCase();
        if (tipo !== 'CAPEX' && tipo !== 'OPEX') return;
        const chave = tipo.toLowerCase();
        resultado[chave].orcado += extrator(p);
        resultado[chave].realizado += Number(p.realizado) || 0;
    });
    return resultado;
}

// Preenche os elementos <prefixo>Capex/OpexOrcado/Realizado/Saldo, se
// existirem na tela (funciona tanto no Dashboard quanto na Visão de
// Orçamento, cada um com seu próprio conjunto de ids).
function renderQuadroCapexOpex(prefixo, lista) {
    const dados = calcularCapexOpex(lista);
    const fmt = (v) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
    ['capex', 'opex'].forEach(tipo => {
        const orcado = dados[tipo].orcado, realizado = dados[tipo].realizado;
        const sufixo = tipo.charAt(0).toUpperCase() + tipo.slice(1);
        const elOrcado = document.getElementById(`${prefixo}${sufixo}Orcado`);
        const elReal = document.getElementById(`${prefixo}${sufixo}Realizado`);
        const elSaldo = document.getElementById(`${prefixo}${sufixo}Saldo`);
        if (elOrcado) elOrcado.innerText = fmt(orcado);
        if (elReal) elReal.innerText = fmt(realizado);
        if (elSaldo) elSaldo.innerText = fmt(orcado - realizado);
    });
}

// NOVO (a pedido do usuário 24/08/2026): mesma ideia de
// renderQuadroCapexOpex, mas pro pool de Carry Over — Total e a quebra
// em CAPEX/OPEX (sem Realizado/Saldo, que não fazem sentido pra um pool
// que ainda não começou a ser gasto), usando o valor congelado no
// momento da marcação (valor_carryover), não val_bc/previsto.
// AJUSTADO (a pedido do usuário 24/08/2026): passou a mostrar o Total
// primeiro, e o Total soma TODO `valor_carryover` da lista — não só
// capex+opex — pra não perder projeto algum cujo tipo_orcamento não seja
// exatamente CAPEX/OPEX.
function renderQuadroCarryOverCapexOpex(prefixo, lista) {
    const dados = calcularCapexOpex(lista, (p) => Number(p.valor_carryover) || 0);
    const total = lista.reduce((acc, p) => acc + (Number(p.valor_carryover) || 0), 0);
    const fmt = (v) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
    const elTotal = document.getElementById(`${prefixo}TotalCarryOver`);
    const elCapex = document.getElementById(`${prefixo}CapexCarryOver`);
    const elOpex = document.getElementById(`${prefixo}OpexCarryOver`);
    if (elTotal) elTotal.innerText = fmt(total);
    if (elCapex) elCapex.innerText = fmt(dados.capex.orcado);
    if (elOpex) elOpex.innerText = fmt(dados.opex.orcado);
}

// NOVO (item 2 do relatório de testes): ordenação clicável no Status
// Detalhado da Carteira, por Farol de Saúde, Área ou Fase.
// AJUSTADO (a pedido do usuário): "classificar por Farol, Área e Fase"
// significa vir ORGANIZADA por padrão pelos 3 juntos (Farol primeiro,
// pra destacar críticos, depois Área, depois Fase) — sem precisar
// clicar em nada. O clique num cabeçalho ainda troca pra ordenar só por
// aquele campo específico, se o usuário quiser.
// AJUSTADO (a pedido do usuário 25/08/2026): o padrão passou a ser o
// número sequencial do código do projeto (o trecho `-NNN-` do meio,
// ex.: PRJ-FY27-007-TCS → 7), substituindo o antigo padrão de Status
// depois Código — reaproveitado também pela tela de Consultas
// (js/consultas/consulta-projetos.js).
let dashOrdenacaoAtual = { campo: 'padrao', direcao: 'asc' };

function extrairNumeroSequencialCodigo(codigo) {
    const m = (codigo || '').match(/-(\d+)-/);
    return m ? parseInt(m[1], 10) : 0;
}

function ordenarStatusDetalhado(campo) {
    if (dashOrdenacaoAtual.campo === campo) {
        dashOrdenacaoAtual.direcao = dashOrdenacaoAtual.direcao === 'asc' ? 'desc' : 'asc';
    } else {
        dashOrdenacaoAtual.campo = campo;
        dashOrdenacaoAtual.direcao = 'asc';
    }
    ['area', 'fase', 'farol'].forEach(c => {
        const el = document.getElementById(`ordArrow-${c}`);
        if (el) el.innerText = c === campo ? (dashOrdenacaoAtual.direcao === 'asc' ? '▲' : '▼') : '';
    });
    renderDashboardMetrics();
}

async function renderDashboardMetrics() {
    // NOVO (a pedido do usuário): filtro de Ano Fiscal selecionado —
    // aplica em toda a função, substituindo as referências diretas a
    // projectsData por essa lista já filtrada.
    // NOVO (Controle de acesso por atividade, Fase 5): restrição de área,
    // encadeada logo depois do filtro de Ano Fiscal.
    const projectsDataFiltrado = filtrarProjetosPorArea(filtrarProjetosPorAnoFiscalSelecionado(projectsData, modoAFDashboard), 'dashboard');
    renderFaixaAFSelecionado('dashFaixaAFSelecionado', modoAFDashboard);

    let totOrcamentoOficial = 0;
    let totOrcamentoEmConstrucao = 0;
    let totR = 0, totAdhoc = 0;

    // NOVO 10/08/2026: busca o cronograma granular de todas as etapas
    // uma vez só, pra alimentar calcularSaudeProjeto com o mesmo tipo de
    // checagem de atraso que o Cronograma & Evolução usa — sem isso,
    // o farol de saúde não detectava etapas com prazo vencido fora de
    // Business Case/Requerimentos.
    const { data: todasEtapasCache } = await _supabase.from('projeto_etapas').select('*');

    // CORRIGIDO (a pedido do usuário — bug reportado: valores de projetos
    // sendo aprovados no AF recém-aberto não apareciam em lugar nenhum):
    // isOrcamentoGlobalFechado() checava TODOS os projetos do sistema
    // juntos, sem separar por Ano Fiscal — bastava UM projeto de
    // QUALQUER AF (inclusive Carryover de anos anteriores) já estar além
    // do Business Case pra o sistema achar, erroneamente, que o AF
    // CORRENTE também estava fechado, escondendo o orçamento "em
    // construção" que ainda estava sendo aprovado nele. Agora cada
    // projeto usa o status de fechamento do PRÓPRIO Ano Fiscal dele.
    const isFechadoParaAF = await construirMapaFechamentoAF();

    // NOVO 10/08/2026 (item 1 do relatório de testes): junto de somar os
    // totais, guarda também QUAIS projetos entraram na conta — é essa
    // mesma lista (não todos os projetos) que precisa alimentar o
    // CAPEX/OPEX logo abaixo, senão os dois quadros não batem.
    const projetosNoOrcamentoExibido = [];
    let algumAFAindaEmConstrucao = false;

    projectsDataFiltrado.forEach(p => {
        const prev = Number(p.val_bc) || Number(p.previsto) || 0;
        const real = Number(p.realizado) || 0;
        totR += real;
        if (p.is_adhoc) totAdhoc += prev;

        const sub = (p.sub_status || '').toUpperCase();
        if (sub !== 'CANCELADO' && sub !== 'REPROVADO' && sub !== 'HOLD') {
            const fechadoDesseProjeto = isFechadoParaAF(p.ano_fiscal);
            if (fechadoDesseProjeto) {
                if (p.etapa_atual && p.etapa_atual !== 'BUSINESS CASE') {
                    totOrcamentoOficial += prev;
                    projetosNoOrcamentoExibido.push(p);
                } else {
                    totOrcamentoEmConstrucao += prev;
                    algumAFAindaEmConstrucao = true;
                }
            } else {
                totOrcamentoEmConstrucao += prev;
                algumAFAindaEmConstrucao = true;
                projetosNoOrcamentoExibido.push(p);
            }
        }
    });

    // NOVO: com múltiplos AFs convivendo (alguns fechados, outros ainda
    // em construção), o valor exibido passa a ser a SOMA dos dois —
    // antes era um "ou outro" (ternário), que escondia um dos dois
    // quando havia mais de um AF na visão selecionada. Pra um único AF
    // num estado uniforme, a soma dá exatamente o mesmo resultado de
    // antes (um dos dois sempre fica zerado nesse caso).
    const displayOrcamento = totOrcamentoOficial + totOrcamentoEmConstrucao;
    const isFechado = !algumAFAindaEmConstrucao;

    if (document.getElementById('kpiTotalProjetos')) document.getElementById('kpiTotalProjetos').innerText = projectsDataFiltrado.length;
    
    const kpiOrcAprovado = document.getElementById('kpiOrcAprovado');
    if (kpiOrcAprovado) {
        if (isFechado) {
            kpiOrcAprovado.innerHTML = `R$ ${displayOrcamento.toLocaleString('pt-BR', {minimumFractionDigits:2})} <span class="text-[10px] bg-green-100 text-green-800 px-1 rounded block font-normal">Oficial Homologado</span>`;
        } else {
            kpiOrcAprovado.innerHTML = `R$ ${displayOrcamento.toLocaleString('pt-BR', {minimumFractionDigits:2})} <span class="text-[10px] bg-amber-100 text-amber-800 px-1 rounded block font-normal">Em Construção (Informativo)</span>`;
        }
    }

    if (document.getElementById('kpiOrcAdhoc')) document.getElementById('kpiOrcAdhoc').innerText = `R$ ${totAdhoc.toLocaleString('pt-BR', {minimumFractionDigits:2})}`;
    if (document.getElementById('kpiOrcUtilizado')) document.getElementById('kpiOrcUtilizado').innerText = `R$ ${totR.toLocaleString('pt-BR', {minimumFractionDigits:2})}`;
    if (document.getElementById('kpiProjecao')) document.getElementById('kpiProjecao').innerText = `R$ ${(totR * 1.15).toLocaleString('pt-BR', {minimumFractionDigits:2})}`;
    if (document.getElementById('kpiSaldo')) document.getElementById('kpiSaldo').innerText = `R$ ${(displayOrcamento - totR).toLocaleString('pt-BR', {minimumFractionDigits:2})}`;

    renderTabelaConsolidacaoPortfolio(displayOrcamento, projectsDataFiltrado, isFechadoParaAF);
    await renderBlocosCriacaoEPortfolioFY(projectsDataFiltrado);
    renderQuadroCapexOpex('kpi', projetosNoOrcamentoExibido);
    renderQuadroCarryOverCapexOpex('kpi', projectsDataFiltrado.filter(p => p.is_carryover === true));

    const dashTableBody = document.getElementById('dashTableBody');
    if (dashTableBody) {
        // NOVO 10/08/2026: filtros por Área/Fase/Status no Status
        // Detalhado da Carteira.
        popularFiltrosStatusDetalhado();
        const filtroArea = (document.getElementById('dashFiltroArea') || {}).value || '';
        const filtroFase = (document.getElementById('dashFiltroFase') || {}).value || '';
        const filtroStatus = (document.getElementById('dashFiltroStatus') || {}).value || '';

        const projetosFiltrados = projectsDataFiltrado.filter(p => {
            if (filtroArea && (p.area || '') !== filtroArea) return false;
            if (filtroFase && (p.etapa_atual || 'BUSINESS CASE').toUpperCase() !== filtroFase) return false;
            if (filtroStatus && (p.sub_status || '') !== filtroStatus) return false;
            return true;
        });

        if (projetosFiltrados.length === 0) {
            const msgVazia = projectsDataFiltrado.length === 0 ? 'Nenhum projeto cadastrado no portfólio' : 'Nenhum projeto encontrado com esses filtros';
            dashTableBody.innerHTML = `<tr><td colspan="9" class="p-4 text-center text-gray-400 font-bold">${msgVazia}</td></tr>`;
            const dashCardsBodyVazio = document.getElementById('dashCardsBody');
            if (dashCardsBodyVazio) dashCardsBodyVazio.innerHTML = `<div class="p-4 text-center text-gray-400 font-bold text-sm">${msgVazia}</div>`;
        } else {
            // NOVO (item 2 do relatório de testes): ordenação clicável por
            // Farol/Área/Fase — calcula a saúde uma vez só (reaproveitada
            // no laço abaixo) pra poder ordenar por ela também.
            const FAROL_ORDEM = { CRITICO: 0, ATENCAO: 1, HOLD: 2, SAUDAVEL: 3, INATIVO: 4 };
            let projetosComSaude = projetosFiltrados.map(p => ({ p, saude: calcularSaudeProjeto(p, todasEtapasCache || []) }));

            if (dashOrdenacaoAtual.campo === 'padrao') {
                // AJUSTADO (a pedido do usuário 25/08/2026): agora
                // classifica pelo número sequencial do código do projeto
                // crescente — substituindo o padrão anterior (Status
                // depois Código).
                projetosComSaude.sort((a, b) => extrairNumeroSequencialCodigo(a.p.codigo) - extrairNumeroSequencialCodigo(b.p.codigo));
            } else if (dashOrdenacaoAtual.campo) {
                projetosComSaude.sort((a, b) => {
                    let va, vb;
                    if (dashOrdenacaoAtual.campo === 'area') { va = (a.p.area || '').toUpperCase(); vb = (b.p.area || '').toUpperCase(); }
                    else if (dashOrdenacaoAtual.campo === 'fase') { va = (a.p.etapa_atual || 'BUSINESS CASE').toUpperCase(); vb = (b.p.etapa_atual || 'BUSINESS CASE').toUpperCase(); }
                    else if (dashOrdenacaoAtual.campo === 'farol') { va = FAROL_ORDEM[a.saude.status] ?? 99; vb = FAROL_ORDEM[b.saude.status] ?? 99; }
                    if (va < vb) return dashOrdenacaoAtual.direcao === 'asc' ? -1 : 1;
                    if (va > vb) return dashOrdenacaoAtual.direcao === 'asc' ? 1 : -1;
                    return 0;
                });
            }

            // NOVO 10/08/2026 (responsivo pro celular): monta a linha da
            // tabela E o cartão equivalente no mesmo laço, com os mesmos
            // dados — a tabela some (hidden) e os cartões aparecem em
            // telas estreitas (md:hidden no container oposto).
            let linhasTabela = '';
            let cartoes = '';
            projetosComSaude.forEach(({ p, saude }) => {
                const qualif = (p.tipo_qualificacao || 'REG').toUpperCase();
                const badgeQualif = qualif === 'GROW' ? 'bg-purple-100 text-purple-800' : qualif === 'RUN' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800';
                const valPrevisto = (Number(p.val_bc) || Number(p.previsto) || 0).toLocaleString('pt-BR', {minimumFractionDigits:2});
                const valRealizado = (Number(p.realizado) || 0).toLocaleString('pt-BR', {minimumFractionDigits:2});

                linhasTabela += `
                    <tr>
                        <td class="p-3 font-bold font-mono"><button onclick="abrirDetalheProjeto('${p.codigo}')" class="text-red-700 hover:text-red-900 hover:underline" title="Ver detalhamento completo">${p.codigo}</button></td>
                        <td class="p-3 font-semibold">${escapeHtml(p.nome)} <br><span class="text-[10px] px-1.5 py-0.5 rounded font-bold ${badgeQualif}">${qualif}</span>${p.is_adhoc ? '<span class="text-[10px] px-1.5 py-0.5 rounded font-bold bg-purple-100 text-purple-800 ml-1">Extraordinário</span>' : ''}${p.is_carryover ? '<span class="text-[10px] px-1.5 py-0.5 rounded font-bold bg-orange-100 text-orange-800 ml-1">Carryover</span>' : ''}${p.is_subprojeto ? '<span class="text-[10px] px-1.5 py-0.5 rounded font-bold bg-cyan-100 text-cyan-800 ml-1">Subprojeto de ' + escapeHtml(p.projeto_pai_codigo) + '</span>' : ''}${p.projeto_concluido ? '<span class="text-[10px] px-1.5 py-0.5 rounded font-bold bg-emerald-100 text-emerald-800 ml-1">🏁 Concluído</span>' : ''}</td>
                        <td class="p-3 text-xs font-bold">${p.area || '-'}</td>
                        <td class="p-3 text-xs">${p.tipo_orcamento || '-'}</td>
                        <td class="p-3 text-xs font-bold">${p.etapa_atual || 'BUSINESS CASE'}</td>
                        <td class="p-3 text-xs">${p.sub_status || '-'}</td>
                        <td class="p-3 font-mono text-right">R$ ${valPrevisto}</td>
                        <td class="p-3 font-mono text-right text-red-600">R$ ${valRealizado}</td>
                        <td class="p-3 text-xs text-center">${saude.html}</td>
                    </tr>
                `;

                cartoes += `
                    <div class="bg-white border border-gray-200 rounded-lg p-3 shadow-sm">
                        <div class="flex justify-between items-start mb-2">
                            <button onclick="abrirDetalheProjeto('${p.codigo}')" class="text-red-700 font-mono font-bold text-sm hover:underline text-left">${p.codigo}</button>
                            ${saude.html}
                        </div>
                        <div class="font-semibold text-sm text-gray-800 mb-1">${escapeHtml(p.nome)}</div>
                        <span class="text-[10px] px-1.5 py-0.5 rounded font-bold ${badgeQualif} inline-block mb-2">${qualif}</span>
                        <div class="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-gray-600 border-t pt-2">
                            <div><span class="text-gray-400">Área:</span> <b>${p.area || '-'}</b></div>
                            <div><span class="text-gray-400">Tipo:</span> <b>${p.tipo_orcamento || '-'}</b></div>
                            <div><span class="text-gray-400">Fase:</span> <b>${p.etapa_atual || 'BUSINESS CASE'}</b></div>
                            <div><span class="text-gray-400">Status:</span> <b>${p.sub_status || '-'}</b></div>
                            <div><span class="text-gray-400">Previsto:</span> <b>R$ ${valPrevisto}</b></div>
                            <div><span class="text-gray-400">Realizado:</span> <b class="text-red-600">R$ ${valRealizado}</b></div>
                        </div>
                    </div>
                `;
            });

            dashTableBody.innerHTML = linhasTabela;
            const dashCardsBody = document.getElementById('dashCardsBody');
            if (dashCardsBody) dashCardsBody.innerHTML = cartoes;
        }
    }
}

// NOVO (a pedido do usuário 24/08/2026, conforme `quadro de totais.xlsx`
// anexado): os blocos que antecedem a Consolidação do Portfólio por
// Fase — sempre olhando pro Ano Fiscal ATUAL (getInfoAnoFiscal), não pro
// filtro de AF selecionado no topo do Dashboard, porque as descrições da
// planilha falam explicitamente "para o ano fiscal aberto".
// AJUSTADO (a pedido do usuário 24/08/2026): visual igual ao quadro de
// Consolidação por Fase (mesmas classes de tabela/linha/rodapé) — antes
// estava num layout compacto de 2 colunas lado a lado, diferente do
// resto do Dashboard. Também ganhou um 3º bloco espelhando o 1º, mas só
// com as demandas Extraordinárias (mesmas 4 categorias, filtro invertido
// de is_adhoc).
//
// Bloco 1 — "Projetos na Criação do Fiscal Year" (funil de Business
// Case, só demandas normais): as 4 categorias são mutuamente exclusivas
// por construção (cada projeto em BC cai em exatamente uma), então a
// soma bate sozinha com o TOTAL GERAL — não teve que forçar nada.
// - Pra gerar orçamento: em BC, ainda sem orçamento definido (A PLANEJAR/PLANEJADO).
// - Pra validar orçamento: em BC, orçamento definido (ORÇAMENTO REALIZADO), aguardando comitê.
// - Aprovados: em BC, já aprovado no comitê (sub_status APROVADO) mas ainda
//   não incluído no fechamento em lote do AF (ver executarAprovacaoGlobalOrcamentoAF,
//   js/approvals/orcamento-af.js — mesmo filtro usado lá).
// - Reprovados: sub_status REPROVADO.
//
// Bloco 2 (NOVO) — mesma estrutura do Bloco 1, mas só com demandas
// Extraordinárias (is_adhoc=true) — o funil delas é o mesmo (Realizar
// Orçamento → aprovação no comitê), só a inclusão final muda (trade-off
// em vez do fechamento em lote do AF).
//
// Bloco 3 — "Portfolio de Projetos do Fiscal Year":
// - Extraordinárias: is_adhoc=true (todos, qualquer fase).
// - Carryover: is_carryover=true (todos, qualquer fase).
// - Demandas normais: todo o resto (nem Extraordinário nem Carryover).
// AJUSTADO (a pedido do usuário 24/08/2026): "Total de Projetos
// Incluídos na Abertura" deixou de ler o retrato congelado
// `anos_fiscais_config.qtd_projetos_fechado` (que só refletia o
// fechamento em lote, sem contar aprovações individuais feitas depois)
// e passou a ser a contagem AO VIVO de "demandas normais" — a mudança
// foi necessária pra cumprir a regra pedida agora: o TOTAL GERAL deste
// quadro tem que bater com o TOTAL GERAL da Consolidação por Fase. Isso
// só é garantido matematicamente se as 3 linhas daqui (normais +
// Extraordinárias + Carryover) formam uma partição exaustiva da MESMA
// população usada na tabela de fase (`listaBase`, recebida por
// parâmetro) — cada projeto cai em exatamente uma das 3 origens aqui, e
// em exatamente uma fase/situação lá.
async function renderBlocosCriacaoEPortfolioFY(listaFiltrada) {
    const elBody1 = document.getElementById('tableCriacaoFYBody');
    const elBodyAdhoc = document.getElementById('tableCriacaoAdhocFYBody');
    const elBody2 = document.getElementById('tablePortfolioFYBody');
    if (!elBody1 && !elBodyAdhoc && !elBody2) return;

    // Mesma base (e mesma exclusão de subprojeto) que a Consolidação por
    // Fase usa — é isso que garante os totais baterem entre os quadros.
    const listaBase = (listaFiltrada || projectsData).filter(p => p.is_subprojeto !== true);

    // Mesmas classes de <td>/<tr> já usadas na Consolidação por Fase —
    // "buscando diagramação e cores idênticas" (pedido do usuário).
    // AJUSTADO (a pedido do usuário 24/08/2026): linhas coloridas por
    // significado, pro quadro ficar mais fácil de ler de relance.
    const linha = (label, qtd, cor) => `
        <tr class="${cor || ''}">
            <td class="p-3 border-r border-gray-200 font-bold">${label}</td>
            <td class="p-3 text-center font-bold">${qtd}</td>
        </tr>`;
    const linhaTotal = (qtd) => `
        <td class="p-3 border-r border-gray-300">TOTAL GERAL DA CARTEIRA</td>
        <td class="p-3 text-center">${qtd}</td>`;

    // Funil de Business Case reutilizável — mesmas 4 categorias, só muda
    // o filtro de is_adhoc (normal vs. Extraordinário). Só olha pra quem
    // ainda está EM Business Case — o resto (já promovido) é contado no
    // Bloco 3 pela origem, não repetido aqui.
    // CORRIGIDO (bug reportado 24/08/2026): não excluía Carryover — 7
    // projetos de AF2026 marcados Carryover sob a regra antiga (antes do
    // ajuste de elegibilidade) ficaram parados em Business Case e
    // vazavam pra cá, aparecendo misturados na "criação" normal. Um
    // projeto Carryover (ou Extraordinário, já coberto pelo filtro de
    // is_adhoc) não é uma demanda NOVA sendo criada — sai daqui e
    // continua só contado no quadro de Portfolio (por origem) e no de
    // Consolidação por Fase (pela fase real, Business Case incluso).
    const calcularFunilBC = (isAdhoc) => {
        const emBC = listaBase.filter(p => p.etapa_atual === 'BUSINESS CASE' && p.is_adhoc === isAdhoc && p.is_carryover !== true);
        const paraOrcar = emBC.filter(p => ['A PLANEJAR', 'PLANEJADO', null, undefined, ''].includes(p.sub_status));
        const paraValidar = emBC.filter(p => p.sub_status === 'ORÇAMENTO REALIZADO');
        const aprovados = emBC.filter(p => p.sub_status === 'APROVADO');
        const reprovados = emBC.filter(p => p.sub_status === 'REPROVADO');
        return { paraOrcar, paraValidar, aprovados, reprovados };
    };

    // ---- Bloco 1 — demandas normais ----
    if (elBody1) {
        const f = calcularFunilBC(false);
        const total1 = f.paraOrcar.length + f.paraValidar.length + f.aprovados.length + f.reprovados.length;
        elBody1.innerHTML =
            linha('Total de Projetos para gerar orçamento', f.paraOrcar.length, 'bg-blue-50 text-blue-800') +
            linha('Total de projetos para validar orçamento (aprovar/reprovar/reanalisar)', f.paraValidar.length, 'bg-amber-50 text-amber-800') +
            linha('Total de Projetos Aprovados', f.aprovados.length, 'bg-emerald-50 text-emerald-800') +
            linha('Total de Projetos Reprovados', f.reprovados.length, 'bg-red-50 text-red-800');
        const elTotal1 = document.getElementById('tableCriacaoFYTotal');
        if (elTotal1) elTotal1.innerHTML = linhaTotal(total1);
    }

    // ---- Bloco 2 (NOVO) — mesmo funil, só demandas Extraordinárias ----
    if (elBodyAdhoc) {
        const f = calcularFunilBC(true);
        const totalAdhoc = f.paraOrcar.length + f.paraValidar.length + f.aprovados.length + f.reprovados.length;
        elBodyAdhoc.innerHTML =
            linha('Total de Projetos para gerar orçamento', f.paraOrcar.length, 'bg-blue-50 text-blue-800') +
            linha('Total de projetos para validar orçamento (aprovar/reprovar/reanalisar)', f.paraValidar.length, 'bg-amber-50 text-amber-800') +
            linha('Total de Projetos Aprovados (aguardando inclusão via trade-off)', f.aprovados.length, 'bg-emerald-50 text-emerald-800') +
            linha('Total de Projetos Reprovados', f.reprovados.length, 'bg-red-50 text-red-800');
        const elTotalAdhoc = document.getElementById('tableCriacaoAdhocFYTotal');
        if (elTotalAdhoc) elTotalAdhoc.innerHTML = linhaTotal(totalAdhoc);
    }

    // ---- Bloco 3 — Portfolio de Projetos do Fiscal Year ----
    // Partição exaustiva de `listaBase` por ORIGEM (a de Fase, logo
    // abaixo, particiona a MESMA listaBase por FASE/SITUAÇÃO) — cada
    // projeto cai em exatamente uma das 3 linhas, garantindo que o TOTAL
    // GERAL bata com o da Consolidação por Fase.
    if (elBody2) {
        const extraordinarias = listaBase.filter(p => p.is_adhoc === true);
        const carryover = listaBase.filter(p => p.is_carryover === true);
        const normais = listaBase.filter(p => p.is_adhoc !== true && p.is_carryover !== true);
        const totalBloco2 = normais.length + extraordinarias.length + carryover.length;

        elBody2.innerHTML =
            linha('Total de Projetos Incluídos na Abertura do Ano Fiscal', normais.length, 'bg-blue-50 text-blue-800') +
            linha('Total Demandas Extraordinárias', extraordinarias.length, 'bg-purple-50 text-purple-800') +
            linha('Total Demandas Carryover', carryover.length, 'bg-orange-50 text-orange-800');
        const elTotal2 = document.getElementById('tablePortfolioFYTotal');
        if (elTotal2) elTotal2.innerHTML = linhaTotal(totalBloco2);
    }
}

function renderTabelaConsolidacaoPortfolio(totOrcamentoGeral, listaFiltrada, isFechadoParaAF) {
    // NOVO (a pedido do usuário): usa a lista já filtrada por Ano Fiscal
    // quando fornecida — fallback pra projectsData (comportamento
    // antigo) se chamada de algum lugar que ainda não passa o parâmetro.
    const listaBase = listaFiltrada || projectsData;
    const fasesDef = [
        { id: 'BC', label: '1. Business Case (Ativos / Em Andamento)', etapasMatch: ['BUSINESS CASE', ''], subStatusExclude: ['CANCELADO', 'REPROVADO'] },
        { id: 'REQ', label: '2. Requerimentos', etapasMatch: ['REQUIREMENTS'], subStatusExclude: [] },
        { id: 'TECH', label: '3. Technical Architecture', etapasMatch: ['TECHNICAL'], subStatusExclude: [] },
        { id: 'EXEC', label: '4. Execução (Desenvolvimento)', etapasMatch: ['EXECUTION'], subStatusExclude: [] },
        { id: 'UAT', label: '5. UAT (Homologação)', etapasMatch: ['UAT'], subStatusExclude: [] },
        { id: 'GOLIVE', label: '6. Go-Live & Concluídos', etapasMatch: ['GOLIVE', 'GO LIVE', 'CONCLUIDO'], subStatusExclude: [] }
    ];

    const totalGlobal = listaBase.length || 1;
    let totGeralQtd = 0, totGeralOrc = 0;

    // AJUSTADO (a pedido do usuário 24/08/2026): Carryover e Extraordinário
    // voltam a contar na fase real deles (não segregados) — o total desta
    // tabela agora bate com o quadro "Portfolio de Projetos do Fiscal
    // Year" (ver renderBlocosCriacaoEPortfolioFY), que já soma
    // Carryover/Extraordinário separadamente por origem. HOLD continua
    // segregado (é um estado "parado", não uma fase de verdade).
    let rowsHtml = fasesDef.map(fase => {
        const projsFase = listaBase.filter(p => {
            const etapa = (p.etapa_atual || 'BUSINESS CASE').toUpperCase();
            const sub = (p.sub_status || '').toUpperCase();
            if (sub === 'HOLD') return false; // item 1 (relatório de testes): segregado pro quadro próprio também
            // NOVO (item 2 — subprojetos/conclusão): subprojeto não conta
            // como demanda própria aqui (o pai já representa a demanda);
            // projeto já concluído sai da contagem "ativa" por fase.
            if (p.is_subprojeto === true) return false;
            if (p.projeto_concluido === true) return false;
            if (!fase.etapasMatch.includes(etapa)) return false;
            if (fase.subStatusExclude.includes(sub)) return false;
            return true;
        });
        const qtd = projsFase.length;
        const pct = Math.round((qtd / totalGlobal) * 100);
        const orcSoma = projsFase.reduce((acc, p) => acc + (Number(p.val_bc) || Number(p.previsto) || 0), 0);

        totGeralQtd += qtd; 
        totGeralOrc += orcSoma;

        // CORRIGIDO (a pedido do usuário): checa por AF de cada projeto
        // dessa linha, não mais um "fechado" global — evita marcar
        // "Em Construção" errado quando o AF de outro projeto (de outra
        // linha, fora do Business Case) é que já estava fechado.
        const isConstrucao = fase.id === 'BC' && projsFase.some(p => isFechadoParaAF && !isFechadoParaAF(p.ano_fiscal));
        const labelSufixo = isConstrucao ? ' <span class="text-[10px] bg-amber-100 text-amber-800 px-1 rounded">Em Construção (Informativo)</span>' : '';

        return `
            <tr>
                <td class="p-3 border-r border-gray-200 font-bold">${fase.label} ${labelSufixo}</td>
                <td class="p-3 border-r border-gray-200 text-center font-bold">${qtd}</td>
                <td class="p-3 border-r border-gray-200 text-center">${pct}%</td>
                <td class="p-3 border-r border-gray-200 text-right font-bold text-red-700">R$ ${orcSoma.toLocaleString('pt-BR', {minimumFractionDigits:2})}</td>
                <td class="p-3">🟢 ${qtd} em Andamento</td>
            </tr>
        `;
    }).join('');

    const projsCancelados = listaBase.filter(p => (p.sub_status || '').toUpperCase() === 'CANCELADO' || (p.status || '').toUpperCase() === 'CANCELADO');
    const qtdCancelados = projsCancelados.length;
    const pctCancelados = Math.round((qtdCancelados / totalGlobal) * 100);
    const orcCancelados = projsCancelados.reduce((acc, p) => acc + (Number(p.val_bc) || Number(p.previsto) || 0), 0);
    // CORRIGIDO 10/08/2026 (bug reportado): o valor de cancelados/reprovados
    // NÃO deve compor o "TOTAL GERAL DA CARTEIRA" — só a quantidade de
    // linhas continua contando (informativo), o valor de orçamento fica
    // de fora da soma.
    totGeralQtd += qtdCancelados;

    rowsHtml += `
        <tr class="bg-gray-50 text-gray-500">
            <td class="p-3 border-r border-gray-200 font-bold uppercase"><i class="fa-solid fa-ban text-gray-500 mr-1"></i> Projetos Cancelados</td>
            <td class="p-3 border-r border-gray-200 text-center font-bold">${qtdCancelados}</td>
            <td class="p-3 border-r border-gray-200 text-center">${pctCancelados}%</td>
            <td class="p-3 border-r border-gray-200 text-right font-bold line-through">R$ ${orcCancelados.toLocaleString('pt-BR', {minimumFractionDigits:2})}</td>
            <td class="p-3 italic text-gray-400">🚫 ${qtdCancelados} Cancelado(s)</td>
        </tr>
    `;

    // CORRIGIDO 10/08/2026 (bug reportado pelo usuário): projetos com
    // orçamento reprovado no Comitê desapareciam do dashboard por
    // completo — não se encaixavam em nenhuma fase (etapa_atual continua
    // BUSINESS CASE, mas a fase 'BC' exclui REPROVADO) nem na linha de
    // Cancelados (que só olhava CANCELADO). Linha própria, mesmo padrão.
    const projsReprovados = listaBase.filter(p => (p.sub_status || '').toUpperCase() === 'REPROVADO');
    const qtdReprovados = projsReprovados.length;
    const pctReprovados = Math.round((qtdReprovados / totalGlobal) * 100);
    const orcReprovados = projsReprovados.reduce((acc, p) => acc + (Number(p.val_bc) || Number(p.previsto) || 0), 0);
    totGeralQtd += qtdReprovados;

    rowsHtml += `
        <tr class="bg-red-50 text-red-700">
            <td class="p-3 border-r border-gray-200 font-bold uppercase"><i class="fa-solid fa-circle-xmark mr-1"></i> Projetos Reprovados</td>
            <td class="p-3 border-r border-gray-200 text-center font-bold">${qtdReprovados}</td>
            <td class="p-3 border-r border-gray-200 text-center">${pctReprovados}%</td>
            <td class="p-3 border-r border-gray-200 text-right font-bold line-through">R$ ${orcReprovados.toLocaleString('pt-BR', {minimumFractionDigits:2})}</td>
            <td class="p-3 italic">❌ ${qtdReprovados} Reprovado(s)</td>
        </tr>
    `;

    // NOVO 10/08/2026 (item 1 do relatório de testes): projetos em HOLD
    // (via trade-off Extraordinário) ganham linha própria — não somam no total
    // geral, ficam visíveis só aqui e na tela de Detalhamento.
    const projsHold = listaBase.filter(p => (p.sub_status || '').toUpperCase() === 'HOLD');
    const qtdHold = projsHold.length;
    const orcHold = projsHold.reduce((acc, p) => acc + (Number(p.val_bc) || Number(p.previsto) || 0), 0);
    totGeralQtd += qtdHold;

    // AJUSTADO (a pedido do usuário 24/08/2026, conforme quadro de
    // totais.xlsx anexado): Hold e Concluídos não mostram % — só as
    // fases e "Projetos Cancelados" mostram.
    rowsHtml += `
        <tr class="bg-yellow-50 text-yellow-800">
            <td class="p-3 border-r border-gray-200 font-bold uppercase"><i class="fa-solid fa-pause mr-1"></i> Projetos em Hold</td>
            <td class="p-3 border-r border-gray-200 text-center font-bold">${qtdHold}</td>
            <td class="p-3 border-r border-gray-200 text-center">-</td>
            <td class="p-3 border-r border-gray-200 text-right font-bold">R$ ${orcHold.toLocaleString('pt-BR', {minimumFractionDigits:2})}</td>
            <td class="p-3 italic">⏸️ ${qtdHold} Em Hold — via trade-off Extraordinário</td>
        </tr>
    `;

    // NOVO (item 2 — subprojetos/conclusão): linha própria de projetos
    // JÁ concluídos (baixa final registrada, ver tela de Conclusão de
    // Projeto) — só principais contam aqui, subprojeto concluído fica
    // implícito dentro do pai.
    const projsConcluidos = listaBase.filter(p => p.projeto_concluido === true && !p.is_subprojeto);
    const qtdConcluidos = projsConcluidos.length;
    const orcConcluidos = projsConcluidos.reduce((acc, p) => acc + (Number(p.val_bc) || Number(p.previsto) || 0), 0);
    totGeralQtd += qtdConcluidos;

    rowsHtml += `
        <tr class="bg-emerald-50 text-emerald-800">
            <td class="p-3 border-r border-gray-200 font-bold uppercase"><i class="fa-solid fa-flag-checkered mr-1"></i> Projetos Concluídos</td>
            <td class="p-3 border-r border-gray-200 text-center font-bold">${qtdConcluidos}</td>
            <td class="p-3 border-r border-gray-200 text-center">-</td>
            <td class="p-3 border-r border-gray-200 text-right font-bold">R$ ${orcConcluidos.toLocaleString('pt-BR', {minimumFractionDigits:2})}</td>
            <td class="p-3 italic">🏁 ${qtdConcluidos} com baixa final registrada</td>
        </tr>
    `;

    // AJUSTADO (a pedido do usuário 24/08/2026): as linhas de total de
    // Extraordinário e de Carryover saíram daqui — foram pro quadro
    // "Portfolio de Projetos do Fiscal Year" (renderBlocosCriacaoEPortfolioFY),
    // exatamente como está na planilha anexada. Aqui, os projetos
    // Extraordinário/Carryover já contam nas linhas de fase acima (não
    // são mais segregados), então o TOTAL GERAL desta tabela bate com o
    // TOTAL GERAL daquele outro quadro.

    const elTabela = document.getElementById('tableConsolidacaoPortfolio');
    if (elTabela) elTabela.innerHTML = rowsHtml;

    const elTotal = document.getElementById('tableConsolidacaoPortfolioTotal');
    if (elTotal) {
        // CORRIGIDO (a pedido do usuário): checa por AF de cada projeto,
        // não mais um "fechado" global.
        const statusGlobalLabel = (isFechadoParaAF && listaBase.some(p => !isFechadoParaAF(p.ano_fiscal)))
            ? '🟡 Orçamento em Construção (Informativo)'
            : '🟢 Orçamento Homologado';
        elTotal.innerHTML = `
            <td class="p-3 border-r border-gray-300">TOTAL GERAL DA CARTEIRA</td>
            <td class="p-3 border-r border-gray-300 text-center">${totGeralQtd}</td>
            <td class="p-3 border-r border-gray-300 text-center">100%</td>
            <td class="p-3 border-r border-gray-300 text-right text-red-700">R$ ${totGeralOrc.toLocaleString('pt-BR', {minimumFractionDigits:2})}</td>
            <td class="p-3">${statusGlobalLabel}</td>
        `;
    }

    if (typeof renderGraphFunilFases === 'function') renderGraphFunilFases(listaBase);
    if (typeof renderGraphOrcadoVsRealizadoUn === 'function') renderGraphOrcadoVsRealizadoUn(listaBase);
    if (typeof renderGraphFarolSaude === 'function') renderGraphFarolSaude(listaBase);

    renderTabelaCarryoverDashboard(listaBase, isFechadoParaAF);
}

// NOVO 10/08/2026 (G19): quadro próprio, só com projetos marcados como
// Carryover — segregados do quadro principal de consolidação por fase.
function renderTabelaCarryoverDashboard(listaFiltrada, isFechadoParaAF) {
    const tbody = document.getElementById('tableCarryoverDashboardBody');
    if (!tbody) return;

    // NOVO (a pedido do usuário): usa a lista já filtrada por Ano Fiscal.
    const listaBase = listaFiltrada || projectsData;
    const projsCarryover = listaBase.filter(p => p.is_carryover === true);

    if (projsCarryover.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-gray-400 font-bold">Nenhum projeto marcado como Carryover no momento</td></tr>`;
        return;
    }

    tbody.innerHTML = projsCarryover.map(p => `
        <tr>
            <td class="p-3 font-mono font-bold text-orange-700">${p.codigo}</td>
            <td class="p-3 font-semibold">${escapeHtml(p.nome)}</td>
            <td class="p-3 text-xs font-bold">${p.etapa_atual || 'BUSINESS CASE'} <br><span class="text-gray-500 font-normal">${p.sub_status || '-'}</span></td>
            <td class="p-3 text-right font-mono font-bold text-orange-700">R$ ${Number(p.valor_carryover || 0).toLocaleString('pt-BR', {minimumFractionDigits:2})}</td>
            <td class="p-3 text-xs text-gray-500">${escapeHtml(p.carryover_marcado_por) || '-'}</td>
        </tr>
    `).join('');
}
