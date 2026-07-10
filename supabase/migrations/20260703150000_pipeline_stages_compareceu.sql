-- empurra etapas que vêm depois de "Agendado" (posição > 2) para abrir espaço
update pipeline_stages ps
set position = position + 2
where position > (
  select coalesce(min(ps2.position), 2)
  from pipeline_stages ps2
  where ps2.client_id = ps.client_id
    and lower(ps2.name) = 'agendado'
);

-- insere "Compareceu" e "Orçamento em aberto" para cada cliente
-- logo após a posição de "Agendado"
insert into pipeline_stages (client_id, name, position)
select ps.client_id, 'Compareceu', ps.position + 1
from pipeline_stages ps
where lower(ps.name) = 'agendado';

insert into pipeline_stages (client_id, name, position)
select ps.client_id, 'Orçamento em aberto', ps.position + 2
from pipeline_stages ps
where lower(ps.name) = 'agendado';
