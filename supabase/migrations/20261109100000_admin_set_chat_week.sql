-- A coffee chat counts toward the week it was LOGGED in (accelerator_coffee_chats.created_at, which interns can't write, so nobody
-- can backdate their own). When a chat really belongs to an earlier week (an intern did it that week but logged it late), an admin
-- can count it toward that week. Only created_at changes; the move is written to the audit log.
create or replace function admin_set_chat_week(p_chat_id uuid, p_logged_at timestamptz, p_week_number integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_label text;
begin
  if not is_admin() then
    raise exception 'admin access required';
  end if;
  if p_logged_at > now() then
    raise exception 'a chat cannot be counted toward a time in the future';
  end if;

  update accelerator_coffee_chats set created_at = p_logged_at where id = p_chat_id returning profile_id into v_owner;
  if v_owner is null then
    raise exception 'that coffee chat does not exist';
  end if;

  select coalesce(nullif(trim(full_name), ''), 'an intern') into v_label from profiles where id = v_owner;
  perform log_admin_action('chat_week_changed', 'coffee_chat', p_chat_id::text, v_label, jsonb_build_object('week', p_week_number));
end;
$$;
grant execute on function admin_set_chat_week(uuid, timestamptz, integer) to authenticated;
