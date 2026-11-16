export async function checkDatabase(pool) {
  const client = await pool.connect();
  let discard = false;
  try {
    await client.query('BEGIN READ ONLY');
    const { rows: [login] } = await client.query(`SELECT rolcanlogin, rolsuper, rolbypassrls, rolcreaterole, rolcreatedb
      FROM pg_catalog.pg_roles WHERE rolname = current_user`);
    if (!login?.rolcanlogin || login.rolsuper || login.rolbypassrls || login.rolcreaterole || login.rolcreatedb) {
      throw new Error('The database service login must be restricted');
    }
    await client.query('SET LOCAL ROLE alchemy_app');
    const { rows: [runtime] } = await client.query(`SELECT
      NOT (rolsuper OR rolbypassrls OR rolcreaterole OR rolcreatedb OR rolcanlogin) AS restricted
      FROM pg_catalog.pg_roles WHERE rolname = current_user`);
    const { rows: [schema] } = await client.query(`SELECT
      (SELECT count(*) = 17 AND bool_and(c.relrowsecurity AND c.relforcerowsecurity
        AND NOT pg_has_role(current_user, c.relowner, 'MEMBER')
        AND has_table_privilege(current_user, c.oid, 'SELECT'))
        FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'alchemy' AND c.relname IN ('workspaces','memberships','projects','missions','mission_reviews','mission_catalog_checks','mission_revisions','mission_drafts','source_suppressions','mission_plans','mission_plan_decisions','plan_approval_withdrawals','project_submissions','project_source_revisions','project_source_files','project_source_archives','archive_release_candidates'))
      AND has_table_privilege(current_user, 'alchemy.projects', 'INSERT')
      AND has_function_privilege(current_user, 'alchemy.create_owned_workspace(uuid,text)', 'EXECUTE')
      AND has_function_privilege(current_user, 'alchemy.issue_workspace_invitation(uuid,uuid,text)', 'EXECUTE')
      AND has_function_privilege(current_user, 'alchemy.respond_workspace_invitation(uuid,text)', 'EXECUTE')
      AND NOT has_any_column_privilege(current_user, 'alchemy.workspace_invitations', 'INSERT')
      AND EXISTS (SELECT 1 FROM pg_catalog.pg_class WHERE oid = to_regclass('alchemy.workspace_invitations')
        AND relrowsecurity AND relforcerowsecurity)
      AND NOT has_table_privilege(current_user, 'alchemy.workspaces', 'INSERT')
      AND NOT has_any_column_privilege(current_user, 'alchemy.workspaces', 'INSERT')
      AND has_table_privilege(current_user, 'alchemy.project_source_revisions', 'INSERT')
      AND NOT has_table_privilege(current_user, 'alchemy.project_source_revisions', 'UPDATE,DELETE')
      AND has_table_privilege(current_user, 'alchemy.project_source_files', 'INSERT')
      AND NOT has_table_privilege(current_user, 'alchemy.project_source_files', 'UPDATE,DELETE')
      AND has_table_privilege(current_user, 'alchemy.project_source_archives', 'INSERT')
      AND NOT has_table_privilege(current_user, 'alchemy.project_source_archives', 'UPDATE,DELETE')
      AND has_column_privilege(current_user, 'alchemy.archive_test_runs', 'id', 'INSERT')
      AND has_column_privilege(current_user, 'alchemy.archive_test_runs', 'result', 'SELECT')
      AND NOT has_column_privilege(current_user, 'alchemy.archive_test_runs', 'result', 'UPDATE')
      AND has_table_privilege(current_user, 'alchemy.archive_release_candidates', 'INSERT')
      AND NOT has_table_privilege(current_user, 'alchemy.archive_release_candidates', 'UPDATE,DELETE')
      AND has_column_privilege(current_user, 'alchemy.release_environment_activations', 'candidate_id', 'INSERT')
      AND NOT has_table_privilege(current_user, 'alchemy.release_environment_activations', 'UPDATE,DELETE')
      AND EXISTS (SELECT 1 FROM pg_catalog.pg_class WHERE oid = to_regclass('alchemy.release_environment_activations')
        AND relrowsecurity AND relforcerowsecurity)
      AND has_column_privilege(current_user, 'alchemy.release_approver_grants', 'revoked_at', 'UPDATE')
      AND has_column_privilege(current_user, 'alchemy.release_environment_decisions', 'decision', 'INSERT')
      AND NOT has_table_privilege(current_user, 'alchemy.release_environment_decisions', 'UPDATE,DELETE')
      AND (SELECT count(*) = 2 AND bool_and(relrowsecurity AND relforcerowsecurity)
        FROM pg_catalog.pg_class WHERE oid IN (to_regclass('alchemy.release_approver_grants'), to_regclass('alchemy.release_environment_decisions')))
      AND has_table_privilege(current_user, 'alchemy.projects', 'DELETE')
      AND has_column_privilege(current_user, 'alchemy.projects', 'name', 'UPDATE')
      AND has_column_privilege(current_user, 'alchemy.projects', 'purpose', 'UPDATE')
      AND has_table_privilege(current_user, 'alchemy.missions', 'INSERT')
      AND has_table_privilege(current_user, 'alchemy.mission_reviews', 'INSERT')
      AND has_table_privilege(current_user, 'alchemy.mission_catalog_checks', 'INSERT')
      AND NOT EXISTS (
        SELECT 1 FROM (VALUES
          ('alchemy.mission_revisions', 'INSERT'),
          ('alchemy.project_submissions', 'INSERT'),
          ('alchemy.mission_drafts', 'INSERT'),
          ('alchemy.mission_drafts', 'UPDATE'),
          ('alchemy.mission_drafts', 'DELETE'),
          ('alchemy.source_suppressions', 'INSERT'),
          ('alchemy.mission_plans', 'INSERT'),
          ('alchemy.mission_plan_decisions', 'INSERT'),
          ('alchemy.plan_approval_withdrawals', 'INSERT')
        ) AS required(relation, privilege)
        WHERE NOT has_table_privilege(current_user, to_regclass(required.relation), required.privilege)
      )
      AND EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = 'alchemy.missions'::regclass
        AND conname = 'mission_submission_once')
      AND has_function_privilege(current_user, 'alchemy.workspace_team(uuid)', 'EXECUTE')
      AND has_function_privilege(current_user, 'alchemy.revoke_workspace_member(uuid,uuid)', 'EXECUTE')
      AND has_function_privilege(current_user, 'alchemy.grant_workspace_member(uuid,uuid,text)', 'EXECUTE')
      AND has_function_privilege(current_user, 'alchemy.change_workspace_member_role(uuid,uuid,text,text)', 'EXECUTE')
      AND has_function_privilege(current_user, 'alchemy.workspace_member_role_history(uuid)', 'EXECUTE')
      AND NOT has_column_privilege(current_user, 'alchemy.memberships', 'role', 'UPDATE')
      AND EXISTS (SELECT 1 FROM pg_catalog.pg_class WHERE oid = to_regclass('alchemy.workspace_member_role_changes')
        AND relrowsecurity AND relforcerowsecurity AND NOT has_table_privilege(current_user, oid, 'SELECT,INSERT,UPDATE,DELETE'))
      AND NOT has_table_privilege(current_user, 'alchemy.memberships', 'INSERT')
      AND has_column_privilege(current_user, 'alchemy.mission_catalog_checks', 'catalog_bytes', 'INSERT')
      AND has_function_privilege(current_user, 'alchemy.workspace_revocation_audit(uuid)', 'EXECUTE')
      AND to_regclass('alchemy.source_decision_version') IS NOT NULL
      AND to_regclass('alchemy.mission_activity_created') IS NOT NULL AS ready`);
    if (!runtime?.restricted || !schema.ready) throw new Error('Workspace schema or runtime role is incomplete');
    await client.query("SELECT set_config('alchemy.actor_id', '', true)");
    const { rows: [scope] } = await client.query('SELECT EXISTS (SELECT 1 FROM alchemy.workspaces) AS visible');
    if (scope.visible) throw new Error('Workspace access requires an actor');
    await client.query('RESET ROLE');
    await client.query('SET LOCAL ROLE alchemy_identity');
    const { rows: [identity] } = await client.query(`SELECT
      has_function_privilege(current_user, 'alchemy.resolve_actor(text,text)', 'EXECUTE')
      AND has_function_privilege(current_user, 'alchemy.session_actor(text)', 'EXECUTE')
      AND has_function_privilege(current_user, 'alchemy.revoke_session(text)', 'EXECUTE')
      AND has_function_privilege(current_user, 'alchemy.revoke_other_sessions(text)', 'EXECUTE')
      AND has_function_privilege(current_user, 'alchemy.consume_login_attempt(text,text)', 'EXECUTE')
      AND has_function_privilege(current_user, 'alchemy.cleanup_expired_identity_records()', 'EXECUTE')
      AND has_table_privilege(current_user, 'alchemy.sessions', 'INSERT')
      AND has_table_privilege(current_user, 'alchemy.login_attempts', 'INSERT')
      AND has_column_privilege(current_user, 'alchemy.login_attempts', 'return_path', 'INSERT')
      AND NOT has_table_privilege(current_user, 'alchemy.sessions', 'SELECT') AS ready`);
    if (!identity.ready) throw new Error('Identity schema or runtime role is incomplete');
    await client.query('SELECT alchemy.session_actor($1)', ['0'.repeat(64)]);
  } finally {
    try { await client.query('ROLLBACK'); }
    catch (error) { discard = true; throw error; }
    finally { client.release(discard); }
  }
}
