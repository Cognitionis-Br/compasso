-- =========================================================================
-- 2026-09-02_update_pilar_iniciativa_projetos_teste.sql
-- Compasso — SÓ Compasso (projeto Supabase fytynjjvzecljmgbtwec).
--
-- As 49 linhas de 'projeto de testes 0001..0049' (codigo PRJ-FY27-501 a
-- 549) foram inseridas todas com pilar_estrategico_id=6 / 
-- iniciativa_estrategica_id=26 (copiado do registro-modelo). Este UPDATE
-- redistribui os 49 projetos pelos 10 pilares e 26 iniciativas reais
-- cadastrados (SELECT * FROM pilares_estrategicos / iniciativas_estrategicas,
-- em 02/09/2026), garantindo que TODO pilar e TODA iniciativa apareçam em
-- pelo menos 1 projeto (49 linhas > 28 combinações reais, então o ciclo se
-- repete a partir da 29ª linha).
--
-- Respeita o vínculo real iniciativas_estrategicas.pilar_id: cada projeto
-- recebe uma iniciativa que de fato pertence ao pilar atribuído a ele.
--
-- 'PILAR ESTRATEGICO 003' (id 7) e 'PILAR ESTRATEGICO 008' (id 11) não têm
-- nenhuma iniciativa cadastrada no banco — os projetos que caem nesses
-- pilares ficam com iniciativa_estrategica_id = NULL (não dá pra inventar
-- uma iniciativa que não existe).
-- =========================================================================

UPDATE projetos SET pilar_estrategico_id = 1, iniciativa_estrategica_id = 6 WHERE codigo LIKE 'PRJ-FY27-501-%';
UPDATE projetos SET pilar_estrategico_id = 1, iniciativa_estrategica_id = 7 WHERE codigo LIKE 'PRJ-FY27-502-%';
UPDATE projetos SET pilar_estrategico_id = 1, iniciativa_estrategica_id = 1 WHERE codigo LIKE 'PRJ-FY27-503-%';
UPDATE projetos SET pilar_estrategico_id = 1, iniciativa_estrategica_id = 2 WHERE codigo LIKE 'PRJ-FY27-504-%';
UPDATE projetos SET pilar_estrategico_id = 1, iniciativa_estrategica_id = 3 WHERE codigo LIKE 'PRJ-FY27-505-%';
UPDATE projetos SET pilar_estrategico_id = 1, iniciativa_estrategica_id = 4 WHERE codigo LIKE 'PRJ-FY27-506-%';
UPDATE projetos SET pilar_estrategico_id = 2, iniciativa_estrategica_id = 21 WHERE codigo LIKE 'PRJ-FY27-507-%';
UPDATE projetos SET pilar_estrategico_id = 2, iniciativa_estrategica_id = 20 WHERE codigo LIKE 'PRJ-FY27-508-%';
UPDATE projetos SET pilar_estrategico_id = 2, iniciativa_estrategica_id = 18 WHERE codigo LIKE 'PRJ-FY27-509-%';
UPDATE projetos SET pilar_estrategico_id = 2, iniciativa_estrategica_id = 17 WHERE codigo LIKE 'PRJ-FY27-510-%';
UPDATE projetos SET pilar_estrategico_id = 2, iniciativa_estrategica_id = 19 WHERE codigo LIKE 'PRJ-FY27-511-%';
UPDATE projetos SET pilar_estrategico_id = 3, iniciativa_estrategica_id = 12 WHERE codigo LIKE 'PRJ-FY27-512-%';
UPDATE projetos SET pilar_estrategico_id = 3, iniciativa_estrategica_id = 5 WHERE codigo LIKE 'PRJ-FY27-513-%';
UPDATE projetos SET pilar_estrategico_id = 3, iniciativa_estrategica_id = 14 WHERE codigo LIKE 'PRJ-FY27-514-%';
UPDATE projetos SET pilar_estrategico_id = 3, iniciativa_estrategica_id = 13 WHERE codigo LIKE 'PRJ-FY27-515-%';
UPDATE projetos SET pilar_estrategico_id = 3, iniciativa_estrategica_id = 15 WHERE codigo LIKE 'PRJ-FY27-516-%';
UPDATE projetos SET pilar_estrategico_id = 3, iniciativa_estrategica_id = 16 WHERE codigo LIKE 'PRJ-FY27-517-%';
UPDATE projetos SET pilar_estrategico_id = 4, iniciativa_estrategica_id = 10 WHERE codigo LIKE 'PRJ-FY27-518-%';
UPDATE projetos SET pilar_estrategico_id = 4, iniciativa_estrategica_id = 11 WHERE codigo LIKE 'PRJ-FY27-519-%';
UPDATE projetos SET pilar_estrategico_id = 6, iniciativa_estrategica_id = 26 WHERE codigo LIKE 'PRJ-FY27-520-%';
UPDATE projetos SET pilar_estrategico_id = 7, iniciativa_estrategica_id = NULL WHERE codigo LIKE 'PRJ-FY27-521-%';
UPDATE projetos SET pilar_estrategico_id = 8, iniciativa_estrategica_id = 9 WHERE codigo LIKE 'PRJ-FY27-522-%';
UPDATE projetos SET pilar_estrategico_id = 8, iniciativa_estrategica_id = 8 WHERE codigo LIKE 'PRJ-FY27-523-%';
UPDATE projetos SET pilar_estrategico_id = 9, iniciativa_estrategica_id = 24 WHERE codigo LIKE 'PRJ-FY27-524-%';
UPDATE projetos SET pilar_estrategico_id = 9, iniciativa_estrategica_id = 25 WHERE codigo LIKE 'PRJ-FY27-525-%';
UPDATE projetos SET pilar_estrategico_id = 10, iniciativa_estrategica_id = 22 WHERE codigo LIKE 'PRJ-FY27-526-%';
UPDATE projetos SET pilar_estrategico_id = 10, iniciativa_estrategica_id = 23 WHERE codigo LIKE 'PRJ-FY27-527-%';
UPDATE projetos SET pilar_estrategico_id = 11, iniciativa_estrategica_id = NULL WHERE codigo LIKE 'PRJ-FY27-528-%';
UPDATE projetos SET pilar_estrategico_id = 1, iniciativa_estrategica_id = 6 WHERE codigo LIKE 'PRJ-FY27-529-%';
UPDATE projetos SET pilar_estrategico_id = 1, iniciativa_estrategica_id = 7 WHERE codigo LIKE 'PRJ-FY27-530-%';
UPDATE projetos SET pilar_estrategico_id = 1, iniciativa_estrategica_id = 1 WHERE codigo LIKE 'PRJ-FY27-531-%';
UPDATE projetos SET pilar_estrategico_id = 1, iniciativa_estrategica_id = 2 WHERE codigo LIKE 'PRJ-FY27-532-%';
UPDATE projetos SET pilar_estrategico_id = 1, iniciativa_estrategica_id = 3 WHERE codigo LIKE 'PRJ-FY27-533-%';
UPDATE projetos SET pilar_estrategico_id = 1, iniciativa_estrategica_id = 4 WHERE codigo LIKE 'PRJ-FY27-534-%';
UPDATE projetos SET pilar_estrategico_id = 2, iniciativa_estrategica_id = 21 WHERE codigo LIKE 'PRJ-FY27-535-%';
UPDATE projetos SET pilar_estrategico_id = 2, iniciativa_estrategica_id = 20 WHERE codigo LIKE 'PRJ-FY27-536-%';
UPDATE projetos SET pilar_estrategico_id = 2, iniciativa_estrategica_id = 18 WHERE codigo LIKE 'PRJ-FY27-537-%';
UPDATE projetos SET pilar_estrategico_id = 2, iniciativa_estrategica_id = 17 WHERE codigo LIKE 'PRJ-FY27-538-%';
UPDATE projetos SET pilar_estrategico_id = 2, iniciativa_estrategica_id = 19 WHERE codigo LIKE 'PRJ-FY27-539-%';
UPDATE projetos SET pilar_estrategico_id = 3, iniciativa_estrategica_id = 12 WHERE codigo LIKE 'PRJ-FY27-540-%';
UPDATE projetos SET pilar_estrategico_id = 3, iniciativa_estrategica_id = 5 WHERE codigo LIKE 'PRJ-FY27-541-%';
UPDATE projetos SET pilar_estrategico_id = 3, iniciativa_estrategica_id = 14 WHERE codigo LIKE 'PRJ-FY27-542-%';
UPDATE projetos SET pilar_estrategico_id = 3, iniciativa_estrategica_id = 13 WHERE codigo LIKE 'PRJ-FY27-543-%';
UPDATE projetos SET pilar_estrategico_id = 3, iniciativa_estrategica_id = 15 WHERE codigo LIKE 'PRJ-FY27-544-%';
UPDATE projetos SET pilar_estrategico_id = 3, iniciativa_estrategica_id = 16 WHERE codigo LIKE 'PRJ-FY27-545-%';
UPDATE projetos SET pilar_estrategico_id = 4, iniciativa_estrategica_id = 10 WHERE codigo LIKE 'PRJ-FY27-546-%';
UPDATE projetos SET pilar_estrategico_id = 4, iniciativa_estrategica_id = 11 WHERE codigo LIKE 'PRJ-FY27-547-%';
UPDATE projetos SET pilar_estrategico_id = 6, iniciativa_estrategica_id = 26 WHERE codigo LIKE 'PRJ-FY27-548-%';
UPDATE projetos SET pilar_estrategico_id = 7, iniciativa_estrategica_id = NULL WHERE codigo LIKE 'PRJ-FY27-549-%';

NOTIFY pgrst, 'reload schema';

-- Conferência (opcional):
--   SELECT p.codigo, p.nome, p.pilar_estrategico_id, pe.nome AS pilar,
--          p.iniciativa_estrategica_id, ie.nome AS iniciativa
--   FROM projetos p
--   LEFT JOIN pilares_estrategicos pe ON pe.id = p.pilar_estrategico_id
--   LEFT JOIN iniciativas_estrategicas ie ON ie.id = p.iniciativa_estrategica_id
--   WHERE p.nome ILIKE 'projeto de testes %' ORDER BY p.codigo;
--
-- Checar cobertura (deve retornar as 10 linhas de pilares e as 26 de
-- iniciativas, cada uma com count >= 1):
--   SELECT pilar_estrategico_id, count(*) FROM projetos
--   WHERE nome ILIKE 'projeto de testes %' GROUP BY pilar_estrategico_id ORDER BY 1;
--   SELECT iniciativa_estrategica_id, count(*) FROM projetos
--   WHERE nome ILIKE 'projeto de testes %' GROUP BY iniciativa_estrategica_id ORDER BY 1;
-- =========================================================================
