// =========================================================================
// workspace-projeto/etapa-dispatcher.js
// Fase 3 — dispatcher central das abas de etapa do workspace de projeto.
//
// workspace-projeto.js chama renderEtapaProjeto(projeto, aba, bodyId)
// se a função existir; este arquivo a define, roteando para os módulos
// de cada etapa (workspace-req.js, workspace-spec.js, …) ou exibindo
// um stub quando o módulo ainda não foi implementado.
// =========================================================================

async function renderEtapaProjeto(projeto, aba, bodyId) {
    if (aba === 'etapa_requerimentos') {
        if (typeof renderWorkspaceReq === 'function') {
            await renderWorkspaceReq(projeto, bodyId);
        } else {
            _wsRenderAbaStub(bodyId, 'Requerimentos', 'fa-diagram-project');
        }
        return;
    }

    if (aba === 'etapa_especificacao') {
        if (typeof renderWorkspaceSpec === 'function') {
            await renderWorkspaceSpec(projeto, bodyId);
        } else {
            _wsRenderAbaStub(bodyId, 'Especificação', 'fa-diagram-project');
        }
        return;
    }

    if (aba === 'etapa_execucao') {
        if (typeof renderWorkspaceExec === 'function') {
            await renderWorkspaceExec(projeto, bodyId);
        } else {
            _wsRenderAbaStub(bodyId, 'Execução', 'fa-gears');
        }
        return;
    }

    if (aba === 'etapa_uat') {
        if (typeof renderWorkspaceUat === 'function') {
            await renderWorkspaceUat(projeto, bodyId);
        } else {
            _wsRenderAbaStub(bodyId, 'UAT', 'fa-vial-circle-check');
        }
        return;
    }

    if (aba === 'etapa_golive') {
        if (typeof renderWorkspaceGolive === 'function') {
            await renderWorkspaceGolive(projeto, bodyId);
        } else {
            _wsRenderAbaStub(bodyId, 'Go Live', 'fa-rocket');
        }
        return;
    }

    if (aba === 'etapa_encerramento') {
        if (typeof renderWorkspaceEncerramento === 'function') {
            await renderWorkspaceEncerramento(projeto, bodyId);
        } else {
            _wsRenderAbaStub(bodyId, 'Encerramento', 'fa-flag-checkered');
        }
        return;
    }

    // Demais etapas: stub com ícone específico por fase
    const etapaInfo = {
        etapa_execucao:    { label: 'Execução',     icon: 'fa-gears' },
        etapa_uat:         { label: 'UAT',           icon: 'fa-vial-circle-check' },
        etapa_golive:      { label: 'Go Live',       icon: 'fa-rocket' },
        etapa_encerramento:{ label: 'Encerramento',  icon: 'fa-flag-checkered' },
    };
    const info = etapaInfo[aba] || { label: aba, icon: 'fa-diagram-project' };
    _wsRenderAbaStub(bodyId, info.label, info.icon);
}
