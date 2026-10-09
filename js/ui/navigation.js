// =========================================================================
// ui/navigation.js
// Navegação entre abas/telas do sistema (switchTab) e abrir/fechar
// submenus do menu lateral (toggleSidebarMenu).
//
// switchTab despacha para as funções de render de cada tela (ex.:
// renderF1Formalizadas, renderDashboardMetrics, etc.) — a maioria delas
// ainda mora em app.js e algumas (formatCurrency, somarDiasUteis,
// calcularSaudeProjeto) já foram extraídas para js/utils/. Como tudo
// continua no mesmo escopo global de scripts clássicos, essas chamadas
// funcionam normalmente independente de onde cada função física está.
//
// Usada por praticamente todo onclick="switchTab(...)" do index.html —
// extração de alto uso, testar com atenção redobrada em todas as abas.
// =========================================================================
// NOVO (evolução visual — dark mode): alterna [data-theme="dark"] no
// <html> e persiste em localStorage (só conveniência do navegador de
// quem está usando — não sincroniza entre dispositivos nem é lido pelo
// backend). A aplicação do tema salvo ao carregar a página é feita por
// um script inline no <head>/topo do <body>, ANTES do primeiro paint,
// pra não piscar claro->escuro; esta função só cuida da troca em tempo
// de uso e do ícone do botão.
function alternarTemaEscuro() {
    const raiz = document.documentElement;
    const escuroAtivo = raiz.getAttribute('data-theme') === 'dark';
    const novoTema = escuroAtivo ? 'light' : 'dark';
    if (novoTema === 'dark') raiz.setAttribute('data-theme', 'dark');
    else raiz.removeAttribute('data-theme');
    try { localStorage.setItem('compasso_tema', novoTema); } catch (e) { /* navegador privado/bloqueado — segue sem persistir */ }
    _atualizarIconeTemaEscuro();
}
function _atualizarIconeTemaEscuro() {
    const btn = document.getElementById('btnTemaEscuro');
    if (!btn) return;
    const escuroAtivo = document.documentElement.getAttribute('data-theme') === 'dark';
    btn.innerHTML = escuroAtivo ? '<i class="fa-solid fa-sun"></i>' : '<i class="fa-solid fa-moon"></i>';
    btn.title = escuroAtivo ? 'Alternar pra tema claro' : 'Alternar pra tema escuro';
}
// O <html> já recebeu data-theme (se salvo) pelo script inline no topo do
// <body>, antes deste arquivo carregar — só falta sincronizar o ícone do
// botão, que existe desde o HTML estático (não é criado dinamicamente).
_atualizarIconeTemaEscuro();

// NOVO 10/08/2026 (menu responsivo pro celular): abre/fecha o menu
// lateral em telas estreitas — em telas md+ (tablet/desktop) essas
// classes nem entram em jogo, o menu continua fixo como sempre foi.
function toggleSidebarMobile() {
    const menu = document.getElementById('sidebarMenu');
    const backdrop = document.getElementById('sidebarBackdrop');
    if (!menu || !backdrop) return;

    const estaAberto = !menu.classList.contains('-translate-x-full');
    if (estaAberto) {
        menu.classList.add('-translate-x-full');
        menu.classList.remove('translate-x-0');
        backdrop.classList.add('hidden');
    } else {
        menu.classList.remove('-translate-x-full');
        menu.classList.add('translate-x-0');
        backdrop.classList.remove('hidden');
    }
}

function fecharSidebarMobileSeAberto() {
    const menu = document.getElementById('sidebarMenu');
    const backdrop = document.getElementById('sidebarBackdrop');
    if (!menu || !backdrop) return;
    menu.classList.add('-translate-x-full');
    menu.classList.remove('translate-x-0');
    backdrop.classList.add('hidden');
}

function switchTab(tabId) {
    // D-2: aliases de nomes antigos → tabId canônico
    const _alias = { req_planejamento: 'req_planejamento', fase_technical: 'fase_technical', fase_execution: 'fase_execution' };
    // (aliases são resolvidos pelo resolveTabRedirect quando chamado da busca; aqui
    //  guardamos só o tabId direto; aliases de busca estão em _REDIR_MENU abaixo.)

    abaAtualId = tabId;
    if (tabId !== 'workspace_projeto') try { document.title = 'Compasso'; } catch(e) {} // V70

    // D-7: atualiza o hash da URL sem recarregar
    if (typeof routerPush === 'function') routerPush(tabId);

    fecharSidebarMobileSeAberto(); // fecha o menu sozinho no celular ao navegar

    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));

    // NOVO (Licenciamento de Módulos, 28/08/2026): bloqueia o carregamento
    // da view se o módulo dono dela (js/core/licenca.js, TAB_MODULO_MAP)
    // não estiver ativo — mesmo que o acesso seja forçado (URL, console,
    // etc.), sem depender só do menu já estar escondido.
    const moduloDaTela = moduloDoTab(tabId);
    if (moduloDaTela && !moduloAtivo(moduloDaTela)) {
        const nomeExibicao = document.getElementById('moduloBloqueadoNome');
        if (nomeExibicao) nomeExibicao.innerText = NOME_EXIBICAO_MODULO[moduloDaTela] || moduloDaTela;
        const bloqueado = document.getElementById('view-modulo-bloqueado');
        if (bloqueado) bloqueado.classList.remove('hidden');
        return;
    }

    const targetView = document.getElementById('view-' + tabId);
    if (targetView) targetView.classList.remove('hidden');

    document.querySelectorAll('.sidebar-link').forEach(el => {
        el.classList.remove('text-red-600', 'font-bold', 'border-red-600', 'bg-red-50');
        el.classList.add('text-gray-500', 'border-transparent');
    });

    const activeSidebarLink = document.getElementById('link-' + tabId);
    if (activeSidebarLink) {
        activeSidebarLink.classList.remove('text-gray-500', 'border-transparent');
        activeSidebarLink.classList.add('text-red-600', 'font-bold', 'border-red-600', 'bg-red-50');
    }

    if (tabId === 'f1_formalizacao') { mudarAbaFormalizarDemanda('criar'); popularOpcoesAFDemanda(); popularTiposProjetoParaDemanda(); popularProdutosParaDemanda(); popularTiposReturnBenefitParaDemanda(); renderF1Formalizadas(); }
    if (tabId === 'f1_orcamento') { mudarAbaOrcamentarDemanda('a_planejar'); renderF1OrcamentoView(); }
    if (tabId === 'aprov_comite') renderAprovComiteView();
    if (tabId === 'aprov_orcamento_af') renderAprovOrcamentoAFView();
    if (tabId === 'req_planejamento') { mudarAbaGerarRequerimentos('a_planejar'); renderReqPlanejamentoView(); }
    if (tabId === 'req_aprov_ti') { mudarAbaAvaliarTI('a_planejar'); renderReqAprovTIView(); }
    if (tabId === 'req_aprov_negocio') { mudarAbaAvaliarNegocio('a_planejar'); renderReqAprovNegocioView(); }
    if (tabId === 'req_conclusao') renderReqConclusaoView();
    if (tabId === 'fase_technical') { mudarAbaGerarEspecificacao('a_planejar'); renderTechView(); }
    if (tabId === 'tech_conclusao') renderTechConclusaoView();
    if (tabId === 'tech_aval_negocio') { mudarAbaAvalEspecNegocio('a_planejar'); renderTechAvalNegocioView(); }
    if (tabId === 'fase_execution') { mudarAbaExecution('a_planejar'); renderExecutionView(); }
    if (tabId === 'fase_uat') { mudarAbaUAT('ratificar'); renderUatView(); }
    if (tabId === 'gestao_templates') { mudarAbaTemplates('incluir'); renderGestaoTemplatesView(); }
    if (tabId === 'gestao_fluxo_email') renderGestaoFluxoEmailView();
    if (tabId === 'fila_email') renderFilaEmailPendentes();
    if (tabId === 'planejamento_estrategico') { mudarAbaPlanejamentoEstrategico('pilares_criar'); renderPlanejamentoEstrategicoView(); }
    if (tabId === 'empresas_terceirizadas') { mudarAbaEmpresas('criar'); renderEmpresasTerceirizadasView(); }
    if (tabId === 'contratos_projeto') { mudarAbaContratos('criar'); renderContratosProjetoView(); }
    if (tabId === 'contratos_vinculos') renderContratosVinculosView();
    if (tabId === 'registro_valores_contrato') renderRegistroValoresView();
    if (tabId === 'relatorio_projetos_contratos') renderRelatorioProjetosContratosView();
    if (tabId === 'contratos_pendencias') { mudarAbaPendencias('lista'); renderPendenciasContratosView(); }
    if (tabId === 'pagamentos_pendentes_nf') renderPagamentosPendentesNfView();
    if (tabId === 'tipos_projeto') { mudarAbaTiposProjeto('criar'); renderTiposProjetoView(); }
    if (tabId === 'produtos') { mudarAbaProdutos('criar'); renderProdutosView(); }
    if (tabId === 'cargos') { mudarAbaCargos('criar'); renderCargosView(); }
    if (tabId === 'percentual_bloqueio_orcamento') renderPercentualBloqueioOrcamentoView();
    if (tabId === 'mudanca_orcamento') renderMudancaOrcamentoView();
    if (tabId === 'troca_responsavel_atividade') renderTrocaResponsavelAtividadeView();
    if (tabId === 'auditoria') renderAuditoriaView();
    // NOVO (Feature 1.1/1.2 — 03/09/2026). controle_orcamento e
    // validacao_tradeoff se auto-restringem dentro da própria view
    // (restrito/conteudo). periodo_ano_fiscal segue o padrão hardcoded
    // por papel (Administrador OU Proprietário), como licenciamento_modulos.
    if (tabId === 'controle_orcamento') renderControleOrcamentoView();
    if (tabId === 'validacao_tradeoff') renderValidacaoTradeoffView();
    // NOVO (Módulo de Construção de Requerimentos com IA, 23/09/2026):
    // mesmo padrão — as views se auto-restringem (restrito/conteudo).
    if (tabId === 'ia_templates') renderIaTemplatesView();
    if (tabId === 'ia_config') renderIaConfigView();
    // NOVO (Compasso 2.0 Release 1 — Fundação e Trabalho Pessoal, 2026-09-23).
    if (tabId === 'home') renderHomePessoalView();
    if (tabId === 'meu_trabalho') renderMeuTrabalhoView();
    if (tabId === 'meus_projetos') renderMeusProjetosView();
    if (tabId === 'notificacoes') renderNotificacoesView();
    // NOVO (V2 do Plano de Evolução — Calendário Global, 2026-09-25).
    if (tabId === 'calendario') renderCalendarioGlobalView();
    // NOVO (Compasso 2.0 Release 2 — Workspace Colaborativo do Projeto, 2026-09-23).
    if (tabId === 'workspace_projeto') renderWorkspaceProjeto();
    // NOVO (Compasso 2.0 Release 3 — Gestão, Financeiro e Governança, 2026-09-23).
    if (tabId === 'minhas_aprovacoes') renderMinhasAprovacoesView();
    if (tabId === 'governanca_unificada') renderGovernancaUnificadaView();
    if (tabId === 'portfolio_executivo') renderPortfolioExecutivoView();
    if (tabId === 'portfolio_business_cases') renderPortfolioBCView();
    if (tabId === 'financeiro_corporativo') renderFinanceiroCorporativoView();
    // NOVO (V4 do Plano de Evolução — Estimation, 2026-09-25).
    if (tabId === 'rate_card') renderRateCardView();
    if (tabId === 'busca_global') renderBuscaGlobalView();
    if (tabId === 'relatorios') renderRelatoriosView();
    // NOVO (D-4, Fase 1, 30/09/2026): stub Conhecimento — repositório read-only
    // de documentos publicados no Encerramento de projeto. Tela completa na Fase 2.
    if (tabId === 'conhecimento') {
        const v = document.getElementById('view-conhecimento');
        if (v && v.innerHTML.trim() === '') {
            v.innerHTML = '<div class="p-8 text-center text-gray-400"><i class="fa-solid fa-book-open text-4xl mb-3 block"></i><p class="font-semibold">Conhecimento</p><p class="text-sm mt-1">Este módulo está em desenvolvimento.</p></div>';
        }
    }
    if (tabId === 'configuracoes') renderConfiguracoesView();
    if (tabId === 'periodo_ano_fiscal') {
        const restrito = document.getElementById('periodoAnoFiscalRestrito');
        const conteudo = document.getElementById('periodoAnoFiscalConteudo');
        if (ehAdministrador || ehProprietario) {
            if (restrito) restrito.classList.add('hidden');
            if (conteudo) conteudo.classList.remove('hidden');
            renderPeriodoAnoFiscalView();
        } else {
            if (restrito) restrito.classList.remove('hidden');
            if (conteudo) conteudo.classList.add('hidden');
        }
    }
    // AJUSTADO (papel Proprietário, 28/08/2026): restrita a ehProprietario
    // (mais forte que ehAdministrador) — mesma camada dupla de Ferramentas
    // de Dev (catálogo de atividades pra visibilidade do link + checagem
    // extra aqui pro conteúdo de verdade), só que com o papel mais
    // privilegiado. Um Administrador comum (sem eh_proprietario) cai no
    // "restrito" mesmo tendo acesso_irrestrito a tudo mais.
    if (tabId === 'dados_empresa') {
        const restrito = document.getElementById('dadosEmpresaRestrito');
        const conteudo = document.getElementById('dadosEmpresaConteudo');
        if (ehProprietario) {
            if (restrito) restrito.classList.add('hidden');
            renderDadosEmpresaView();
        } else {
            if (restrito) restrito.classList.remove('hidden');
            if (conteudo) conteudo.classList.add('hidden');
        }
    }
    if (tabId === 'licenciamento_modulos') {
        const restrito = document.getElementById('licenciamentoModulosRestrito');
        const conteudo = document.getElementById('licenciamentoModulosConteudo');
        if (ehProprietario) {
            if (restrito) restrito.classList.add('hidden');
            if (conteudo) conteudo.classList.remove('hidden');
            renderLicenciamentoModulosView();
        } else {
            if (restrito) restrito.classList.remove('hidden');
            if (conteudo) conteudo.classList.add('hidden');
        }
    }
    if (tabId === 'return_benefit') { mudarAbaReturnBenefit('criar'); renderReturnBenefitView(); }
    if (tabId === 'governanca') renderGovernancaView();
    if (tabId === 'retomar_hold') renderRetomarHoldView();
    if (tabId === 'conclusao_projeto') renderConclusaoProjetoView();
    if (tabId === 'fase_golive') { mudarAbaGoLive('ratificar'); renderGoliveView(); }
    if (tabId === 'projetos_adhoc') renderAdhocView();
    // Fase 1 — D-11: filas de projetos por etapa (js/projetos/fila-etapa.js)
    if (tabId === 'projetos_requerimentos') renderFilaEtapaView('projetos_requerimentos');
    if (tabId === 'projetos_especificacao') renderFilaEtapaView('projetos_especificacao');
    if (tabId === 'projetos_execucao')      renderFilaEtapaView('projetos_execucao');
    if (tabId === 'projetos_uat')           renderFilaEtapaView('projetos_uat');
    if (tabId === 'projetos_golive')        renderFilaEtapaView('projetos_golive');
    if (tabId === 'projetos_encerramento')  renderFilaEtapaView('projetos_encerramento');
    if (tabId === 'conhecimento')           renderConhecimentoView();
    if (tabId === 'fechamento_af') renderFechamentoAfView();
    if (tabId === 'cronograma_evolucao') renderCronogramaEvolucaoView();
    if (tabId === 'usuarios') { mudarAbaUsuarios('criar'); renderUsuariosView(); }
    if (tabId === 'ano_fiscal') loadAnoFiscalConfig();
    if (tabId === 'ajuste_orcamento') renderAjusteOrcamentoView();
    if (tabId === 'areas') { mudarAbaAreas('criar'); loadAreas(); }
    if (tabId === 'pessoas_solicitantes') { mudarAbaPessoasSolicitantes('criar'); loadPessoasSolicitantes(); }
    if (tabId === 'portes') { mudarAbaPortes('criar'); loadPortes(); }
    if (tabId === 'responsaveis') { mudarAbaResponsaveis('criar'); loadResponsaveis(); }
    if (tabId === 'workflow_etapas') loadFasesEtapas();
    // AJUSTADO (segurança Fase 3, 2026-09-01): estas 3 telas SAÍRAM do
    // catálogo comum (não são mais concedíveis por função). Voltam a ser
    // hardcoded por papel — visíveis/acessíveis só para Administrador OU
    // Proprietário (Proprietário é superconjunto de Administrador).
    // Licenciamento de Módulos segue exclusivo de Proprietário (mais abaixo).
    const admOuProprietario = ehAdministrador || ehProprietario;
    if (tabId === 'funcoes_permissoes') {
        const restrito = document.getElementById('funcoesPermissoesRestrito');
        const conteudo = document.getElementById('funcoesPermissoesConteudo');
        if (admOuProprietario) {
            if (restrito) restrito.classList.add('hidden');
            if (conteudo) conteudo.classList.remove('hidden');
            mudarAbaFuncoes('criar');
            loadFuncoes();
        } else {
            if (restrito) restrito.classList.remove('hidden');
            if (conteudo) conteudo.classList.add('hidden');
        }
    }
    if (tabId === 'atribuicao_funcoes') {
        const restrito = document.getElementById('atribuicaoFuncoesRestrito');
        const conteudo = document.getElementById('atribuicaoFuncoesConteudo');
        if (admOuProprietario) {
            if (restrito) restrito.classList.add('hidden');
            if (conteudo) conteudo.classList.remove('hidden');
            loadFuncoes();
        } else {
            if (restrito) restrito.classList.remove('hidden');
            if (conteudo) conteudo.classList.add('hidden');
        }
    }
    if (tabId === 'restricao_area_atividades') {
        const restrito = document.getElementById('restricaoAreaAtividadesRestrito');
        const conteudo = document.getElementById('restricaoAreaAtividadesConteudo');
        if (admOuProprietario) {
            if (restrito) restrito.classList.add('hidden');
            if (conteudo) conteudo.classList.remove('hidden');
            renderRestricaoAreaAtividadesView();
        } else {
            if (restrito) restrito.classList.remove('hidden');
            if (conteudo) conteudo.classList.add('hidden');
        }
    }
    // MANTIDO deliberadamente exclusivo do PROPRIETÁRIO (não segue o
    // catálogo, mesmo que uma função tenha "dev_tools" atribuído, e não
    // basta ser Administrador / ter acesso irrestrito): ferramentas
    // destrutivas (limpar base, reset, criar projeto de teste) — camada
    // extra de segurança, tanto aqui (visibilidade) quanto dentro de cada
    // ação em js/dev-tools/*.js (que já re-checam ehProprietario de novo).
    if (tabId === 'dev_tools') {
        const restrito = document.getElementById('devToolsRestrito');
        const conteudo = document.getElementById('devToolsConteudo');
        const conteudoLimpeza = document.getElementById('devToolsLimpezaConteudo');
        const conteudoLimpezaTotal = document.getElementById('devToolsLimpezaTotalConteudo');
        const conteudoLimpezaContratos = document.getElementById('devToolsLimpezaContratosConteudo');
        const conteudoCriarTeste = document.getElementById('devToolsCriarTesteConteudo');
        if (ehProprietario) {
            if (restrito) restrito.classList.add('hidden');
            if (conteudo) conteudo.classList.remove('hidden');
            if (conteudoLimpeza) conteudoLimpeza.classList.remove('hidden');
            if (conteudoLimpezaTotal) conteudoLimpezaTotal.classList.remove('hidden');
            if (conteudoLimpezaContratos) conteudoLimpezaContratos.classList.remove('hidden');
            if (conteudoCriarTeste) conteudoCriarTeste.classList.remove('hidden');
            renderListaProjetosDevTools();
            if (typeof inicializarFormCriarTeste === 'function') inicializarFormCriarTeste();
        } else {
            if (restrito) restrito.classList.remove('hidden');
            if (conteudo) conteudo.classList.add('hidden');
            if (conteudoLimpeza) conteudoLimpeza.classList.add('hidden');
            if (conteudoLimpezaTotal) conteudoLimpezaTotal.classList.add('hidden');
            if (conteudoLimpezaContratos) conteudoLimpezaContratos.classList.add('hidden');
            if (conteudoCriarTeste) conteudoCriarTeste.classList.add('hidden');
        }
    }
    if (tabId === 'prazos') loadFasesEtapas(); // já chama renderPrazosTable() no final, se existir (ver workflow-engine.js)
    if (tabId === 'dashboard') renderDashboardMetrics();
    if (tabId === 'consultas') renderConsultaProjetos();
    if (tabId === 'visao_orcamento') renderVisaoOrcamentoView();
    if (tabId === 'alertas_orcamento') renderAlertasOrcamentoView();
    if (tabId === 'roadmap') renderRoadmap();
    // Fase 1A · A1: ADM shell (SCR-23/24/25 — adm-shell.js)
    if (typeof renderAdmView === 'function' && typeof _admIsAdmTab === 'function' && _admIsAdmTab(tabId)) {
        renderAdmView(tabId);
    }
    // Fase 2A · M12A: Workspace Fiscal (fy-lista.js, fy-workspace.js)
    if (tabId === 'fy_lista') { if (typeof renderFYListaView === 'function') renderFYListaView(); }
    if (tabId === 'fy_workspace') { if (typeof renderFYWorkspace === 'function') renderFYWorkspace(); }
}

function toggleSidebarMenu(menuId, iconId) {
    const menu = document.getElementById(menuId);
    const icon = document.getElementById(iconId);

    if (menu.classList.contains('open')) {
        menu.classList.remove('open');
        icon.classList.remove('rotate');
    } else {
        menu.classList.add('open');
        icon.classList.add('rotate');
    }
}

// =============================================================================
// AVISO "O MENU MUDOU" (D-2 — Fase 1, 30/09/2026)
// Exibe um banner dispensável na sidebar por 30 dias após a reestruturação.
// Data de início fixa: 2026-09-30. Armazenada em localStorage (conveniência
// local; não sincroniza entre dispositivos).
// =============================================================================
const _AVISO_MENU_INICIO = new Date('2026-09-30T00:00:00');
const _AVISO_MENU_DIAS   = 30;
const _AVISO_MENU_KEY    = 'compasso_aviso_menu_dispensado';

function iniciarAvisoMenuMudou() {
    const aviso = document.getElementById('menu-mudou-aviso');
    if (!aviso) return;
    try {
        if (localStorage.getItem(_AVISO_MENU_KEY) === '1') return;
    } catch (e) { /* navegador bloqueado — mostra por padrão */ }
    const agora = new Date();
    const diasPassados = (agora - _AVISO_MENU_INICIO) / 86400000;
    if (diasPassados >= 0 && diasPassados < _AVISO_MENU_DIAS) {
        aviso.classList.remove('hidden');
    }
}

function dispensarAvisoMenu() {
    const aviso = document.getElementById('menu-mudou-aviso');
    if (aviso) aviso.classList.add('hidden');
    try { localStorage.setItem(_AVISO_MENU_KEY, '1'); } catch (e) { /* bloqueado */ }
}

function mostrarCorrespondenciasMenu() {
    const linhas = Object.entries(_REDIR_MENU).map(([de, para]) =>
        `<tr><td class="px-2 py-1 text-gray-500 text-xs line-through">${de}</td><td class="px-2 py-1 text-xs">→</td><td class="px-2 py-1 text-xs font-medium text-indigo-700">${para.label}</td></tr>`
    ).join('');
    const html = `<div class="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" id="modal-corresp-menu">
        <div class="bg-white rounded-xl shadow-xl max-w-sm w-full max-h-[80vh] overflow-y-auto p-4">
            <div class="flex items-center justify-between mb-3">
                <h3 class="font-bold text-sm text-gray-900">Onde foi parar cada item?</h3>
                <button onclick="document.getElementById('modal-corresp-menu').remove()" class="text-gray-400 hover:text-gray-700"><i class="fa-solid fa-xmark"></i></button>
            </div>
            <table class="w-full">${linhas}</table>
        </div>
    </div>`;
    const div = document.createElement('div');
    div.innerHTML = html;
    document.body.appendChild(div.firstElementChild);
}

// =============================================================================
// MAPA DE REDIRECIONAMENTO — nomes antigos do menu → nova localização (D-2)
// Usado por switchTab (aliases de navegação) e pela busca global.
// =============================================================================
const _REDIR_MENU = {
    'Ano Fiscal':                     { tabId: 'ano_fiscal',             label: 'Portfólio › Ano Fiscal › Abertura Ano Fiscal' },
    'Fechamento Ano Fiscal':          { tabId: 'fechamento_af',          label: 'Portfólio › Ano Fiscal › Fechamento Ano Fiscal' },
    'Ajuste de Orçamento':            { tabId: 'ajuste_orcamento',       label: 'Financeiro › Ajuste de Orçamento' },
    'Validação de Trade-off':         { tabId: 'validacao_tradeoff',     label: 'Portfólio › Ano Fiscal › Validação de Trade-off' },
    'Business Case':                  { tabId: 'portfolio_business_cases', label: 'Portfólio › Business Cases › Portfólio de BCs' },
    'Formalizar Demanda':             { tabId: 'f1_formalizacao',        label: 'Portfólio › Business Cases › Formalizar Demanda' },
    'Orçamentar Demanda':             { tabId: 'f1_orcamento',           label: 'Portfólio › Business Cases › Orçamentar Demanda' },
    'Aprovar Orçamento por Projeto':  { tabId: 'aprov_comite',           label: 'Portfólio › Business Cases › Aprovar Orçamento por Projeto' },
    'Aprovar Orçamento Ano Fiscal':   { tabId: 'aprov_orcamento_af',     label: 'Portfólio › Business Cases › Aprovar Orçamento Ano Fiscal' },
    'Aprovar Demanda Extraordinária': { tabId: 'projetos_adhoc',         label: 'Financeiro › Aprovar Demanda Extraordinária' },
    'Gerar Requerimentos':            { tabId: 'req_planejamento',       label: 'Projetos › Requerimentos' },
    'Avaliar Requerimentos':          { tabId: 'req_aprov_ti',           label: 'Projetos › Requerimentos' },
    'Gerar Especificação':            { tabId: 'fase_technical',         label: 'Projetos › Especificação' },
    'Execução':                       { tabId: 'fase_execution',         label: 'Projetos › Execução' },
    'Retomar Projetos em Hold':       { tabId: 'retomar_hold',           label: 'Portfólio › Ano Fiscal › Transições – Hold' },
    'Cobrança de Ajustes':            { tabId: 'governanca',             label: 'Portfólio › Business Cases › Filas – Ajustes e Complementos' },
    'Auditoria':                      { tabId: 'auditoria',              label: 'Administração › Administração › Auditoria' },
    'Fornecedores':                   { tabId: 'empresas_terceirizadas', label: 'Administração › Cadastros › Fornecedores' },
    'Contratos e Fornecedores':       { tabId: 'contratos_projeto',      label: 'Financeiro › Contratos e Terceiros' },
    'Perfis de Acesso':               { tabId: 'usuarios',               label: 'Administração › Administração › Usuários' },
    'Usuários':                       { tabId: 'usuarios',               label: 'Administração › Administração › Usuários' },
    'Funções e Permissões':           { tabId: 'funcoes_permissoes',     label: 'Administração › Administração › Funções e Permissões' },
    'Atribuição de Funções':          { tabId: 'atribuicao_funcoes',     label: 'Administração › Administração › Atribuição de Funções' },
    'Restrição de Área':              { tabId: 'restricao_area_atividades', label: 'Administração › Administração › Restrição de Área por Atividade' },
    'Parâmetros e Cadastros':         { tabId: 'areas',                  label: 'Administração › Cadastros' },
    'Áreas Solicitantes':             { tabId: 'areas',                  label: 'Administração › Cadastros › Áreas Solicitantes' },
    'Cargos':                         { tabId: 'cargos',                 label: 'Administração › Cadastros › Cargos' },
    'Configurações':                  { tabId: 'configuracoes',          label: 'Administração › Configurações › Configurações Gerais' },
    'Período do Ano Fiscal':          { tabId: 'periodo_ano_fiscal',     label: 'Administração › Configurações › Período do Ano Fiscal' },
    'Rate Card':                      { tabId: 'rate_card',              label: 'Financeiro › Rate Card' },
};

// Retorna o tabId canônico para um alias de nome antigo, ou null se não houver.
function resolveTabRedirect(query) {
    const q = (query || '').trim().toLowerCase();
    for (const [nome, dest] of Object.entries(_REDIR_MENU)) {
        if (nome.toLowerCase() === q) return dest.tabId;
    }
    return null;
}

// Inicializa o aviso ao carregar a página.
document.addEventListener('DOMContentLoaded', iniciarAvisoMenuMudou);
