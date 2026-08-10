-- move leads que estão em "Novo" para "Em atendimento" do mesmo cliente
update leads l
set stage_id = (
  select ps2.id
  from pipeline_stages ps2
  where ps2.client_id = l.client_id
    and lower(ps2.name) like '%atendimento%'
  order by ps2.position
  limit 1
)
where l.stage_id in (
  select id from pipeline_stages where lower(name) = 'novo'
);

-- deleta a etapa "Novo" de todos os clientes
delete from pipeline_stages where lower(name) = 'novo';

-- reposiciona etapas para garantir sequência sem gaps (position começa em 0)
with ranked as (
  select id, client_id,
         row_number() over (partition by client_id order by position) - 1 as new_pos
  from pipeline_stages
)
update pipeline_stages ps
set position = ranked.new_pos
from ranked
where ps.id = ranked.id;
