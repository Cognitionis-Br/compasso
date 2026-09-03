// =========================================================================
// config/periodo-ano-fiscal.js
// NOVO (Feature 1.2 — 03/09/2026): Período do Ano Fiscal parametrizável.
// Antes, getInfoAnoFiscal() (js/core/fiscal-year.js) tinha abril–março fixo
// no código. Agora o mês de início vem da tabela config_periodo_ano_fiscal,
// COM VIGÊNCIA: cada linha vale a partir de vigencia_de; datas anteriores à
// primeira vigência continuam apuradas em abril (mês 4).
//
// Tela restrita a ADMINISTRADOR / PROPRIETÁRIO (gate hardcoded, fora do
// catálogo comum — mesmo padrão de Licenciamento de Módulos). O cache é
// carregado no login (js/auth/auth.js) antes de qualquer render, então
// mesInicioAnoFiscal() e getInfoAnoFiscal() continuam SÍNCRONOS.
// =========================================================================

// Todas as linhas cadastradas, ordenadas por vigência ascendente.
let configPeriodoAFCache = [];

async function carregarConfigPeriodoAF() {
    const { data, error } = await _supabase
        .from('config_periodo_ano_fiscal')
        .select('*')
        .order('vigencia_de', { ascending: true });
    configPeriodoAFCache = error ? [] : (data || []);
    return configPeriodoAFCache;
}

// Mês (1–12) de início do Ano Fiscal aplicável a `dataRef` (default: hoje).
// Escolhe a linha com maior vigencia_de <= dataRef. Sem nenhuma linha
// aplicável => 4 (abril), o comportamento histórico do sistema.
function mesInicioAnoFiscal(dataRef) {
    const ref = dataRef ? new Date(dataRef) : new Date();
    const refYmd = ref.toISOString().split('T')[0];
    let escolhido = null;
    (configPeriodoAFCache || []).forEach(linha => {
        if (!linha || !linha.vigencia_de) return;
        const vig = String(linha.vigencia_de).split('T')[0];
        if (vig <= refYmd) {
            if (!escolhido || vig >= String(escolhido.vigencia_de).split('T')[0]) escolhido = linha;
        }
    });
    const m = escolhido ? Number(escolhido.mes_inicio) : 4;
    return (m >= 1 && m <= 12) ? m : 4;
}

// Mês de encerramento = 12 meses depois do início (mês anterior ao início).
function mesEncerramentoAnoFiscal(mesInicio) {
    const m = Number(mesInicio) || 4;
    return ((m + 10) % 12) + 1;
}

const NOMES_MESES_PT = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

async function renderPeriodoAnoFiscalView() {
    // Gate hardcoded — a tela nunca depende do catálogo.
    const restrito = document.getElementById('periodoAnoFiscalRestrito');
    const conteudo = document.getElementById('periodoAnoFiscalConteudo');
    const podeVer = (typeof ehAdministrador !== 'undefined' && ehAdministrador) ||
                    (typeof ehProprietario !== 'undefined' && ehProprietario);
    if (restrito) restrito.classList.toggle('hidden', podeVer);
    if (conteudo) conteudo.classList.toggle('hidden', !podeVer);
    if (!podeVer) return;

    await carregarConfigPeriodoAF();
    const mesAtual = mesInicioAnoFiscal();

    const sel = document.getElementById('periodoAnoFiscalMesInicio');
    if (sel) {
        sel.innerHTML = NOMES_MESES_PT.map((nome, i) =>
            `<option value="${i + 1}" ${(i + 1) === mesAtual ? 'selected' : ''}>${nome}</option>`).join('');
    }
    const elFim = document.getElementById('periodoAnoFiscalMesFim');
    if (elFim) elFim.innerText = NOMES_MESES_PT[mesEncerramentoAnoFiscal(mesAtual) - 1];

    const elHist = document.getElementById('periodoAnoFiscalHistorico');
    if (elHist) {
        const linhas = (configPeriodoAFCache || []).slice().reverse();
        elHist.innerHTML = linhas.length === 0
            ? `<tr><td colspan="4" class="p-3 text-center text-gray-400 font-bold">Nenhum período cadastrado — o sistema usa Abril–Março (padrão).</td></tr>`
            : linhas.map(l => `
                <tr>
                    <td class="p-2">${l.vigencia_de ? new Date(l.vigencia_de).toLocaleDateString('pt-BR') : '-'}</td>
                    <td class="p-2 font-bold">${NOMES_MESES_PT[(Number(l.mes_inicio) || 4) - 1]}</td>
                    <td class="p-2">${l.mes_inicio_anterior ? NOMES_MESES_PT[(Number(l.mes_inicio_anterior)) - 1] : '-'}</td>
                    <td class="p-2 uppercase font-bold">${escapeHtml(l.alterado_por || '-')}<span class="block text-[9px] text-gray-400">${l.alterado_em ? new Date(l.alterado_em).toLocaleString('pt-BR') : ''}</span></td>
                </tr>`).join('');
    }
}

// Atualiza o "mês de encerramento" ao vivo quando o usuário troca o select.
function onMudarMesInicioAnoFiscal() {
    const sel = document.getElementById('periodoAnoFiscalMesInicio');
    const elFim = document.getElementById('periodoAnoFiscalMesFim');
    if (sel && elFim) elFim.innerText = NOMES_MESES_PT[mesEncerramentoAnoFiscal(Number(sel.value)) - 1];
}

async function salvarPeriodoAnoFiscal() {
    const podeAlterar = (typeof ehAdministrador !== 'undefined' && ehAdministrador) ||
                        (typeof ehProprietario !== 'undefined' && ehProprietario);
    if (!podeAlterar) return alert('Apenas ADMINISTRADOR ou PROPRIETÁRIO podem alterar o período do Ano Fiscal.');

    const sel = document.getElementById('periodoAnoFiscalMesInicio');
    const novoMes = sel ? Number(sel.value) : NaN;
    if (!(novoMes >= 1 && novoMes <= 12)) return alert('Selecione um mês de início válido.');

    const vigencia = (document.getElementById('periodoAnoFiscalVigencia') || {}).value || new Date().toISOString().split('T')[0];
    const mesAnterior = mesInicioAnoFiscal();

    if (novoMes === mesAnterior && configPeriodoAFCache.length > 0) {
        return alert('O mês de início selecionado é o mesmo que já vigora — nada a salvar.');
    }
    if (!confirm(`Confirmar: o Ano Fiscal passa a começar em ${NOMES_MESES_PT[novoMes - 1]} a partir de ${new Date(vigencia).toLocaleDateString('pt-BR')}?\n\nDatas anteriores a essa vigência continuam apuradas no período antigo. Quarters e rótulos "AFxxxx" das telas passam a refletir o novo período.`)) return;

    const payload = {
        mes_inicio: novoMes,
        vigencia_de: vigencia,
        mes_inicio_anterior: configPeriodoAFCache.length > 0 ? mesAnterior : null,
        alterado_por: (typeof currentUser !== 'undefined' && currentUser) ? currentUser.nome : 'desconhecido',
        alterado_em: new Date().toISOString()
    };
    const { error } = await _supabase.from('config_periodo_ano_fiscal').insert([payload]);
    if (error) return alert('Erro ao salvar o período do Ano Fiscal: ' + error.message);

    alert('✅ Período do Ano Fiscal salvo. Recarregue a página para as telas refletirem o novo período.');
    await carregarConfigPeriodoAF();
    await renderPeriodoAnoFiscalView();
}
