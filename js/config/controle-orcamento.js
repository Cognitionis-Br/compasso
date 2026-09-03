// =========================================================================
// config/controle-orcamento.js
// NOVO (Feature 1.1 — 03/09/2026): "Controle Orçamentário" (menu
// ADMINISTRAÇÃO). Define o MODO que rege a elegibilidade de projetos no
// trade-off da Demanda Extraordinária:
//   'AF'      -> todos os projetos do Ano Fiscal (default, comportamento atual)
//   'AREA'    -> só projetos da mesma área do projeto extraordinário
//   'PRODUTO' -> só projetos do mesmo produto do projeto extraordinário
//
// NÃO altera o seletor "Agrupar orçamento por" do Dashboard/Financeiro
// (js/core/filtro-agrupamento-orcamento.js) — esse continua sendo escolha
// de tela, independente deste parâmetro.
//
// Atividade DELEGÁVEL: Administrador/Proprietário entram por bypass, e um
// Administrador pode conceder 'controle_orcamento' a outro perfil em
// Funções e Permissões (mesmo padrão de 'ajuste_orcamento'). Append-only:
// cada save faz INSERT de nova linha; a vigente é a de maior alterado_em.
// O cache é carregado no login (js/auth/auth.js), então
// modoControleOrcamentoAtivo() é SÍNCRONO.
// =========================================================================

let configControleOrcamentoCache = null;

async function carregarConfigControleOrcamento() {
    const { data, error } = await _supabase
        .from('config_controle_orcamento')
        .select('*')
        .order('alterado_em', { ascending: false })
        .limit(1);
    configControleOrcamentoCache = (error || !data || !data.length) ? null : data[0];
    return configControleOrcamentoCache;
}

// Modo vigente ('AF' | 'AREA' | 'PRODUTO'). Fallback 'AF'.
function modoControleOrcamentoAtivo() {
    const m = configControleOrcamentoCache && configControleOrcamentoCache.modo;
    return (m === 'AREA' || m === 'PRODUTO') ? m : 'AF';
}

const CONTROLE_ORCAMENTO_LABEL = { AF: 'Ano Fiscal', AREA: 'Área', PRODUTO: 'Produto' };

// A vigência começa SEMPRE no 1º dia do mês corrente — o usuário não
// informa data. (Append-only: o fim de cada faixa é implícito.)
function _coPrimeiroDiaMesAtualISO() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

function _podeVerControleOrcamento() {
    return (typeof ehAdministrador !== 'undefined' && ehAdministrador) ||
           (typeof ehProprietario !== 'undefined' && ehProprietario) ||
           (typeof usuarioTemAtividade === 'function' && usuarioTemAtividade('controle_orcamento'));
}

async function renderControleOrcamentoView() {
    const restrito = document.getElementById('controleOrcamentoRestrito');
    const conteudo = document.getElementById('controleOrcamentoConteudo');
    const podeVer = _podeVerControleOrcamento();
    if (restrito) restrito.classList.toggle('hidden', podeVer);
    if (conteudo) conteudo.classList.toggle('hidden', !podeVer);
    if (!podeVer) return;

    await carregarConfigControleOrcamento();
    const cfg = configControleOrcamentoCache || {};
    const modoAtual = modoControleOrcamentoAtivo();

    const sel = document.getElementById('controleOrcamentoModo');
    if (sel) sel.value = modoAtual;
    const elVig = document.getElementById('controleOrcamentoVigenciaInfo');
    if (elVig) elVig.innerText = new Date(_coPrimeiroDiaMesAtualISO() + 'T00:00:00').toLocaleDateString('pt-BR');

    const elLog = document.getElementById('controleOrcamentoLog');
    if (elLog) {
        elLog.innerHTML = cfg.alterado_em
            ? `Modo vigente: <b>${CONTROLE_ORCAMENTO_LABEL[modoAtual]}</b> · última alteração por <b class="uppercase">${escapeHtml(cfg.alterado_por || '-')}</b> em ${new Date(cfg.alterado_em).toLocaleString('pt-BR')}${cfg.modo_anterior ? ` (anterior: ${CONTROLE_ORCAMENTO_LABEL[cfg.modo_anterior] || cfg.modo_anterior})` : ''}.`
            : `Modo vigente: <b>${CONTROLE_ORCAMENTO_LABEL[modoAtual]}</b> (padrão).`;
    }

    await _renderHistoricoControleOrcamento();
}

async function _renderHistoricoControleOrcamento() {
    const tbody = document.getElementById('controleOrcamentoHistorico');
    if (!tbody) return;
    const { data } = await _supabase.from('config_controle_orcamento').select('*');
    const asc = (data || []).slice().sort((a, b) => String(a.vigencia_de).localeCompare(String(b.vigencia_de)) || String(a.alterado_em).localeCompare(String(b.alterado_em)));
    const fmtD = iso => iso ? new Date(String(iso).split('T')[0] + 'T00:00:00').toLocaleDateString('pt-BR') : '-';
    const fmtDMenos1 = iso => { if (!iso) return '-'; const d = new Date(String(iso).split('T')[0] + 'T00:00:00'); d.setDate(d.getDate() - 1); return d.toLocaleDateString('pt-BR'); };
    const linhas = asc.map((l, i) => ({ l, ini: fmtD(l.vigencia_de), fim: (i < asc.length - 1) ? fmtDMenos1(asc[i + 1].vigencia_de) : 'atual' })).reverse();
    tbody.innerHTML = linhas.length === 0
        ? `<tr><td colspan="4" class="p-3 text-center text-gray-400 font-bold">Sem alterações registradas.</td></tr>`
        : linhas.map(({ l, ini, fim }) => `
            <tr>
                <td class="p-2">${ini} <span class="text-gray-400">→</span> ${fim}</td>
                <td class="p-2 font-bold">${CONTROLE_ORCAMENTO_LABEL[l.modo] || l.modo}</td>
                <td class="p-2">${l.modo_anterior ? (CONTROLE_ORCAMENTO_LABEL[l.modo_anterior] || l.modo_anterior) : '-'}</td>
                <td class="p-2 uppercase font-bold">${escapeHtml(l.alterado_por || '-')}<span class="block text-[9px] text-gray-400">${l.alterado_em ? new Date(l.alterado_em).toLocaleString('pt-BR') : ''}</span></td>
            </tr>`).join('');
}

async function salvarControleOrcamento() {
    const podeAlterar = (typeof ehAdministrador !== 'undefined' && ehAdministrador) ||
                        (typeof ehProprietario !== 'undefined' && ehProprietario) ||
                        (typeof usuarioPodeAlterarTela === 'function' && usuarioPodeAlterarTela('controle_orcamento'));
    if (!podeAlterar) return alert('Você não tem permissão para alterar o modo de controle orçamentário.');

    const sel = document.getElementById('controleOrcamentoModo');
    const novoModo = sel ? sel.value : '';
    if (!['AF', 'AREA', 'PRODUTO'].includes(novoModo)) return alert('Selecione um modo válido.');

    const vigencia = _coPrimeiroDiaMesAtualISO(); // sempre o 1º dia do mês corrente
    const modoAnterior = modoControleOrcamentoAtivo();
    if (novoModo === modoAnterior && configControleOrcamentoCache) {
        return alert('O modo selecionado já é o vigente — nada a salvar.');
    }
    if (!confirm(`Confirmar: o controle orçamentário do trade-off passa a ser por "${CONTROLE_ORCAMENTO_LABEL[novoModo]}" a partir de ${new Date(vigencia + 'T00:00:00').toLocaleDateString('pt-BR')}?\n\nIsto muda quais projetos ficam elegíveis no trade-off da Demanda Extraordinária. Não afeta o seletor de agrupamento do Dashboard/Financeiro, nem trade-offs já aprovados.`)) return;

    const payload = {
        modo: novoModo,
        vigencia_de: vigencia,
        modo_anterior: configControleOrcamentoCache ? modoAnterior : null,
        alterado_por: (typeof currentUser !== 'undefined' && currentUser) ? currentUser.nome : 'desconhecido',
        alterado_em: new Date().toISOString()
    };
    const { error } = await _supabase.from('config_controle_orcamento').insert([payload]);
    if (error) return alert('Erro ao salvar o modo de controle orçamentário: ' + error.message);

    alert('✅ Modo de controle orçamentário salvo.');
    await carregarConfigControleOrcamento();
    await renderControleOrcamentoView();
}
