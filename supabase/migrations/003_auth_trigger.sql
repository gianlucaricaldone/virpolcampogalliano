-- Create a trigger to automatically create a user profile when a new auth user is created
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, email, role, created_at, updated_at)
  values (
    new.id, 
    new.email,
    'tesserato', -- default role
    now(),
    now()
  );
  return new;
end;
$$ language plpgsql security definer;

-- Trigger the function every time a user is created
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Also create profiles for existing auth users that don't have a profile
insert into public.users (id, email, role, created_at, updated_at)
select 
  au.id,
  au.email,
  'tesserato',
  now(),
  now()
from auth.users au
left join public.users u on au.id = u.id
where u.id is null;