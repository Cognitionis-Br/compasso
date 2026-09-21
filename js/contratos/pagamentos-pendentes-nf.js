// =========================================================================
// contratos/pagamentos-pendentes-nf.js
// NOVO (a pedido do usuário 2026-09-16, dúvida: "não estou localizando como
// são cobrados os contratos que não receberam a nota fiscal"): tela
// dedicada, mesma base de dados de Pendências de Contratos
// (contratos_pendencias/pendencias.js), filtrada pra pagamentos com NF
// ainda não recebida — com o alerta visual de mais de
// PEND_NF_ATRASO_DIAS_UTEIS dias úteis (mesma regra de
// _pendEmAtrasoNf/pendencias.js) e um botão de envio MANUAL da cobrança.
//
// O disparo automático já existente (_pendEscalonarNfAtrasadas,
// pendencias.js) continua valendo — roda sozinho toda vez que alguém abre
// Pendências de Contratos, mas só avisa 1 vez por pendência
// (escalado_nf_em). Esta tela complementa: reenviar quando quiser, sem
// precisar esperar passar de novo pela tela de Pendências.
// =========================================================================

const PAGNF_TIPO_ALVO = 'PAGAMENTO';

// Permissão própria (não reaproveita _pendPodeVer/contratos_pendencias:consultar
// — precisa da SUA PRÓPRIA activity_key, pagamentos_pendentes_nf:consultar,
// senão o menu mostraria o link pra quem tem essa key mas o conteúdo
// travaria por checar uma key diferente, ou vice-versa).
function _pagNfPodeVer() {
    return (typeof ehAdministrador !== 'undefined' && ehAdministrador) ||
           (typeof ehProprietario !== 'undefined' && ehProprietario) ||
           (typeof usuarioTemAtividade === 'function' && usuarioTemAtividade('pagamentos_pendentes_nf:consultar'));
}
function _pagNfPodeEnviar() {
    return (typeof _pendPodeAprovar === 'function') && _pendPodeAprovar();
}

function _pagNfLista() {
    return (pendenciasContratosCache || []).filter(p =>
        p.tipo === PAGNF_TIPO_ALVO && p.status === 'PENDENTE' && p.nf_status === 'NAO_RECEBIDA'
    );
}

async function renderPagamentosPendentesNfView() {
    const restrito = document.getElementById('pagNfRestrito');
    const conteudo = document.getElementById('pagNfConteudo');
    const podeVer = _pagNfPodeVer();
    if (restrito) restrito.classList.toggle('hidden', podeVer);
    if (conteudo) conteudo.classList.toggle('hidden', !podeVer);
    if (!podeVer) return;

    // Reaproveita as caches já carregadas por Pendências de Contratos — se
    // o usuário entrou direto aqui (nunca abriu Pendências nesta sessão),
    // carrega agora.
    if (!pendenciasContratosCache || pendenciasContratosCache.length === 0 ||
        !contratosProjetoCache || !contratosProjetoCache.length ||
        !empresasTerceirizadasCache || !empresasTerceirizadasCache.length) {
        const [{ data: pend }, { data: contr }, { data: emp }] = await Promise.all([
            _supabase.from('contratos_pendencias').select('*').order('criado_em', { ascending: false }),
            _supabase.from('contratos_projeto').select('*'),
            _supabase.from('empresas_terceirizadas').select('*')
        ]);
        pendenciasContratosCache = pend || [];
        contratosProjetoCache = contr || contratosProjetoCache || [];
        empresasTerceirizadasCache = emp || empresasTerceirizadasCache || [];
    }

    _pagNfRenderTabela();
}

function _pagNfRenderTabela() {
    const tbody = document.getElementById('pagNfTableBody');
    if (!tbody) return;
    const lista = _pagNfLista();

    const resumo = document.getElementById('pagNfResumo');
    if (resumo) {
        const emAtraso = lista.filter(_pendEmAtrasoNf).length;
        resumo.innerHTML = `${lista.length} pagamento(s) aguardando NF` +
            (emAtraso > 0 ? ` · <span class="text-danger-700 font-bold">${emAtraso} há mais de ${PEND_NF_ATRASO_DIAS_UTEIS} dias úteis</span>` : '');
    }

    if (lista.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="p-4 text-center text-gray-400 font-bold">Nenhum pagamento aguardando Nota Fiscal</td></tr>`;
        return;
    }

    const podeEnviar = _pagNfPodeEnviar();
    tbody.innerHTML = [...lista]
        .sort((a, b) => (a.criado_em || '').localeCompare(b.criado_em || ''))
        .map(p => {
            const contrato = (contratosProjetoCache || []).find(c => c.id === p.contrato_id);
            const empresa = contrato ? (empresasTerceirizadasCache || []).find(e => e.codigo === contrato.empresa_codigo) : null;
            const nomeFornecedor = empresa ? empresa.nome : (p.fornecedor || '—');
            const semEmailFornecedor = !empresa || !empresa.email;
            const atraso = _pendEmAtrasoNf(p);
            const dias = _pendDiasUteisDesde(p.criado_em);
            const projetoTexto = p.projeto_codigo || p.projeto_ref || 'Rateio entre vários projetos';
            return `
            <tr class="${atraso ? 'bg-danger-50' : ''}">
                <td class="p-2 text-[10px] text-gray-500 whitespace-nowrap">${(p.criado_em || '').replace('T', ' ').split('.')[0]}</td>
                <td class="p-2 text-xs">${escapeHtml(contrato ? contrato.numero_contrato : (p.contrato_ref || '—'))}</td>
                <td class="p-2 text-xs">${escapeHtml(nomeFornecedor)}${semEmailFornecedor ? '<br><span class="text-[9px] text-amber-700 font-bold">sem e-mail cadastrado</span>' : ''}</td>
                <td class="p-2 text-xs">${escapeHtml(projetoTexto)}</td>
                <td class="p-2 text-right font-mono text-xs">${formatCurrency(p.valor)}</td>
                <td class="p-2 text-center text-xs font-bold ${atraso ? 'text-danger-700' : 'text-gray-600'}">${dias}${atraso ? ' <i class="fa-solid fa-triangle-exclamation"></i>' : ''}</td>
                <td class="p-2 text-center">
                    ${p.escalado_nf_em ? `<span class="text-[9px] text-gray-400" title="Última cobrança enviada em ${p.escalado_nf_em.split('T')[0]}"><i class="fa-solid fa-envelope-circle-check"></i> avisado</span>` : '<span class="text-[9px] text-gray-300">—</span>'}
                </td>
                <td class="p-2 text-center whitespace-nowrap">
                    <button onclick="abrirDetalhePendencia(${p.id})" class="text-indigo-600 hover:text-indigo-800 font-bold text-[10px] uppercase mr-2">Detalhar</button>
                    ${podeEnviar ? `<button onclick="enviarCobrancaNf(${p.id})" class="bg-amber-600 hover:bg-amber-700 text-white font-bold text-[10px] px-2 py-1 rounded shadow"><i class="fa-solid fa-paper-plane"></i> Cobrar</button>` : ''}
                </td>
            </tr>`;
        }).join('');
}

// Disparo MANUAL da mesma cobrança que o automático de Pendências de
// Contratos (_pendEscalonarNfAtrasadas, pendencias.js) dispara sozinho na
// 1ª vez que uma pendência passa de 5 dias úteis — aqui o Gestor de
// Contratos decide reenviar quando quiser, mesmo já tendo sido avisado
// antes ou ainda dentro do prazo. CORRIGIDO (a pedido do usuário
// 2026-09-16): vai direto pro e-mail cadastrado do FORNECEDOR
// (empresas_terceirizadas.email via _pendEnviarCobrancaNfFornecedor,
// pendencias.js) — não depende mais de nenhuma configuração em Envio de
// E-mail > Gestão do Fluxo.
async function enviarCobrancaNf(id) {
    if (!_pagNfPodeEnviar()) return alert('Você não tem permissão para enviar cobrança de NF.');
    const p = (pendenciasContratosCache || []).find(x => x.id === id);
    if (!p) return;

    const contrato = (contratosProjetoCache || []).find(c => c.id === p.contrato_id);
    const forn = contrato ? (empresasTerceirizadasCache || []).find(e => e.codigo === contrato.empresa_codigo) : null;
    const dias = _pendDiasUteisDesde(p.criado_em);

    if (!forn || !forn.email) {
        return alert('⛔ O fornecedor deste contrato não tem e-mail cadastrado. Cadastre em Contratos e Fornecedores > Fornecedores antes de enviar a cobrança.');
    }

    if (!confirm(`Confirma o envio da cobrança de NF para ${forn.nome} (${forn.email}), pendência #${id} (${contrato ? contrato.numero_contrato : (p.contrato_ref || '-')})?`)) return;

    const resultado = await _pendEnviarCobrancaNfFornecedor(p, contrato, forn, dias);
    if (resultado.erro) return alert('⛔ ' + resultado.erro);

    await _supabase.from('contratos_pendencias').update({ escalado_nf_em: new Date().toISOString() }).eq('id', id);
    p.escalado_nf_em = new Date().toISOString();
    await _logPendencia(id, 'ESCALONAMENTO_NF_MANUAL', { dias_uteis: dias, destinatario: forn.email, enviado_por: currentUser ? currentUser.nome : 'desconhecido' });

    alert(`✅ Cobrança de NF enviada para ${forn.email}.`);
    _pagNfRenderTabela();
}
