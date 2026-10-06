-- =============================================================================
-- seed.sql — demo data for the Crewspace portfolio build
--
-- Demo org: "Hale & Fern Studio" (is_demo = true) — a fictional design
-- agency. ALL people, emails (@haleandfern.example), teams, and content here
-- are fictional and exist only to demonstrate the product.
--
-- Contents: 24 members, 4 teams, 5 system roles + 2 custom roles
-- ("Support Lead", "Hiring Manager"), 6 pending invitations, 40 audit events.
--
-- Run with: supabase db reset   (fresh database; the seed runs once)
-- The organizations insert below is deliberately NOT conflict-tolerant: the
-- slug unique constraint makes an accidental re-run fail atomically instead
-- of silently duplicating demo data.
-- =============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. People roster (fictional)
-- ---------------------------------------------------------------------------
create temporary table seed_people (
  email     text primary key,
  full_name text not null,
  title     text not null,
  user_id   uuid not null default gen_random_uuid()
) on commit drop;

insert into seed_people (email, full_name, title) values
  ('amara.conteh@haleandfern.example',   'Amara Conteh',   'Founder & Creative Director'),
  ('david.okafor@haleandfern.example',   'David Okafor',    'Head of Operations'),
  ('priya.raman@haleandfern.example',    'Priya Raman',     'Finance Lead'),
  ('sofia.marchetti@haleandfern.example','Sofia Marchetti', 'Design Director'),
  ('james.whitfield@haleandfern.example','James Whitfield', 'Engineering Manager'),
  ('aisha.bello@haleandfern.example',    'Aisha Bello',     'Client Success Manager'),
  ('tomas.herrera@haleandfern.example',  'Tomas Herrera',   'Design Manager'),
  ('grace.adeyemi@haleandfern.example',  'Grace Adeyemi',   'People Manager'),
  ('nadia.kamara@haleandfern.example',   'Nadia Kamara',    'Support Lead'),
  ('kwame.mensah@haleandfern.example',   'Kwame Mensah',    'Talent Partner'),
  ('lena.fischer@haleandfern.example',   'Lena Fischer',    'Product Designer'),
  ('omar.haddad@haleandfern.example',    'Omar Haddad',      'Frontend Engineer'),
  ('zoe.nguyen@haleandfern.example',     'Zoe Nguyen',      'Backend Engineer'),
  ('sam.kamara@haleandfern.example',     'Sam Kamara',      'QA Engineer'),
  ('ruth.osei@haleandfern.example',      'Ruth Osei',       'Account Manager'),
  ('eli.toure@haleandfern.example',      'Eli Toure',       'Support Specialist'),
  ('maya.sow@haleandfern.example',       'Maya Sow',        'Brand Designer'),
  ('leo.parker@haleandfern.example',     'Leo Parker',      'Motion Designer'),
  ('nina.rossi@haleandfern.example',     'Nina Rossi',      'Copywriter'),
  ('ibrahim.diallo@haleandfern.example', 'Ibrahim Diallo',  'DevOps Engineer'),
  ('tara.singh@haleandfern.example',     'Tara Singh',      'Data Analyst'),
  ('jonas.weber@haleandfern.example',    'Jonas Weber',     'Design Intern'),
  ('fatou.jallow@haleandfern.example',   'Fatou Jallow',    'Advisor'),
  ('karl.bangura@haleandfern.example',   'Karl Bangura',    'Contractor (alumni)');

-- ---------------------------------------------------------------------------
-- 2. auth.users rows (demo credentials — password 'CrewspaceDemo1!' for all;
--    local/staging demo use only, never production)
-- ---------------------------------------------------------------------------
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
)
select
  (select id from auth.instances limit 1),
  p.user_id,
  'authenticated',
  'authenticated',
  p.email,
  crypt('CrewspaceDemo1!', gen_salt('bf')),
  now() - interval '90 days',
  '{"provider":"email","providers":["email"]}'::jsonb,
  jsonb_build_object('full_name', p.full_name),
  now() - interval '90 days',
  now() - interval '90 days'
from seed_people p
on conflict (id) do nothing;
-- The on_auth_user_created trigger creates profile stubs automatically.

-- ---------------------------------------------------------------------------
-- 3. The demo org
-- ---------------------------------------------------------------------------
insert into public.organizations (name, slug, invite_policy, is_demo, created_by)
values (
  'Hale & Fern Studio',
  'hale-fern',
  'admins',
  true,
  (select user_id from seed_people where email = 'amara.conteh@haleandfern.example')
);

-- ---------------------------------------------------------------------------
-- 4. Roles: 5 system + 2 custom
-- ---------------------------------------------------------------------------
insert into public.roles (org_id, name, description, is_system, system_key, color, created_by)
select
  o.id, v.name, v.description, true, v.system_key, v.color,
  (select user_id from seed_people where email = 'amara.conteh@haleandfern.example')
from public.organizations o
cross join (values
  ('Owner',   'Full control of the organization, including ownership transfer.', 'owner',   'primary'),
  ('Admin',   'Manage members, teams, roles, and settings. Cannot transfer ownership.', 'admin', 'blue'),
  ('Manager', 'Manage their teams and invite members at Member level.', 'manager', 'green'),
  ('Member',  'Standard team member.', 'member', 'neutral'),
  ('Viewer',  'Read-only access to the directory and org data.', 'viewer', 'neutral')
) as v(name, description, system_key, color)
where o.slug = 'hale-fern';

insert into public.roles (org_id, name, description, is_system, system_key, color, created_by)
select
  o.id,
  'Support Lead',
  'Leads day-to-day member support: can view the directory, manage invitations, and read the audit log.',
  false, null, 'amber',
  (select user_id from seed_people where email = 'amara.conteh@haleandfern.example')
from public.organizations o where o.slug = 'hale-fern';

insert into public.roles (org_id, name, description, is_system, system_key, color, created_by)
select
  o.id,
  'Hiring Manager',
  'Runs hiring: can view members, invite candidates, create teams, and manage invitations.',
  false, null, 'violet',
  (select user_id from seed_people where email = 'amara.conteh@haleandfern.example')
from public.organizations o where o.slug = 'hale-fern';

-- System-role permission matrix (TECHNICAL-REQUIREMENTS §6).
insert into public.role_permissions (role_id, permission_key, granted_by)
select r.id, m.permission_key,
  (select user_id from seed_people where email = 'amara.conteh@haleandfern.example')
from public.roles r
join public.organizations o on o.id = r.org_id and o.slug = 'hale-fern'
join (values
  ('owner','org:read'),('owner','org:update'),('owner','org:transfer_ownership'),
  ('owner','members:read'),('owner','members:invite'),('owner','members:change_role'),('owner','members:deactivate'),
  ('owner','teams:create'),('owner','teams:manage'),
  ('owner','roles:create'),('owner','roles:assign'),('owner','roles:update'),('owner','roles:delete'),
  ('owner','invitations:manage'),('owner','audit:read'),('owner','audit:export'),
  ('owner','settings:manage'),('owner','billing:view'),
  ('admin','org:read'),('admin','org:update'),
  ('admin','members:read'),('admin','members:invite'),('admin','members:change_role'),('admin','members:deactivate'),
  ('admin','teams:create'),('admin','teams:manage'),
  ('admin','roles:create'),('admin','roles:assign'),('admin','roles:update'),('admin','roles:delete'),
  ('admin','invitations:manage'),('admin','audit:read'),('admin','audit:export'),
  ('admin','settings:manage'),('admin','billing:view'),
  ('manager','org:read'),
  ('manager','members:read'),('manager','members:invite'),('manager','members:change_role'),
  ('manager','teams:create'),('manager','teams:manage'),
  ('manager','invitations:manage'),('manager','audit:read'),
  ('member','org:read'),('member','members:read'),
  ('viewer','org:read'),('viewer','members:read')
) as m(system_key, permission_key) on m.system_key = r.system_key
where r.is_system
on conflict do nothing;

-- Custom roles: sensible permission subsets.
insert into public.role_permissions (role_id, permission_key, granted_by)
select r.id, m.permission_key,
  (select user_id from seed_people where email = 'amara.conteh@haleandfern.example')
from public.roles r
join public.organizations o on o.id = r.org_id and o.slug = 'hale-fern'
join (values
  ('Support Lead',  'members:read'),
  ('Support Lead',  'invitations:manage'),
  ('Support Lead',  'audit:read'),
  ('Hiring Manager','org:read'),
  ('Hiring Manager','members:read'),
  ('Hiring Manager','members:invite'),
  ('Hiring Manager','teams:create'),
  ('Hiring Manager','invitations:manage'),
  ('Hiring Manager','audit:read')
) as m(role_name, permission_key) on m.role_name = r.name
where not r.is_system
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- 5. Memberships (24; Karl Bangura is deactivated to demo that state)
-- ---------------------------------------------------------------------------
create temporary table seed_memberships (email text primary key, role_name text not null, active boolean not null default true)
on commit drop;

insert into seed_memberships (email, role_name, active) values
  ('amara.conteh@haleandfern.example',    'Owner',          true),
  ('david.okafor@haleandfern.example',    'Admin',          true),
  ('priya.raman@haleandfern.example',     'Admin',          true),
  ('sofia.marchetti@haleandfern.example', 'Admin',          true),
  ('james.whitfield@haleandfern.example', 'Manager',        true),
  ('aisha.bello@haleandfern.example',     'Manager',        true),
  ('tomas.herrera@haleandfern.example',   'Manager',        true),
  ('grace.adeyemi@haleandfern.example',   'Manager',        true),
  ('nadia.kamara@haleandfern.example',    'Support Lead',   true),
  ('kwame.mensah@haleandfern.example',    'Hiring Manager', true),
  ('lena.fischer@haleandfern.example',    'Member',         true),
  ('omar.haddad@haleandfern.example',     'Member',         true),
  ('zoe.nguyen@haleandfern.example',      'Member',         true),
  ('sam.kamara@haleandfern.example',      'Member',         true),
  ('ruth.osei@haleandfern.example',       'Member',         true),
  ('eli.toure@haleandfern.example',       'Member',         true),
  ('maya.sow@haleandfern.example',        'Member',         true),
  ('leo.parker@haleandfern.example',      'Member',         true),
  ('nina.rossi@haleandfern.example',      'Member',         true),
  ('ibrahim.diallo@haleandfern.example',  'Member',         true),
  ('tara.singh@haleandfern.example',      'Member',         true),
  ('jonas.weber@haleandfern.example',     'Viewer',         true),
  ('fatou.jallow@haleandfern.example',    'Viewer',         true),
  ('karl.bangura@haleandfern.example',    'Member',         false);

insert into public.memberships (org_id, user_id, role_id, is_active, deactivated_at, joined_at)
select
  o.id, p.user_id, r.id, sm.active,
  case when not sm.active then now() - interval '20 days' end,
  now() - ((24 - row_number() over (order by sm.email)) || ' days')::interval
from seed_memberships sm
join seed_people p on p.email = sm.email
join public.organizations o on o.slug = 'hale-fern'
join public.roles r on r.org_id = o.id and r.name = sm.role_name
on conflict (org_id, user_id) do nothing;

-- Default role for new members = Member.
update public.organizations o
set default_role_id = r.id
from public.roles r
where r.org_id = o.id and r.name = 'Member' and o.slug = 'hale-fern';

-- ---------------------------------------------------------------------------
-- 6. Teams (4) + team memberships + leads
-- ---------------------------------------------------------------------------
insert into public.teams (org_id, name, description, created_by)
select o.id, v.name, v.description,
  (select user_id from seed_people where email = 'amara.conteh@haleandfern.example')
from public.organizations o
cross join (values
  ('Design',         'Brand, product, and motion design.'),
  ('Engineering',    'Product engineering and infrastructure.'),
  ('Client Success', 'Onboarding, support, and account management.'),
  ('People Ops',     'Hiring, culture, and operations.')
) as v(name, description)
where o.slug = 'hale-fern';

create temporary table seed_team_members (team_name text, email text) on commit drop;
insert into seed_team_members (team_name, email) values
  ('Design', 'sofia.marchetti@haleandfern.example'),
  ('Design', 'tomas.herrera@haleandfern.example'),
  ('Design', 'lena.fischer@haleandfern.example'),
  ('Design', 'maya.sow@haleandfern.example'),
  ('Design', 'leo.parker@haleandfern.example'),
  ('Design', 'nina.rossi@haleandfern.example'),
  ('Engineering', 'james.whitfield@haleandfern.example'),
  ('Engineering', 'omar.haddad@haleandfern.example'),
  ('Engineering', 'zoe.nguyen@haleandfern.example'),
  ('Engineering', 'sam.kamara@haleandfern.example'),
  ('Engineering', 'ibrahim.diallo@haleandfern.example'),
  ('Engineering', 'tara.singh@haleandfern.example'),
  ('Client Success', 'aisha.bello@haleandfern.example'),
  ('Client Success', 'ruth.osei@haleandfern.example'),
  ('Client Success', 'eli.toure@haleandfern.example'),
  ('Client Success', 'nadia.kamara@haleandfern.example'),
  ('People Ops', 'grace.adeyemi@haleandfern.example'),
  ('People Ops', 'priya.raman@haleandfern.example'),
  ('People Ops', 'kwame.mensah@haleandfern.example'),
  ('People Ops', 'fatou.jallow@haleandfern.example');

insert into public.team_memberships (team_id, membership_id, added_by)
select t.id, m.id,
  (select user_id from seed_people where email = 'amara.conteh@haleandfern.example')
from seed_team_members stm
join public.teams t on t.name = stm.team_name
join public.organizations o on o.id = t.org_id and o.slug = 'hale-fern'
join seed_people p on p.email = stm.email
join public.memberships m on m.org_id = o.id and m.user_id = p.user_id
on conflict do nothing;

-- Team leads (by membership id).
update public.teams t set lead_membership_id = m.id
from public.memberships m
join seed_people p on p.user_id = m.user_id
join public.organizations o on o.id = m.org_id and o.slug = 'hale-fern'
where t.org_id = o.id and (
  (t.name = 'Design'         and p.email = 'tomas.herrera@haleandfern.example') or
  (t.name = 'Engineering'    and p.email = 'james.whitfield@haleandfern.example') or
  (t.name = 'Client Success' and p.email = 'aisha.bello@haleandfern.example') or
  (t.name = 'People Ops'     and p.email = 'grace.adeyemi@haleandfern.example')
);

-- ---------------------------------------------------------------------------
-- 7. Profile details (trigger created stubs; fill display fields)
-- ---------------------------------------------------------------------------
update public.profiles pr
set title = p.title,
    bio = 'Fictional demo member of Hale & Fern Studio.',
    email_verified = true,
    updated_at = now()
from seed_people p
where pr.id = p.user_id;

-- ---------------------------------------------------------------------------
-- 8. Six pending invitations
-- ---------------------------------------------------------------------------
insert into public.invitations
  (org_id, email, role_id, team_ids, token_hash, status, invited_by, message, source, expires_at, resend_count)
select
  o.id,
  v.email::citext,
  r.id,
  coalesce((select array_agg(t.id) from public.teams t where t.org_id = o.id and t.name = any (v.teams)), '{}'),
  encode(digest(v.token_seed, 'sha256'), 'hex'),
  'pending',
  (select user_id from seed_people where email = v.invited_by),
  v.message,
  'manual',
  now() + (v.days_left || ' days')::interval,
  v.resends
from public.organizations o
cross join (values
  ('wesley.sankoh@example.com',   'Member', '{Design}',         'amara.conteh@haleandfern.example', 'Welcome aboard — excited to have you on the design team.', 6, 0, 'halefern-demo-invite-01'),
  ('hawa.turay@example.com',      'Member', '{Engineering}',    'david.okafor@haleandfern.example', null,                                                     5, 1, 'halefern-demo-invite-02'),
  ('peter.lum@example.com',       'Viewer', '{}',               'amara.conteh@haleandfern.example', 'Read-only access while you evaluate the workspace.',          4, 0, 'halefern-demo-invite-03'),
  ('lucia.ferreira@example.com',  'Member', '{Client Success}', 'aisha.bello@haleandfern.example',  'Joining ahead of the onboarding sprint.',                    3, 2, 'halefern-demo-invite-04'),
  ('marcus.chen@example.com',     'Member', '{Engineering}',    'james.whitfield@haleandfern.example', null,                                                   2, 0, 'halefern-demo-invite-05'),
  ('adaeze.obi@example.com',      'Member', '{People Ops}',     'grace.adeyemi@haleandfern.example', 'People Ops is growing — glad to have you.',                 1, 1, 'halefern-demo-invite-06')
) as v(email, role_name, teams, invited_by, message, days_left, resends, token_seed)
join public.roles r on r.org_id = o.id and r.name = v.role_name
where o.slug = 'hale-fern';

-- ---------------------------------------------------------------------------
-- 9. Forty audit events, spread over the last 30 days
-- ---------------------------------------------------------------------------
insert into public.audit_log (org_id, actor_id, action, target_type, target_label, created_at)
select
  o.id,
  m.user_id,
  (array[
    'org.created','membership.created','membership.role_changed','invitation.sent',
    'invitation.accepted','team.created','team.member_added','role.permissions_changed',
    'settings.updated','audit.exported'
  ])[1 + (g % 10)],
  'membership',
  p.full_name,
  now() - ((g * 18) || ' hours')::interval
from generate_series(1, 40) g
cross join public.organizations o
join lateral (
  select p2.user_id, p2.full_name
  from seed_people p2
  order by p2.email
  limit 1 offset (g % 24)
) p on true
join public.memberships m on m.org_id = o.id and m.user_id = p.user_id
where o.slug = 'hale-fern';

commit;
