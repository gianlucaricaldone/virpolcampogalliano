-- RLS Policies for users table
-- Everyone can view all users (simplified approach to avoid recursion)
create policy "Everyone can view users" on public.users
  for select using (true);

create policy "Users can update their own profile" on public.users
  for update using (auth.uid() = id);

-- RLS Policies for squadre table
create policy "Everyone can view squadre" on public.squadre
  for select using (true);

create policy "Admins and dirigenti can manage squadre" on public.squadre
  for all using (
    exists (
      select 1 from public.users
      where id = auth.uid() and role in ('admin', 'dirigente')
    )
  );

-- RLS Policies for tesserati table
create policy "Everyone can view tesserati" on public.tesserati
  for select using (true);

create policy "Admins and dirigenti can manage tesserati" on public.tesserati
  for all using (
    exists (
      select 1 from public.users
      where id = auth.uid() and role in ('admin', 'dirigente')
    )
  );

create policy "Allenatori can view their team tesserati" on public.tesserati
  for select using (
    exists (
      select 1 from public.users
      where id = auth.uid() 
        and role = 'allenatore'
        and squadra_id @> array[tesserati.squadra_id]
    )
  );

-- RLS Policies for presenze table
create policy "Allenatori can manage presenze for their teams" on public.presenze
  for all using (
    exists (
      select 1 from public.users u
      join public.tesserati t on t.id = presenze.tesserato_id
      where u.id = auth.uid() 
        and u.role = 'allenatore'
        and u.squadra_id @> array[t.squadra_id]
    )
  );

create policy "Tesserati can view their own presenze" on public.presenze
  for select using (
    exists (
      select 1 from public.tesserati t
      join public.users u on u.email = t.email
      where u.id = auth.uid() and t.id = presenze.tesserato_id
    )
  );

create policy "Admins and dirigenti can view all presenze" on public.presenze
  for select using (
    exists (
      select 1 from public.users
      where id = auth.uid() and role in ('admin', 'dirigente')
    )
  );

-- RLS Policies for partite table
create policy "Everyone can view partite" on public.partite
  for select using (true);

create policy "Allenatori can manage their team partite" on public.partite
  for all using (
    exists (
      select 1 from public.users
      where id = auth.uid() 
        and role = 'allenatore'
        and squadra_id @> array[partite.squadra_id]
    )
  );

create policy "Admins and dirigenti can manage all partite" on public.partite
  for all using (
    exists (
      select 1 from public.users
      where id = auth.uid() and role in ('admin', 'dirigente')
    )
  );

-- RLS Policies for convocazioni table
create policy "Tesserati can view their convocazioni" on public.convocazioni
  for select using (
    exists (
      select 1 from public.tesserati t
      join public.users u on u.email = t.email
      where u.id = auth.uid() and t.id = convocazioni.tesserato_id
    )
  );

create policy "Allenatori can manage convocazioni for their teams" on public.convocazioni
  for all using (
    exists (
      select 1 from public.users u
      join public.partite p on p.id = convocazioni.partita_id
      where u.id = auth.uid() 
        and u.role = 'allenatore'
        and u.squadra_id @> array[p.squadra_id]
    )
  );

-- RLS Policies for campi table
create policy "Everyone can view campi" on public.campi
  for select using (true);

create policy "Admins and dirigenti can manage campi" on public.campi
  for all using (
    exists (
      select 1 from public.users
      where id = auth.uid() and role in ('admin', 'dirigente')
    )
  );

-- RLS Policies for calendario_campi table
create policy "Everyone can view calendario campi" on public.calendario_campi
  for select using (true);

create policy "Allenatori can create reservations for their teams" on public.calendario_campi
  for insert with check (
    exists (
      select 1 from public.users
      where id = auth.uid() 
        and role = 'allenatore'
        and squadra_id @> array[calendario_campi.squadra_id]
    )
  );

create policy "Admins and dirigenti can manage calendario campi" on public.calendario_campi
  for all using (
    exists (
      select 1 from public.users
      where id = auth.uid() and role in ('admin', 'dirigente')
    )
  );

-- RLS Policies for tornei table
create policy "Everyone can view tornei" on public.tornei
  for select using (true);

create policy "Admins can manage tornei" on public.tornei
  for all using (
    exists (
      select 1 from public.users
      where id = auth.uid() and role = 'admin'
    )
  );

-- RLS Policies for iscrizioni_torneo table
create policy "Everyone can view iscrizioni torneo" on public.iscrizioni_torneo
  for select using (true);

create policy "Everyone can create iscrizioni torneo" on public.iscrizioni_torneo
  for insert with check (true);

create policy "Admins can manage iscrizioni torneo" on public.iscrizioni_torneo
  for all using (
    exists (
      select 1 from public.users
      where id = auth.uid() and role = 'admin'
    )
  );

-- RLS Policies for magazzino table
create policy "Authenticated users can view magazzino" on public.magazzino
  for select using (auth.role() = 'authenticated');

create policy "Admins can manage magazzino" on public.magazzino
  for all using (
    exists (
      select 1 from public.users
      where id = auth.uid() and role = 'admin'
    )
  );

create policy "Dirigenti can view magazzino" on public.magazzino
  for select using (
    exists (
      select 1 from public.users
      where id = auth.uid() and role = 'dirigente'
    )
  );

-- RLS Policies for assegnazioni_materiale table
create policy "Allenatori can view their team assignments" on public.assegnazioni_materiale
  for select using (
    exists (
      select 1 from public.users
      where id = auth.uid() 
        and role = 'allenatore'
        and squadra_id @> array[assegnazioni_materiale.squadra_id]
    )
  );

create policy "Admins and dirigenti can manage assignments" on public.assegnazioni_materiale
  for all using (
    exists (
      select 1 from public.users
      where id = auth.uid() and role in ('admin', 'dirigente')
    )
  );

-- RLS Policies for eventi_economici table (admin only)
create policy "Only admins can access eventi economici" on public.eventi_economici
  for all using (
    exists (
      select 1 from public.users
      where id = auth.uid() and role = 'admin'
    )
  );

-- RLS Policies for movimenti_economici table (admin only)
create policy "Only admins can access movimenti economici" on public.movimenti_economici
  for all using (
    exists (
      select 1 from public.users
      where id = auth.uid() and role = 'admin'
    )
  );