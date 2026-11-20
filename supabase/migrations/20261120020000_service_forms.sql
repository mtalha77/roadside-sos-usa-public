-- RSOS-116: complete request forms per service. Each request stores its Get Help answers as
-- structured JSON with the question version (packages/core/src/service-questions.ts), up to three
-- private photos, and when it is needed (now or scheduled). Admins hide, require or reorder
-- questions per market; every change is logged.

alter table public.requests
  add column service_answers jsonb check (service_answers is null or (jsonb_typeof(service_answers) = 'object' and pg_column_size(service_answers) < 8192)),
  add column answers_version integer check (answers_version is null or answers_version >= 1),
  add column photo_paths text[] not null default '{}' check (cardinality(photo_paths) <= 3),
  add column scheduled_for timestamptz;

-- The website attaches the answers right after creating the request, with its status token. Only
-- once, only within 10 minutes, and photos only from that visitor's own draft folder.
create function public.set_request_answers(p_token text, p_draft_token text, p_answers jsonb, p_version integer,
                                           p_photos text[], p_scheduled_for timestamptz, p_urgent boolean)
returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_id uuid;
begin
  if length(coalesce(p_token, '')) < 24 or length(coalesce(p_draft_token, '')) < 24 then
    raise exception 'invalid token' using errcode = '22023';
  end if;
  select id into v_id from public.requests
   where status_token = p_token and service_answers is null and created_at > now() - interval '10 minutes'
   for update;
  if not found then return; end if;
  if exists (select 1 from unnest(coalesce(p_photos, '{}')) p
             where p !~ ('^draft/' || p_draft_token || '/[0-9]\.(jpg|jpeg|png|webp|heic)$')) then
    raise exception 'invalid photo path' using errcode = '22023';
  end if;
  update public.requests
     set service_answers = p_answers, answers_version = p_version,
         photo_paths = coalesce(p_photos[1:3], '{}'), scheduled_for = p_scheduled_for,
         urgent = urgent or coalesce(p_urgent, false)
   where id = v_id;
  insert into public.request_events (request_id, event_type, actor_type, data)
  values (v_id, 'answers', 'driver', jsonb_build_object('version', p_version, 'photos', cardinality(coalesce(p_photos, '{}')),
          'urgent', coalesce(p_urgent, false)));
end;
$$;
revoke all on function public.set_request_answers(text, text, jsonb, integer, text[], timestamptz, boolean) from public;
grant execute on function public.set_request_answers(text, text, jsonb, integer, text[], timestamptz, boolean) to anon, authenticated;

-- Photos: a visitor uploads only into their own live draft's folder (draft/<draft token>/);
-- staff read photos of requests in their markets.
create function public.request_draft_live(p_token text) returns boolean
language sql stable security definer set search_path = '' as $$
  select length(coalesce(p_token, '')) >= 24
     and exists (select 1 from public.request_drafts d where d.token = p_token and d.expires_at > now());
$$;
grant execute on function public.request_draft_live(text) to anon, authenticated;
create policy "visitors upload request photos to their draft" on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'job-photos'
              and (storage.foldername(name))[1] = 'draft'
              and public.request_draft_live((storage.foldername(name))[2]));
create policy "staff read request photos in their markets" on storage.objects for select to authenticated
  using (bucket_id = 'job-photos'
         and (storage.foldername(name))[1] = 'draft'
         and exists (select 1 from public.requests r
                     where name = any (r.photo_paths) and public.staff_can_access_market(r.market_id)));

-- Question overrides per market (null market: every market).
create table public.service_question_overrides (
  id uuid primary key default gen_random_uuid(),
  market_id uuid references public.markets (id) on delete cascade,
  service_slug text not null check (service_slug ~ '^[a-z-]{2,40}$'),
  question_id text not null check (question_id ~ '^[A-Za-z]{2,40}$'),
  hidden boolean not null default false,
  required boolean,
  sort integer check (sort is null or sort between -100 and 100),
  updated_by uuid,
  updated_at timestamptz not null default now()
);
create unique index service_question_overrides_key on public.service_question_overrides
  (coalesce(market_id, '00000000-0000-0000-0000-000000000000'::uuid), service_slug, question_id);
alter table public.service_question_overrides enable row level security;
revoke all on public.service_question_overrides from anon, authenticated;
grant select on public.service_question_overrides to anon, authenticated;
-- The form shows them to every visitor, so reading is public; changing is through the function.
create policy "everyone reads question overrides" on public.service_question_overrides for select to anon, authenticated
  using (true);

create function public.set_question_override(p_market_id uuid, p_service text, p_question text, p_hidden boolean,
                                             p_required boolean, p_sort integer) returns void
language plpgsql volatile security definer set search_path = '' as $$
begin
  if public.jwt_staff_role() not in ('super_admin', 'ops_manager')
     or (p_market_id is not null and not public.staff_can_access_market(p_market_id))
     or (p_market_id is null and public.jwt_staff_role() <> 'super_admin') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_question = 'safety' and (p_hidden or p_required is false) then
    raise exception 'the safety question is always asked' using errcode = '22023';
  end if;
  delete from public.service_question_overrides
   where market_id is not distinct from p_market_id and service_slug = p_service and question_id = p_question;
  if p_hidden or p_required is not null or p_sort is not null then
    insert into public.service_question_overrides (market_id, service_slug, question_id, hidden, required, sort, updated_by)
    values (p_market_id, p_service, p_question, coalesce(p_hidden, false), p_required, p_sort, auth.uid());
  end if;
  insert into public.audit_log (actor_id, actor_role, action, entity_type, entity_id, market_id, data)
  values (auth.uid(), public.jwt_staff_role()::text, 'service.question', 'service', p_service, p_market_id,
          jsonb_build_object('question', p_question, 'hidden', p_hidden, 'required', p_required, 'sort', p_sort));
end;
$$;
revoke all on function public.set_question_override(uuid, text, text, boolean, boolean, integer) from public, anon;
grant execute on function public.set_question_override(uuid, text, text, boolean, boolean, integer) to authenticated;
