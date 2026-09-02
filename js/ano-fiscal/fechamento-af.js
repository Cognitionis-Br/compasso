// =========================================================================
// ano-fiscal/fechamento-af.js
// Tela "Fechamento Ano Fiscal" (grupo ANO FISCAL) — 2 abas:
//   1. "Avaliação e Fechamento Ano Fiscal" -> visão de resultado do AF
//      (js/ano-fiscal/resultado-af.js) + botão "Fechar Ano Fiscal".
//   2. "Avaliação Projetos Fechamento Ano Fiscal" -> decisão por projeto
//      (js/ano-fiscal/fechamento-projetos.js), substitui "Projetos Carry Over".
//
// AF alvo (o que está sendo encerrado):
//   Q4  -> o Ano Fiscal EM CURSO (getInfoAnoFiscal().afAtualStr).
//   Q1/Q2/Q3 -> o Ano Fiscal ANTERIOR ao em curso (afAtual − 1).
//
// Fechamento do ANO FISCAL != fechamento do ORÇAMENTO:
//   - grava anos_fiscais_config.ano_fiscal_fechado + af_fechado_por/_em/_observacao
//   - grava log_fechamento_ano_fiscal
//   - pré-condição: NENHUM projeto do AF pode estar "em andamento" — todos
//     devem estar HOLD, CANCELADO ou CARRYOVER (desenvolvimento ou hold).
//   - reflete na Abertura Ano Fiscal (só abre o próximo se o AF anterior
//     estiver fechado, além do orçamento do corrente).
// =========================================================================

let fechamentoAfAbaAtiva = 'avaliacao';
let fechamentoAfConfigCache = [];

function fechamentoAfTargetAF() {
    const info = (typeof getInfoAnoFiscal === 'function') ? getInfoAnoFiscal() : { afAtualStr: '', quarterAtual: '' };
    if ((info.quarterAtual || '').toUpperCase() === 'Q4') return info.afAtualStr;
    const n = parseInt(String(info.afAtualStr || '').replace(/\D/g, ''), 10);
    return isNaN(n) ? info.afAtualStr : ('AF' + (n - 1));
}

function fechamentoAfConfigDoAlvo() {
    const alvo = fechamentoAfTargetAF();
    return (fechamentoAfConfigCache || []).find(c => c.ano_fiscal === alvo) || null;
}

function fechamentoAfJaFechado() {
    const cfg = fechamentoAfConfigDoAlvo();
    return !!(cfg && cfg.ano_fiscal_fechado === true);
}

// Projetos do AF alvo que ainda estão "em andamento" sem tratamento
// (não concluídos, não subprojeto, e nem HOLD, nem CANCELADO, nem carryover).
function fechamentoAfProjetosPendentes() {
    const alvo = fechamentoAfTargetAF();
    return (projectsData || []).filter(p => {
        if (p.ano_fiscal !== alvo) return false;
        if (p.is_subprojeto === true) return false;
        if (p.projeto_concluido === true) return false;
        const sub = (p.sub_status || '').toUpperCase();
        if (sub === 'HOLD' || sub === 'CANCELADO' || sub === 'REPROVADO') return false;
        if (p.is_carryover === true) return false;
        return true;
    });
}

function mudarAbaFechamentoAf(aba) {
    fechamentoAfAbaAtiva = aba;
    ['avaliacao', 'projetos'].forEach(a => {
        const btn = document.getElementById(`fechamentoAfBtn-${a}`);
        const painel = document.getElementById(`fechamentoAfPainel-${a}`);
        if (btn) btn.className = `fechamento-af-btn px-4 py-2 rounded-md text-sm font-bold border-2 ${a === aba ? 'bg-red-700 text-white border-red-700' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`;
        if (painel) painel.classList.toggle('hidden', a !== aba);
    });
    if (typeof aplicarVisibilidadeSubAbas === 'function') aplicarVisibilidadeSubAbas('fechamento_af', 'fechamentoAfBtn');

    if (aba === 'avaliacao' && typeof renderResultadoAfView === 'function') renderResultadoAfView();
    if (aba === 'projetos' && typeof renderFechamentoProjetosView === 'function') renderFechamentoProjetosView();
}

async function renderFechamentoAfView() {
    const { data: cfg } = await _supabase.from('anos_fiscais_config').select('*');
    fechamentoAfConfigCache = cfg || [];

    const alvo = fechamentoAfTargetAF();
    const cfgAlvo = fechamentoAfConfigDoAlvo();
    const info = (typeof getInfoAnoFiscal === 'function') ? getInfoAnoFiscal() : { quarterAtual: '' };

    const elCtx = document.getElementById('fechamentoAfContextoAF');
    if (elCtx) {
        const badge = fechamentoAfJaFechado()
            ? `<span class="bg-green-100 text-green-800 font-bold px-2 py-1 rounded text-[10px]">🔒 Ano Fiscal fechado por ${escapeHtml(cfgAlvo.af_fechado_por) || '-'}${cfgAlvo.af_fechado_em ? ' em ' + new Date(cfgAlvo.af_fechado_em).toLocaleDateString('pt-BR') : ''}</span>`
            : `<span class="bg-amber-100 text-amber-800 font-bold px-2 py-1 rounded text-[10px]">⏳ Ano Fiscal em fechamento</span>`;
        elCtx.innerHTML = `<b>Ano Fiscal sendo encerrado:</b> <span class="font-mono font-bold">${alvo || '-'}</span> &nbsp; ${badge} <span class="text-[10px] text-gray-400 ml-2">(quarter atual: ${info.quarterAtual || '-'})</span>`;
    }

    renderFechamentoAfAcaoFechar();
    mudarAbaFechamentoAf(fechamentoAfAbaAtiva || 'avaliacao');
}

function renderFechamentoAfAcaoFechar() {
    const el = document.getElementById('fechamentoAfAcaoFechar');
    if (!el) return;
    const alvo = fechamentoAfTargetAF();
    const cfgAlvo = fechamentoAfConfigDoAlvo();
    const podeFechar = (typeof usuarioPodeAlterar === 'function') && usuarioPodeAlterar('fechamento_af:avaliacao');

    if (fechamentoAfJaFechado()) {
        el.innerHTML = `
            <div class="bg-green-50 border border-green-300 rounded-lg p-4 text-xs text-green-800">
                <b>🔒 ${alvo} já foi fechado.</b> por ${escapeHtml(cfgAlvo.af_fechado_por) || '-'}${cfgAlvo.af_fechado_em ? ' em ' + new Date(cfgAlvo.af_fechado_em).toLocaleString('pt-BR') : ''}.
                ${cfgAlvo.af_fechado_observacao ? `<div class="mt-1 text-green-700">Comentário: ${escapeHtml(cfgAlvo.af_fechado_observacao)}</div>` : ''}
            </div>`;
        return;
    }

    const pendentes = fechamentoAfProjetosPendentes();
    const bloqueado = pendentes.length > 0;
    el.innerHTML = `
        <div class="bg-white border border-gray-200 rounded-lg p-4 mb-2">
            <div class="flex items-center justify-between gap-4 flex-wrap">
                <div class="text-xs text-gray-600">
                    Fechar o Ano Fiscal <b>${alvo}</b> registra quem/quando fechou (com comentário) e libera a abertura do próximo Ano Fiscal.
                    ${bloqueado
                        ? `<div class="mt-2 text-red-700 font-bold">⛔ EXISTEM PROJETOS EM ANDAMENTO. TRATE TODOS NA ABA DE AVALIAÇÃO</div>`
                        : `<div class="mt-2 text-emerald-700 font-bold">✅ Todos os projetos do ${alvo} já estão tratados.</div>`}
                </div>
                <button onclick="abrirModalFecharAnoFiscal()" ${(!podeFechar || bloqueado) ? 'disabled' : ''}
                    class="font-bold py-2 px-4 rounded text-xs transition ${(!podeFechar || bloqueado) ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-red-700 hover:bg-red-800 text-white'}"
                    title="${!podeFechar ? 'Sem permissão para fechar o Ano Fiscal' : (bloqueado ? 'Existem projetos em andamento sem tratamento' : '')}">
                    <i class="fa-solid fa-lock"></i> Fechar Ano Fiscal ${alvo}
                </button>
            </div>
        </div>`;
}

function abrirModalFecharAnoFiscal() {
    if (!(typeof usuarioPodeAlterar === 'function' && usuarioPodeAlterar('fechamento_af:avaliacao'))) {
        return alert('Você não tem permissão para fechar o Ano Fiscal.');
    }
    if (fechamentoAfProjetosPendentes().length > 0) {
        return alert('⛔ EXISTEM PROJETOS EM ANDAMENTO. TRATE TODOS NA ABA DE AVALIAÇÃO');
    }
    document.getElementById('fecharAfAlvo').innerText = fechamentoAfTargetAF();
    document.getElementById('fecharAfObs').value = '';
    document.getElementById('modalFecharAnoFiscal').classList.remove('hidden');
}

function fecharModalFecharAnoFiscal() {
    document.getElementById('modalFecharAnoFiscal').classList.add('hidden');
}

async function confirmarFecharAnoFiscal() {
    if (!(typeof usuarioPodeAlterar === 'function' && usuarioPodeAlterar('fechamento_af:avaliacao'))) {
        return alert('Você não tem permissão para fechar o Ano Fiscal.');
    }
    const alvo = fechamentoAfTargetAF();
    const obs = document.getElementById('fecharAfObs').value.trim();

    // Reconfere a pré-condição no clique.
    const pendentes = fechamentoAfProjetosPendentes();
    if (pendentes.length > 0) {
        return alert('⛔ EXISTEM PROJETOS EM ANDAMENTO. TRATE TODOS NA ABA DE AVALIAÇÃO');
    }
    if (!confirm(`Confirmar o FECHAMENTO do Ano Fiscal ${alvo}?\n\nEssa ação registra o fechamento (quem/quando/comentário) e passa a ser exigida para abrir o próximo Ano Fiscal.`)) return;

    const quem = currentUser ? currentUser.nome : 'desconhecido';
    const agora = new Date().toISOString();

    const { error } = await _supabase.from('anos_fiscais_config').upsert({
        ano_fiscal: alvo,
        ano_fiscal_fechado: true,
        af_fechado_por: quem,
        af_fechado_em: agora,
        af_fechado_observacao: obs || null
    }, { onConflict: 'ano_fiscal' });
    if (error) return alert('Erro ao fechar o Ano Fiscal: ' + error.message);

    const { error: errLog } = await _supabase.from('log_fechamento_ano_fiscal').insert([{
        ano_fiscal: alvo,
        acao: 'FECHAMENTO',
        fechado_por: quem,
        observacao: obs || null
    }]);
    if (errLog) console.error('Ano Fiscal fechado, mas houve erro ao gravar o log:', errLog.message);

    fecharModalFecharAnoFiscal();
    alert(`✅ Ano Fiscal ${alvo} fechado.`);
    if (typeof loadProjects === 'function') await loadProjects();
    if (typeof loadAnoFiscalConfig === 'function') await loadAnoFiscalConfig();
    await renderFechamentoAfView();
}
