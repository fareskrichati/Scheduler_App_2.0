-- Pending approval. Run only after the Edge Function and Vault secret are configured.
-- Enable pg_cron and pg_net in Supabase before applying this file.
-- Vault must contain uniplan_v2_cron_secret matching UNIPLAN_CRON_SECRET.
do $$
begin
 if not exists (select 1 from vault.decrypted_secrets where name='uniplan_v2_cron_secret') then
  raise exception 'Configure the Canvas scheduler secret first';
 end if;
end $$;
select cron.schedule(
 'uniplan-v2-canvas-due',
 '0 * * * *',
 $job$
 select net.http_post(
  url := 'https://mgvahslbxdskzhiwxxod.supabase.co/functions/v1/uniplan-canvas-v2',
  headers := jsonb_build_object('Content-Type','application/json','x-uniplan-cron',
   (select decrypted_secret from vault.decrypted_secrets where name='uniplan_v2_cron_secret' limit 1)),
  body := '{"action":"cron"}'::jsonb,
  timeout_milliseconds := 120000
 );
 $job$
);
