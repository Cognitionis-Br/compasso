// =========================================================================
// core/version.js
// FASE 4 (03/09/2026) — VERSÃO DO SISTEMA. Fonte ÚNICA de verdade.
//
// Para lançar uma nova versão:
//   1. edite COMPASSO_VERSAO abaixo (semver: MAJOR.MINOR.PATCH);
//   2. suba o "release" quando for um marco comercial;
//   3. acrescente a seção correspondente em CHANGELOG.md (na raiz do repo);
//   4. commit. (Ver "Versionamento" em CLAUDE.md.)
//
// Semver: MAJOR = quebra/compatibilidade, MINOR = recurso novo, PATCH =
// correção. "Release N" é o rótulo comercial do ciclo (independente do
// PATCH — sobe em marcos, não a cada correção).
// =========================================================================

const COMPASSO_VERSAO = {
    numero: '1.0.0',
    release: 'Release 0',
    data: '2026-09-03'
};

// "v1.0.0" — rótulo curto para cabeçalhos.
function versaoCompassoCurta() {
    return 'v' + COMPASSO_VERSAO.numero;
}

// "Versão 1.0.0 · Release 0" — rótulo completo para rodapés / tela inicial.
function versaoCompassoLonga() {
    return `Versão ${COMPASSO_VERSAO.numero} · ${COMPASSO_VERSAO.release}`;
}

// Preenche todo elemento com [data-compasso-versao] — "curta" ou "longa"
// conforme data-compasso-versao="longa". Chamado no carregamento da página
// (js/main.js) e é seguro chamar de novo a qualquer momento.
function aplicarVersaoCompasso() {
    document.querySelectorAll('[data-compasso-versao]').forEach(el => {
        el.textContent = (el.getAttribute('data-compasso-versao') === 'longa')
            ? versaoCompassoLonga()
            : versaoCompassoCurta();
    });
}
