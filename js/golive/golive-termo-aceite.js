// =========================================================================
// golive/golive-termo-aceite.js
// NOVO (a pedido do usuário 25/08/2026): Termo de Aceite do Go-Live — um
// registro por projeto (upsert por projeto_codigo). Editável até o
// projeto ser dado como concluído de verdade (projetos.projeto_concluido
// = true) — depois disso, o modal abre só pra consulta.
// =========================================================================

let termoAceiteCodigoAtual = null;

async function abrirModalGoliveTermoAceite(codigo) {
    const p = projectsData.find(x => x.codigo === codigo);
    if (!p) return;

    termoAceiteCodigoAtual = codigo;
    document.getElementById('termoAceiteNomeDisplay').innerText = `${p.codigo} - ${p.nome}`;

    const { data, error } = await _supabase.from('golive_termo_aceite').select('*').eq('projeto_codigo', codigo).maybeSingle();
    const termo = error ? null : data;

    document.getElementById('termoAceitePor').value = termo ? (termo.aceito_por || '') : '';
    document.getElementById('termoAceiteData').value = termo ? (termo.data_aceite || '') : new Date().toISOString().split('T')[0];
    document.getElementById('termoAceiteRessalvas').value = termo ? (termo.ressalvas || '') : '';
    document.getElementById('termoAceiteObservacoes').value = termo ? (termo.observacoes || '') : '';

    // NOVO (a pedido do usuário 25/08/2026 — bug reportado): não pode
    // aceitar o Termo enquanto houver Ocorrência de Erro ainda não
    // resolvida (ABERTA ou EM_SOLUCAO) — mesmo bloqueio de campos/botão
    // já usado pra projeto concluído, só que com aviso próprio.
    const ocorrenciasAbertas = await obterOcorrenciasAbertas(codigo);
    const projetoConcluido = p.projeto_concluido === true;
    const bloqueado = projetoConcluido || ocorrenciasAbertas.length > 0;

    const aviso = document.getElementById('termoAceiteAvisoConcluido');
    const avisoOcorrencias = document.getElementById('termoAceiteAvisoOcorrencias');
    const btnSalvar = document.getElementById('termoAceiteBtnSalvar');
    if (aviso) aviso.classList.toggle('hidden', !projetoConcluido);
    if (avisoOcorrencias) {
        if (!projetoConcluido && ocorrenciasAbertas.length > 0) {
            avisoOcorrencias.innerHTML = `⛔ <b>${ocorrenciasAbertas.length} Ocorrência(s) de Erro ainda não resolvida(s)</b> — resolva todas antes de aceitar o Termo.<ul class="list-disc pl-4 mt-1">` +
                ocorrenciasAbertas.map(o => `<li>${escapeHtml((o.descricao_ocorrencia || '').slice(0, 80))}${(o.descricao_ocorrencia || '').length > 80 ? '…' : ''} — <i>${GOLIVE_OCORRENCIA_STATUS_LABEL[o.status] || o.status}</i></li>`).join('') +
                `</ul>`;
            avisoOcorrencias.classList.remove('hidden');
        } else {
            avisoOcorrencias.classList.add('hidden');
        }
    }
    if (btnSalvar) btnSalvar.classList.toggle('hidden', bloqueado);
    ['termoAceitePor', 'termoAceiteData', 'termoAceiteRessalvas', 'termoAceiteObservacoes'].forEach(id => {
        document.getElementById(id).disabled = bloqueado;
    });

    document.getElementById('modalGoliveTermoAceite').classList.remove('hidden');
}

function fecharModalGoliveTermoAceite() {
    document.getElementById('modalGoliveTermoAceite').classList.add('hidden');
    termoAceiteCodigoAtual = null;
}

async function salvarGoliveTermoAceite() {
    const p = projectsData.find(x => x.codigo === termoAceiteCodigoAtual);
    if (p && p.projeto_concluido === true) {
        return alert('⛔ Projeto já concluído — o termo de aceite não pode mais ser editado.');
    }

    // Reconfere aqui (defesa em profundidade — o botão já vem escondido
    // nesse caso, mas confere de novo antes de gravar).
    const ocorrenciasAbertas = await obterOcorrenciasAbertas(termoAceiteCodigoAtual);
    if (ocorrenciasAbertas.length > 0) {
        return alert(`⛔ Ainda há ${ocorrenciasAbertas.length} Ocorrência(s) de Erro não resolvida(s) — não é possível aceitar o Termo agora.`);
    }

    const aceitoPor = document.getElementById('termoAceitePor').value.trim();
    const dataAceite = document.getElementById('termoAceiteData').value;
    const ressalvas = document.getElementById('termoAceiteRessalvas').value.trim();
    const observacoes = document.getElementById('termoAceiteObservacoes').value.trim();

    if (!aceitoPor || !dataAceite) {
        return alert('Preencha quem aceitou e a data do aceite!');
    }

    const { error } = await _supabase.from('golive_termo_aceite').upsert({
        projeto_codigo: termoAceiteCodigoAtual,
        aceito_por: aceitoPor,
        data_aceite: dataAceite,
        ressalvas: ressalvas || null,
        observacoes: observacoes || null,
        atualizado_em: new Date().toISOString()
    }, { onConflict: 'projeto_codigo' });
    if (error) return alert('Erro ao salvar o termo de aceite: ' + error.message);

    alert('✅ Termo de Aceite salvo!');
    fecharModalGoliveTermoAceite();
}

// NOVO (a pedido do usuário 25/08/2026): tela própria "Termo de Aceite" —
// lista os projetos em andamento no Go-Live com a situação da evolução e
// a contagem de ocorrências abertas/fechadas, pra decidir se já dá pra
// abrir o termo (o próprio modal trava se ainda houver ocorrência
// aberta — ver abrirModalGoliveTermoAceite acima). Reaproveita
// obterProjetosEmAndamentoGolive (js/golive/golive-ocorrencias.js).
async function renderListaGoliveTermoAceite(tbodyId) {
    const tbody = document.getElementById(tbodyId);
    if (!tbody) return;

    const lista = await obterProjetosEmAndamentoGolive();

    const linhas = await Promise.all(lista.map(async ({ projeto: p, etapa: pe }) => {
        const { data: todasOcorrencias } = await _supabase.from('golive_ocorrencias').select('status').eq('projeto_codigo', p.codigo);
        const ocorrencias = todasOcorrencias || [];
        const qtdFechadas = ocorrencias.filter(o => o.status === 'RESOLVIDA').length;
        const qtdAbertas = ocorrencias.length - qtdFechadas;
        const situacao = pe && pe.situacao === 'EXECUCAO_CONCLUIDO' ? 'Concluído (100%)' : `Em andamento (${pe ? (pe.percentual_evolucao || 0) : 0}%)`;

        return `
            <tr>
                <td class="p-3 font-mono font-bold text-cyan-700">${p.codigo}</td>
                <td class="p-3 font-semibold">${escapeHtml(p.nome)}</td>
                <td class="p-3 text-xs">${situacao}</td>
                <td class="p-3 text-center text-xs ${qtdAbertas > 0 ? 'text-red-600 font-bold' : 'text-gray-500'}">${qtdAbertas}</td>
                <td class="p-3 text-center text-xs text-gray-500">${qtdFechadas}</td>
                <td class="p-3 text-center">
                    <button onclick="abrirModalGoliveTermoAceite('${escapeJsAttr(p.codigo)}')" class="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-3 py-1.5 rounded shadow"><i class="fa-solid fa-file-signature"></i> Abrir Termo</button>
                </td>
            </tr>
        `;
    }));

    tbody.innerHTML = linhas.length === 0
        ? `<tr><td colspan="6" class="p-4 text-center text-gray-400 font-bold">Nenhum projeto apto ao Termo de Aceite</td></tr>`
        : linhas.join('');
}
