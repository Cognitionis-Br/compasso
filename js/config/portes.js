// =========================================================================
// config/portes.js
// Cadastro de Porte (G25, lista de ajustes do usuário 10/08/2026):
// substitui o porte fixo (P/M/G/GG) por faixas cadastráveis.
//
// AJUSTADO (a pedido do usuário 24/08/2026): as faixas passaram de VALOR
// de orçamento para QUANTIDADE DE HORAS do projeto — o porte não tem
// mais nenhum vínculo com o valor orçado (ver obterPortePorHoras em
// js/core/workflow-engine.js). As colunas valor_minimo/valor_maximo
// continuam existindo na tabela `portes` (histórico, não apagadas), só
// deixaram de ser lidas/validadas por qualquer tela.
// Regras de consistência (inalteradas, agora sobre horas):
// - Código com até 2 letras, descrição, horas mínimo/máximo.
// - Se o porte já estiver em uso por algum projeto, mínimo/máximo ficam
//   travados (só descrição é editável).
// - Uma faixa não pode se sobrepor à de outro porte (bloqueia o save).
// - Depois de cada save, avisa (sem bloquear) se a cobertura ficou com
//   buraco — esperado ficar temporariamente incompleta no meio de uma
//   reestruturação de faixas.
// =========================================================================

const HORAS_MINIMO_RANGE_TOTAL = 0;

// AJUSTADO (padronização de telas, a pedido do usuário): 2 abas — Cadastrar
// Porte / Portes Cadastrados — mesmo padrão de mudarAbaCargos.
function mudarAbaPortes(aba) {
    ['criar', 'cadastrados'].forEach(a => {
        const btn = document.getElementById(`portesBtn-${a}`);
        const painel = document.getElementById(`portesPainel-${a}`);
        if (btn) btn.className = `portes-btn px-4 py-2 rounded-md text-sm font-bold border-2 ${a === aba ? 'bg-red-700 text-white border-red-700' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`;
        if (painel) painel.classList.toggle('hidden', a !== aba);
    });
    aplicarVisibilidadeSubAbas('portes', 'portesBtn');
}

async function loadPortes() {
    const { data, error } = await _supabase.from('portes').select('*').order('horas_minimo');
    portesData = error ? [] : (data || []);
    renderPortesTable();
}

function renderPortesTable() {
    const tbody = document.getElementById('tablePortesBody');
    if (!tbody) return;

    if (portesData.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-gray-400 font-bold">Nenhum porte cadastrado</td></tr>`;
        return;
    }

    tbody.innerHTML = portesData.map(p => `
        <tr>
            <td class="p-3 font-mono font-bold text-indigo-700">${p.codigo}</td>
            <td class="p-3">${escapeHtml(p.descricao)}</td>
            <td class="p-3 text-right font-mono">${p.horas_minimo != null ? Number(p.horas_minimo).toLocaleString('pt-BR') + 'h' : '-'}</td>
            <td class="p-3 text-right font-mono">${p.horas_maximo != null ? Number(p.horas_maximo).toLocaleString('pt-BR') + 'h' : '-'}</td>
            <td class="p-3 text-right">
                <button onclick="editPorte(${p.id})" class="text-indigo-600 hover:text-indigo-800 text-xs font-bold"><i class="fa-solid fa-pen-to-square"></i> Editar</button>
            </td>
        </tr>
    `).join('');

    renderAvisoCoberturaPorte();
}

async function editPorte(id) {
    const porte = portesData.find(p => p.id === id);
    if (!porte) return;

    mudarAbaPortes('criar');

    const emUso = await porteEstaEmUso(porte.codigo);

    document.getElementById('porteIdInput').value = porte.id;
    document.getElementById('porteCodigoInput').value = porte.codigo;
    document.getElementById('porteCodigoInput').disabled = true; // código nunca muda depois de criado
    document.getElementById('porteDescricaoInput').value = porte.descricao;
    document.getElementById('porteHorasMinimoInput').value = porte.horas_minimo;
    document.getElementById('porteHorasMaximoInput').value = porte.horas_maximo;
    document.getElementById('porteHorasMinimoInput').disabled = emUso;
    document.getElementById('porteHorasMaximoInput').disabled = emUso;

    const aviso = document.getElementById('porteEmUsoAviso');
    if (aviso) aviso.classList.toggle('hidden', !emUso);

    document.getElementById('btnSalvarPorte').innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Atualizar Porte';
    document.getElementById('porteDescricaoInput').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function limparFormularioPorte() {
    document.getElementById('porteIdInput').value = '';
    document.getElementById('porteCodigoInput').value = '';
    document.getElementById('porteCodigoInput').disabled = false;
    document.getElementById('porteDescricaoInput').value = '';
    document.getElementById('porteHorasMinimoInput').value = '';
    document.getElementById('porteHorasMinimoInput').disabled = false;
    document.getElementById('porteHorasMaximoInput').value = '';
    document.getElementById('porteHorasMaximoInput').disabled = false;
    document.getElementById('btnSalvarPorte').innerHTML = '<i class="fa-solid fa-plus"></i> Salvar Porte';
    const aviso = document.getElementById('porteEmUsoAviso');
    if (aviso) aviso.classList.add('hidden');
}

async function porteEstaEmUso(codigo) {
    const { count, error } = await _supabase.from('projetos').select('codigo', { count: 'exact', head: true }).eq('tamanho', codigo);
    if (error) return false; // se a checagem falhar, não bloqueia — só não trava a edição por segurança
    return (count || 0) > 0;
}

async function savePorte(e) {
    e.preventDefault();
    const id = document.getElementById('porteIdInput').value;
    const codigo = document.getElementById('porteCodigoInput').value.trim().toUpperCase();
    const descricao = document.getElementById('porteDescricaoInput').value.trim();
    const horas_minimo = parseFloat(document.getElementById('porteHorasMinimoInput').value);
    const horas_maximo = parseFloat(document.getElementById('porteHorasMaximoInput').value);

    if (!codigo || codigo.length > 2) {
        return alert('Código do porte é obrigatório e deve ter no máximo 2 letras!');
    }
    if (!descricao) {
        return alert('Informe a descrição do porte!');
    }
    if (isNaN(horas_minimo) || isNaN(horas_maximo) || horas_maximo <= horas_minimo) {
        return alert('Horas máximo precisa ser maior que horas mínimo!');
    }

    // Bloqueia sobreposição com QUALQUER outro porte (não o próprio, se
    // estiver editando) — uma faixa nunca pode invadir a de outro.
    const sobrepoe = portesData.some(p => {
        if (id && p.id === Number(id)) return false;
        if (p.horas_minimo == null || p.horas_maximo == null) return false;
        return horas_minimo <= p.horas_maximo && horas_maximo >= p.horas_minimo;
    });
    if (sobrepoe) {
        const conflitante = portesData.find(p => (!id || p.id !== Number(id)) && p.horas_minimo != null && p.horas_maximo != null && horas_minimo <= p.horas_maximo && horas_maximo >= p.horas_minimo);
        return alert(`⛔ Essa faixa de horas se sobrepõe ao porte "${conflitante.codigo}" (${Number(conflitante.horas_minimo).toLocaleString('pt-BR')}h – ${Number(conflitante.horas_maximo).toLocaleString('pt-BR')}h).\n\nAjuste o máximo/mínimo de um dos dois antes de salvar (ex.: reduza o máximo deste porte para ficar menor que o mínimo do outro).`);
    }

    const payload = { descricao, horas_minimo, horas_maximo };

    if (id) {
        const { error } = await _supabase.from('portes').update(payload).eq('id', Number(id));
        if (error) return alert('Erro ao atualizar porte: ' + error.message);
        alert('✅ Porte atualizado!');
    } else {
        const { error } = await _supabase.from('portes').insert([{ codigo, ...payload }]);
        if (error) return alert('Erro ao cadastrar porte: ' + error.message);
        alert('✅ Porte cadastrado!');
    }

    limparFormularioPorte();
    await loadPortes();
    mudarAbaPortes('cadastrados');
}

// Avisa (sem bloquear) se a cobertura de horas tem buraco — esperado
// ficar temporariamente incompleta durante uma reestruturação. Sem teto
// fixo (diferente da versão antiga por valor, que tinha um limite de R$
// 999.999.999,99): só confere buraco entre faixas consecutivas e se a
// primeira faixa começa em 0. Ignora portes que ainda não tiveram as
// horas preenchidas (migração recém-aplicada).
function renderAvisoCoberturaPorte() {
    const container = document.getElementById('porteCoberturaAviso');
    if (!container) return;

    const comHoras = portesData.filter(p => p.horas_minimo != null && p.horas_maximo != null);
    const semHoras = portesData.filter(p => p.horas_minimo == null || p.horas_maximo == null);
    const ordenados = [...comHoras].sort((a, b) => a.horas_minimo - b.horas_minimo);
    const problemas = [];

    if (semHoras.length > 0) {
        problemas.push(`${semHoras.length} porte(s) ainda sem faixa de horas definida: ${semHoras.map(p => p.codigo).join(', ')}.`);
    }

    if (ordenados.length > 0) {
        if (Number(ordenados[0].horas_minimo) !== HORAS_MINIMO_RANGE_TOTAL) {
            problemas.push(`Falta cobertura entre 0h e ${Number(ordenados[0].horas_minimo).toLocaleString('pt-BR')}h.`);
        }
        for (let i = 0; i < ordenados.length - 1; i++) {
            const fimAtual = Number(ordenados[i].horas_maximo);
            const inicioProximo = Number(ordenados[i + 1].horas_minimo);
            // CORRIGIDO (bug reportado 24/08/2026): exigia uma diferença
            // EXATA de 0,5h entre faixas (herdado do step do input) — mas
            // nada obriga o usuário a cadastrar faixas de meia em meia
            // hora; faixas em horas inteiras (ex.: até 100h / a partir de
            // 101h, diferença de 1h) são igualmente "adjacentes", sem
            // buraco de verdade. Aceita qualquer diferença de até 1h como
            // adjacência válida — só acusa buraco quando sobra mais que
            // isso entre uma faixa e a próxima.
            if (inicioProximo - fimAtual > 1.001) {
                problemas.push(`Buraco entre "${ordenados[i].codigo}" (até ${fimAtual.toLocaleString('pt-BR')}h) e "${ordenados[i+1].codigo}" (a partir de ${inicioProximo.toLocaleString('pt-BR')}h).`);
            }
        }
    }

    if (problemas.length === 0 && portesData.length > 0) {
        container.innerHTML = `<div class="bg-green-50 border border-green-200 text-green-800 text-xs font-bold p-3 rounded mt-4"><i class="fa-solid fa-circle-check"></i> Cobertura completa: as faixas de horas cobrem de 0h em diante, sem sobreposição nem buraco.</div>`;
    } else if (problemas.length > 0) {
        container.innerHTML = `<div class="bg-amber-50 border border-amber-300 text-amber-800 text-xs font-bold p-3 rounded mt-4"><i class="fa-solid fa-triangle-exclamation"></i> Cobertura incompleta:<ul class="list-disc pl-5 mt-1 font-normal">${problemas.map(p => `<li>${p}</li>`).join('')}</ul></div>`;
    } else {
        container.innerHTML = '';
    }
}
