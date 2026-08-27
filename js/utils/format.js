// =========================================================================
// utils/format.js
// Formatação de valores monetários no padrão pt-BR (BRL) + escape de HTML.
// Funções puras: mesma entrada sempre produz a mesma saída, sem depender
// de estado global nem do DOM.
// =========================================================================
function formatCurrency(val) {
    return Number(val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// NOVO (a pedido do usuário 26/08/2026 — item 7 do relatório de
// higiene/segurança): o sistema inteiro monta HTML via template string
// interpolando campos de texto livre (nome do projeto, motivo de
// cancelamento, observações, relatórios de evolução etc.) direto no
// innerHTML, sem nenhum encoding — um nome de projeto ou observação
// contendo `<script>`/`<img onerror=...>` executaria ao ser exibido em
// qualquer tela que o mostrasse (XSS armazenado). escapeHtml() faz o
// escape padrão dos 5 caracteres perigosos de HTML — usar em toda
// interpolação de texto livre vindo do banco/formulário.
function escapeHtml(valor) {
    if (valor === null || valor === undefined) return '';
    return String(valor)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// NOVO: pro padrão onclick="minhaFuncao('${escapeJsAttr(texto)}')" — texto
// livre passado como argumento de string dentro de um atributo HTML
// inline. Precisa das DUAS camadas de escape, nesta ordem: primeiro
// escapa barra invertida e aspas simples pro JS (senão o texto quebra a
// string JS ao ser interpretado), DEPOIS escapa pra HTML (senão o texto
// quebra o próprio atributo antes do HTML chegar a virar JS) — sem as
// duas, dá pra escapar da string e injetar JS arbitrário no clique.
function escapeJsAttr(valor) {
    if (valor === null || valor === undefined) return '';
    const jsEscapado = String(valor).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    return escapeHtml(jsEscapado);
}
