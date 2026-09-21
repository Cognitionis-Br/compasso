// =========================================================================
// dashboards/dashboard.js
// Orquestração da aba Dashboard: recorte por Ano Fiscal + Filtro Global,
// tabela "Status Detalhado da Carteira" e tabela de Carryover. As seções
// visuais ficam em dashboard-filtro.js / -resumo.js / -fases.js / -funis.js.
// calcularCapexOpex / renderQuadroCapexOpex ficam aqui porque a Visão de
// Orçamento (Financeiro) e o Carry Over também os usam.
// =========================================================================
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
    // NOVO (Agrupamento de Orçamento — item 5): 3º elo da cascata —
    // Ano Fiscal → restrição de área → agrupamento (AF/Área/Produto).
    // Aplicado ANTES de tudo pra a tela inteira (quadro, listas, gráficos)
    // refletir o subgrupo escolhido.
    if (typeof carregarAnosFiscaisLista === 'function') await carregarAnosFiscaisLista();
    // Filtro Global por Produto precisa de produtosCache p/ os rótulos.
    if (typeof carregarProdutosData === 'function' && (typeof produtosCache === 'undefined' || !produtosCache || !produtosCache.length)) {
        try { await carregarProdutosData(); } catch (e) { /* rótulo cai p/ "Produto #id" */ }
    }
    if (typeof montarSeletorAF === 'function') modoAFDashboard = montarSeletorAF('dashSeletorAF', modoAFDashboard);
    // Recorte por Ano Fiscal selecionado + restrição de área do usuário.
    // O agrupamento AF/Área/Produto foi absorvido pelo Filtro Global.
    const projectsDataFiltrado = filtrarProjetosPorArea(
        filtrarProjetosPorAnoFiscalSelecionado(projectsData, modoAFDashboard), 'dashboard');
    renderFaixaAFSelecionado('dashFaixaAFSelecionado', modoAFDashboard);

    // Filtro Global (Estágio 1) — recorte compartilhado sobre a lista já
    // no escopo do Ano Fiscal. Resumo Orçamentário e Funis seguem com a
    // lista do AF (projectsDataFiltrado); Consolidação por Fase, Farol,
    // Orçado×Realizado, Composição e Status Detalhado usam projectsDataDash.
    if (typeof renderFiltroGlobalDashboard === 'function') renderFiltroGlobalDashboard();
    const projectsDataDash = (typeof aplicarFiltroGlobal === 'function')
        ? aplicarFiltroGlobal(projectsDataFiltrado) : projectsDataFiltrado;

    // Estágio 2 — Resumo Orçamentário (§4.3), Composição (§4.5).
    // O Farol (§4.4) precisa do cache de projeto_etapas; renderizado
    // logo depois do fetch dele, mais abaixo.
    if (typeof renderResumoOrcamentario === 'function') renderResumoOrcamentario(projectsDataFiltrado);
    if (typeof renderComposicaoPortfolio === 'function') renderComposicaoPortfolio(projectsDataDash);

    // NOVO 10/08/2026: busca o cronograma granular de todas as etapas
    // uma vez só, pra alimentar calcularSaudeProjeto com o mesmo tipo de
    // checagem de atraso que o Cronograma & Evolução usa — sem isso,
    // o farol de saúde não detectava etapas com prazo vencido fora de
    // Business Case/Requerimentos.
    const { data: todasEtapasCache } = await _supabase.from('projeto_etapas').select('*');

    // Estágio 2 — Farol de Saúde (§4.4), agora com o cache de etapas.
    if (typeof renderFarolSaudeDash === 'function') renderFarolSaudeDash(projectsDataDash, todasEtapasCache || []);

    // Estágio 3 — Consolidação por Fase (§4.2) substitui a tabela antiga.
    // Os gráficos e a tabela de Carryover (antes chamados no fim de
    // renderTabelaConsolidacaoPortfolio) passam a ser chamados aqui direto.
    if (typeof renderOrcadoRealizadoArea === 'function') renderOrcadoRealizadoArea(projectsDataDash);
    if (typeof renderConsolidacaoFases === 'function') renderConsolidacaoFases(projectsDataDash, todasEtapasCache || []);
    if (typeof renderFunisCriacao === 'function') renderFunisCriacao(projectsDataFiltrado);
    if (typeof renderTabelaCarryoverDashboard === 'function') renderTabelaCarryoverDashboard(projectsDataDash);

    const dashTableBody = document.getElementById('dashTableBody');
    if (dashTableBody) {
        // Status Detalhado da Carteira — reflete o Filtro Global (§4.9).
        const projetosFiltrados = projectsDataDash;

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
                        <td class="p-3 text-xs"><span class="text-[10px] px-1.5 py-0.5 rounded font-bold ${badgeQualif}">${qualif}</span></td>
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


// NOVO 10/08/2026 (G19): quadro próprio, só com projetos marcados como
// Carryover — segregados do quadro principal de consolidação por fase.
function renderTabelaCarryoverDashboard(listaFiltrada) {
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
