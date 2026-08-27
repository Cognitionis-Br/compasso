// =========================================================================
// utils/dates.js
// Soma de dias úteis (pula sábado e domingo) a partir de uma data base.
// Função pura: mesma entrada sempre produz a mesma saída, sem depender
// de estado global nem do DOM.
// =========================================================================
function somarDiasUteis(dataInicialStr, diasUteis) {
    if (!dataInicialStr) return '-';
    let data = new Date(dataInicialStr + 'T00:00:00');
    let adicionados = 0;
    while (adicionados < diasUteis) {
        data.setDate(data.getDate() + 1);
        const diaSemana = data.getDay();
        if (diaSemana !== 0 && diaSemana !== 6) adicionados++;
    }
    return data.toISOString().split('T')[0];
}

// Conta dias úteis entre duas datas (inclusive) — usada pelo cálculo de
// percentual previsto vs. realizado (Especificacao_Workflow_v4.md, seção 5).
function contarDiasUteisEntre(dataInicioStr, dataFimStr) {
    if (!dataInicioStr || !dataFimStr) return 0;
    const inicio = new Date(dataInicioStr + 'T00:00:00');
    const fim = new Date(dataFimStr + 'T00:00:00');
    if (fim < inicio) return 0;

    let count = 0;
    let cursor = new Date(inicio);
    while (cursor <= fim) {
        const dia = cursor.getDay();
        if (dia !== 0 && dia !== 6) count++;
        cursor.setDate(cursor.getDate() + 1);
    }
    return count;
}
