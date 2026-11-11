-- NAO roda automatico (nao e uma migration). Mapeamento evolution_instance_name -> sheet_id,
-- levantado a partir do pipeline n8n antigo. Revisar e rodar manualmente contra o Supabase real.
-- gid padrao (1048674045) ja e o default da coluna settings.sheet_gid -- só ajustar se a aba de algum cliente for diferente.

update settings s set sheet_id = '1AAcB8qjEf-NDM36lPTCOuUst7tsACIvfNe4QgsJf_yM' from clients c where c.id = s.client_id and s.evolution_instance_name = 'C140-EspacoBottega';
update settings s set sheet_id = '1zOwuPWh_g2fLHyfmBfHl1RIPYznzGdf7yGidGnq9qN0' from clients c where c.id = s.client_id and s.evolution_instance_name in ('C149-GGlow', 'C149-GGlowClinica', 'C149-ClinicaGGlow');
update settings s set sheet_id = '18V8FQD8Q5lVSoioIkDjnUKYFqminsQWgIWbuc8ImW9E' from clients c where c.id = s.client_id and s.evolution_instance_name = 'C174-EsteticFaceItapetininga';
update settings s set sheet_id = '1Vc5IT497LN25AUD8ckoH7CkXJ-72O7ypn8ZxuoAUELg' from clients c where c.id = s.client_id and s.evolution_instance_name = 'C162-DrBrunoAraujo';
update settings s set sheet_id = '17_CS-0I470XfX5sQMLAd0jdQJxng4gFCBkO1eaQx8qA' from clients c where c.id = s.client_id and s.evolution_instance_name = 'C123-OrgulhodeSorrirPeruibe';
update settings s set sheet_id = '1bWYYqtG_2TZ3Zs0r5wkvadSI8gEMAug-9nZUp-jxYuc' from clients c where c.id = s.client_id and s.evolution_instance_name in ('C123-OrgulhoSantos', 'C123-OrgulhodeSorrirSantos');
update settings s set sheet_id = '1biD55AqQuFQZJlSnUyGvrg3DwKWD-8fLSl5bt2fJiEM' from clients c where c.id = s.client_id and s.evolution_instance_name = 'C172-DrCaioFigueira';
update settings s set sheet_id = '1SuyRNdYrGZXtBFmB0-Hv91ZICa7geeFHx6Ayiz7jU08' from clients c where c.id = s.client_id and s.evolution_instance_name = 'C163-AcessoSaudeCIC';
update settings s set sheet_id = '1fVoRc627ZhHEBKFIGuGvvtiMDBrO_2D3Wp2mWZlH3Go' from clients c where c.id = s.client_id and s.evolution_instance_name = 'C150-Lumia';
update settings s set sheet_id = '1tl6svgz2tSM3lNPk4gVDJJ0Ab9cpCSN5e78gqTIvtMo' from clients c where c.id = s.client_id and s.evolution_instance_name = 'C182-DraJordanaKardek';
update settings s set sheet_id = '1t4KLQdv9bjYcftwMw81rn-WvMs0NW92omQLWR_MkiF4' from clients c where c.id = s.client_id and s.evolution_instance_name = 'C166-Lucasmallmann';
update settings s set sheet_id = '1ssM8yBQsSpby-y7FXqs8NmWAAjzsfigxhR4P4J7mfys' from clients c where c.id = s.client_id and s.evolution_instance_name = 'C52-DrLucasPitao';
update settings s set sheet_id = '16A--MHKp8IBoZKHGQD21LFN-7WUVL2m_BcZmu0UdEXg' from clients c where c.id = s.client_id and s.evolution_instance_name = 'C171-DraStefaniRezende';
update settings s set sheet_id = '11Hz0kF_Cy8xtDc8l5Yc8kOW_0Hidq8k5mKf1JHKrnGE' from clients c where c.id = s.client_id and s.evolution_instance_name = 'C177-DrLucasBertini';
update settings s set sheet_id = '1pQpLfdt9gCHoRekLRpqFk9pwW2V51ksCN_NTJd1G_zY' from clients c where c.id = s.client_id and s.evolution_instance_name in ('C135-DraMichelleSantos');
update settings s set sheet_id = '1dnsXrJS3W7MgH-sEbJrDS7gOUFtNOM8Kg8saZjAelEM' from clients c where c.id = s.client_id and s.evolution_instance_name = 'C180-DrNathanNunes';
update settings s set sheet_id = '1LWOtVjWsaX_tkV1TG8ibN765WbRuNTablOxhwPSyKoc' from clients c where c.id = s.client_id and s.evolution_instance_name = 'C175-VivazOdontologia';
update settings s set sheet_id = '1hnJ7rl0Hcy2GcWdh3nMN7s9nhBCtahKsHYiQglAF_JE' from clients c where c.id = s.client_id and s.evolution_instance_name = 'C123-DrRafaelRocha';
update settings s set sheet_id = '11CLtmylBG_cuo4EI36N0HyvnY39PwOnEDORiXqg7S-o' from clients c where c.id = s.client_id and s.evolution_instance_name = 'C176-DraCamilaFugii';
update settings s set sheet_id = '1TEuyWftgK9iM2rINKEeg-xTAZGVFxibmWZpokn6XCEc' from clients c where c.id = s.client_id and s.evolution_instance_name = 'C136-IntegrareOdontologia';

-- Kommo (Feature B) -- subdomain confirmado, token NAO incluido aqui (precisa
-- ser inserido cifrado via app/código, nunca em texto puro numa migration/seed):
update settings s set kommo_subdomain = 'efitapetininga' from clients c where c.id = s.client_id and s.evolution_instance_name = 'C174-EsteticFaceItapetininga';
update settings s set kommo_subdomain = 'clinicagoesearaujo' from clients c where c.id = s.client_id and s.evolution_instance_name = 'C162-DrBrunoAraujo';
-- kommo_token_enc de cada um precisa ser gravado via encryptSecret()+bufferToBytea() em código server-only, com o token real do Kommo.
