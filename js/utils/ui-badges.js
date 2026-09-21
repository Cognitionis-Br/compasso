// =========================================================================
// utils/ui-badges.js   (evolução visual — consolidação de UX)
// Cada tela reimplementava sua própria pastilha de status do zero, com
// combinações de classe ligeiramente diferentes (px-2 py-0.5 vs
// px-1.5 py-0.5, text-[9px] vs text-[10px], pastel vs sólido, emoji vs
// nada) — levantamento via revisão de design encontrou 6+ variações só
// nas telas de workflow/cadastro. renderBadgeStatus() é o ponto único.
//
// As combinações de classe abaixo são strings LITERAIS completas (nunca
// concatenadas por partes) — o Tailwind Play CDN escaneia o DOM já
// renderizado em busca de nomes de classe; uma classe montada por partes
// arbitrárias correria o risco de nunca ter sido "vista" inteira em
// lugar nenhum do app e não ganhar CSS nenhum.
// =========================================================================
const BADGE_CORES = {
    emerald: 'bg-emerald-100 text-emerald-800',
    amber: 'bg-amber-100 text-amber-800',
    danger: 'bg-danger-100 text-danger-800',
    gray: 'bg-gray-100 text-gray-600',
    purple: 'bg-purple-100 text-purple-800',
    blue: 'bg-blue-100 text-blue-800',
    cyan: 'bg-cyan-100 text-cyan-800',
    orange: 'bg-orange-100 text-orange-800',
    sky: 'bg-sky-100 text-sky-800'
};

// corKey: uma chave de BADGE_CORES acima. icone: nome do ícone FontAwesome
// solid (ex. 'fa-circle-check'), sem o 'fa-solid' — passe null/'' pra
// pastilha sem ícone. texto: rótulo (sempre escapado). titulo: tooltip
// nativo opcional (também escapado).
function renderBadgeStatus(corKey, icone, texto, titulo) {
    const classes = BADGE_CORES[corKey] || BADGE_CORES.gray;
    const iconeHtml = icone ? `<i class="fa-solid ${icone} mr-1"></i>` : '';
    const tituloAttr = titulo ? ` title="${escapeHtml(titulo)}"` : '';
    return `<span class="px-2 py-0.5 rounded text-[10px] font-bold ${classes}"${tituloAttr}>${iconeHtml}${escapeHtml(texto)}</span>`;
}
