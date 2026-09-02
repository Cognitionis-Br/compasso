// =========================================================================
// conclusao/conclusao-projeto.js
// Item 1: Conclusão de Projeto — baixa definitiva do projeto/subprojeto
// depois do Go-Live concluído. Diferente da conclusão de cada etapa (que
// já existe em projeto_etapas) — isso é o encerramento do projeto
// inteiro, feito manualmente.
// =========================================================================

let conclusaoProjetoCodigoAtual = null;
let conclusaoProjetoDataCache = [];

async function renderConclusaoProjetoView() {
    const tbody = document.getElementById('conclusaoProjetoTableBody');
    if (!tbody) return;

    const etapaGolive = obterEtapaPorNome('EXECUTAR (GO-LIVE)');
    if (!etapaGolive) {
        tbody.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-gray-400 font-bold">Etapa de Go-Live não configurada.</td></tr>`;
        return;
    }

    const { data, error } = await _supabase.from('projeto_etapas').select('*').eq('etapa_id', etapaGolive.id).eq('situacao', 'EXECUCAO_CONCLUIDO');
    const golivesConcluidos = error ? [] : (data || []);
    conclusaoProjetoDataCache = golivesConcluidos;

    const codigosElegiveis = golivesConcluidos.map(e => e.projeto_codigo);
    // NOVO (Controle de acesso por atividade, Fase 5): restrição de área.
    const elegiveis = filtrarProjetosPorArea(projectsData
        .filter(p => codigosElegiveis.includes(p.codigo) && p.projeto_concluido !== true)
        .sort((a, b) => a.codigo.localeCompare(b.codigo)), 'conclusao_projeto');

    if (elegiveis.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-gray-400 font-bold">Nenhum projeto com Go-Live concluído aguardando baixa final.</td></tr>`;
        return;
    }

    tbody.innerHTML = elegiveis.map(p => {
        const pe = golivesConcluidos.find(e => e.projeto_codigo === p.codigo);
        return `
            <tr>
                <td class="p-3 font-mono font-bold text-emerald-700">${p.codigo}</td>
                <td class="p-3 font-semibold">${escapeHtml(p.nome)}</td>
                <td class="p-3 text-xs">${p.area || '-'}</td>
                <td class="p-3 text-xs">${p.is_subprojeto ? `<span class="bg-cyan-100 text-cyan-800 font-bold px-1.5 py-0.5 rounded">Subprojeto de ${p.projeto_pai_codigo}</span>` : '<span class="text-gray-500">Projeto</span>'}</td>
                <td class="p-3 text-xs">${pe && pe.concluido_em ? pe.concluido_em.split('T')[0] : '-'}</td>
                <td class="p-3 text-center">
                    <button onclick="abrirModalConcluirProjeto('${p.codigo}')" class="bg-green-600 hover:bg-green-700 text-white font-bold text-xs px-3 py-1.5 rounded shadow">
                        <i class="fa-solid fa-flag-checkered"></i> Concluir Projeto
                    </button>
                    ${typeof renderBotoesGoliveOcorrenciasTermo === 'function' ? renderBotoesGoliveOcorrenciasTermo(p.codigo) : ''}
                </td>
            </tr>
        `;
    }).join('');
}

// NOVO (a pedido do usuário 25/08/2026): junta os motivos que travam a
// conclusão de um projeto — hoje só verificava subprojetos pendentes;
// passa a checar também Ocorrências de Go-Live ainda não resolvidas e a
// ausência do Termo de Aceite. Reaproveitado tanto ao abrir o modal
// (mensagem pro usuário) quanto na confirmação (defesa em profundidade).
async function obterPendenciasConclusaoProjeto(codigo) {
    const p = projectsData.find(x => x.codigo === codigo);
    const motivos = [];

    if (p && !p.is_subprojeto) {
        const subprojetos = projectsData.filter(sp => sp.projeto_pai_codigo === codigo);
        const pendentes = subprojetos.filter(sp => sp.projeto_concluido !== true);
        if (pendentes.length > 0) {
            motivos.push(`<b>${subprojetos.length} subprojeto(s), ${pendentes.length} ainda não concluído(s):</b><ul class="list-disc pl-4 mt-1">` +
                pendentes.map(sp => `<li>${sp.codigo} - ${escapeHtml(sp.nome)} (fase atual: ${sp.etapa_atual || '-'})</li>`).join('') +
                `</ul>`);
        }
    }

    // G-Ocorrências: qualquer ocorrência de Go-Live ainda não RESOLVIDA
    // trava a conclusão — projeto passou por Go-Live pra chegar até aqui
    // (é a própria elegibilidade desta tela), não precisa checar de novo.
    const ocorrenciasAbertas = await obterOcorrenciasAbertas(codigo);
    if (ocorrenciasAbertas.length > 0) {
        motivos.push(`<b>${ocorrenciasAbertas.length} Ocorrência(s) de Go-Live ainda não resolvida(s):</b><ul class="list-disc pl-4 mt-1">` +
            ocorrenciasAbertas.map(o => `<li>${(o.descricao_ocorrencia || '').slice(0, 80)}${(o.descricao_ocorrencia || '').length > 80 ? '…' : ''} — <i>${GOLIVE_OCORRENCIA_STATUS_LABEL[o.status] || o.status}</i></li>`).join('') +
            `</ul>`);
    }

    // Termo de Aceite: precisa existir um registro pra este projeto.
    const { data: termoData } = await _supabase.from('golive_termo_aceite').select('projeto_codigo').eq('projeto_codigo', codigo).maybeSingle();
    if (!termoData) {
        motivos.push(`<b>Termo de Aceite do Go-Live ainda não registrado.</b>`);
    }

    return motivos;
}

async function abrirModalConcluirProjeto(codigo) {
    const p = projectsData.find(x => x.codigo === codigo);
    if (!p) return;

    conclusaoProjetoCodigoAtual = codigo;
    document.getElementById('conclusaoProjetoNomeDisplay').innerText = `${p.codigo} - ${p.nome}`;
    document.getElementById('conclusaoProjetoAreaDisplay').innerText = `Área Solicitante: ${p.area || '-'} · Pessoa Solicitante: ${p.pessoa_solicitante || '-'}`;
    document.getElementById('conclusaoProjetoData').value = new Date().toISOString().split('T')[0];
    document.getElementById('conclusaoProjetoObservacao').value = '';

    const avisoEl = document.getElementById('conclusaoProjetoAvisoSubprojetos');
    const btnConfirmar = document.getElementById('conclusaoProjetoBtnConfirmar');
    const motivos = await obterPendenciasConclusaoProjeto(codigo);
    if (motivos.length > 0) {
        avisoEl.innerHTML = `⛔ <b>Não é possível concluir este projeto ainda:</b><div class="mt-1 space-y-2">${motivos.map(m => `<div>${m}</div>`).join('')}</div>`;
        avisoEl.classList.remove('hidden');
        btnConfirmar.disabled = true;
        btnConfirmar.className = 'px-4 py-2 bg-gray-300 text-gray-500 rounded text-xs font-bold cursor-not-allowed';
    } else {
        avisoEl.classList.add('hidden');
        btnConfirmar.disabled = false;
        btnConfirmar.className = 'px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded text-xs font-bold transition';
    }

    document.getElementById('modalConclusaoProjeto').classList.remove('hidden');
}

function fecharModalConclusaoProjeto() {
    document.getElementById('modalConclusaoProjeto').classList.add('hidden');
    conclusaoProjetoCodigoAtual = null;
}

async function confirmarConclusaoProjeto() {
    if (!conclusaoProjetoCodigoAtual) return;
    const p = projectsData.find(x => x.codigo === conclusaoProjetoCodigoAtual);
    if (!p) return;

    // Checagem de novo aqui (defesa em profundidade — o botão já vem
    // desabilitado nesse caso, mas confere de novo antes de gravar).
    const motivosConfirmar = await obterPendenciasConclusaoProjeto(p.codigo);
    if (motivosConfirmar.length > 0) {
        return alert('⛔ Ainda há pendências que impedem a conclusão deste projeto — feche o modal e confira o aviso na tela.');
    }

    const data = document.getElementById('conclusaoProjetoData').value;
    const observacao = document.getElementById('conclusaoProjetoObservacao').value.trim();
    if (!data || !observacao) {
        return alert('Preencha a data de conclusão e a observação!');
    }

    const payload = {
        projeto_concluido: true,
        // CORRIGIDO 02/09/2026 (bug reportado): a baixa final também
        // encerra a fase — sem isso o projeto ficava com etapa_atual
        // 'GOLIVE' e sub_status 'PENDENTE TERMO DE ACEITE' mesmo já
        // concluído (o auto-avanço não roda mais nesse ponto, ver
        // js/phases/generic-workflow-ui.js).
        etapa_atual: 'CONCLUIDO',
        sub_status: 'CONCLUIDO',
        data_conclusao_final: data,
        observacao_conclusao_final: observacao,
        concluido_final_por: currentUser ? currentUser.nome : 'desconhecido'
    };

    const { error } = await _supabase.from('projetos').update(payload).eq('codigo', p.codigo);
    if (error) return alert('Erro ao concluir o projeto: ' + error.message);

    Object.assign(p, payload);

    alert(`✅ ${p.codigo} concluído com sucesso!`);
    fecharModalConclusaoProjeto();
    await renderConclusaoProjetoView();
}
