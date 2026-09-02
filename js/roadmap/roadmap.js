// =========================================================================
// roadmap/roadmap.js
// Roadmap — três visões (G18, lista de ajustes do usuário 10/08/2026):
// - Por Fase (a original, mantida sem mudança de comportamento).
// - Por Área → Projeto: agrupa por área, mostra a fase de cada projeto
//   como atributo da linha.
// - Por Responsável → Projeto: mesma ideia, agrupado pela pessoa
//   solicitante.
//
// Controle de acesso segregado por área: reaproveita o campo `area` já
// existente em perfis_usuarios (currentUser.area) — usuário só vê
// projetos da própria área; ADMINISTRADOR vê tudo, sem filtro. Isso é só
// UX por enquanto (mesmo nível de garantia do resto do RBAC hoje) — a
// garantia real depende do G2 (RLS), ainda não implementado.
// =========================================================================

let roadmapVisaoAtual = 'fase';

// NOVO (filtros do Roadmap, a pedido do usuário): busca de projeto por
// código/nome (disponível em qualquer visão) e um filtro pelo VALOR da
// dimensão de agrupamento (Área/Responsável/Iniciativa), disponível só
// nas 3 visões agrupadas — "Por Fase" não agrupa por nada, então só tem
// a busca por código/nome.
let filtroDimensaoRoadmap = '';
let filtroBuscaProjetoRoadmap = '';

const CONFIG_FILTRO_DIMENSAO_ROADMAP = {
    area: { label: 'Área', campo: 'area' },
    responsavel: { label: 'Responsável', campo: 'pessoa_solicitante' },
    iniciativa: { label: 'Iniciativa Estratégica', campo: null } // resolvido via lookup, não é campo direto do projeto
};

function switchRoadmapVisao(visao) {
    roadmapVisaoAtual = visao;
    ['fase', 'area', 'responsavel', 'iniciativa'].forEach(v => {
        const btn = document.getElementById(`roadmapBtn${v.charAt(0).toUpperCase() + v.slice(1)}`);
        if (btn) btn.classList.toggle('bg-indigo-600', v === visao);
        if (btn) btn.classList.toggle('text-white', v === visao);
        if (btn) btn.classList.toggle('bg-gray-100', v !== visao);
        if (btn) btn.classList.toggle('text-gray-600', v !== visao);
    });

    filtroDimensaoRoadmap = '';
    const wrapperDimensao = document.getElementById('roadmapFiltroDimensaoWrapper');
    const configDimensao = CONFIG_FILTRO_DIMENSAO_ROADMAP[visao];
    if (wrapperDimensao) wrapperDimensao.classList.toggle('hidden', !configDimensao);
    if (configDimensao) {
        document.getElementById('roadmapFiltroDimensaoLabel').innerText = configDimensao.label;
        popularFiltroDimensaoRoadmap(visao, configDimensao);
    }

    renderRoadmap();
}

// Popula o select do valor da dimensão (Área/Responsável/Iniciativa) a
// partir do portfólio inteiro (não só do que está filtrado por AF no
// momento) — evita que trocar o AF selecionado depois "perca" uma opção
// que já estava escolhida.
function popularFiltroDimensaoRoadmap(visao, configDimensao) {
    const select = document.getElementById('roadmapFiltroDimensaoSelect');
    if (!select) return;

    if (visao === 'iniciativa') {
        _supabase.from('iniciativas_estrategicas').select('nome').order('nome').then(({ data }) => {
            const nomes = [...new Set((data || []).map(i => i.nome).filter(Boolean))];
            select.innerHTML = '<option value="">-- Todas --</option>' + nomes.map(n => `<option value="${n}">${n}</option>`).join('');
        });
        return;
    }

    const valores = [...new Set((projectsData || []).map(p => p[configDimensao.campo]).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
    select.innerHTML = '<option value="">-- Todas --</option>' + valores.map(v => `<option value="${v}">${v}</option>`).join('');
}

function onMudarFiltroRoadmap() {
    filtroDimensaoRoadmap = document.getElementById('roadmapFiltroDimensaoSelect').value;
    filtroBuscaProjetoRoadmap = document.getElementById('roadmapFiltroBuscaProjeto').value.trim();
    renderRoadmap();
}

function limparFiltrosRoadmap() {
    filtroDimensaoRoadmap = '';
    filtroBuscaProjetoRoadmap = '';
    const selectDimensao = document.getElementById('roadmapFiltroDimensaoSelect');
    if (selectDimensao) selectDimensao.value = '';
    const inputBusca = document.getElementById('roadmapFiltroBuscaProjeto');
    if (inputBusca) inputBusca.value = '';
    renderRoadmap();
}

// Casa tanto texto parcial digitado quanto o valor completo "CÓDIGO -
// NOME" que vem da datalist quando o usuário escolhe uma sugestão.
function projetoBateBuscaRoadmap(p) {
    if (!filtroBuscaProjetoRoadmap) return true;
    const termo = filtroBuscaProjetoRoadmap.toUpperCase();
    const codigo = (p.codigo || '').toUpperCase();
    const nome = (p.nome || '').toUpperCase();
    return codigo.includes(termo) || nome.includes(termo) || termo.includes(codigo) || (nome && termo.includes(nome));
}

function popularBuscaProjetoRoadmap(lista) {
    const datalist = document.getElementById('roadmapFiltroBuscaProjetoLista');
    if (!datalist) return;
    datalist.innerHTML = (lista || []).map(p => `<option value="${p.codigo} - ${escapeHtml(p.nome)}">`).join('');
}

// Filtro de acesso: ADMINISTRADOR vê tudo; os demais só veem projetos da
// própria área (comparando projeto.area x currentUser.area).
// AJUSTADO (Controle de acesso por atividade, Fase 5): passou a usar o
// filtro genérico (js/config/funcoes.js) — mesma regra de antes, mas
// agora respeitando restricao_area do catálogo em vez de aplicar sempre.
function filtrarProjetosPorAcessoRoadmap(lista) {
    return filtrarProjetosPorArea(lista, 'roadmap');
}

function renderRoadmap() {
    const container = document.getElementById('roadmapTimelineContainer');
    if (!container) return;

    // NOVO (a pedido do usuário): filtro de Ano Fiscal selecionado,
    // aplicado antes do filtro de acesso por área/perfil.
    if (typeof montarSeletorAF === 'function') modoAFRoadmap = montarSeletorAF('roadmapSeletorAF', modoAFRoadmap);
    renderFaixaAFSelecionado('roadmapFaixaAFSelecionado', modoAFRoadmap);
    const baseAF = filtrarProjetosPorAnoFiscalSelecionado(projectsData || [], modoAFRoadmap);
    const baseFiltrada = filtrarProjetosPorAcessoRoadmap(baseAF);

    popularBuscaProjetoRoadmap(baseFiltrada);

    if (baseFiltrada.length === 0) {
        const motivo = (!currentUser || !currentUser.area) && !(typeof ehAdministrador !== 'undefined' && ehAdministrador)
            ? 'Seu usuário não tem uma área definida — fale com um administrador.'
            : 'Nenhum projeto para exibir no roadmap.';
        container.innerHTML = `<div class="p-6 text-center text-gray-400 font-bold">${motivo}</div>`;
        return;
    }

    if (roadmapVisaoAtual === 'area') {
        renderRoadmapAgrupado(container, baseFiltrada, 'area', 'Área');
    } else if (roadmapVisaoAtual === 'responsavel') {
        renderRoadmapAgrupado(container, baseFiltrada, 'pessoa_solicitante', 'Responsável');
    } else if (roadmapVisaoAtual === 'iniciativa') {
        renderRoadmapPorIniciativa(container, baseFiltrada);
    } else {
        renderRoadmapPorProjetoGantt(container, baseFiltrada);
    }
}

// =========================================================================
// NOVO (a pedido do usuário — visão tipo Gantt por projeto): substitui a
// antiga "Por Fase" (que agrupava CARDS por fase) por uma linha do tempo
// por PROJETO, com um segmento colorido por fase, posicionado nos meses
// reais do Ano Fiscal (Abr-Mar) em que aconteceu/está acontecendo.
// Subprojetos aparecem encadeados dentro da linha do projeto pai.
// =========================================================================

const FASES_TIMELINE = [
    { key: 'BUSINESS CASE', label: 'Business Case', labelCurto: 'BC', cor: 'bg-red-800' },
    { key: 'REQUERIMENTS', label: 'Requirements', labelCurto: 'Req', cor: 'bg-orange-500' },
    { key: 'TECHNICAL', label: 'Especificação', labelCurto: 'Espec', cor: 'bg-pink-300' },
    { key: 'EXECUTION', label: 'Execution', labelCurto: 'Exec', cor: 'bg-sky-300' },
    { key: 'UAT', label: 'UAT', labelCurto: 'UAT', cor: 'bg-blue-500' },
    { key: 'GOLIVE', label: 'Go-Live', labelCurto: 'GL', cor: 'bg-emerald-600' }
];
const MESES_FY = ['ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ', 'JAN', 'FEV', 'MAR'];

// NOVO (a pedido do usuário 24/08/2026): a grade do Gantt era sempre fixa
// em 12 meses (Abr-Mar do AF exibido) — atividades que começaram ANTES do
// início do AF (ex.: Business Case rodando nos meses anteriores à abertura
// formal do ano fiscal) ficavam escondidas (mesIndexNoAF descartava índice
// negativo). Agora a grade pode ganhar colunas EXTRAS no início, o
// suficiente pra cobrir a atividade mais antiga entre os projetos
// exibidos, sem nunca cortar o fim (continua terminando em Março do AF,
// como sempre foi). MESES_CALENDARIO é o ciclo completo de 12 meses,
// usado só pra gerar os rótulos das colunas extras (sem ano — mesmo
// critério dos rótulos ABR-MAR de sempre, já que projetos diferentes
// exibidos juntos podem ter AFs/anos-calendário diferentes).
const MESES_CALENDARIO = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
const EXTENSAO_GANTT_MAX_MESES = 12; // teto de segurança — evita grade absurdamente larga se alguma data estiver muito errada

function gerarRotulosMesesGantt(extensaoMeses) {
    const prefixo = [];
    for (let i = extensaoMeses; i >= 1; i--) {
        const idx = ((3 - i) % 12 + 12) % 12; // 3 = índice de ABR em MESES_CALENDARIO
        prefixo.push(MESES_CALENDARIO[idx]);
    }
    return [...prefixo, ...MESES_FY];
}

// Quantos meses ANTES do início do AF do projeto uma data cai (0 se a
// data estiver dentro ou depois do início do AF).
function mesesAntesDoAF(dataStr, anoFiscalStr) {
    if (!dataStr) return 0;
    const limites = obterLimitesAnoFiscal(anoFiscalStr);
    if (!limites) return 0;
    const anoInicioAF = Number(limites.inicio.split('-')[0]);
    const mesInicioAF = Number(limites.inicio.split('-')[1]);
    const [anoData, mesData] = dataStr.split('-').map(Number);
    const idx = (anoData - anoInicioAF) * 12 + (mesData - mesInicioAF);
    return idx < 0 ? -idx : 0;
}

// Varre os projetos (+ subprojetos) que vão aparecer no Gantt e descobre
// de quantos meses a grade precisa se estender ANTES do início do AF pra
// não esconder atividades que começaram antes — cada projeto é medido
// contra o seu PRÓPRIO ano_fiscal (mesma referência usada pra posicionar
// as barras dele em renderTrilhaSegmentos/renderLinhaGanttProjeto).
function calcularExtensaoGanttMeses(principais, listaCompleta, todasEtapas) {
    let maxExtensao = 0;
    principais.forEach(p => {
        const segmentosPrincipal = obterSegmentosFaseProjeto(p.codigo, todasEtapas);
        const subprojetos = listaCompleta.filter(sp => sp.projeto_pai_codigo === p.codigo);
        const segmentosSub = subprojetos.flatMap(sp => obterSegmentosFaseProjeto(sp.codigo, todasEtapas));
        [...segmentosPrincipal, ...segmentosSub].forEach(seg => {
            const extra = mesesAntesDoAF(seg.inicio, p.ano_fiscal);
            if (extra > maxExtensao) maxExtensao = extra;
        });
    });
    return Math.min(maxExtensao, EXTENSAO_GANTT_MAX_MESES);
}

// NOVO (a pedido do usuário: quebra de sub-fases no roadmap): Requirements
// (Gerar -> Aprovar Negócio -> Aprovar TI -> Fechar) e Technical (Gerar ->
// Avaliar Negócio -> Fechar) têm múltiplas etapas dentro da mesma fase —
// a barra da fase, que hoje é um segmento único agregando todas as
// etapas, passa a virar um segmento POR ETAPA nessas duas fases, cada um
// com seu próprio intervalo de datas e status. As etapas em si (nomes,
// ordem, quantas são) continuam vindo de fases_etapas via
// obterEtapasDaFase — nada fixo aqui, então acompanha o que estiver
// cadastrado em Administração → Fases e Etapas.
const FASES_COM_SUBFASES_TIMELINE = ['REQUERIMENTS', 'TECHNICAL'];

// AJUSTADO (a pedido do usuário): em vez de variar a OPACIDADE da cor-base
// (abordagem anterior, revertida — dependia de valores arbitrários do
// Tailwind, frágil no CDN sem build), varia o PRÓPRIO TOM dentro da escala
// da mesma família de cor (ex.: orange-500 -> 600 -> 700 -> 800). A
// primeira sub-etapa mantém exatamente a cor-base da fase (a mesma da
// legenda); as seguintes vão escurecendo dentro da paleta real do
// Tailwind — sempre classes fixas do tema padrão, então o CDN gera o CSS
// sem pegadinha nenhuma.
const ESCALA_TOM_TAILWIND = [300, 400, 500, 600, 700, 800, 900];

function corSubfaseComTom(corBase, indice, total) {
    if (total <= 1) return corBase;
    const match = corBase.match(/^(bg-[a-z]+-)(\d+)$/);
    if (!match) return corBase; // cor em formato inesperado — não arrisca, mantém a base
    const [, prefixo, pesoBaseStr] = match;
    let posBase = ESCALA_TOM_TAILWIND.indexOf(Number(pesoBaseStr));
    if (posBase === -1) posBase = 2; // fallback: assume próximo de 500

    const posFinal = Math.min(ESCALA_TOM_TAILWIND.length - 1, posBase + (total - 1));
    const passo = (posFinal - posBase) / (total - 1);
    const pos = Math.min(ESCALA_TOM_TAILWIND.length - 1, Math.round(posBase + indice * passo));
    return `${prefixo}${ESCALA_TOM_TAILWIND[pos]}`;
}

// REVERTIDO (a pedido do usuário): a estrutura fixa de 12 meses do Ano
// Fiscal (Abr-Mar), dividida por quarter, é o formato certo — a
// tentativa anterior de janela dinâmica por projeto tirou essa
// estrutura. A causa real do bug de fases sumindo era outra: a posição
// do mês usava o AF "de hoje" (do sistema) pra todo mundo, em vez do AF
// **do próprio projeto** — projetos de ciclos mais antigos, com fases
// concluídas em outro ano-calendário, saíam da janela e desapareciam.
// Corrigido usando obterLimitesAnoFiscal(projeto.ano_fiscal) — já
// existe, criado antes pra validar prazo — pra mapear cada mês
// corretamente dentro do AF de cada projeto, mantendo os rótulos fixos
// Abr-Mar de sempre.
// CORRIGIDO (bug reportado: projeto com datas anteriores ao Ano Fiscal
// exibido aparecia com o quadro inteiro empurrado pro primeiro mês, como
// se tivesse começado dentro do AF — mais comum em Carryover, que é
// justamente o caso com exceção explícita pra ter datas fora do AF de
// origem (ver validarDataDentroDoAF). O CLAMP no início (Math.max(0, ...))
// mentia sobre quando a fase realmente começou. Agora: data anterior ao
// início do AF exibido retorna null — o chamador (renderTrilhaSegmentos)
// já filtra e não desenha pontos com idxIni null, então a fase some desta
// linha em vez de aparecer comprimida no mês errado. O fim continua
// limitado a 11 (não null) — uma fase que começou dentro do AF e ainda
// está em andamento no próximo ano fiscal continua visível, só não
// ultrapassa a grade fixa de 12 meses.
// AJUSTADO (a pedido do usuário 24/08/2026): recebe `extensaoMeses` — o
// tanto que a grade foi esticada pra trás pra caber a atividade mais
// antiga entre os projetos exibidos (ver calcularExtensaoGanttMeses). O
// índice é deslocado por essa extensão antes de checar o limite inferior;
// com a extensão calculada corretamente pelo chamador, idx só continua
// negativo (e portanto escondido) se a data for anterior até à própria
// janela já esticada — não deveria mais acontecer no caminho normal.
function mesIndexNoAF(dataStr, anoFiscalStr, extensaoMeses) {
    if (!dataStr) return null;
    extensaoMeses = extensaoMeses || 0;
    const limites = obterLimitesAnoFiscal(anoFiscalStr);
    if (!limites) return null;
    const anoInicioAF = Number(limites.inicio.split('-')[0]);
    const mesInicioAF = Number(limites.inicio.split('-')[1]); // sempre 4 (abril)
    const [anoData, mesData] = dataStr.split('-').map(Number);
    const idx = (anoData - anoInicioAF) * 12 + (mesData - mesInicioAF) + extensaoMeses;
    if (idx < 0) return null; // data anterior à janela exibida (mesmo já esticada) — não mostra
    return Math.min(11 + extensaoMeses, idx);
}

// CORRIGIDO (bug de lógica de negócio reportado 24/08/2026 — encontrado ao
// investigar por que corrigir `data_termino_planejamento` de uma etapa já
// concluída não mudava a barra no Gantt): pra etapas concluídas, o fim da
// barra usava `concluido_em` (o timestamp real de quando alguém clicou
// "Concluir" no sistema) e IGNORAVA silenciosamente `data_termino_planejamento`
// — misturando "quando era pra terminar" com "quando terminou de fato" numa
// única data, sem visualizar a diferença entre os dois. Agora cada segmento
// carrega os dois separadamente (`fimPlanejado` e `fimReal`) — quem desenha
// a barra (renderTrilhaSegmentos) decide como representar a diferença (barra
// sólida até o planejado + rachurado esticando até o real, quando o real for
// depois do planejado). `fim` continua existindo como o maior dos dois, só
// pra não quebrar quem calcula a largura/raia da barra ou a extensão do
// Gantt (calcularExtensaoGanttMeses só olha `seg.inicio`, não é afetado).
function obterSegmentosFaseProjeto(codigo, todasEtapas) {
    const segmentos = [];
    FASES_TIMELINE.forEach(faseInfo => {
        const etapasDaFase = obterEtapasDaFase(faseInfo.key);
        if (!etapasDaFase || etapasDaFase.length === 0) return;

        if (FASES_COM_SUBFASES_TIMELINE.includes(faseInfo.key) && etapasDaFase.length > 1) {
            etapasDaFase.forEach((etapa, indice) => {
                const linha = todasEtapas.find(e => e.projeto_codigo === codigo && e.etapa_id === etapa.id && e.data_inicio_planejamento);
                if (!linha) return; // sub-fase ainda não iniciada — não desenha
                const fimPlanejado = linha.data_termino_planejamento;
                const fimReal = linha.concluido_em ? linha.concluido_em.split('T')[0] : null;
                segmentos.push({
                    ...faseInfo,
                    cor: corSubfaseComTom(faseInfo.cor, indice, etapasDaFase.length),
                    label: `${faseInfo.label} — ${etapa.etapa}`,
                    etapaId: etapa.id,
                    inicio: linha.data_inicio_planejamento,
                    fimPlanejado,
                    fimReal,
                    fim: (fimReal && fimReal > fimPlanejado) ? fimReal : fimPlanejado,
                    concluida: linha.situacao === 'EXECUCAO_CONCLUIDO'
                });
            });
            return;
        }

        const idsEtapa = etapasDaFase.map(e => e.id);
        const linhas = todasEtapas.filter(e => e.projeto_codigo === codigo && idsEtapa.includes(e.etapa_id) && e.data_inicio_planejamento);
        if (linhas.length === 0) return;

        const inicio = linhas.reduce((min, e) => (!min || e.data_inicio_planejamento < min) ? e.data_inicio_planejamento : min, null);
        const concluida = linhas.every(e => e.situacao === 'EXECUCAO_CONCLUIDO');
        const fimPlanejado = linhas.reduce((max, e) => (!max || e.data_termino_planejamento > max) ? e.data_termino_planejamento : max, null);
        const conclusoesReais = linhas.filter(e => e.concluido_em).map(e => e.concluido_em.split('T')[0]);
        const fimReal = conclusoesReais.length > 0 ? conclusoesReais.reduce((max, dt) => (!max || dt > max) ? dt : max, null) : null;

        segmentos.push({
            ...faseInfo,
            inicio,
            fimPlanejado,
            fimReal,
            fim: (fimReal && fimReal > fimPlanejado) ? fimReal : fimPlanejado,
            concluida
        });
    });
    return segmentos;
}

// AJUSTADO (item 5 do relatório de testes): o cabeçalho de meses
// aparecia repetido em CADA linha de projeto — agora aparece uma vez só,
// junto do cabeçalho de quartis, fixo (sticky) no topo da lista — só a
// lista de projetos rola por baixo dele.
// AJUSTADO (a pedido do usuário 24/08/2026): recebe `extensaoMeses` — se
// maior que zero, a grade de meses ganha colunas extras ANTES de Q1 (rótulo
// "Antes do AF") pra caber atividades que começaram antes do início do AF
// exibido. Usa `style="grid-template-columns"` em vez da classe utilitária
// `grid-cols-12` porque o total de colunas agora é dinâmico (12 +
// extensaoMeses) — Tailwind via CDN só gera classes fixas da escala padrão.
// AJUSTADO DE NOVO (a pedido do usuário 24/08/2026): a célula que dizia
// "FY do Projeto" (rótulo genérico, sem valor nenhum) agora mostra o
// próprio Ano Fiscal selecionado no seletor do topo do Roadmap
// (`modoAFRoadmap` — mesma fonte que alimenta a faixa "Ano Fiscal
// Corrente — AFxxxx" logo acima). No modo "Todos os Anos Fiscais" não
// existe um único AF pra mostrar, então mantém um rótulo neutro.
function renderCabecalhoQuartisEMeses(extensaoMeses) {
    extensaoMeses = extensaoMeses || 0;
    const totalMeses = 12 + extensaoMeses;
    const estiloGradeMeses = `grid-template-columns: repeat(${totalMeses}, minmax(0, 1fr));`;
    const rotulosMeses = gerarRotulosMesesGantt(extensaoMeses);
    const infoAF = getInfoAnoFiscal();
    const rotuloFY = modoAFRoadmap === 'todos' ? 'Todos os AFs'
        : (modoAFRoadmap === 'pipeline' || modoAFRoadmap === 'proximo')
            ? (typeof afPipelineStr === 'function' ? afPipelineStr() : infoAF.proximoAFStr)
            : (modoAFRoadmap || (typeof afEmAndamentoStr === 'function' ? afEmAndamentoStr() : infoAF.afAtualStr));

    return `
        <div class="shadow-md rounded-lg overflow-hidden border border-red-900">
            <div class="grid grid-cols-4 bg-red-900 text-white text-[10px] font-bold uppercase">
                <div class="py-1.5 px-3 border-r border-red-800 flex items-center">${rotuloFY}</div>
                <div class="col-span-3 grid" style="${estiloGradeMeses}">
                    ${extensaoMeses > 0 ? `<div class="py-1.5 text-center border-r-2 border-red-950 opacity-70" style="grid-column: span ${extensaoMeses};">Antes do AF</div>` : ''}
                    <div class="py-1.5 text-center border-r border-red-800" style="grid-column: span 3;">Q1</div>
                    <div class="py-1.5 text-center border-r border-red-800" style="grid-column: span 3;">Q2</div>
                    <div class="py-1.5 text-center border-r border-red-800" style="grid-column: span 3;">Q3</div>
                    <div class="py-1.5 text-center" style="grid-column: span 3;">Q4</div>
                </div>
            </div>
            <div class="grid grid-cols-4 bg-red-800">
                <div class="border-r border-red-700"></div>
                <div class="col-span-3 grid text-[9px] font-bold text-center text-white uppercase" style="${estiloGradeMeses}">
                    ${rotulosMeses.map((m, i) => `<div class="py-1 border-r last:border-r-0 ${i === extensaoMeses - 1 ? 'border-red-950 border-r-2' : 'border-red-700'} ${i < extensaoMeses ? 'opacity-70' : ''}">${m}</div>`).join('')}
                </div>
            </div>
        </div>
    `;
}

// NOVO (a pedido do usuário: farol de status por diamante colorido,
// como no exemplo de referência). Calcula o status do segmento a partir
// da mesma regra de atraso já usada no Cronograma & Evolução
// (calcularAlertaEvolucao), pegando a etapa mais recente daquela fase.
function calcularStatusSegmento(codigoProjeto, seg, todasEtapas) {
    let linhas;
    if (seg.etapaId) {
        // Segmento de sub-fase (Requirements/Technical): status da etapa
        // específica, não da fase inteira.
        linhas = todasEtapas.filter(e => e.projeto_codigo === codigoProjeto && e.etapa_id === seg.etapaId);
    } else {
        const etapasDaFase = obterEtapasDaFase(seg.key);
        if (!etapasDaFase || etapasDaFase.length === 0) return { cor: 'bg-gray-400', label: 'Não Iniciado' };
        const idsEtapa = etapasDaFase.map(e => e.id);
        linhas = todasEtapas.filter(e => e.projeto_codigo === codigoProjeto && idsEtapa.includes(e.etapa_id));
    }
    if (linhas.length === 0) return { cor: 'bg-gray-400', label: 'Não Iniciado' };

    const emAndamento = linhas.find(e => e.situacao === 'EXECUCAO_EM_ANDAMENTO');
    if (emAndamento) {
        const alerta = calcularAlertaEvolucao(emAndamento);
        if (alerta && alerta.nivel === 'vermelho') return { cor: 'bg-red-600', label: 'Atrasado' };
        if (alerta && alerta.nivel === 'amarelo') return { cor: 'bg-amber-400', label: 'Em Risco' };
        return { cor: 'bg-emerald-500', label: 'No Prazo' };
    }
    if (linhas.every(e => e.situacao === 'EXECUCAO_CONCLUIDO')) return { cor: 'bg-emerald-500', label: 'No Prazo' };
    return { cor: 'bg-gray-400', label: 'Não Iniciado' };
}

function renderTrilhaSegmentos(segmentos, codigoProjeto, todasEtapas, anoFiscalStr, extensaoMeses) {
    extensaoMeses = extensaoMeses || 0;
    // AJUSTADO (item 3 do relatório de testes): tirado o nome da fase de
    // dentro da barra — a cor já identifica qual é (ver legenda de cores
    // no topo da tela). Fica só o diamante de status + check de
    // concluído.
    // Grade fixa de 12 colunas (Abr-Mar do AF do projeto), como sempre foi.
    //
    // CORRIGIDO DE NOVO (bug reportado: empurrar a segunda fase pra
    // frente deslocava ela pro mês ERRADO — se Requerimentos começa de
    // verdade em agosto, junto com Business Case, empurrar pra setembro
    // mentia sobre quando a etapa realmente aconteceu). Agora, quando
    // duas fases caem no mesmo mês de verdade, a segunda empilha numa
    // RAIA (linha) abaixo, mantendo as duas na coluna do mês correto —
    // técnica clássica de agendamento por "raias" (como um Gantt de
    // verdade faz).
    // AJUSTADO (bug de lógica de negócio reportado 24/08/2026): a barra
    // parava de distinguir "quando era pra terminar" (fimPlanejado) de
    // "quando terminou de fato" (fimReal) — as duas viravam uma data só.
    // Agora calcula os dois índices separadamente; se a conclusão real
    // ficou depois do planejado, a barra é desenhada em duas partes: um
    // bloco SÓLIDO (início → planejado) seguido de um bloco RACHURADO
    // (planejado → real), mesma cor da fase, deixando o atraso visível
    // sem esconder nem o prazo original nem quando terminou de verdade.
    const posicoes = segmentos.map(seg => {
        const idxIni = mesIndexNoAF(seg.inicio, anoFiscalStr, extensaoMeses);
        const idxFimPlanejado = mesIndexNoAF(seg.fimPlanejado, anoFiscalStr, extensaoMeses) ?? idxIni;
        const idxFimReal = seg.fimReal ? (mesIndexNoAF(seg.fimReal, anoFiscalStr, extensaoMeses) ?? idxFimPlanejado) : null;
        const idxFim = Math.max(idxFimPlanejado, idxFimReal ?? idxFimPlanejado);
        return { seg, idxIni, idxFimPlanejado, idxFimReal, idxFim };
    }).filter(p => p.idxIni !== null).sort((a, b) => a.idxIni - b.idxIni || a.idxFim - b.idxFim);

    const raiasFimOcupado = []; // raiasFimOcupado[i] = última coluna ocupada na raia i
    posicoes.forEach(p => {
        let raia = raiasFimOcupado.findIndex(fimRaia => fimRaia < p.idxIni);
        if (raia === -1) {
            raia = raiasFimOcupado.length;
            raiasFimOcupado.push(p.idxFim);
        } else {
            raiasFimOcupado[raia] = p.idxFim;
        }
        p.raia = raia;
    });

    const totalRaias = Math.max(1, raiasFimOcupado.length);
    const totalColunas = 12 + extensaoMeses;
    const ESTILO_RACHURADO = 'background-image: repeating-linear-gradient(45deg, rgba(255,255,255,0.6) 0, rgba(255,255,255,0.6) 3px, transparent 3px, transparent 6px);';

    return `
        <div class="grid gap-0.5 items-center" style="grid-template-columns: repeat(${totalColunas}, minmax(0, 1fr)); grid-auto-rows: 1.5rem; row-gap: 3px;">
            ${posicoes.map(p => {
                const temAtraso = p.idxFimReal !== null && p.idxFimReal > p.idxFimPlanejado;
                const spanPlanejado = Math.max(1, (p.idxFimPlanejado - p.idxIni) + 1);
                const status = calcularStatusSegmento(codigoProjeto, p.seg, todasEtapas);
                const tituloPlanejado = temAtraso
                    ? `${p.seg.label}: planejado ${p.seg.inicio} a ${p.seg.fimPlanejado} — ${status.label}`
                    : `${p.seg.label}: ${p.seg.inicio} a ${p.seg.fim} — ${status.label}`;

                let html = `
                    <div class="${p.seg.cor} ${temAtraso ? 'rounded-l' : 'rounded'} text-white text-[9px] font-bold flex items-center justify-center gap-1 px-1 h-6" style="grid-column: ${p.idxIni + 1} / span ${spanPlanejado}; grid-row: ${p.raia + 1};" title="${tituloPlanejado}">
                        <span class="${status.cor} w-2 h-2 rotate-45 inline-block flex-shrink-0 border border-white"></span>
                        ${p.seg.concluida && !temAtraso ? '<span>✓</span>' : ''}
                    </div>
                `;

                if (temAtraso) {
                    const spanReal = Math.max(1, p.idxFimReal - p.idxFimPlanejado);
                    html += `
                        <div class="${p.seg.cor} rounded-r text-white text-[9px] font-bold flex items-center justify-center h-6" style="grid-column: ${p.idxFimPlanejado + 2} / span ${spanReal}; grid-row: ${p.raia + 1}; ${ESTILO_RACHURADO}" title="${p.seg.label}: concluído em ${p.seg.fimReal} — passou do planejado (${p.seg.fimPlanejado})">
                            <span>✓</span>
                        </div>
                    `;
                }

                return html;
            }).join('')}
        </div>
    `;
}

// AJUSTADO (item 3 do relatório de testes): junta a legenda de cores das
// fases (já que o nome saiu de dentro da barra) na MESMA linha da
// legenda de status, antes da lista de projetos.
function renderLegendaStatusRoadmap() {
    const itensStatus = [
        { cor: 'bg-gray-400', label: 'Não Iniciado' },
        { cor: 'bg-emerald-500', label: 'No Prazo' },
        { cor: 'bg-amber-400', label: 'Em Risco' },
        { cor: 'bg-red-600', label: 'Atrasado' }
    ];
    return `
        <div class="flex flex-wrap items-center gap-4 justify-end text-[10px] text-gray-600 mb-3">
            <span class="font-bold text-gray-500 uppercase">Fase:</span>
            ${FASES_TIMELINE.map(f => `<span class="flex items-center gap-1"><span class="${f.cor} w-2.5 h-2.5 rounded-sm inline-block border border-gray-300"></span> ${f.label}</span>`).join('')}
            <span class="border-l border-gray-300 h-3 mx-1"></span>
            <span class="font-bold text-gray-500 uppercase">Status:</span>
            ${itensStatus.map(it => `<span class="flex items-center gap-1"><span class="${it.cor} w-2.5 h-2.5 rotate-45 inline-block border border-white"></span> ${it.label}</span>`).join('')}
        </div>
    `;
}

function renderRoadmapPorProjetoGantt(container, lista) {
    container.innerHTML = `<div class="p-6 text-center text-gray-400 font-bold">Carregando linha do tempo...</div>`;

    _supabase.from('projeto_etapas').select('*').then(({ data, error }) => {
        const todasEtapas = error ? [] : (data || []);

        // CORRIGIDO (bug reportado: projeto cancelado aparecia na aba "Por
        // Fase" mas não nas outras): esta view não tinha o mesmo filtro de
        // status ativo que renderRoadmapAgrupado/renderRoadmapPorIniciativa
        // já aplicam — cancelados/reprovados/hold ficavam de fora só lá.
        // Só projetos "principais" e ATIVOS viram linha própria — subprojetos
        // aparecem encadeados dentro da linha do pai deles.
        const principais = lista.filter(p => {
            const sub = (p.sub_status || '').toUpperCase();
            return sub !== 'CANCELADO' && sub !== 'REPROVADO' && sub !== 'HOLD' && !p.is_subprojeto;
        }).filter(projetoBateBuscaRoadmap);

        if (principais.length === 0) {
            container.innerHTML = `<div class="p-6 text-center text-gray-400 font-bold">Nenhum projeto para exibir.</div>`;
            return;
        }

        // NOVO (a pedido do usuário 24/08/2026): descobre se algum projeto
        // exibido tem atividade que começou antes do início do próprio AF,
        // pra esticar a grade pra trás e não escondê-la (ver
        // calcularExtensaoGanttMeses).
        const extensaoMeses = calcularExtensaoGanttMeses(principais, lista, todasEtapas);

        // CORRIGIDO DE NOVO (bug reportado: sticky não travava de jeito
        // nenhum — rolava junto com os projetos): position:sticky depende
        // do ancestral de rolagem certo, e esse app tem várias camadas de
        // flex/overflow que dificultam confirmar isso com certeza. Trocado
        // por uma estrutura mais garantida: cabeçalho FORA da área de
        // rolagem, e só a lista de projetos dentro de um container com
        // scroll próprio — funciona sempre, independente de CSS ancestral.
        container.innerHTML = `
            ${renderLegendaStatusRoadmap()}
            <div class="mb-2">${renderCabecalhoQuartisEMeses(extensaoMeses)}</div>
            <div class="max-h-[65vh] overflow-y-auto pr-1">
                ${principais.map(p => renderLinhaGanttProjeto(p, lista, todasEtapas, extensaoMeses)).join('')}
            </div>
        `;
    });
}

// AJUSTADO (a pedido do usuário 24/08/2026): recebe `extensaoMeses` (repassado
// pro cálculo de posição das barras) e passa a exibir o Ano Fiscal do
// próprio projeto no bloco de informações — a coluna já era rotulada "FY do
// Projeto" no cabeçalho, mas o valor nunca aparecia em lugar nenhum da linha.
function renderLinhaGanttProjeto(p, listaCompleta, todasEtapas, extensaoMeses) {
    const segmentosPrincipal = obterSegmentosFaseProjeto(p.codigo, todasEtapas);
    const subprojetos = listaCompleta.filter(sp => sp.projeto_pai_codigo === p.codigo);

    return `
        <div class="bg-white rounded-lg border border-gray-200 shadow-sm mb-4 overflow-hidden">
            <div class="grid grid-cols-4">
                <div class="bg-red-700 text-white p-3">
                    <div class="flex items-center justify-between gap-2">
                        <div class="font-mono font-bold text-xs">${p.codigo}</div>
                        <div class="font-mono text-[10px] font-bold bg-white/20 px-1.5 py-0.5 rounded">${p.ano_fiscal || 'FY -'}</div>
                    </div>
                    <div class="font-bold text-sm underline">${escapeHtml(p.nome)}</div>
                    <div class="text-[10px] mt-1 opacity-80">Área: ${p.area || '-'}</div>
                    <div class="text-[10px] opacity-80">Orçamento Original: R$ ${(Number(p.val_bc) || Number(p.previsto) || 0).toLocaleString('pt-BR', {minimumFractionDigits:2})}</div>
                    <div class="text-[10px] opacity-80">Solicitante: ${escapeHtml(p.pessoa_solicitante) || '-'}</div>
                </div>
                <div class="col-span-3 p-3">
                    <div class="mt-2 pb-2 ${subprojetos.length > 0 ? 'border-b border-gray-200' : ''}">${renderTrilhaSegmentos(segmentosPrincipal, p.codigo, todasEtapas, p.ano_fiscal, extensaoMeses)}</div>
                    <div class="space-y-3 mt-2">
                        ${subprojetos.map(sp => {
                            const segSub = obterSegmentosFaseProjeto(sp.codigo, todasEtapas);
                            return `
                                <div class="pl-3 border-l-2 border-cyan-400 bg-cyan-50 bg-opacity-40 py-1.5 rounded-r">
                                    <div class="text-[9px] font-bold text-cyan-700 uppercase mb-1">↳ Subprojeto: ${escapeHtml(sp.nome)} (${sp.codigo})</div>
                                    ${renderTrilhaSegmentos(segSub, sp.codigo, todasEtapas, p.ano_fiscal, extensaoMeses)}
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            </div>
        </div>
    `;
}


function renderRoadmapPorFase(container, lista) {
    const fasesOrdem = [
        { key: 'BUSINESS CASE', label: '1. Business Case', color: 'bg-red-600' },
        { key: 'REQUIREMENTS', label: '2. Requisitos', color: 'bg-purple-600' },
        { key: 'TECHNICAL', label: '3. Technical Architecture', color: 'bg-blue-600' },
        { key: 'EXECUTION', label: '4. Execução (Dev)', color: 'bg-cyan-600' },
        { key: 'UAT', label: '5. Homologação (UAT)', color: 'bg-teal-600' },
        { key: 'GOLIVE', label: '6. Go-Live & Concluídos', color: 'bg-emerald-600' }
    ];

    container.innerHTML = fasesOrdem.map(fase => {
        const projetosNaFase = lista.filter(p => {
            const etapa = (p.etapa_atual || 'BUSINESS CASE').toUpperCase();
            const sub = (p.sub_status || '').toUpperCase();
            if (sub === 'CANCELADO' || sub === 'REPROVADO' || sub === 'HOLD') return false;
            // CORRIGIDO 10/08/2026: reconhece 'GOLIVE' (sem espaço, o
            // valor real gravado pelo avanço automático de fase) e os
            // dois variantes legados, por segurança.
            if (fase.key === 'GOLIVE') return etapa === 'GOLIVE' || etapa === 'GO LIVE' || etapa === 'CONCLUIDO';
            if (fase.key === 'BUSINESS CASE') return etapa === 'BUSINESS CASE' || etapa === '';
            return etapa === fase.key;
        });

        const listaProjetosHtml = projetosNaFase.length === 0
            ? `<div class="text-xs text-gray-400 italic py-2">Nenhum projeto nesta fase no momento.</div>`
            : projetosNaFase.map(p => renderCardProjetoRoadmap(p)).join('');

        return `
            <div class="border-l-4 ${fase.color} pl-4 py-2 mb-6">
                <h4 class="font-bold text-sm text-gray-800 uppercase mb-3 flex items-center justify-between">
                    <span>${fase.label}</span>
                    <span class="text-xs font-mono bg-gray-100 text-gray-600 px-2 py-0.5 rounded">${projetosNaFase.length} projeto(s)</span>
                </h4>
                <div class="space-y-2">${listaProjetosHtml}</div>
            </div>
        `;
    }).join('');
}

// Visão genérica Área→Projeto ou Responsável→Projeto: agrupa pelo campo
// pedido, mostra a fase de cada projeto como atributo da linha (não como
// agrupador).
// AJUSTADO (item 1c do relatório de testes): mesma visão em linha do
// tempo do "Por Projeto", só que agrupada por área/responsável — antes
// usava um card antigo (renderCardProjetoRoadmap), sem trilha nenhuma.
function renderRoadmapAgrupado(container, lista, campoAgrupador, labelAgrupador) {
    container.innerHTML = `<div class="p-6 text-center text-gray-400 font-bold">Carregando linha do tempo...</div>`;

    _supabase.from('projeto_etapas').select('*').then(({ data, error }) => {
        const todasEtapas = error ? [] : (data || []);

        // NOVO (filtros do Roadmap, a pedido do usuário): filtro pelo valor
        // da própria dimensão de agrupamento (Área/Responsável) + busca por
        // código/nome do projeto.
        const ativos = lista.filter(p => {
            const sub = (p.sub_status || '').toUpperCase();
            return sub !== 'CANCELADO' && sub !== 'REPROVADO' && sub !== 'HOLD' && !p.is_subprojeto;
        }).filter(p => !filtroDimensaoRoadmap || (p[campoAgrupador] || '') === filtroDimensaoRoadmap)
          .filter(projetoBateBuscaRoadmap);

        const grupos = {};
        ativos.forEach(p => {
            const chave = p[campoAgrupador] || `(sem ${labelAgrupador.toLowerCase()})`;
            if (!grupos[chave]) grupos[chave] = [];
            grupos[chave].push(p);
        });

        const chavesOrdenadas = Object.keys(grupos).sort((a, b) => a.localeCompare(b, 'pt-BR'));

        if (chavesOrdenadas.length === 0) {
            container.innerHTML = `<div class="p-6 text-center text-gray-400 font-bold">Nenhum projeto ativo para exibir.</div>`;
            return;
        }

        const extensaoMeses = calcularExtensaoGanttMeses(ativos, lista, todasEtapas);

        container.innerHTML = `
            ${renderLegendaStatusRoadmap()}
            <div class="mb-2">${renderCabecalhoQuartisEMeses(extensaoMeses)}</div>
            <div class="max-h-[65vh] overflow-y-auto pr-1">
                ${chavesOrdenadas.map(chave => `
                    <div class="border-l-4 border-indigo-500 pl-4 py-2 mb-6">
                        <h4 class="font-bold text-sm text-gray-800 uppercase mb-3 flex items-center justify-between">
                            <span>${escapeHtml(chave)}</span>
                            <span class="text-xs font-mono bg-gray-100 text-gray-600 px-2 py-0.5 rounded">${grupos[chave].length} projeto(s)</span>
                        </h4>
                        ${grupos[chave].map(p => renderLinhaGanttProjeto(p, lista, todasEtapas, extensaoMeses)).join('')}
                    </div>
                `).join('')}
            </div>
        `;
    });
}

// NOVO (item 3, novos ajustes): Roadmap agrupado por Iniciativa
// Estratégica — precisa de lookup (iniciativa_estrategica_id -> nome),
// diferente do agrupamento simples por campo direto (área/responsável).
// Projetos sem iniciativa cadastrada caem todos no mesmo grupo fixo
// "Projetos sem Registro de Iniciativa Estratégica", exibido por último.
const GRUPO_SEM_INICIATIVA = 'Projetos sem Registro de Iniciativa Estratégica';

function renderRoadmapPorIniciativa(container, lista) {
    container.innerHTML = `<div class="p-6 text-center text-gray-400 font-bold">Carregando linha do tempo...</div>`;

    Promise.all([
        _supabase.from('projeto_etapas').select('*'),
        _supabase.from('iniciativas_estrategicas').select('*')
    ]).then(([{ data: etapasData, error: errorEtapas }, { data: iniciativasData }]) => {
        const todasEtapas = errorEtapas ? [] : (etapasData || []);
        const iniciativas = iniciativasData || [];

        const ativos = lista.filter(p => {
            const sub = (p.sub_status || '').toUpperCase();
            return sub !== 'CANCELADO' && sub !== 'REPROVADO' && sub !== 'HOLD' && !p.is_subprojeto;
        }).filter(projetoBateBuscaRoadmap);

        const grupos = {};
        ativos.forEach(p => {
            let chave = GRUPO_SEM_INICIATIVA;
            if (p.iniciativa_estrategica_id) {
                const ini = iniciativas.find(i => i.id === p.iniciativa_estrategica_id);
                chave = ini ? ini.nome : GRUPO_SEM_INICIATIVA;
            }
            // NOVO (filtros do Roadmap, a pedido do usuário): filtro pelo
            // nome da Iniciativa (a chave já resolvida acima) — feito aqui
            // e não no ativos.filter porque a chave só existe depois do
            // lookup por id.
            if (filtroDimensaoRoadmap && chave !== filtroDimensaoRoadmap) return;
            if (!grupos[chave]) grupos[chave] = [];
            grupos[chave].push(p);
        });

        // Grupo "sem registro" sempre por último — os demais em ordem
        // alfabética entre si.
        const chavesOrdenadas = Object.keys(grupos)
            .filter(c => c !== GRUPO_SEM_INICIATIVA)
            .sort((a, b) => a.localeCompare(b, 'pt-BR'));
        if (grupos[GRUPO_SEM_INICIATIVA]) chavesOrdenadas.push(GRUPO_SEM_INICIATIVA);

        if (chavesOrdenadas.length === 0) {
            container.innerHTML = `<div class="p-6 text-center text-gray-400 font-bold">Nenhum projeto ativo para exibir.</div>`;
            return;
        }

        const extensaoMeses = calcularExtensaoGanttMeses(ativos, lista, todasEtapas);

        container.innerHTML = `
            ${renderLegendaStatusRoadmap()}
            <div class="mb-2">${renderCabecalhoQuartisEMeses(extensaoMeses)}</div>
            <div class="max-h-[65vh] overflow-y-auto pr-1">
                ${chavesOrdenadas.map(chave => `
                    <div class="border-l-4 ${chave === GRUPO_SEM_INICIATIVA ? 'border-gray-400' : 'border-indigo-500'} pl-4 py-2 mb-6">
                        <h4 class="font-bold text-sm ${chave === GRUPO_SEM_INICIATIVA ? 'text-gray-500 italic' : 'text-gray-800'} uppercase mb-3 flex items-center justify-between">
                            <span>${escapeHtml(chave)}</span>
                            <span class="text-xs font-mono bg-gray-100 text-gray-600 px-2 py-0.5 rounded normal-case">${grupos[chave].length} projeto(s)</span>
                        </h4>
                        ${grupos[chave].map(p => renderLinhaGanttProjeto(p, lista, todasEtapas, extensaoMeses)).join('')}
                    </div>
                `).join('')}
            </div>
        `;
    });
}

function renderCardProjetoRoadmap(p, mostrarFase) {
    const faseLabel = (p.etapa_atual || 'BUSINESS CASE').toUpperCase();
    return `
        <div class="bg-gray-50 border border-gray-200 p-3 rounded-md mb-2 flex justify-between items-center shadow-xs">
            <div>
                <div class="flex items-center gap-2">
                    <span class="font-mono font-bold text-xs text-red-700">${p.codigo}</span>
                    <span class="font-bold text-xs text-gray-800">${escapeHtml(p.nome)}</span>
                    ${mostrarFase ? `<span class="text-[9px] font-bold px-1.5 py-0.5 bg-indigo-100 text-indigo-800 rounded uppercase">${faseLabel}</span>` : ''}
                </div>
                <div class="text-[10px] text-gray-500 mt-1">
                    Área: <span class="font-bold">${p.area || '-'}</span> | Porte: <span class="font-bold">${p.tamanho || 'M'}</span> (${horasAtuaisDoProjeto(p)}h) | Qualificação: <span class="font-bold uppercase">${p.tipo_qualificacao || 'REG'}</span>
                </div>
            </div>
            <div class="text-right">
                <span class="text-[10px] font-bold px-2 py-1 bg-white border rounded shadow-2xs text-gray-700 uppercase">${p.sub_status || 'EM ANDAMENTO'}</span>
                <div class="font-mono text-[11px] font-bold text-green-700 mt-1">R$ ${(Number(p.val_bc) || Number(p.previsto) || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</div>
            </div>
        </div>
    `;
}
