// =============================================================================
// js/core/router.js — Hash Router (D-7, Fase 1, 30/09/2026)
//
// Traduz URL hash ↔ estado interno do switchTab. Não carrega telas por conta
// própria — delega sempre para switchTab() (navigation.js), que é o ponto
// único de renderização de qualquer tela.
//
// Formato canônico:
//   #/<grupo>/<sub>          ex.: #/portfolio/ano-fiscal
//   #/<grupo>/<sub>/<id>     ex.: #/portfolio/ano-fiscal/42
//   #/<grupo>/<sub>/<id>/<acao>?param=valor
//                            ex.: #/portfolio/ano-fiscal/42/transicoes/carryover?status=APPROVED
//
// Mapeamento tabId → segmento de rota:
//   home                    → /home
//   meu_trabalho            → /meu-trabalho
//   meus_projetos           → /meus-projetos
//   calendario              → /calendario
//   notificacoes            → /notificacoes
//   minhas_aprovacoes       → /minhas-aprovacoes
//   roadmap                 → /roadmap
//   dashboard               → /portfolio/dashboard
//   portfolio_executivo     → /portfolio/executivo
//   portfolio_business_cases→ /portfolio/business-cases
//   cronograma_evolucao     → /portfolio/cronograma
//   consultas               → /portfolio/consultas
//   ano_fiscal              → /portfolio/ano-fiscal
//   fechamento_af           → /portfolio/ano-fiscal/fechamento
//   validacao_tradeoff      → /portfolio/ano-fiscal/tradeoff
//   retomar_hold            → /portfolio/ano-fiscal/hold
//   f1_formalizacao         → /portfolio/business-cases/formalizar
//   f1_orcamento            → /portfolio/business-cases/orcar
//   aprov_comite            → /portfolio/business-cases/aprovar-projeto
//   aprov_orcamento_af      → /portfolio/business-cases/aprovar-af
//   projetos_adhoc          → /financeiro/extraordinario
//   governanca              → /portfolio/business-cases/filas
//   projetos_requerimentos  → /projetos/requerimentos
//   projetos_especificacao  → /projetos/especificacao
//   projetos_execucao       → /projetos/execucao
//   projetos_uat            → /projetos/uat
//   projetos_golive         → /projetos/golive
//   projetos_encerramento   → /projetos/encerramento
//   governanca_unificada    → /governanca
//   mudanca_orcamento       → /governanca/orcamento
//   troca_responsavel_atividade → /governanca/responsavel
//   financeiro_corporativo  → /financeiro/corporativo
//   visao_orcamento         → /financeiro/orcamento
//   alertas_orcamento       → /financeiro/alertas
//   rate_card               → /financeiro/rate-card
//   ajuste_orcamento        → /financeiro/ajuste
//   relatorios              → /relatorios
//   conhecimento            → /conhecimento
//   workspace_projeto       → /projetos/:id   (id = codigo do projeto)
// =============================================================================

const _TAB_PARA_ROTA = {
    home:                          '/home',
    meu_trabalho:                  '/meu-trabalho',
    meus_projetos:                 '/meus-projetos',
    calendario:                    '/calendario',
    notificacoes:                  '/notificacoes',
    minhas_aprovacoes:             '/minhas-aprovacoes',
    roadmap:                       '/roadmap',
    dashboard:                     '/portfolio/dashboard',
    portfolio_executivo:           '/portfolio/executivo',
    portfolio_business_cases:      '/portfolio/business-cases',
    cronograma_evolucao:           '/portfolio/cronograma',
    consultas:                     '/portfolio/consultas',
    ano_fiscal:                    '/portfolio/ano-fiscal',
    fechamento_af:                 '/portfolio/ano-fiscal/fechamento',
    validacao_tradeoff:            '/portfolio/ano-fiscal/tradeoff',
    retomar_hold:                  '/portfolio/ano-fiscal/hold',
    f1_formalizacao:               '/portfolio/business-cases/formalizar',
    f1_orcamento:                  '/portfolio/business-cases/orcar',
    aprov_comite:                  '/portfolio/business-cases/aprovar-projeto',
    aprov_orcamento_af:            '/portfolio/business-cases/aprovar-af',
    governanca:                    '/portfolio/business-cases/filas',
    projetos_requerimentos:        '/projetos/requerimentos',
    projetos_especificacao:        '/projetos/especificacao',
    projetos_execucao:             '/projetos/execucao',
    projetos_uat:                  '/projetos/uat',
    projetos_golive:               '/projetos/golive',
    projetos_encerramento:         '/projetos/encerramento',
    governanca_unificada:          '/governanca',
    mudanca_orcamento:             '/governanca/orcamento',
    troca_responsavel_atividade:   '/governanca/responsavel',
    financeiro_corporativo:        '/financeiro/corporativo',
    visao_orcamento:               '/financeiro/orcamento',
    alertas_orcamento:             '/financeiro/alertas',
    rate_card:                     '/financeiro/rate-card',
    ajuste_orcamento:              '/financeiro/ajuste',
    projetos_adhoc:                '/financeiro/extraordinario',
    relatorios:                    '/relatorios',
    conhecimento:                  '/conhecimento',
    // SCR-23 Cadastros (D-13 canônico)
    cadastros_home:                '/cadastros',
    cad_org:                       '/cadastros/estrutura-organizacional/org',
    cad_cargos:                    '/cadastros/estrutura-organizacional/cargos',
    cad_pessoas:                   '/cadastros/pessoas-e-entidades/pessoas',
    cad_fornecedores:              '/cadastros/pessoas-e-entidades/fornecedores',
    cad_portes:                    '/cadastros/portfolio-e-projetos/portes',
    cad_classificacoes:            '/cadastros/portfolio-e-projetos/classificacoes',
    cad_estrategia:                '/cadastros/estrategia',
    // SCR-24 Administração (D-13 canônico)
    administracao_home:            '/administracao',
    adm_usuarios:                  '/administracao/acesso-e-seguranca/usuarios',
    adm_perfis:                    '/administracao/acesso-e-seguranca/perfis',
    adm_sessoes:                   '/administracao/acesso-e-seguranca/sessoes',
    adm_equipes:                   '/administracao/organizacao-do-trabalho/equipes',
    adm_aptidoes:                  '/administracao/organizacao-do-trabalho/aptidoes',
    adm_alcadas:                   '/administracao/governanca-de-autoridade/alcadas',
    adm_delegacoes:                '/administracao/governanca-de-autoridade/delegacoes',
    adm_sod:                       '/administracao/governanca-de-autoridade/segregacao',
    adm_workflow:                  '/administracao/processos-e-sla/workflow',
    adm_sla:                       '/administracao/processos-e-sla/sla',
    adm_integracoes:               '/administracao/integracoes-e-operacao/integracoes',
    adm_auditoria:                 '/administracao/auditoria',
    // SCR-25 Configurações (D-13 canônico)
    configuracoes_home:            '/configuracoes',
    cfg_organizacao:               '/configuracoes/organizacao-e-licenca/organizacao',
    cfg_licenca:                   '/configuracoes/organizacao-e-licenca/licenca',
    cfg_fy:                        '/configuracoes/planejamento-e-projetos/ano-fiscal',
    cfg_estimativas:               '/configuracoes/planejamento-e-projetos/estimativas',
    cfg_ratecards:                 '/configuracoes/planejamento-e-projetos/ratecards',
    cfg_financeiro:                '/configuracoes/financeiro',
    cfg_notificacoes:              '/configuracoes/comunicacao/notificacoes',
    cfg_eventos:                   '/configuracoes/comunicacao/eventos',
    cfg_templates:                 '/configuracoes/comunicacao/templates',
    cfg_ia:                        '/configuracoes/inteligencia-artificial',
    cfg_parametros:                '/configuracoes/parametros-do-sistema',
    // Legados ADM (mantidos para deep-links externos; redirecionam via ADM_LEGACY_MAP)
    areas:                         '/cadastros/estrutura-organizacional/org',
    pessoas_solicitantes:          '/cadastros/pessoas-e-entidades/pessoas',
    cargos:                        '/cadastros/estrutura-organizacional/cargos',
    portes:                        '/cadastros/portfolio-e-projetos/portes',
    tipos_projeto:                 '/cadastros/portfolio-e-projetos/classificacoes',
    produtos:                      '/cadastros/portfolio-e-projetos/classificacoes',
    return_benefit:                '/cadastros/portfolio-e-projetos/classificacoes',
    planejamento_estrategico:      '/cadastros/estrategia',
    empresas_terceirizadas:        '/cadastros/pessoas-e-entidades/fornecedores',
    usuarios:                      '/administracao/acesso-e-seguranca/usuarios',
    funcoes_permissoes:            '/administracao/acesso-e-seguranca/perfis',
    atribuicao_funcoes:            '/administracao/acesso-e-seguranca/usuarios',
    restricao_area_atividades:     '/administracao/acesso-e-seguranca/perfis',
    responsaveis:                  '/administracao/organizacao-do-trabalho/equipes',
    workflow_etapas:               '/administracao/processos-e-sla/workflow',
    prazos:                        '/administracao/processos-e-sla/sla',
    auditoria:                     '/administracao/auditoria',
    configuracoes:                 '/configuracoes/organizacao-e-licenca/organizacao',
    controle_orcamento:            '/configuracoes/financeiro',
    percentual_bloqueio_orcamento: '/configuracoes/financeiro',
    periodo_ano_fiscal:            '/configuracoes/planejamento-e-projetos/ano-fiscal',
    gestao_templates:              '/configuracoes/comunicacao/templates',
    gestao_fluxo_email:            '/configuracoes/comunicacao/eventos',
    fila_email:                    '/administracao/integracoes-e-operacao/integracoes',
    ia_templates:                  '/configuracoes/inteligencia-artificial',
    ia_config:                     '/configuracoes/inteligencia-artificial',
    // Contratos
    contratos_projeto:             '/financeiro/contratos',
    contratos_vinculos:            '/financeiro/contratos/vinculos',
    registro_valores_contrato:     '/financeiro/contratos/valores',
    relatorio_projetos_contratos:  '/financeiro/contratos/relatorio',
    contratos_pendencias:          '/financeiro/contratos/pendencias',
    pagamentos_pendentes_nf:       '/financeiro/contratos/pagamentos',
    // Proprietário
    dados_empresa:                 '/proprietario/empresa',
    licenciamento_modulos:         '/proprietario/modulos',
    // Dev
    dev_tools:                     '/dev/tools',
};

// Índice inverso: rota → tabId (prefixos são suficientes para desfazer o hash)
const _ROTA_PARA_TAB = {};
for (const [tab, rota] of Object.entries(_TAB_PARA_ROTA)) {
    _ROTA_PARA_TAB[rota] = tab;
}

// Retorna o tabId canônico para um hash de URL, ou null se não reconhecido.
// Hash deve ser passado sem o '#' inicial.
// Ex.: '/portfolio/ano-fiscal' → 'ano_fiscal'
//      '/portfolio/ano-fiscal/42/transicoes/carryover' → 'ano_fiscal' (o id/acao são ignorados pelo tab; handlers específicos os lerão de location.hash)
function tabIdFromHash(hash) {
    if (!hash || hash === '/') return 'home';
    const semQuery = hash.split('?')[0];
    // Tenta match exato primeiro
    if (_ROTA_PARA_TAB[semQuery]) return _ROTA_PARA_TAB[semQuery];
    // Tenta match de prefixo mais longo (para rotas com /:id ou /:acao)
    const partes = semQuery.split('/').filter(Boolean);
    for (let n = partes.length; n >= 1; n--) {
        const tentativa = '/' + partes.slice(0, n).join('/');
        if (_ROTA_PARA_TAB[tentativa]) return _ROTA_PARA_TAB[tentativa];
    }
    return null;
}

// Retorna o hash canônico para um tabId.
// Para workspace_projeto (com id), passe { tabId: 'workspace_projeto', id: codigo }.
function hashFromTabId(tabId, opcoes) {
    if (tabId === 'workspace_projeto' && opcoes && opcoes.id) {
        return '/projetos/' + encodeURIComponent(opcoes.id);
    }
    return _TAB_PARA_ROTA[tabId] || null;
}

// Atualiza o hash da URL sem disparar um novo evento hashchange (usa history.replaceState).
function _setHashSilencioso(hash) {
    try {
        if (history.replaceState) {
            history.replaceState(null, '', '#' + hash);
        } else {
            // Fallback — dispara hashchange, aceito como degradação graciosa.
            location.hash = hash;
        }
    } catch (e) { /* em iframe ou contexto restrito — sem hash */ }
}

// Ouvinte de hashchange: quando o usuário cola um link ou usa ← →, navega
// para a tela correspondente ao novo hash.
window.addEventListener('hashchange', function () {
    const hash = location.hash.replace(/^#/, '') || '/';
    const tabId = tabIdFromHash(hash);
    if (tabId && typeof switchTab === 'function') {
        // Não atualiza o hash de volta (evita loop): switchTab vai chamar
        // routerPush internamente, mas já é o hash que veio do evento.
        _rotaSilenciosa = true;
        switchTab(tabId);
        _rotaSilenciosa = false;
    }
});

// Flag interna: switchTab ativo por evento hashchange → não reescrever hash.
let _rotaSilenciosa = false;

// Chamada por switchTab() para manter o hash sincronizado com a aba ativa.
// opcoes: { id } para workspace_projeto.
function routerPush(tabId, opcoes) {
    if (_rotaSilenciosa) return;
    const hash = hashFromTabId(tabId, opcoes);
    if (hash) _setHashSilencioso(hash);
}

// Inicializa: ao carregar, se há hash na URL, navega para a aba correspondente.
document.addEventListener('DOMContentLoaded', function () {
    const hash = location.hash.replace(/^#/, '');
    if (hash && hash !== '/') {
        const tabId = tabIdFromHash(hash);
        if (tabId && typeof switchTab === 'function') {
            _rotaSilenciosa = true;
            switchTab(tabId);
            _rotaSilenciosa = false;
        }
    }
});
