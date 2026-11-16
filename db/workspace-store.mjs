import { createHash, randomUUID } from 'node:crypto';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function requireId(value, field) {
  if (typeof value !== 'string' || !uuid.test(value)) throw new TypeError(field + ' must be a UUID');
  return value;
}

function required(value, label, limit) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text || text.length > limit) throw new TypeError(label + ' must contain 1 to ' + limit + ' characters');
  return text;
}

const draftDigest = "encode(sha256(convert_to(jsonb_build_array(title, goal, acceptance)::text, 'UTF8')), 'hex')";
const currentRevision = `COALESCE((SELECT max(v.revision) FROM alchemy.mission_revisions v
  WHERE v.workspace_id = m.workspace_id AND v.mission_id = m.id), 1)`;
const revisionHistory = `COALESCE((SELECT jsonb_agg(to_jsonb(v) - 'workspace_id' - 'mission_id' ORDER BY v.revision DESC)
            FROM alchemy.mission_revisions v WHERE v.workspace_id = m.workspace_id AND v.mission_id = m.id), '[]'::jsonb)`;

const planHistory = `COALESCE((
  SELECT jsonb_agg(jsonb_build_object('revision', plan.revision, 'version', plan.version,
    'steps', plan.steps, 'author_id', plan.author_id, 'recorded_at', plan.recorded_at,
    'review', CASE WHEN d.decision IS NOT NULL THEN jsonb_build_object(
      'decision', d.decision, 'reason', d.reason, 'reviewer_id', d.author_id, 'recorded_at', d.recorded_at) END,
    'withdrawal', CASE WHEN w.author_id IS NOT NULL THEN jsonb_build_object(
      'reason', w.reason, 'actor_id', w.author_id, 'recorded_at', w.recorded_at) END)
    ORDER BY plan.revision DESC, plan.version DESC)
  FROM alchemy.mission_plans plan LEFT JOIN alchemy.mission_plan_decisions d USING (workspace_id, mission_id, revision, version)
  LEFT JOIN alchemy.plan_approval_withdrawals w USING (workspace_id, mission_id, revision, version)
  WHERE plan.workspace_id = m.workspace_id AND plan.mission_id = m.id
), '[]'::jsonb)`;

const catalogEvidence = `COALESCE((
  SELECT jsonb_agg(to_jsonb(c) - 'workspace_id' - 'mission_id' - 'catalog_bytes'
    ORDER BY c.checked_at DESC, c.review_version DESC, c.catalog_sha256, c.checker_sha256)
  FROM alchemy.mission_catalog_checks c
  WHERE c.workspace_id = m.workspace_id AND c.mission_id = m.id
), '[]'::jsonb)`;

// Only a trusted server-side authentication handler should supply actorId.
export function workspaceStore(pool) {
  async function asActor(actorId, operation) {
    requireId(actorId, 'Authenticated actor');
    const client = await pool.connect();
    let discard = false;
    try {
      await client.query('BEGIN');
      await client.query('SET LOCAL ROLE alchemy_app');
      await client.query("SELECT set_config('alchemy.actor_id', $1, true)", [actorId]);
      const result = await operation(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      try {
        await client.query('ROLLBACK');
      } catch {
        discard = true;
      }
      throw error;
    } finally {
      client.release(discard);
    }
  }

  return {
    accountAppearance(actorId) {
      return asActor(actorId, async client => (
        await client.query('SELECT theme FROM alchemy.account_appearance WHERE actor_id = $1', [actorId])
      ).rows[0]?.theme ?? null);
    },
    saveAccountAppearance(actorId, theme) {
      return asActor(actorId, client => client.query(`INSERT INTO alchemy.account_appearance (actor_id,theme)
        VALUES ($1,$2) ON CONFLICT (actor_id) DO UPDATE SET theme=EXCLUDED.theme, updated_at=statement_timestamp()`, [actorId, theme]));
    },
    resetAccountAppearance(actorId) {
      return asActor(actorId, client => client.query('DELETE FROM alchemy.account_appearance WHERE actor_id = $1', [actorId]));
    },
    workspaceInvitations(actorId, { workspaceId = null, invitationId = null } = {}) {
      return asActor(actorId, async client => (
        await client.query(`SELECT id, workspace_id, workspace_name, invitee_id, role, expires_at,
          CASE WHEN state='pending' AND expires_at <= statement_timestamp() THEN 'expired' ELSE state END AS state
          FROM alchemy.workspace_invitations
          WHERE (($1::uuid IS NULL AND invitee_id=$2) OR workspace_id=$1) AND ($3::uuid IS NULL OR id=$3)
          ORDER BY created_at DESC,id LIMIT 50`, [workspaceId, actorId, invitationId])
      ).rows);
    },
    issueWorkspaceInvitation(actorId, workspaceId, inviteeId, role) {
      return asActor(actorId, async client => (
        await client.query('SELECT alchemy.issue_workspace_invitation($1,$2,$3) AS id', [workspaceId, inviteeId, role])
      ).rows[0].id);
    },
    revokeWorkspaceInvitation(actorId, workspaceId, invitationId) {
      return asActor(actorId, async client => (
        await client.query(`UPDATE alchemy.workspace_invitations SET state='revoked', decided_at=statement_timestamp(), decided_by=$3
          WHERE workspace_id=$1 AND id=$2 AND state='pending' AND expires_at > statement_timestamp() RETURNING id`,
        [workspaceId, invitationId, actorId])
      ).rows.length > 0);
    },
    respondWorkspaceInvitation(actorId, invitationId, response) {
      return asActor(actorId, async client => (
        await client.query('SELECT alchemy.respond_workspace_invitation($1,$2) AS status', [invitationId, response])
      ).rows[0].status);
    },
    createOwnedWorkspace(actorId, requestKey, name) {
      return asActor(actorId, async client => (
        await client.query('SELECT * FROM alchemy.create_owned_workspace($1,$2)', [requestKey, name])
      ).rows[0]);
    },
    releaseActivationOptions(actorId, workspaceId, projectId, candidateId) {
      return asActor(actorId, async client => (
        await client.query(`SELECT d.environment, active.id AS previous_id, active.candidate_id AS current_candidate_id,
          EXISTS (SELECT 1 FROM alchemy.release_environment_activations h WHERE
            h.workspace_id=d.workspace_id AND h.project_id=d.project_id AND h.environment=d.environment
            AND h.candidate_id=d.candidate_id) AS previously_active
          FROM alchemy.release_environment_decisions d JOIN alchemy.release_approver_grants g ON g.id = d.grant_id
          JOIN alchemy.workspace_team($1) team ON team.actor_id = d.reviewer_id AND team.revoked_at IS NULL
          LEFT JOIN LATERAL (SELECT h.id,h.candidate_id FROM alchemy.release_environment_activations h WHERE
            h.workspace_id=d.workspace_id AND h.project_id=d.project_id AND h.environment=d.environment
            ORDER BY h.sequence DESC LIMIT 1) active ON true
          WHERE d.workspace_id=$1 AND d.project_id=$2 AND d.candidate_id=$3 AND d.decision='approved'
            AND d.expires_at > statement_timestamp() AND g.revoked_at IS NULL ORDER BY d.environment`,
        [workspaceId, projectId, candidateId])
      ).rows);
    },
    releaseEnvironmentHistory(actorId, workspaceId, projectId, environment) {
      return asActor(actorId, async client => (
        await client.query(`SELECT event.candidate_id, event.operation, event.activated_at, event.activated_by, event.reason,
          previous.candidate_id AS previous_candidate_id
          FROM alchemy.release_environment_activations event
          LEFT JOIN alchemy.release_environment_activations previous ON previous.id = event.previous_id
            AND previous.workspace_id = event.workspace_id AND previous.project_id = event.project_id
            AND previous.environment = event.environment
          WHERE event.workspace_id = $1 AND event.project_id = $2 AND event.environment = $3
          ORDER BY event.sequence DESC LIMIT 50`, [workspaceId, projectId, environment])
      ).rows);
    },
    activateReleaseEnvironment(actorId, workspaceId, projectId, environment, candidateId, previousId, operation, reason) {
      return asActor(actorId, async client => {
        const scope = [workspaceId.toLowerCase(), projectId.toLowerCase(), environment];
        await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
          ['release:' + scope.join(':')]);
        const { rows: [current] } = await client.query(`SELECT id, candidate_id FROM alchemy.release_environment_activations
          WHERE workspace_id = $1 AND project_id = $2 AND environment = $3 ORDER BY sequence DESC LIMIT 1`, scope);
        if ((current?.id ?? null) !== (previousId?.toLowerCase() ?? null) || current?.candidate_id === candidateId.toLowerCase()) return false;
        const { rows } = await client.query(`INSERT INTO alchemy.release_environment_activations
          (workspace_id,project_id,environment,candidate_id,previous_id,operation,activated_by,reason)
          SELECT d.workspace_id,d.project_id,d.environment,d.candidate_id,$5,$6,$7,$8
          FROM alchemy.release_environment_decisions d JOIN alchemy.release_approver_grants g ON g.id = d.grant_id
          JOIN alchemy.workspace_team($1) team ON team.actor_id = d.reviewer_id AND team.revoked_at IS NULL
          WHERE d.workspace_id = $1 AND d.project_id = $2 AND d.environment = $3 AND d.candidate_id = $4
            AND d.decision = 'approved' AND d.expires_at > statement_timestamp() AND g.revoked_at IS NULL
            AND (($6 = 'rollback') = EXISTS (SELECT 1 FROM alchemy.release_environment_activations a
              WHERE a.workspace_id = $1 AND a.project_id = $2 AND a.environment = $3 AND a.candidate_id = $4))
          RETURNING id`, [...scope, candidateId, previousId, operation, actorId, reason]);
        return rows.length > 0;
      });
    },
    releaseApproverGrants(actorId, workspaceId, projectId, reviewerId = null) {
      return asActor(actorId, async client => (
        await client.query(`SELECT id, environment, reviewer_id, granted_by, granted_at, revoked_by, revoked_at
          FROM alchemy.release_approver_grants WHERE workspace_id = $1 AND project_id = $2 AND ($3::uuid IS NULL OR reviewer_id = $3)
          ORDER BY (revoked_at IS NOT NULL), granted_at DESC, id LIMIT 100`, [workspaceId, projectId, reviewerId])
      ).rows);
    },
    setReleaseApproverGrant(actorId, workspaceId, projectId, target, environment) {
      return asActor(actorId, async client => (
        await client.query(`INSERT INTO alchemy.release_approver_grants (workspace_id, project_id, environment, reviewer_id, granted_by)
          SELECT $1, $2, $3, team.actor_id, $5 FROM alchemy.workspace_team($1) team
          WHERE team.actor_id = $4 AND team.revoked_at IS NULL ON CONFLICT DO NOTHING RETURNING id`,
        [workspaceId, projectId, environment, target, actorId])
      ).rows.length > 0);
    },
    revokeReleaseApproverGrant(actorId, workspaceId, projectId, grantId) {
      return asActor(actorId, async client => (
        await client.query(`UPDATE alchemy.release_approver_grants SET revoked_at = statement_timestamp(), revoked_by = $4
          WHERE workspace_id = $1 AND project_id = $2 AND id = $3 AND revoked_at IS NULL RETURNING id`,
        [workspaceId, projectId, grantId, actorId])
      ).rows.length > 0);
    },
    releaseEnvironmentDecisions(actorId, workspaceId, projectId, candidateId) {
      return asActor(actorId, async client => (
        await client.query(`SELECT environment, reviewer_id, decision, reason, decided_at, expires_at, expires_at <= statement_timestamp() AS expired
          FROM alchemy.release_environment_decisions WHERE workspace_id = $1 AND project_id = $2 AND candidate_id = $3
          ORDER BY environment`, [workspaceId, projectId, candidateId])
      ).rows);
    },
    decideReleaseEnvironment(actorId, workspaceId, projectId, candidateId, grantId, environment, digest, decision, reason) {
      return asActor(actorId, async client => (
        await client.query(`INSERT INTO alchemy.release_environment_decisions
          (candidate_id,workspace_id,project_id,environment,archive_sha256,grant_id,reviewer_id,decision,reason,expires_at)
          SELECT c.id,c.workspace_id,c.project_id,g.environment,c.archive_sha256,g.id,$8,$6,$7,
            CASE WHEN $6 = 'approved' THEN statement_timestamp() + interval '24 hours' END
          FROM alchemy.archive_release_candidates c JOIN alchemy.release_approver_grants g USING (workspace_id,project_id)
          WHERE c.workspace_id = $1 AND c.project_id = $2 AND c.id = $3 AND g.id = $4
            AND g.environment = $5 AND g.reviewer_id = $8 AND g.revoked_at IS NULL AND c.archive_sha256 = $9
          ON CONFLICT DO NOTHING RETURNING candidate_id`,
        [workspaceId, projectId, candidateId, grantId, environment, decision, reason, actorId, digest])
      ).rows.length > 0);
    },
    archiveReleaseCandidates(actorId, workspaceId, projectId, candidateId = null) {
      return asActor(actorId, async client => (
        await client.query(`SELECT c.id, c.run_id, c.archive_sha256, c.proposed_by, c.proposed_at, c.reason,
          r.owner_name, r.repository_name, r.commit_sha
          FROM alchemy.archive_release_candidates c JOIN alchemy.archive_test_runs r ON r.id = c.run_id
          WHERE c.workspace_id = $1 AND c.project_id = $2 AND ($3::uuid IS NULL OR c.id = $3)
          ORDER BY c.proposed_at DESC, c.id LIMIT 50`, [workspaceId, projectId, candidateId])
      ).rows);
    },
    eligibleArchiveReleaseRun(actorId, workspaceId, projectId, runId) {
      return asActor(actorId, async client => (
        await client.query(`SELECT r.id, r.owner_name, r.repository_name, r.commit_sha, a.archive_sha256
          FROM alchemy.archive_test_runs r JOIN alchemy.project_source_archives a
            USING (workspace_id, project_id, owner_name, repository_name, commit_sha)
          WHERE r.workspace_id = $1 AND r.project_id = $2 AND r.id = $3
            AND r.state = 'finished' AND r.result->>'status' = 'finished' AND r.result->'exitCode' = '0'::jsonb
            AND r.result->>'commit' = r.commit_sha AND r.result->>'archiveSha256' = a.archive_sha256`,
        [workspaceId, projectId, runId])
      ).rows[0] ?? null);
    },
    proposeArchiveRelease(actorId, workspaceId, projectId, run, expectedDigest, reason) {
      return asActor(actorId, async client => (
        await client.query(`INSERT INTO alchemy.archive_release_candidates (workspace_id, project_id, run_id, archive_sha256, proposed_by, reason)
          VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (run_id) DO NOTHING RETURNING id`,
        [workspaceId, projectId, run, expectedDigest, actorId, reason])
      ).rows[0] ?? null);
    },
    archiveTestRuns(actorId, workspaceId, projectId, source, runId = null) {
      return asActor(actorId, async client => (
        await client.query(`SELECT id, state, requested_by, requested_at, finished_at${runId ? ', result' : ''}
          FROM alchemy.archive_test_runs WHERE workspace_id = $1 AND project_id = $2 AND
          owner_name = $3 AND repository_name = $4 AND commit_sha = $5 AND ($6::uuid IS NULL OR id = $6)
          ORDER BY requested_at DESC, id LIMIT 20`,
        [workspaceId, projectId, source.owner, source.repository, source.commit, runId])
      ).rows);
    },
    queueArchiveTestRun(actorId, workspaceId, projectId, source, runId) {
      return asActor(actorId, client => client.query(`INSERT INTO alchemy.archive_test_runs
        (id, workspace_id, project_id, owner_name, repository_name, commit_sha, requested_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT DO NOTHING`,
      [runId, workspaceId, projectId, source.owner, source.repository, source.commit, actorId]));
    },
    projectSourceArchive(actorId, workspaceId, projectId, source, download = false) {
      return asActor(actorId, async client => (
        await client.query(`SELECT archive_sha256, octet_length(content) AS size, recorded_by, recorded_at${download ? ', content' : ''}
          FROM alchemy.project_source_archives
          WHERE workspace_id = $1 AND project_id = $2 AND owner_name = $3 AND repository_name = $4 AND commit_sha = $5`,
        [workspaceId, projectId, source.owner, source.repository, source.commit])
      ).rows[0] ?? null);
    },
    recordProjectSourceArchive(actorId, workspaceId, projectId, source, content) {
      return asActor(actorId, client => client.query(`INSERT INTO alchemy.project_source_archives
        (workspace_id, project_id, owner_name, repository_name, commit_sha, content, recorded_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (workspace_id, project_id, owner_name, repository_name, commit_sha) DO NOTHING`,
      [workspaceId, projectId, source.owner, source.repository, source.commit, content, actorId]));
    },
    projectSourceFile(actorId, workspaceId, projectId, source, path) {
      return asActor(actorId, async client => (
        await client.query(`SELECT blob_sha, content, recorded_by, recorded_at FROM alchemy.project_source_files
          WHERE workspace_id = $1 AND project_id = $2 AND owner_name = $3 AND repository_name = $4
          AND commit_sha = $5 AND file_path = $6`,
        [workspaceId, projectId, source.owner, source.repository, source.commit, path])
      ).rows[0] ?? null);
    },
    projectSourceFiles(actorId, workspaceId, projectId) {
      return asActor(actorId, async client => (
        await client.query(`SELECT owner_name, repository_name, commit_sha, file_path, blob_sha
          FROM alchemy.project_source_files WHERE workspace_id = $1 AND project_id = $2
          ORDER BY recorded_at DESC, owner_name, repository_name, commit_sha, file_path LIMIT 50`,
        [workspaceId, projectId])
      ).rows);
    },
    recordProjectSourceFile(actorId, workspaceId, projectId, source, path, blob, content) {
      return asActor(actorId, client => client.query(`INSERT INTO alchemy.project_source_files
        (workspace_id, project_id, owner_name, repository_name, commit_sha, file_path, blob_sha, content, recorded_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (workspace_id, project_id, owner_name, repository_name, commit_sha, file_path) DO NOTHING`,
      [workspaceId, projectId, source.owner, source.repository, source.commit, path, blob, content, actorId]));
    },
    projectSource(actorId, workspaceId, projectId, source) {
      return asActor(actorId, async client => (
        await client.query(`SELECT tree_sha FROM alchemy.project_source_revisions
          WHERE workspace_id = $1 AND project_id = $2 AND owner_name = $3 AND repository_name = $4 AND commit_sha = $5`,
        [workspaceId, projectId, source.owner, source.repository, source.commit])
      ).rows[0] ?? null);
    },
    projectSources(actorId, workspaceId, projectId) {
      return asActor(actorId, async client => (
        await client.query(`SELECT owner_name, repository_name, commit_sha, tree_sha, recorded_by, recorded_at
          FROM alchemy.project_source_revisions WHERE workspace_id = $1 AND project_id = $2
          ORDER BY recorded_at DESC, owner_name, repository_name, commit_sha LIMIT 50`, [workspaceId, projectId])
      ).rows);
    },
    recordProjectSource(actorId, workspaceId, projectId, source, tree) {
      return asActor(actorId, client => client.query(`INSERT INTO alchemy.project_source_revisions
        (workspace_id, project_id, owner_name, repository_name, commit_sha, tree_sha, recorded_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (workspace_id, project_id, owner_name, repository_name, commit_sha) DO NOTHING`,
      [workspaceId, projectId, source.owner, source.repository, source.commit, tree, actorId]));
    },
    revocationAudit(actorId, workspaceId) {
      requireId(workspaceId, 'Workspace');
      return asActor(actorId, async client => (
        await client.query('SELECT * FROM alchemy.workspace_revocation_audit($1)', [workspaceId])
      ).rows);
    },

    sourceAudit(actorId, workspaceId, sourceId) {
      requireId(workspaceId, 'Workspace');
      return asActor(actorId, async client => (await client.query(`SELECT source_id, reason, actor_id, recorded_at, suppressed, decision_version
        FROM alchemy.source_suppressions
        WHERE workspace_id = $1 AND ($2::text IS NULL OR source_id = $2)
          AND EXISTS (SELECT 1 FROM alchemy.memberships WHERE workspace_id = $1 AND role = 'owner')
        ORDER BY recorded_at DESC, source_id, decision_version DESC LIMIT 50`, [workspaceId, sourceId])).rows);
    },
    sourceDecisions(actorId, workspaceId, sourceId = null) {
      requireId(workspaceId, 'Workspace');
      return asActor(actorId, async client => (await client.query(`SELECT source_id, reason, actor_id, recorded_at, suppressed, event_id
        FROM alchemy.source_suppressions WHERE workspace_id = $1 AND ($2::text IS NULL OR source_id = $2)
        ORDER BY decision_version DESC`, [workspaceId, sourceId])).rows);
    },
    sourceSuppressions(actorId, workspaceId) {
      requireId(workspaceId, 'Workspace');
      return asActor(actorId, async client => new Map((await client.query(`
        SELECT source_id, reason, actor_id, recorded_at FROM (
          SELECT DISTINCT ON (source_id) source_id, reason, actor_id, recorded_at, suppressed
          FROM alchemy.source_suppressions WHERE workspace_id = $1
          ORDER BY source_id, decision_version DESC
        ) latest WHERE suppressed`, [workspaceId])).rows.map(row => [row.source_id, row])));
    },
    recordSourceDecision(actorId, workspaceId, sourceId, reason, suppressed, expected = null) {
      requireId(workspaceId, 'Workspace');
      const note = required(reason, 'Reason', 500);
      return asActor(actorId, async client => {
        await client.query("SELECT pg_advisory_xact_lock(hashtext($1::uuid::text || ':' || $2::text), 17)", [workspaceId, sourceId]);
        const { rows: [latest] } = await client.query(`SELECT event_id, suppressed, decision_version FROM alchemy.source_suppressions
          WHERE workspace_id = $1 AND source_id = $2 ORDER BY decision_version DESC LIMIT 1`, [workspaceId, sourceId]);
        if ((latest?.event_id ?? null) !== expected) return !expected && suppressed && latest?.suppressed;
        if ((latest?.suppressed ?? false) === suppressed) return true;
        await client.query(`INSERT INTO alchemy.source_suppressions
          (workspace_id, source_id, actor_id, reason, suppressed, decision_version) VALUES ($1, $2, $3, $4, $5, $6::bigint + 1)`,
        [workspaceId, sourceId, actorId, note, suppressed, latest?.decision_version ?? 0]);
        return true;
      });
    },
    listWorkspaces(actorId) {
      return asActor(actorId, async client => (
        await client.query('SELECT id, name FROM alchemy.workspaces ORDER BY name, id')
      ).rows);
    },
    getWorkspace(actorId, workspaceId) {
      requireId(workspaceId, 'Workspace');
      return asActor(actorId, async client => (
        await client.query(`SELECT w.id, w.name, m.role FROM alchemy.workspaces w
          JOIN alchemy.memberships m ON m.workspace_id = w.id WHERE w.id = $1`, [workspaceId])
      ).rows[0] ?? null);
    },
    workspaceTeam(actorId, workspaceId) {
      requireId(workspaceId, 'Workspace');
      return asActor(actorId, async client => (
        await client.query('SELECT * FROM alchemy.workspace_team($1)', [workspaceId])
      ).rows);
    },
    grantWorkspaceMember(actorId, workspaceId, memberId, role) {
      requireId(workspaceId, 'Workspace');
      requireId(memberId, 'Member');
      return asActor(actorId, async client => (
        await client.query('SELECT alchemy.grant_workspace_member($1, $2, $3) AS granted', [workspaceId, memberId, role])
      ).rows[0].granted);
    },
    changeWorkspaceMemberRole(actorId, workspaceId, memberId, previousRole, nextRole) {
      requireId(workspaceId, 'Workspace');
      requireId(memberId, 'Member');
      return asActor(actorId, async client => (
        await client.query('SELECT alchemy.change_workspace_member_role($1, $2, $3, $4) AS changed',
          [workspaceId, memberId, previousRole, nextRole])
      ).rows[0].changed);
    },
    workspaceMemberRoleHistory(actorId, workspaceId) {
      requireId(workspaceId, 'Workspace');
      return asActor(actorId, async client => (
        await client.query('SELECT * FROM alchemy.workspace_member_role_history($1)', [workspaceId])
      ).rows);
    },
    revokeWorkspaceMember(actorId, workspaceId, memberId) {
      requireId(workspaceId, 'Workspace');
      requireId(memberId, 'Member');
      return asActor(actorId, async client => (
        await client.query('SELECT alchemy.revoke_workspace_member($1, $2) AS revoked', [workspaceId, memberId])
      ).rows[0].revoked);
    },
    listProjects(actorId, workspaceId) {
      requireId(workspaceId, 'Workspace');
      return asActor(actorId, async client => (
        await client.query('SELECT id, name FROM alchemy.projects WHERE workspace_id = $1 ORDER BY name, id', [workspaceId])
      ).rows);
    },
    deleteProject(actorId, workspaceId, projectId, expectedName) {
      return asActor(actorId, async client => (await client.query(`DELETE FROM alchemy.projects
        WHERE workspace_id = $1 AND id = $2 AND name = $3 RETURNING id`,
      [workspaceId, projectId, expectedName])).rows.length === 1);
    },
    editProject(actorId, workspaceId, projectId, name, expectedName, purpose, expectedPurpose) {
      const title = required(name, 'Project name', 100);
      return asActor(actorId, async client => (await client.query(`UPDATE alchemy.projects SET name = $3, purpose = COALESCE($5, purpose)
        WHERE workspace_id = $1 AND id = $2 AND name = $4 AND ($6::text IS NULL OR replace(replace(purpose, chr(13) || chr(10), chr(10)), chr(13), chr(10)) = $6) RETURNING id`,
      [workspaceId, projectId, title, expectedName, purpose?.trim() ?? null, expectedPurpose ?? null])).rows.length === 1);
    },
    createProject(actorId, workspaceId, name, purpose = '', submissionKey = null) {
      requireId(workspaceId, 'Workspace');
      if (submissionKey !== null) requireId(submissionKey, 'Submission key');
      const title = required(name, 'Project name', 100);
      const normalizedPurpose = purpose.trim();
      const digest = createHash('sha256').update(JSON.stringify([title, normalizedPurpose])).digest('hex');
      return asActor(actorId, async client => {
        const projectId = randomUUID();
        if (submissionKey !== null) {
          const claim = await client.query(`INSERT INTO alchemy.project_submissions
            (workspace_id, actor_id, submission_key, project_id, digest) VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT DO NOTHING RETURNING project_id`, [workspaceId, actorId, submissionKey, projectId, digest]);
          if (!claim.rows.length) {
            const { rows: [existing] } = await client.query(`SELECT p.id FROM alchemy.project_submissions s
              JOIN alchemy.projects p ON p.workspace_id = s.workspace_id AND p.id = s.project_id
              WHERE s.workspace_id = $1 AND s.actor_id = $2 AND s.submission_key = $3 AND s.digest = $4`,
            [workspaceId, actorId, submissionKey, digest]);
            return existing ?? null;
          }
        }
        const { rows: [created] } = await client.query(`INSERT INTO alchemy.projects
          (workspace_id, id, name, purpose) VALUES ($1, $2, $3, $4) RETURNING id`,
        [workspaceId, projectId, title, normalizedPurpose]);
        return created;
      });
    },
    getProject(actorId, workspaceId, projectId) {
      requireId(workspaceId, 'Workspace');
      requireId(projectId, 'Project');
      return asActor(actorId, async client => (
        await client.query(`SELECT p.id, p.name, p.purpose, m.role FROM alchemy.projects p
          JOIN alchemy.memberships m ON m.workspace_id = p.workspace_id
          WHERE p.workspace_id = $1 AND p.id = $2`, [workspaceId, projectId])
      ).rows[0] ?? null);
    },
    missionDraft(actorId, workspaceId, projectId) {
      return asActor(actorId, async client => (
        await client.query(`SELECT title, goal, acceptance, ${draftDigest} AS digest FROM alchemy.mission_drafts
          WHERE workspace_id = $1 AND project_id = $2 AND actor_id = $3`, [workspaceId, projectId, actorId])
      ).rows[0]);
    },
    discardMissionDraft(actorId, workspaceId, projectId, digest) {
      return asActor(actorId, async client => (
        await client.query(`DELETE FROM alchemy.mission_drafts
          WHERE workspace_id = $1 AND project_id = $2 AND actor_id = $3 AND ${draftDigest} = $4
          RETURNING actor_id`, [workspaceId, projectId, actorId, digest])
      ).rows.length === 1);
    },
    saveMissionDraft(actorId, workspaceId, projectId, { title, goal, acceptance }, expectedDigest) {
      const values = [workspaceId, projectId, actorId, title, goal, acceptance];
      return asActor(actorId, async client => {
        const result = expectedDigest
          ? await client.query(`UPDATE alchemy.mission_drafts SET title = $4, goal = $5, acceptance = $6
            WHERE workspace_id = $1 AND project_id = $2 AND actor_id = $3 AND ${draftDigest} = $7
            RETURNING actor_id`, [...values, expectedDigest])
          : await client.query(`INSERT INTO alchemy.mission_drafts
            (workspace_id, project_id, actor_id, title, goal, acceptance) VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT DO NOTHING RETURNING actor_id`, values);
        return result.rows.length === 1;
      });
    },

    listMissions(actorId, workspaceId, projectId, snapshot = null) {
      requireId(workspaceId, 'Workspace');
      requireId(projectId, 'Project');
      return asActor(actorId, async client => (
        await client.query(`SELECT m.id, m.title, COALESCE(v.goal, m.goal) AS goal, COALESCE(v.acceptance, m.acceptance) AS acceptance, m.created_by${snapshot ? `, COALESCE(v.revision, 1) AS revision, r.decision,
          CASE WHEN c.review_version IS NOT NULL THEN cardinality(c.failures) = 0 END AS catalog_passed` : ''}
          FROM alchemy.missions m LEFT JOIN LATERAL (
            SELECT revision, goal, acceptance FROM alchemy.mission_revisions
            WHERE workspace_id = m.workspace_id AND mission_id = m.id ORDER BY revision DESC LIMIT 1
                    ) v ON true
          ${snapshot ? `LEFT JOIN LATERAL (
            SELECT version, decision FROM alchemy.mission_reviews
            WHERE workspace_id = m.workspace_id AND mission_id = m.id AND mission_revision = COALESCE(v.revision, 1)
            ORDER BY version DESC LIMIT 1
          ) r ON true
          LEFT JOIN alchemy.mission_catalog_checks c ON c.workspace_id = m.workspace_id AND c.mission_id = m.id
            AND c.review_version = r.version AND c.catalog_sha256 = $3 AND c.checker_sha256 = $4` : ''}
          WHERE m.workspace_id = $1 AND m.project_id = $2 ORDER BY m.title, m.id`, snapshot ? [workspaceId, projectId, snapshot.catalogSha256, snapshot.checkerSha256] : [workspaceId, projectId])
      ).rows);
    },
    createMission(actorId, workspaceId, projectId, input, submissionKey = null, { clearDraft = false } = {}) {
      requireId(workspaceId, 'Workspace');
      requireId(projectId, 'Project');
      const title = required(input?.title, 'Title', 100);
      const goal = required(input?.goal, 'Goal', 2000);
      const acceptance = required(input?.acceptance, 'Acceptance criteria', 2000);
      if (submissionKey !== null) submissionKey = requireId(submissionKey, 'Submission key');
      return asActor(actorId, async client => {
        const { rows: [created] } = await client.query(`INSERT INTO alchemy.missions
          (workspace_id, project_id, id, title, goal, acceptance, created_by, submission_key)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          ON CONFLICT ON CONSTRAINT mission_submission_once DO NOTHING
          RETURNING id, title, goal, acceptance, created_by`,
        [workspaceId, projectId, randomUUID(), title, goal, acceptance, actorId, submissionKey]);
        if (created) {
          if (clearDraft) await client.query(`DELETE FROM alchemy.mission_drafts
            WHERE workspace_id = $1 AND project_id = $2 AND actor_id = $3
              AND title = $4 AND goal = $5 AND acceptance = $6`,
          [workspaceId, projectId, actorId, input.title, input.goal, input.acceptance]);
          return created;
        }
        const { rows: [existing] } = await client.query(`SELECT id, title, goal, acceptance, created_by
          FROM alchemy.missions WHERE workspace_id = $1 AND project_id = $2 AND created_by = $3 AND submission_key = $4`,
        [workspaceId, projectId, actorId, submissionKey]);
        if (existing?.title === title && existing.goal === goal && existing.acceptance === acceptance) return existing;
        const conflict = new Error('Submission key already used for a different mission');
        conflict.code = 'MISSION_SUBMISSION_CONFLICT';
        throw conflict;
      });
    },
    missionReview(actorId, workspaceId, projectId, missionId, { includeEvidence = false } = {}) {
      for (const value of [workspaceId, projectId, missionId]) requireId(value, 'Record');
      return asActor(actorId, async client => {
        const { rows: [record] } = await client.query(`SELECT m.id, m.title, m.goal, m.acceptance,
          ${revisionHistory} AS revisions,
          COALESCE((SELECT jsonb_agg(jsonb_build_object(
            'version', r.version, 'mission_revision', r.mission_revision, 'decision', r.decision, 'evidence', r.evidence,
            'reviewer', r.reviewer, 'recorded_at', r.recorded_at) ORDER BY r.version DESC)
          FROM alchemy.mission_reviews r WHERE r.workspace_id = m.workspace_id AND r.mission_id = m.id
          ), '[]'::jsonb) AS history${includeEvidence ? ', ' + catalogEvidence + ' AS catalog_checks, ' + planHistory + ' AS plans' : ''}
          FROM alchemy.missions m
          WHERE m.workspace_id = $1 AND m.project_id = $2 AND m.id = $3`, [workspaceId, projectId, missionId]);
        if (!record) return null;
        const { history, revisions, catalog_checks, plans, ...mission } = record;
        return { mission, history, revisions, plans, catalogChecks: catalog_checks };
      });
    },
    projectPlans(actorId, workspaceId, projectId, pendingOnly = false) {
      return asActor(actorId, async client => (await client.query(`SELECT m.id, m.title, ${currentRevision} AS current_revision,
          latest.revision, latest.version, CASE WHEN w.author_id IS NOT NULL THEN 'withdrawn' ELSE d.decision END AS decision
        FROM alchemy.missions m JOIN LATERAL (
          SELECT revision, version FROM alchemy.mission_plans
          WHERE workspace_id = m.workspace_id AND mission_id = m.id
          ORDER BY revision DESC, version DESC LIMIT 1
        ) latest ON true
        LEFT JOIN alchemy.mission_plan_decisions d ON d.workspace_id = m.workspace_id AND d.mission_id = m.id
          AND d.revision = latest.revision AND d.version = latest.version
        LEFT JOIN alchemy.plan_approval_withdrawals w ON (w.workspace_id, w.mission_id, w.revision, w.version) = (d.workspace_id, d.mission_id, d.revision, d.version)
        WHERE m.workspace_id = $1 AND m.project_id = $2
          AND (NOT $3::boolean OR (latest.revision = ${currentRevision} AND d.decision IS NULL))
        ORDER BY m.title, m.id`, [workspaceId, projectId, pendingOnly])).rows);
    },
    missionPlans(actorId, workspaceId, missionId, selected = null) {
      return asActor(actorId, async client => (await client.query(`SELECT p.revision, p.version, p.steps, p.author_id, p.recorded_at,
          d.decision, d.reason, d.author_id AS reviewer_id, d.recorded_at AS decided_at, w.author_id AS withdrawn_by, w.reason AS withdrawal_reason, w.recorded_at AS withdrawn_at
        FROM alchemy.mission_plans p LEFT JOIN alchemy.mission_plan_decisions d USING (workspace_id, mission_id, revision, version)
        LEFT JOIN alchemy.plan_approval_withdrawals w USING (workspace_id, mission_id, revision, version)
        WHERE p.workspace_id = $1 AND p.mission_id = $2
          AND ($3::integer IS NULL OR (p.revision = $3 AND p.version = $4))
        ORDER BY p.revision DESC, p.version DESC LIMIT 50`, [workspaceId, missionId, selected?.revision ?? null, selected?.version ?? null])).rows);
    },
    decideMissionPlan(actorId, workspaceId, projectId, missionId, { revision, version, decision, reason }) {
      if (![revision, version].every(value => Number.isInteger(value) && value > 0 && value <= 2147483647) ||
          !['approved', 'denied', 'withdrawn'].includes(decision)) throw new TypeError('Choose a valid plan decision');
      const note = required(reason, 'Decision reason', 2000);
      return asActor(actorId, async client => {
        await client.query("SELECT pg_advisory_xact_lock(hashtext($1::uuid::text || ':' || $2::uuid::text), 10)", [workspaceId, missionId]);
        if (decision === 'withdrawn') {
          const result = await client.query(`INSERT INTO alchemy.plan_approval_withdrawals
            (workspace_id, mission_id, revision, version, author_id, reason)
            SELECT d.workspace_id, d.mission_id, d.revision, d.version, $6, $7
            FROM alchemy.mission_plan_decisions d JOIN alchemy.missions m
              ON m.workspace_id = d.workspace_id AND m.id = d.mission_id
            WHERE d.workspace_id = $1 AND m.project_id = $2 AND d.mission_id = $3
              AND d.revision = $4 AND d.version = $5 AND d.decision = 'approved'
            ON CONFLICT DO NOTHING RETURNING version`, [workspaceId, projectId, missionId, revision, version, actorId, note]);
          return result.rows.length === 1;
        }
        const result = await client.query(`INSERT INTO alchemy.mission_plan_decisions
          (workspace_id, mission_id, revision, version, author_id, decision, reason)
          SELECT m.workspace_id, m.id, $4, $5, $6, $7, $8 FROM alchemy.missions m
          WHERE m.workspace_id = $1 AND m.project_id = $2 AND m.id = $3 AND ${currentRevision} = $4
            AND (SELECT max(p.version) FROM alchemy.mission_plans p
              WHERE p.workspace_id = m.workspace_id AND p.mission_id = m.id AND p.revision = $4) = $5
          ON CONFLICT DO NOTHING RETURNING version`, [workspaceId, projectId, missionId, revision, version, actorId, decision, note]);
        return result.rows.length === 1;
      });
    },

    saveMissionPlan(actorId, workspaceId, projectId, missionId, { revision, version, steps }) {
      if (!Number.isInteger(revision) || revision < 1 || revision > 2147483647 ||
          !Number.isInteger(version) || version < 0 || version >= 2147483647) throw new TypeError('Invalid plan version');
      const plan = required(steps, 'Work plan', 4000);
      return asActor(actorId, async client => {
        await client.query("SELECT pg_advisory_xact_lock(hashtext($1::uuid::text || ':' || $2::uuid::text), 10)", [workspaceId, missionId]);
        const result = await client.query(`INSERT INTO alchemy.mission_plans
          (workspace_id, mission_id, revision, version, steps, author_id)
          SELECT m.workspace_id, m.id, $4, $5::integer + 1, $6, $7 FROM alchemy.missions m
          WHERE m.workspace_id = $1 AND m.project_id = $2 AND m.id = $3 AND ${currentRevision} = $4
            AND COALESCE((SELECT max(p.version) FROM alchemy.mission_plans p
              WHERE p.workspace_id = m.workspace_id AND p.mission_id = m.id AND p.revision = $4), 0) = $5
          RETURNING version`, [workspaceId, projectId, missionId, revision, version, plan, actorId]);
        return result.rows.length === 1;
      });
    },

    reviseMission(actorId, workspaceId, projectId, missionId, { revision, goal, acceptance }) {
      for (const value of [workspaceId, projectId, missionId]) requireId(value, 'Record');
      if (!Number.isInteger(revision) || revision < 1 || revision >= 2147483647) throw new TypeError('Invalid revision');
      goal = required(goal, 'Goal', 2000);
      acceptance = required(acceptance, 'Acceptance criteria', 2000);
      return asActor(actorId, async client => {
        await client.query("SELECT pg_advisory_xact_lock(hashtext($1::uuid::text || ':' || $2::uuid::text), 10)", [workspaceId, missionId]);
        const result = await client.query(`INSERT INTO alchemy.mission_revisions
          (workspace_id, mission_id, revision, goal, acceptance, author_id)
          SELECT m.workspace_id, m.id, $4::integer + 1, $5, $6, $7 FROM alchemy.missions m
          WHERE m.workspace_id = $1 AND m.project_id = $2 AND m.id = $3 AND ${currentRevision} = $4
          RETURNING revision`, [workspaceId, projectId, missionId, revision, goal, acceptance, actorId]);
        return result.rows.length === 1;
      });
    },
    catalogChecks(actorId, workspaceId, missionId, receipt = null) {
      for (const value of [workspaceId, missionId]) requireId(value, 'Record');
      return asActor(actorId, async client => (
        await client.query(`SELECT c.review_version, c.actor_id, c.catalog_sha256, c.checker_sha256,
          c.record_count, c.failures, c.checked_at, r.mission_revision, c.catalog_bytes IS NOT NULL AS has_catalog_input
          FROM alchemy.mission_catalog_checks c JOIN alchemy.mission_reviews r
            ON r.workspace_id = c.workspace_id AND r.mission_id = c.mission_id AND r.version = c.review_version
          WHERE c.workspace_id = $1 AND c.mission_id = $2
          AND ($3::integer IS NULL OR (c.review_version = $3 AND c.catalog_sha256 = $4 AND c.checker_sha256 = $5))
          ORDER BY checked_at DESC, review_version DESC, catalog_sha256, checker_sha256 LIMIT 50`,
        [workspaceId, missionId, receipt?.version ?? null, receipt?.catalog ?? null, receipt?.checker ?? null])
      ).rows);
    },
    async catalogReceiptInput(actorId, workspaceId, missionId, receipt) {
      for (const value of [workspaceId, missionId]) requireId(value, 'Record');
      return asActor(actorId, async client => (
        await client.query(`SELECT catalog_bytes FROM alchemy.mission_catalog_checks
          WHERE workspace_id = $1 AND mission_id = $2 AND review_version = $3
            AND catalog_sha256 = $4 AND checker_sha256 = $5`,
        [workspaceId, missionId, receipt.version, receipt.catalog, receipt.checker])
      ).rows[0]?.catalog_bytes ?? null);
    },
    recordCatalogCheck(actorId, workspaceId, projectId, missionId, version, evidence, catalog) {
      for (const value of [workspaceId, projectId, missionId]) requireId(value, 'Record');
      return asActor(actorId, async client => {
        await client.query("SELECT pg_advisory_xact_lock(hashtext($1::uuid::text || ':' || $2::uuid::text), 10)", [workspaceId, missionId]);
        const { rows: [review] } = await client.query(`SELECT r.version, r.decision FROM alchemy.missions m
          JOIN alchemy.mission_reviews r ON r.workspace_id = m.workspace_id AND r.mission_id = m.id
          WHERE m.workspace_id = $1 AND m.project_id = $2 AND m.id = $3 AND r.mission_revision = ${currentRevision} ORDER BY r.version DESC LIMIT 1`,
        [workspaceId, projectId, missionId]);
        if (review?.version !== version || review.decision !== 'accepted') return false;
        await client.query(`INSERT INTO alchemy.mission_catalog_checks
          (workspace_id, mission_id, review_version, actor_id, catalog_sha256, checker_sha256, record_count, failures, catalog_bytes)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) ON CONFLICT DO NOTHING`,
        [workspaceId, missionId, version, actorId, evidence.catalogSha256, evidence.checkerSha256,
          evidence.recordCount, evidence.failures, catalog]);
        return true;
      });
    },
    pendingReviews(actorId, workspaceId, projectId = null) {
      requireId(workspaceId, 'Workspace');
      if (projectId !== null) requireId(projectId, 'Project');
      return asActor(actorId, async client => (
        await client.query(`SELECT m.id, m.title, m.project_id, p.name AS project_name, ${currentRevision} AS revision
          FROM alchemy.missions m JOIN alchemy.projects p ON p.workspace_id = m.workspace_id AND p.id = m.project_id
          WHERE m.workspace_id = $1 AND ($2::uuid IS NULL OR m.project_id = $2) AND NOT EXISTS (
            SELECT 1 FROM alchemy.mission_reviews r
            WHERE r.workspace_id = m.workspace_id AND r.mission_id = m.id
              AND r.mission_revision = ${currentRevision}
          )
          ORDER BY m.created_at ASC NULLS FIRST, m.id`, [workspaceId, projectId])
      ).rows);
    },
    projectEvidence(actorId, workspaceId, projectId, result) {
      requireId(workspaceId, 'Workspace');
      requireId(projectId, 'Project');
      return asActor(actorId, async client => (
        await client.query(`SELECT m.id AS mission_id, m.title, r.mission_revision,
          c.review_version, c.checked_at, c.catalog_sha256, c.checker_sha256, cardinality(c.failures) = 0 AS passed,
          concat_ws('-', c.review_version, c.catalog_sha256, c.checker_sha256) AS receipt,
          r.mission_revision = ${currentRevision} AND r.version = (
            SELECT max(latest.version) FROM alchemy.mission_reviews latest
            WHERE latest.workspace_id = m.workspace_id AND latest.mission_id = m.id
          ) AS current_review
          FROM alchemy.mission_catalog_checks c
          JOIN alchemy.missions m ON m.workspace_id = c.workspace_id AND m.id = c.mission_id
          JOIN alchemy.mission_reviews r
            ON r.workspace_id = c.workspace_id AND r.mission_id = c.mission_id AND r.version = c.review_version
          WHERE m.workspace_id = $1 AND m.project_id = $2
            AND ($3::boolean IS NULL OR (cardinality(c.failures) = 0) = $3)
          ORDER BY c.checked_at DESC, m.id, c.review_version DESC, c.catalog_sha256, c.checker_sha256 LIMIT 50`,
        [workspaceId, projectId, result])
      ).rows);
    },
    recentActivity(actorId, workspaceId = null) {
      if (workspaceId !== null) requireId(workspaceId, 'Workspace');
      return asActor(actorId, async client => (
        await client.query(`SELECT events.*, w.name AS workspace_name FROM (
          SELECT workspace_id, id AS mission_id, project_id, title, created_at AS happened_at,
            'created' AS action, 0 AS version, created_by AS actor_id, NULL::text AS receipt FROM alchemy.missions
          WHERE ($1::uuid IS NULL OR workspace_id = $1) AND created_at IS NOT NULL
          UNION ALL
          SELECT m.workspace_id, m.id, m.project_id, m.title, r.recorded_at, r.decision, r.version, r.reviewer, NULL::text
          FROM alchemy.mission_reviews r JOIN alchemy.missions m
            ON m.workspace_id = r.workspace_id AND m.id = r.mission_id
          WHERE ($1::uuid IS NULL OR r.workspace_id = $1)
          UNION ALL
          SELECT m.workspace_id, m.id, m.project_id, m.title, c.checked_at,
            CASE WHEN cardinality(c.failures) = 0 THEN 'catalog-passed' ELSE 'catalog-failed' END,
            c.review_version, c.actor_id, concat_ws('-', c.review_version, c.catalog_sha256, c.checker_sha256)
          FROM alchemy.mission_catalog_checks c JOIN alchemy.missions m
            ON m.workspace_id = c.workspace_id AND m.id = c.mission_id
          WHERE ($1::uuid IS NULL OR c.workspace_id = $1)
          UNION ALL
          SELECT m.workspace_id, m.id, m.project_id, m.title, v.recorded_at,
            'revised', v.revision, v.author_id, NULL::text
          FROM alchemy.mission_revisions v JOIN alchemy.missions m
            ON m.workspace_id = v.workspace_id AND m.id = v.mission_id
          WHERE ($1::uuid IS NULL OR v.workspace_id = $1)
          UNION ALL
          SELECT m.workspace_id, m.id, m.project_id, m.title, p.recorded_at,
            'plan-saved', p.version, p.author_id, concat_ws('-', p.revision, p.version)
          FROM alchemy.mission_plans p JOIN alchemy.missions m
            ON m.workspace_id = p.workspace_id AND m.id = p.mission_id
          WHERE ($1::uuid IS NULL OR p.workspace_id = $1)
          UNION ALL
          SELECT m.workspace_id, m.id, m.project_id, m.title, d.recorded_at,
            'plan-' || d.decision, d.version, d.author_id, concat_ws('-', d.revision, d.version)
          FROM alchemy.mission_plan_decisions d JOIN alchemy.missions m
            ON m.workspace_id = d.workspace_id AND m.id = d.mission_id
          WHERE ($1::uuid IS NULL OR d.workspace_id = $1)
        ) AS events JOIN alchemy.workspaces w ON w.id = events.workspace_id
        ORDER BY happened_at DESC, workspace_id, mission_id, version DESC, action, receipt LIMIT 50`, [workspaceId])
      ).rows);
    },
    exportProjects(actorId, workspaceId, projectId = null) {
      requireId(workspaceId, 'Workspace');
      if (projectId !== null) requireId(projectId, 'Project');
      return asActor(actorId, async client => (
        await client.query(`SELECT w.id, w.name, COALESCE((
          SELECT jsonb_agg(jsonb_build_object('id', p.id, 'name', p.name, 'purpose', p.purpose, 'missions', COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'id', m.id, 'title', m.title, 'goal', m.goal, 'acceptance', m.acceptance,
            'created_by', m.created_by, 'revisions', ${revisionHistory}, 'plans', ${planHistory}, 'reviews', COALESCE((
              SELECT jsonb_agg(jsonb_build_object('version', r.version, 'mission_revision', r.mission_revision, 'decision', r.decision,
                'evidence', r.evidence, 'reviewer', r.reviewer, 'recorded_at', r.recorded_at)
                ORDER BY r.version DESC)
              FROM alchemy.mission_reviews r WHERE r.workspace_id = m.workspace_id AND r.mission_id = m.id
            ), '[]'::jsonb), 'catalogChecks', ${catalogEvidence}) ORDER BY m.title, m.id)
          FROM alchemy.missions m WHERE m.workspace_id = p.workspace_id AND m.project_id = p.id
        ), '[]'::jsonb)) ORDER BY p.name, p.id)
          FROM alchemy.projects p WHERE p.workspace_id = w.id AND ($2::uuid IS NULL OR p.id = $2)
        ), '[]'::jsonb) AS projects
        FROM alchemy.workspaces w WHERE w.id = $1 AND ($2::uuid IS NOT NULL OR EXISTS (
          SELECT 1 FROM alchemy.memberships m WHERE m.workspace_id = w.id AND m.role = 'owner'
        ))`, [workspaceId, projectId])
      ).rows[0] ?? null);
    },
    recordReview(actorId, workspaceId, projectId, missionId, { decision, evidence, version, revision = 1 }) {
      for (const value of [workspaceId, projectId, missionId]) requireId(value, 'Record');
      if (!['accepted', 'changes-requested'].includes(decision) ||
          !Number.isInteger(version) || version < 0 || version >= 2147483647) throw new TypeError('Invalid review');
      const note = required(evidence, 'Review evidence', 2000);
      return asActor(actorId, async client => {
        await client.query("SELECT pg_advisory_xact_lock(hashtext($1::uuid::text || ':' || $2::uuid::text), 10)", [workspaceId, missionId]);
        const result = await client.query(`INSERT INTO alchemy.mission_reviews
          (workspace_id, mission_id, version, reviewer, decision, evidence, mission_revision)
          SELECT workspace_id, id, $4::integer + 1, $5, $6, $7, $8 FROM alchemy.missions m
          WHERE workspace_id = $1 AND project_id = $2 AND id = $3
          AND ${currentRevision} = $8 AND COALESCE((SELECT MAX(version) FROM alchemy.mission_reviews
            WHERE workspace_id = $1 AND mission_id = $3), 0) = $4
          ON CONFLICT DO NOTHING RETURNING version`,
        [workspaceId, projectId, missionId, version, actorId, decision, note, revision]);
        return result.rows.length === 1;
      });
    },
  };
}
