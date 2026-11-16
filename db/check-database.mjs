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
      (SELECT count(*) = 13 AND bool_and(c.relrowsecurity AND c.relforcerowsecurity
        AND NOT pg_has_role(current_user, c.relowner, 'MEMBER')
        AND has_table_privilege(current_user, c.oid, 'SELECT'))
        FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'alchemy' AND c.relname IN ('workspaces','memberships','projects','missions','mission_reviews','mission_catalog_checks','mission_revisions','mission_drafts','source_suppressions','mission_plans','mission_plan_decisions','plan_approval_withdrawals','project_submissions'))
      AND has_table_privilege(current_user, 'alchemy.projects', 'INSERT')
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
