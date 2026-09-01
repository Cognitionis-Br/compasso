// =========================================================================
// main.js
// Ponto de entrada do sistema Compasso — depois de terminada a extração de
// módulos, este é o único arquivo que sobrou do antigo app.js monolítico
// (1.525 linhas originais). Toda a lógica de negócio foi movida para os
// módulos abaixo; ver ARQUITETURA_ALVO.md para a árvore completa e a
// ordem de extração usada.
//
// Ainda são scripts clássicos (não ES Modules) — decisão tomada no início
// da modularização para reduzir risco: os `let`/`const` de topo de cada
// arquivo compartilham o mesmo escopo léxico de página, então nenhuma
// função precisou ser reescrita para importar/exportar estado. A conversão
// para ES Modules de verdade (import/export, state.x em vez de variáveis
// soltas) fica como uma etapa futura deliberada, não motivada por nenhum
// problema atual — ver observação equivalente em core/state.js.
//
// GAPS FUNCIONAIS conhecidos e não resolvidos por esta reorganização
// (ver GAPS_FUNCIONAIS.md e Auditoria_Tecnica.md para detalhes):
// - Login não autentica de verdade (js/auth/auth.js).
//   [ATUALIZADO 10/08/2026: corrigido — ver seção abaixo]
// - 6 telas de fase ainda são stubs vazios (js/phases/stubs.js).
// - resetarBaseParaFase1 (js/dev-tools/reset.js) não tem controle de acesso.
// - Possível duplicidade no cálculo de saldo simulado Ad-Hoc
//   (js/adhoc/tradeoff.js).
// =========================================================================

// -------------------------------------------------------------------------
// AUTENTICAÇÃO REAL — implementada em 10/08/2026 (js/auth/auth.js).
// Ao carregar a página, verifica se já existe uma sessão Supabase ativa
// (ex.: usuário deu F5 ou voltou numa aba já logada) e, se houver, entra
// direto no sistema sem pedir login de novo.
// -------------------------------------------------------------------------
// NOVO (evolução — "esqueci a senha", 27/08/2026): registrado antes de
// checarSessaoAtiva(), e checarSessaoAtiva() é pulada de propósito quando
// a URL veio do link de recuperação — a sessão temporária que o Supabase
// cria ao processar esse link TAMBÉM conta como "sessão ativa" pra
// checarSessaoAtiva(), que abriria o sistema direto por trás do modal de
// nova senha (bug real encontrado via teste: o link abria o sistema em
// vez da troca de senha). A checagem é síncrona — evita depender da
// ordem/tempo dos eventos assíncronos do Supabase (onAuthStateChange x
// getSession).
//
// CORRIGIDO 27/08/2026: só checava a hash (formato antigo/implícito,
// "#access_token=...&type=recovery"). O link de verdade enviado pelo
// Supabase usa o fluxo PKCE (padrão do supabase-js v2), que volta como
// query string "?code=..." — sem hash nenhuma — então a checagem original
// nunca disparava com o link real, só no teste com token falso. Este app
// só envia e-mail com link de auth pra recuperação de senha (nenhum outro
// fluxo usa isso), então qualquer "?code=" na URL já é seguro tratar como
// vindo desse link.
// NOVO (2026-09-01): link de recuperação inválido/expirado volta com
// "#error=...&error_code=..." — mostra mensagem clara e segue pro login.
const erroLinkRecuperacao = tratarErroLinkRecuperacaoSenha();

const vindoDeLinkRecuperacaoSenha = !erroLinkRecuperacao && (
    window.location.hash.includes('type=recovery')
    || new URLSearchParams(window.location.search).has('code'));

monitorarRecuperacaoSenha();

if (!vindoDeLinkRecuperacaoSenha) {
    checarSessaoAtiva();
}
