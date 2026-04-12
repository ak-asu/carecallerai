-- Cron + pg_net automation for CareCaller background jobs.
-- This migration is idempotent and safe to re-run.

create extension if not exists pg_cron;
create extension if not exists pg_net;
create extension if not exists supabase_vault;

create schema if not exists util;

create or replace function util.get_secret(secret_name text)
returns text
language sql
security definer
set search_path = public, vault
as $$
  select decrypted_secret
  from vault.decrypted_secrets
  where name = secret_name
  order by created_at desc
  limit 1;
$$;

create or replace function util.project_url()
returns text
language sql
security definer
set search_path = public, vault
as $$
  select util.get_secret('project_url');
$$;

create or replace function util.anon_key()
returns text
language sql
security definer
set search_path = public, vault
as $$
  select util.get_secret('anon_key');
$$;

create or replace function util.invoke_edge_function(
  function_name text,
  payload jsonb default '{}'::jsonb,
  timeout_milliseconds integer default 60000
)
returns bigint
language plpgsql
security definer
set search_path = public, extensions, vault
as $$
declare
  request_id bigint;
  target_url text;
  auth_key text;
begin
  target_url := util.project_url();
  auth_key := util.anon_key();

  if target_url is null or auth_key is null then
    raise exception 'Missing required vault secrets project_url or anon_key';
  end if;

  select net.http_post(
    url := target_url || '/functions/v1/' || function_name,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || auth_key
    ),
    body := payload,
    timeout_milliseconds := timeout_milliseconds
  ) into request_id;

  return request_id;
end;
$$;

-- Refresh job definitions to avoid duplicates and keep schedule drift under control.
do $$
declare
  existing_job_id bigint;
begin
  select jobid into existing_job_id from cron.job where jobname = 'carecaller-calendar-sync' limit 1;
  if existing_job_id is not null then
    perform cron.unschedule(existing_job_id);
  end if;

  select jobid into existing_job_id from cron.job where jobname = 'carecaller-symptom-followup' limit 1;
  if existing_job_id is not null then
    perform cron.unschedule(existing_job_id);
  end if;

  select jobid into existing_job_id from cron.job where jobname = 'carecaller-medication-enrichment' limit 1;
  if existing_job_id is not null then
    perform cron.unschedule(existing_job_id);
  end if;
end $$;

select cron.schedule(
  'carecaller-calendar-sync',
  '*/15 * * * *',
  $$ select util.invoke_edge_function('calendar-sync', jsonb_build_object('source', 'pg_cron')); $$
);

select cron.schedule(
  'carecaller-symptom-followup',
  '0 * * * *',
  $$ select util.invoke_edge_function('symptom-followup', jsonb_build_object('source', 'pg_cron')); $$
);

select cron.schedule(
  'carecaller-medication-enrichment',
  '0 */6 * * *',
  $$ select util.invoke_edge_function('medication-enrichment', jsonb_build_object('source', 'pg_cron')); $$
);
