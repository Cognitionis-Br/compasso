// =========================================================================
// alertas/sla-utils.js
// Compasso 2.0 — Fase 4 (D-09): utilitários de SLA, badges e timeline.
//
// Funções públicas:
//   carregarSlaConfig()                   — async, popula o cache da tabela sla_config
//   slaParaEtapa(etapaAtual)              — retorna o objeto SLA da etapa (ou null)
//   badgeAlertaPrazo(dtPrazo, sla)        — retorna HTML do badge Ok/Em risco/Vencido
//   timelinePrazoHtml(dtEnvio, sla)       — retorna HTML do card "Prazo da revisão"
//   prazoStatus(dtPrazo, sla)             — retorna 'ok'|'wa'|'cr'|'' (para filtros)
// =========================================================================

let _slaConfig = null;

const _SLA_PADROES = {
    REQUERIMENTOS: { dias_uteis: 10, aviso_antecipado_dias: 2, esc1_papel: 'Coordenador',       esc1_dias: 2, esc2_papel: 'Diretoria', esc2_dias: 4 },
    ESPECIFICACAO:  { dias_uteis:  8, aviso_antecipado_dias: 2, esc1_papel: 'Diretor de Negócio', esc1_dias: 2, esc2_papel: 'Comitê',    esc2_dias: 4 },
    EXECUCAO:       { dias_uteis: 30, aviso_antecipado_dias: 5, esc1_papel: 'Coordenador',       esc1_dias: 3, esc2_papel: 'Diretoria', esc2_dias: 5 },
    UAT:            { dias_uteis: 10, aviso_antecipado_dias: 2, esc1_papel: 'Coordenador',       esc1_dias: 2, esc2_papel: 'Diretoria', esc2_dias: 4 },
    GOLIVE:         { dias_uteis:  5, aviso_antecipado_dias: 1, esc1_papel: 'Coordenador',       esc1_dias: 2, esc2_papel: 'Diretoria', esc2_dias: 3 },
    ENCERRAMENTO:   { dias_uteis: 15, aviso_antecipado_dias: 3, esc1_papel: 'Coordenador',       esc1_dias: 3, esc2_papel: 'Diretoria', esc2_dias: 5 },
};

// Mapa etapa_atual (de projectsData) → chave do SLA
const _ETAPA_SLA_KEY = {
    REQUIREMENTS: 'REQUERIMENTOS',
    TECHNICAL:    'ESPECIFICACAO',
    EXECUTION:    'EXECUCAO',
    UAT:          'UAT',
    GOLIVE:       'GOLIVE',
    CONCLUIDO:    'ENCERRAMENTO',
};

async function carregarSlaConfig() {
    if (_slaConfig) return _slaConfig;
    try {
        const { data } = await _supabase.from('sla_config').select('*').eq('ativo', true);
        if (data && data.length > 0) {
            _slaConfig = {};
            data.forEach(r => {
                _slaConfig[r.etapa] = {
                    dias_uteis:           r.dias_uteis,
                    aviso_antecipado_dias: r.aviso_antecipado_dias,
                    esc1_papel: r.escalonamento_1_papel,
                    esc1_dias:  r.escalonamento_1_dias,
                    esc2_papel: r.escalonamento_2_papel,
                    esc2_dias:  r.escalonamento_2_dias,
                };
            });
            return _slaConfig;
        }
    } catch (_) {}
    _slaConfig = { ..._SLA_PADROES };
    return _slaConfig;
}

function slaParaEtapa(etapaAtual) {
    const cache = _slaConfig || _SLA_PADROES;
    const key = _ETAPA_SLA_KEY[etapaAtual] || etapaAtual;
    return cache[key] || null;
}

// Adiciona `dias` dias corridos a uma data 'YYYY-MM-DD'
function _adicionarDias(dtBase, dias) {
    if (!dtBase) return null;
    const d = new Date(dtBase + 'T12:00:00Z');
    d.setUTCDate(d.getUTCDate() + dias);
    return d.toISOString().split('T')[0];
}

// Retorna 'ok' | 'wa' | 'cr' | '' baseado em dtPrazo e SLA
function prazoStatus(dtPrazo, sla) {
    if (!dtPrazo) return '';
    const hoje     = new Date().toISOString().split('T')[0];
    const avisoMs  = ((sla && sla.aviso_antecipado_dias) || 2) * 86400000;
    const prazoMs  = new Date(dtPrazo + 'T12:00:00Z').getTime();
    const hojeMs   = new Date(hoje     + 'T12:00:00Z').getTime();
    if (hojeMs > prazoMs) return 'cr';
    if (prazoMs - hojeMs <= avisoMs) return 'wa';
    return 'ok';
}

// Retorna HTML do badge de prazo
function badgeAlertaPrazo(dtPrazo, sla) {
    const st = prazoStatus(dtPrazo, sla);
    if (!st) return '';
    if (st === 'cr') return '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-red-100 text-red-800 whitespace-nowrap"><i class="fa-solid fa-circle-xmark"></i>Vencido</span>';
    if (st === 'wa') return '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 whitespace-nowrap"><i class="fa-solid fa-triangle-exclamation"></i>Em risco</span>';
    return '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-green-100 text-green-800 whitespace-nowrap"><i class="fa-solid fa-circle-check"></i>Dentro do prazo</span>';
}

// Retorna HTML do card "Prazo da revisão" (300 px de largura, com timeline).
// dtEnvio: 'YYYY-MM-DD' — data em que o item entrou no estado de revisão.
// sla: objeto da etapa (de slaParaEtapa).
function timelinePrazoHtml(dtEnvio, sla) {
    if (!dtEnvio || !sla) return '';

    const dias    = sla.dias_uteis || 8;
    const avisoD  = sla.aviso_antecipado_dias || 2;
    const dtPrazo = _adicionarDias(dtEnvio, dias);
    const dtAviso = _adicionarDias(dtEnvio, dias - avisoD);
    const dtEsc1  = _adicionarDias(dtPrazo, sla.esc1_dias || 2);
    const dtEsc2  = _adicionarDias(dtPrazo, sla.esc2_dias || 4);
    const hoje    = new Date().toISOString().split('T')[0];
    const badge   = badgeAlertaPrazo(dtPrazo, sla);

    function ponto(dt, label) {
        if (!dt) return '';
        const passado = dt <= hoje;
        let cor = '#94a3b8';
        if (passado) {
            if (dt >= dtPrazo) cor = '#7c3aed';
            else if (dt === dtAviso) cor = '#d97706';
            else if (dt === dtPrazo) cor = '#dc2626';
            else cor = '#16a34a';
        }
        return `
            <div style="display:flex;gap:10px;align-items:center;font-size:12px;padding:4px 0;">
                <span style="width:10px;height:10px;border-radius:999px;background:${cor};flex-shrink:0;"></span>
                <span style="flex-grow:1;color:#374151;">${label}</span>
                <b style="color:#0f1e3d;white-space:nowrap;">${formatDate(dt)}</b>
            </div>`;
    }

    return `
        <div style="width:300px;flex-shrink:0;background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:12px 14px;display:flex;flex-direction:column;gap:4px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
                <span style="font-size:13px;font-weight:800;color:#0f1e3d;">Prazo da revisão</span>
                ${badge}
            </div>
            ${ponto(dtEnvio, 'Enviado ao aprovador')}
            ${ponto(dtAviso, 'Aviso antecipado')}
            ${ponto(dtPrazo, 'Vencimento · alerta ao aprovador')}
            ${ponto(dtEsc1, `Escalonamento nível 1 · ${sla.esc1_papel || 'Coordenador'}`)}
            ${ponto(dtEsc2, `Escalonamento nível 2 · ${sla.esc2_papel || 'Diretoria'}`)}
        </div>`;
}
