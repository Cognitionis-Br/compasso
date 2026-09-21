// =========================================================================
// utils/csv-export.js   (evolução visual do Dashboard)
// Exportação genérica de tabelas pro formato CSV (abre direto no Excel/
// Google Sheets) — usada pelas seções do Dashboard que hoje só existem
// como gráfico em CSS (Consolidação por Fase, Orçado x Realizado por
// Área) e pelo Status Detalhado da Carteira.
// =========================================================================
function exportarCSV(cabecalhos, linhas, nomeArquivo) {
    const escapaCampo = (v) => {
        const s = String(v === null || v === undefined ? '' : v);
        return /[",;\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    // Delimitador ";" (não ",") — no Excel em pt-BR a vírgula é separador
    // decimal, então CSV com vírgula quebra a leitura dos valores em R$.
    const conteudo = [cabecalhos, ...linhas]
        .map(linha => linha.map(escapaCampo).join(';'))
        .join('\r\n');
    // BOM UTF-8 — sem ele o Excel no Windows abre acentuação pt-BR corrompida.
    const blob = new Blob(['﻿' + conteudo], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nomeArquivo.endsWith('.csv') ? nomeArquivo : nomeArquivo + '.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// Botão padrão reaproveitado nas seções do Dashboard.
function botaoExportarCSV(onclick, label) {
    return `<button onclick="${onclick}" class="inline-flex items-center gap-1.5 text-[10px] font-bold text-gray-500 hover:text-gray-800 border border-gray-300 hover:border-gray-400 rounded px-2 py-1">
        <i class="fa-solid fa-file-csv"></i> ${label || 'Exportar CSV'}</button>`;
}
