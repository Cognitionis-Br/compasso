// =========================================================================
// config/responsaveis.js
// Responsáveis por Atividade — atribui etapas do workflow a Usuários já
// cadastrados (perfis_usuarios). Fundação para a Especificação_Workflow_v2.md,
// seção 6.
//
// A lista de atividades/etapas é fixa por enquanto (ETAPAS_WORKFLOW),
// espelhando a tabela de fases/etapas da especificação. Quando o motor de
// workflow genérico (fases_etapas parametrizável) for implementado, esta
// lista passa a vir do banco em vez de hardcoded aqui.
//
// AJUSTADO (a pedido do usuário 26/08/2026 — padronização de telas/menus,
// Fase 6): deixou de ser um cadastro próprio de nome/e-mail digitados
// livremente (responsaveis_atividades) — agora atribui atividades a
// Usuários já cadastrados (perfis_usuarios), guardadas em
// usuario_atividades_responsavel. A tabela antiga é preservada (não
// apagada) só como fonte do relatório de e-mails que não bateram com
// nenhum usuário cadastrado, exibido direto na tela até serem
// reatribuídos manualmente.
// =========================================================================

const ETAPAS_WORKFLOW = [
    'FORMALIZAÇÃO DEMANDA',
    'REALIZAR ORÇAMENTO',
    'APROVAR ORÇAMENTO POR PROJETO',
    'APROVAR ORÇAMENTO ANO FISCAL',
    'GERAR REQUERIMENTOS',
    'APROVAR REQUERIMENTOS NEGÓCIO',
    'APROVAR REQUERIMENTOS TI',
    'FECHAR REQUERIMENTOS',
    'GERAR ESPECIFICAÇÃO',
    'AVALIAR ESPECIFICAÇÃO NEGÓCIO',
    'FECHAR ESPECIFICAÇÃO',
    'EXECUTAR (EXECUTION)',
    'EXECUTAR (UAT)',
    'EXECUTAR (GO-LIVE)',
    'GESTÃO DE EMAIL' // NOVO (item 6 do relatório de testes): não é uma etapa de projeto, é uma atividade administrativa — entra na mesma matriz pra poder ser liberada por perfil
];

async function loadResponsaveis() {
    const { data: usersData, error: usersError } = await _supabase.from('perfis_usuarios').select('*').order('nome');
    if (usersError) {
        console.error('Erro ao carregar perfis_usuarios:', usersError.message);
        usuariosData = [];
    } else {
        usuariosData = usersData || [];
    }

    const { data, error } = await _supabase.from('usuario_atividades_responsavel').select('*').order('nome_etapa');
    if (error) {
        console.error('Erro ao carregar usuario_atividades_responsavel:', error.message);
        usuarioAtividadesData = [];
    } else {
        usuarioAtividadesData = data || [];
    }

    const { data: legadoData, error: legadoError } = await _supabase.from('responsaveis_atividades').select('*').order('nome');
    responsaveisLegadoData = legadoError ? [] : (legadoData || []);

    popularSelectUsuarioResponsavel();
    renderResponsaveisTable();
    renderAtividadesCheckboxes();
    renderRelatorioResponsaveisNaoCasados();
}

function popularSelectUsuarioResponsavel() {
    const sel = document.getElementById('respUsuarioSelect');
    if (!sel) return;
    const ativos = (usuariosData || []).filter(u => u.ativo !== false).sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
    sel.innerHTML = '<option value="">-- Selecione --</option>' +
        ativos.map(u => `<option value="${u.id}">${escapeHtml(u.nome)} (${escapeHtml(u.email)})</option>`).join('');
}

function onSelecionarUsuarioResponsavel() {
    const usuarioId = document.getElementById('respUsuarioSelect').value;
    const atividadesDoUsuario = usuarioId
        ? usuarioAtividadesData.filter(a => a.usuario_id === usuarioId).map(a => a.nome_etapa)
        : [];
    renderAtividadesCheckboxes(atividadesDoUsuario);
}

function renderAtividadesCheckboxes(selecionadas) {
    const container = document.getElementById('respAtividadesCheckboxes');
    if (!container) return;
    const jaSelecionadas = selecionadas || [];
    container.innerHTML = ETAPAS_WORKFLOW.map((etapa, idx) => `
        <label class="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" class="resp-atividade-checkbox" value="${etapa}" id="respAtividade_${idx}" ${jaSelecionadas.includes(etapa) ? 'checked' : ''}>
            <span>${etapa}</span>
        </label>
    `).join('');
}

function renderResponsaveisTable() {
    const tbody = document.getElementById('tableResponsaveisBody');
    if (!tbody) return;

    const usuariosComAtividade = [...new Set(usuarioAtividadesData.map(a => a.usuario_id))];

    if (usuariosComAtividade.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-gray-400 font-bold">Nenhuma atribuição cadastrada</td></tr>`;
        return;
    }

    tbody.innerHTML = usuariosComAtividade.map(usuarioId => {
        const usuario = (usuariosData || []).find(u => u.id === usuarioId);
        const atividades = usuarioAtividadesData.filter(a => a.usuario_id === usuarioId).map(a => a.nome_etapa);
        const badges = atividades.map(a => `<span class="inline-block bg-indigo-100 text-indigo-800 text-[9px] font-bold px-1.5 py-0.5 rounded mr-1 mb-1">${a}</span>`).join('');
        return `
            <tr>
                <td class="p-3 font-bold uppercase">${usuario ? escapeHtml(usuario.nome) : '(usuário não encontrado)'}</td>
                <td class="p-3 text-gray-600">${usuario ? usuario.email : '-'}</td>
                <td class="p-3">${badges || '<span class="text-gray-400 italic">Nenhuma</span>'}</td>
                <td class="p-3 text-right space-x-2 whitespace-nowrap">
                    <button onclick="editarAtividadesResponsavel('${usuarioId}')" class="text-indigo-600 hover:text-indigo-800 text-xs font-bold"><i class="fa-solid fa-pen-to-square"></i> Editar</button>
                    <button onclick="removerTodasAtividadesResponsavel('${usuarioId}')" class="text-red-600 hover:text-red-800 text-xs font-bold"><i class="fa-solid fa-trash"></i> Remover Todas</button>
                </td>
            </tr>
        `;
    }).join('');
}

// NOVO: alterna entre as 2 abas de Responsáveis por Atividade.
function mudarAbaResponsaveis(aba) {
    ['criar', 'cadastrados'].forEach(a => {
        const btn = document.getElementById(`responsaveisBtn-${a}`);
        const painel = document.getElementById(`responsaveisPainel-${a}`);
        if (btn) btn.className = `responsaveis-btn px-4 py-2 rounded-md text-sm font-bold border-2 ${a === aba ? 'bg-red-700 text-white border-red-700' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`;
        if (painel) painel.classList.toggle('hidden', a !== aba);
    });
    aplicarVisibilidadeSubAbas('responsaveis', 'responsaveisBtn');
}

function editarAtividadesResponsavel(usuarioId) {
    document.getElementById('respUsuarioSelect').value = usuarioId;
    onSelecionarUsuarioResponsavel();
    // NOVO (item 5 do relatório de melhorias): selecionar pra editar
    // abre direto a aba do formulário de atribuição.
    mudarAbaResponsaveis('criar');
}

async function salvarAtividadesResponsavel(e) {
    e.preventDefault();
    const usuarioId = document.getElementById('respUsuarioSelect').value;
    if (!usuarioId) return alert('Selecione um usuário!');

    const checkboxes = document.querySelectorAll('.resp-atividade-checkbox');
    const atividadesSelecionadas = Array.from(checkboxes).filter(c => c.checked).map(c => c.value);

    // Substitui tudo (apaga e reinsere) — mais simples que diff, e o
    // volume por usuário é pequeno (no máximo o total de ETAPAS_WORKFLOW).
    const { error: errorDelete } = await _supabase.from('usuario_atividades_responsavel').delete().eq('usuario_id', usuarioId);
    if (errorDelete) return alert('Erro ao atualizar atividades: ' + errorDelete.message);

    if (atividadesSelecionadas.length > 0) {
        const quem = currentUser ? currentUser.nome : 'desconhecido';
        const { error: errorInsert } = await _supabase.from('usuario_atividades_responsavel').insert(
            atividadesSelecionadas.map(nome_etapa => ({ usuario_id: usuarioId, nome_etapa, atribuido_por: quem }))
        );
        if (errorInsert) return alert('Erro ao salvar atividades: ' + errorInsert.message);
    }

    alert('✅ ATIVIDADES ATUALIZADAS COM SUCESSO!');
    document.getElementById('respUsuarioSelect').value = '';
    renderAtividadesCheckboxes([]);
    await loadResponsaveis();
}

async function removerTodasAtividadesResponsavel(usuarioId) {
    if (!confirm('Deseja realmente remover todas as atividades atribuídas a este usuário?')) return;
    const { error } = await _supabase.from('usuario_atividades_responsavel').delete().eq('usuario_id', usuarioId);
    if (error) return alert('Erro ao remover: ' + error.message);
    await loadResponsaveis();
}

// -------------------------------------------------------------------------
// Relatório de e-mails não migrados — linhas de responsaveis_atividades
// (cadastro antigo) cujo e-mail não bate com nenhum perfis_usuarios.email
// cadastrado. Fica visível direto na tela até serem reatribuídas
// manualmente (criando o usuário correspondente ou usando o formulário
// acima com o usuário certo).
// -------------------------------------------------------------------------
function calcularResponsaveisNaoCasados() {
    const emailsUsuarios = new Set((usuariosData || []).map(u => (u.email || '').trim().toLowerCase()));
    return (responsaveisLegadoData || []).filter(r => !emailsUsuarios.has((r.email || '').trim().toLowerCase()));
}

function renderRelatorioResponsaveisNaoCasados() {
    const wrapper = document.getElementById('respNaoCasadosWrapper');
    const tbody = document.getElementById('respNaoCasadosTableBody');
    if (!wrapper || !tbody) return;

    const naoCasados = calcularResponsaveisNaoCasados();

    if (naoCasados.length === 0) {
        wrapper.classList.add('hidden');
        return;
    }

    wrapper.classList.remove('hidden');
    tbody.innerHTML = naoCasados.map(r => {
        const atividades = Array.isArray(r.atividades_permitidas) ? r.atividades_permitidas : [];
        return `
            <tr>
                <td class="p-2 font-bold uppercase">${escapeHtml(r.nome)}</td>
                <td class="p-2">${escapeHtml(r.email)}</td>
                <td class="p-2 text-xs">${atividades.join(', ') || '-'}</td>
            </tr>
        `;
    }).join('');
}

// Lista {nome, email} de usuários com permissão para uma etapa específica —
// usada pelas telas de Planejamento (Especificação_Workflow_v2.md, seção 6)
// para popular o combo de "responsável pela atividade" filtrado por etapa.
// Mantém a mesma forma de retorno de antes (nome/email) pra não exigir
// mudança nos consumidores (generic-workflow-ui.js, subprojetos.js).
function obterResponsaveisPorAtividade(nomeEtapa) {
    return (usuarioAtividadesData || [])
        .filter(a => a.nome_etapa === nomeEtapa)
        .map(a => {
            const usuario = (usuariosData || []).find(u => u.id === a.usuario_id);
            return usuario ? { nome: usuario.nome, email: usuario.email } : null;
        })
        .filter(Boolean);
}
