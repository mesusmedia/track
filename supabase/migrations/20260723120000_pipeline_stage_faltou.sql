-- empurra etapas depois de "Compareceu" para abrir espaço para "Faltou"
update pipeline_stages ps
set position = position + 1
where position > (
  select coalesce(min(ps2.position), 99)
  from pipeline_stages ps2
  where ps2.client_id = ps.client_id
    and lower(ps2.name) = 'compareceu'
);

-- insere "Faltou" logo após "Compareceu" em todos os clientes existentes
insert into pipeline_stages (client_id, name, position)
select ps.client_id, 'Faltou', ps.position + 1
from pipeline_stages ps
where lower(ps.name) = 'compareceu';
