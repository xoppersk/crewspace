-- 00016_signature_permission_copy.sql
--
-- Aligns the six signature permission rows with the Flagship UI Designs
-- artifact's exact plain-language statements (Crewspace signature UI —
-- the "Product Admin" permission register). The permissions catalog is
-- static (the app never writes it); this updates the copy on existing
-- databases, while 00002 carries the same copy for fresh ones.

update public.permissions set
  label = 'Invite members',
  description = 'Can invite new people and choose an initial role.'
where key = 'members:invite';

update public.permissions set
  label = 'Change member roles',
  description = 'Can replace a member''s assigned organization role.'
where key = 'members:change_role';

update public.permissions set
  label = 'Deactivate members',
  description = 'Can suspend access while preserving ownership history.'
where key = 'members:deactivate';

update public.permissions set
  label = 'Edit role permissions',
  description = 'Inherits the organization policy for custom roles.'
where key = 'roles:update';

update public.permissions set
  label = 'Read audit log',
  description = 'Can review consequential access changes and exports.'
where key = 'audit:read';

update public.permissions set
  label = 'Export audit records',
  description = 'Cannot download the organization audit archive.'
where key = 'audit:export';
