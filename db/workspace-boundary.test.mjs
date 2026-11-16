import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { workspaceStore } from './workspace-store.mjs';

test('hosted mission schema enforces workspace scope and write roles', async () => {
  const db = new PGlite();
  const migration = await readFile(new URL('./migrations/001_workspace_boundary.sql', import.meta.url), 'utf8');
  const id = suffix => '00000000-0000-4000-8000-' + String(suffix).padStart(12, '0');
  const [workspaceA, workspaceB, editor, viewer, otherEditor, projectA, projectB] =
    [1, 2, 3, 4, 5, 6, 7].map(id);
  const insert = (connection, workspace, project, mission, actor) => connection.query(
    'INSERT INTO alchemy.missions VALUES ($1, $2, $3, $4, $5, $6, $7)',
    [workspace, project, mission, 'Mission', 'Goal', 'Acceptance', actor],
  );
  const asActor = (actor, callback) => db.transaction(async tx => {
    await tx.exec('SET LOCAL ROLE alchemy_app');
    if (actor) await tx.query("SELECT set_config('alchemy.actor_id', $1, true)", [actor]);
    return callback(tx);
  });
  const workspaces = tx => tx.query('SELECT id FROM alchemy.workspaces ORDER BY id');
  const missions = tx => tx.query('SELECT id FROM alchemy.missions ORDER BY id');
  try {
    await db.exec(migration);
    for (const name of ['007_mission_reviews.sql', '013_mission_revisions.sql']) {
      await db.exec(await readFile(new URL('./migrations/' + name, import.meta.url), 'utf8'));
    }
    await db.exec(await readFile(new URL('./migrations/008_mission_submission_key.sql', import.meta.url), 'utf8'));
    await db.query("INSERT INTO alchemy.workspaces VALUES ($1, 'A'), ($2, 'B')", [workspaceA, workspaceB]);
    await db.query("INSERT INTO alchemy.memberships (workspace_id, actor_id, role) VALUES ($1,$2,'editor'), ($1,$3,'viewer'), ($4,$5,'editor')",
      [workspaceA, editor, viewer, workspaceB, otherEditor]);
    await db.query("INSERT INTO alchemy.projects VALUES ($1,$2,'Project A'), ($3,$4,'Project B')",
      [workspaceA, projectA, workspaceB, projectB]);
    await asActor(editor, tx => insert(tx, workspaceA, projectA, id(8), editor));
    await asActor(otherEditor, tx => insert(tx, workspaceB, projectB, id(9), otherEditor));
    assert.deepEqual((await asActor(editor, workspaces)).rows, [{ id: workspaceA }]);
    assert.deepEqual((await asActor(viewer, missions)).rows, [{ id: id(8) }]);
    assert.deepEqual((await asActor(otherEditor, missions)).rows, [{ id: id(9) }]);
    assert.deepEqual((await asActor(null, missions)).rows, []);
    await assert.rejects(asActor(viewer, tx => insert(tx, workspaceA, projectA, id(10), viewer)), { code: '42501' });
    await assert.rejects(asActor(editor, tx => insert(tx, workspaceB, projectB, id(10), editor)), { code: '42501' });
    await assert.rejects(asActor(editor, tx => insert(tx, workspaceA, projectB, id(10), editor)), { code: '23503' });
    await assert.rejects(asActor(editor, tx => insert(tx, workspaceA, projectA, id(10), viewer)), { code: '42501' });
    await assert.rejects(asActor(editor, tx => tx.query('DELETE FROM alchemy.memberships')), { code: '42501' });
    await db.query('UPDATE alchemy.memberships SET revoked_at = now() WHERE actor_id = $1', [editor]);
    assert.deepEqual((await asActor(editor, missions)).rows, []);
    await assert.rejects(asActor(editor, tx => insert(tx, workspaceA, projectA, id(10), editor)), { code: '42501' });
    assert.deepEqual((await asActor(viewer, missions)).rows, [{ id: id(8) }]);
    const { rows } = await db.query("SELECT rolcanlogin, rolbypassrls, rolsuper FROM pg_roles WHERE rolname = 'alchemy_app'");
    assert.deepEqual(rows, [{ rolcanlogin: false, rolbypassrls: false, rolsuper: false }]);
    // Reuse one real PostgreSQL connection across successful and failed requests.
    let releases = 0;
    const store = workspaceStore({
      async connect() {
        return {
          query: (sql, values) => db.query(sql, values),
          release(discard) {
            assert.equal(discard, false);
            releases++;
          },
        };
      },
    });
    assert.deepEqual(await store.listWorkspaces(viewer), [{ id: workspaceA, name: 'A' }]);
    assert.deepEqual(await store.listProjects(viewer, workspaceB), []);
    const input = { title: ' Readiness ', goal: ' Verify release ', acceptance: ' Tests pass ' };
    await assert.rejects(store.createMission(viewer, workspaceA, projectA, input), { code: '42501' });
    const saved = await store.createMission(otherEditor, workspaceB, projectB, input);
    assert.equal(saved.title, 'Readiness');
    assert.equal(saved.created_by, otherEditor);
    assert.deepEqual(await store.listMissions(viewer, workspaceB, projectB), []);
    assert.ok((await store.listMissions(otherEditor, workspaceB, projectB)).some(row => row.id === saved.id));
    assert.deepEqual(await store.listWorkspaces(editor), []);
    assert.equal(releases, 7);
    const context = await db.query("SELECT NULLIF(current_setting('alchemy.actor_id', true), '') AS actor");
    assert.equal(context.rows[0].actor, null);
  } finally {
    await db.close();
  }
});
