-- Photo-only repairs preserve the published body, timestamps and daily index.
create or replace function public.repair_bota_photo(p_id text,p_source_hash text,p_photo jsonb)
returns boolean language plpgsql security definer set search_path=public as $$
declare changed integer;
begin
 if p_id is null or p_source_hash is null or p_photo is null
    or p_id !~ '^[a-f0-9]{64}$' or p_source_hash !~ '^[a-f0-9]{64}$'
    or jsonb_typeof(p_photo) <> 'object'
    or not (p_photo ?& array['imageUrl','imageWidth','imageHeight','imageSubject','imageCaption','imageRights'])
    or exists(select 1 from jsonb_object_keys(p_photo) as keys(key) where key not in ('imageUrl','imageWidth','imageHeight','imageSubject','imageCaption','imageRights'))
 then raise exception 'Invalid photo-only repair'; end if;
 update public.bota_coverage_articles set data=data || p_photo
 where id=p_id and data->>'sourceHash'=p_source_hash;
 get diagnostics changed=row_count;
 return changed=1;
end $$;
revoke all on function public.repair_bota_photo(text,text,jsonb) from public,anon,authenticated;
grant execute on function public.repair_bota_photo(text,text,jsonb) to service_role;
