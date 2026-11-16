import { catalogRecords, catalogSnapshot, checkCatalog } from './catalog-check.mjs';
import { workspaceStore } from '../../db/workspace-store.mjs';
import { sessionStore } from '../../db/session-store.mjs';
import { readFile } from 'node:fs/promises';
import { retrieve } from '../../docs/flex-alchemy/knowledge/retrieve.mjs';
import { randomUUID } from 'node:crypto';
import { compareGitHubArchiveFiles, inspectGitHubDirectory, isRegularGitHubFile, parseGitHubSource, readGitHubArchive, readGitHubTextFile, verifyGitHubSource } from './github-source.mjs';
import { inventoryArchive } from './archive-verification.mjs';

const style = await readFile(new URL('../local/style.css', import.meta.url), 'utf8');

const id = '[0-9a-fA-F]{8}-(?:[0-9a-fA-F]{4}-){3}[0-9a-fA-F]{12}';
const projects = new RegExp('^/api/workspaces/(' + id + ')/projects$');
const workspaceRoute = new RegExp('^/workspaces/(' + id + ')(/export|/activity|/team|/team/grant|/knowledge|/settings/audit|/reviews|/projects/new)?$');
const accountIdPattern = new RegExp('^' + id + '$');
const releaseEnvironments = ['staging', 'production'];
const browsableDirectory = path => path.length <= 700 && path.split('/').length <= 8
  && path.split('/').every(part => part && !['.', '..'].includes(part) && !/[\u0000-\u001f\u007f]/.test(part));
const previewableName = name => name.length > 0 && name.length <= 255
  && !name.includes('/') && name !== '.' && name !== '..' && !/[\u0000-\u001f\u007f]/.test(name);
const repositoryPreview = (path, name, commit, directory = '', offset = 0) => path + '?'
  + new URLSearchParams({ repository: name, commit, ...(directory ? { directory } : {}), ...(offset ? { offset: String(offset) } : {}) });
const repositoryFilePreview = (path, name, commit, directory, file, offset) =>
  repositoryPreview(path, name, commit, directory, offset) + '&' + new URLSearchParams({ file });
const projectRoute = new RegExp('^/workspaces/(' + id + ')/projects/(' + id + ')(/export|/evidence|/reviews|/plans|/decisions|/edit|/delete|/missions/new|/missions|/repository|/releases)?$');
const missions = new RegExp('^/api/workspaces/(' + id + ')/projects/(' + id + ')/missions$');
const reviewRoute = new RegExp('^/workspaces/(' + id + ')/projects/(' + id + ')/missions/(' + id + ')(/export|/sources|/verification|/revise|/plan)?$');
const decisionLabel = decision => decision === 'accepted' ? 'Accepted by reviewer' : 'Changes requested';
const sessionCookie = '__Host-alchemy_session';
const escapeHtml = value => String(value).replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[character]));

function verificationReceiptPath(path, key) {
  return path + '?receipt=' + encodeURIComponent(key);
}
function catalogInputStatus(check, snapshot) {
  if (!snapshot) return 'unavailable';
  return check.catalog_sha256 === snapshot.catalogSha256 && check.checker_sha256 === snapshot.checkerSha256
    ? 'matches' : 'changed';
}

const inputStatusLabels = {
  unavailable: 'Deployed inputs unavailable for comparison',
  changed: 'Deployed catalog or checker changed',
  matches: 'Matches deployed catalog and checker',
};

function activityList(events, { showWorkspace = false } = {}) {
  if (!events.length) return '<p>No recorded mission activity yet.</p>';
  const labels = { created: 'Mission created', 'catalog-passed': 'Source catalog check passed', 'catalog-failed': 'Source catalog check failed', 'plan-saved': 'Work plan saved', 'plan-approved': 'Work plan approved', 'plan-denied': 'Work plan denied' };
  const items = events.map(event => {
    const date = new Date(event.happened_at).toISOString();
    const revised = event.action === 'revised';
    const suffix = event.action.startsWith('catalog-') ? verificationReceiptPath('/verification', event.receipt) : event.action.startsWith('plan-') ? '/plan?version=' + encodeURIComponent(event.receipt) : revised ? '#revision-' + event.version : '';
    const label = revised ? 'Mission revised to revision ' + event.version : labels[event.action] ?? decisionLabel(event.action);
    return `<li><strong>${label}</strong> ·
<a href="/workspaces/${event.workspace_id}/projects/${event.project_id}/missions/${event.mission_id}${suffix}">${escapeHtml(event.title)}</a>
${showWorkspace ? '<span> · ' + escapeHtml(event.workspace_name) + '</span>' : ''}
<time datetime="${date}">${date}</time>${revised ? `<small> · Revised by <code>${escapeHtml(event.actor_id)}</code></small>` : ''}</li>`;
  }).join('');
  return '<ol>' + items + '</ol>';
}
function missionForm({ title = '', goal = '', acceptance = '', submissionKey = randomUUID(), digest = undefined } = {}, message = '', button = 'Save mission') {
  return `<section><h3>Define an outcome</h3>
${message ? `<p role="alert">${escapeHtml(message)}</p>` : ''}
<form method="post">
<input type="hidden" name="submissionKey" value="${escapeHtml(submissionKey)}">
${digest === undefined ? '' : `<input type="hidden" name="draftDigest" value="${escapeHtml(digest)}">`}
<label for="title">Title</label><input id="title" name="title" required maxlength="100" value="${escapeHtml(title)}">
<label for="goal">Goal</label><textarea id="goal" name="goal" required maxlength="2000">${escapeHtml(goal)}</textarea>
<label for="acceptance">Acceptance criteria</label><textarea id="acceptance" name="acceptance" required maxlength="2000">${escapeHtml(acceptance)}</textarea>
<button>${escapeHtml(button)}</button> <button name="intent" value="draft" formnovalidate>Save draft</button></form></section>`;
}
function navigation(path, workspace = null, signedIn = false) {
  const link = (href, label) => `<a href="${href}"${href === path ? ' aria-current="page"' : ''}>${label}</a>`;
  const base = workspace && '/workspaces/' + workspace.id;
  return `<aside class="workspace-sidebar"><a class="workspace-brand" href="/"><span class="brand-mark" aria-hidden="true">✦</span><span>Flex <span>Alchemy</span></span></a>
<div class="workspace-identity"><span aria-hidden="true">FA</span><div>${escapeHtml(workspace?.name ?? 'Flex Alchemy')}<small>${workspace ? 'Workspace' : 'Flex Alchemy workspace'}</small></div></div>
<nav aria-label="Main navigation">${link('/', 'Workspaces')}
${base ? link(base, 'Projects') + link(base + '/activity', 'Activity') + link(base + '/knowledge', 'Knowledge') + link(base + '/reviews', 'Workspace reviews') : ''}
${workspace?.role === 'owner' ? link(base + '/team', 'Team access') : ''}
${signedIn ? link('/account', 'Account') : ''}${link('/access-help', 'Access help')}</nav></aside>`;
}

function projectNavigation(path, project) {
  const destinations = [
    ['', 'Overview'], ['/missions', 'Missions'], ['/plans', 'Plans'], ['/decisions', 'Plan decisions'], ['/reviews', 'Pending reviews'], ['/evidence', 'Evidence'], ['/repository', 'Repository'], ['/releases', 'Releases'],
  ];
  const activePath = path.startsWith(project.path + '/missions/') ? project.path + '/missions' : path;
  const links = destinations.map(([suffix, label]) => {
    const href = project.path + suffix;
    const current = href === activePath ? (href === path ? 'page' : 'location') : '';
    return `<a href="${href}"${current ? ` aria-current="${current}"` : ''}>${label}</a>`;
  }).join('');
  return `<nav class="project-navigation" aria-label="Project navigation">
<strong>${escapeHtml(project.name)}</strong>${links}</nav>`;
}

function homePage(content, status = 200, path = '/', workspace = null, project = null, signedIn = false) {
  const title = status === 404 ? 'Page unavailable' : status >= 500 ? 'Workspace unavailable'
    : project?.name ?? workspace?.name ?? (path === '/account' ? 'Account' : path === '/access-help' ? 'Access help' : 'Workspaces');
  return new Response(`<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)} | Flex Alchemy</title>
<link rel="stylesheet" href="/style.css"></head><body class="alchemy-workspace"><a class="skip" href="#main">Skip to content</a>
${navigation(path, workspace, signedIn)}
<div class="workspace-body"><header class="workspace-topbar"><span>Workspace</span><span aria-hidden="true">›</span><strong>${escapeHtml(title)}</strong></header>
<main id="main" tabindex="-1"><h1>Flex Alchemy</h1>${project ? projectNavigation(path, project) : ''}${content}</main></div></body></html>`, { status, headers: {
    'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store',
    'Content-Security-Policy': "default-src 'none'; style-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
  } });
}

function reply(status, body, headers = {}) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store', ...headers } });
}

function workspaceLinks(entries) {
  return '<ul>' + entries.map(({ id, name }) =>
    `<li><a href="/workspaces/${encodeURIComponent(id)}">${escapeHtml(name)}</a></li>`).join('') + '</ul>';
}

function tokenFrom(request) {
  const cookies = (request.headers.get('cookie') ?? '').split(';').map(part => part.trim());
  const matches = cookies.filter(part => part.startsWith(sessionCookie + '='));
  return matches.length === 1 ? matches[0].slice(sessionCookie.length + 1) : null;
}

async function missionInput(request) {
  if (request.headers.get('content-type')?.split(';')[0].trim() !== 'application/json' || !request.body) {
    throw new TypeError('A JSON request body is required');
  }
  const reader = request.body.getReader();
  const chunks = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 24_576) {
      await reader.cancel();
      throw new TypeError('Request body exceeds 24 KiB');
    }
    chunks.push(value);
  }
  const value = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  if (!value || Array.isArray(value) || typeof value !== 'object' ||
      Object.keys(value).some(key => !['title', 'goal', 'acceptance'].includes(key))) {
    throw new TypeError('Supply only title, goal and acceptance');
  }
  return value;
}

export function hostedApi({ pool, publicOrigin, browserFlow, githubRequest = fetch, nodeRunsEnabled = false }) {
  const origin = new URL(publicOrigin);
  if (origin.protocol !== 'https:' || origin.origin !== publicOrigin) {
    throw new TypeError('The public origin must be an HTTPS origin without a path');
  }
  const sessions = sessionStore(pool);
  const workspaces = workspaceStore(pool);
  return async function handle(request) {
    const url = new URL(request.url);
    const browserPage = !url.pathname.startsWith('/api/') && url.pathname !== '/api';
    let navigationWorkspace = null;
    let navigationProject = null;
    let signedIn = false;
    const page = (content, status) => homePage(content, status, url.pathname, navigationWorkspace, navigationProject, signedIn);
    const signInPath = '/auth/sign-in?' + new URLSearchParams({ return: url.pathname + url.search });
    const signedOut = () => new Response(null, {
      status: 303, headers: { Location: browserFlow && request.method === 'GET' ? signInPath : '/',
        'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' },
    });
    if (url.origin !== publicOrigin) return reply(400, { error: 'Invalid host' });
    if (request.method === 'POST' && request.headers.get('origin') !== publicOrigin) {
      return reply(403, { error: 'Request origin denied' });
    }
    try {
      if (request.method === 'GET' && url.pathname === '/style.css') {
        return new Response(style, { headers: { 'Content-Type': 'text/css; charset=utf-8' } });
      }
      if (browserFlow) {
        const response = await browserFlow(request);
        if (response) return response;
      }
      const token = tokenFrom(request);
      if (request.method === 'POST' && ['/api/sign-out', '/sign-out'].includes(url.pathname)) {
        if (!token) return reply(401, { error: 'Sign in required' });
        await sessions.revoke(token);
        if (url.pathname === '/sign-out') return new Response(null, { status: 303, headers: {
          Location: '/', 'Cache-Control': 'no-store',
          'Set-Cookie': sessionCookie + '=; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=0',
        } });
        return reply(200, { signedOut: true }, {
          'Set-Cookie': sessionCookie + '=; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=0',
        });
      }
      const actor = await sessions.actor(token);
      signedIn = Boolean(actor);
      if (request.method === 'POST' && url.pathname === '/account/sessions/revoke-others') {
        if (!actor || !await sessions.revokeOthers(token)) {
          return page('<h2>Sign in required</h2><p><a href="/account">Return to Account</a></p>', 401);
        }
        return page('<h2>Other Flex Alchemy sessions ended</h2><p>This browser remains signed in.</p><p><a href="/account">Return to Account</a></p>');
      }
      if (request.method === 'GET' && url.pathname === '/account') {
        if (!actor) return page(`<h2>Sign in to view your account</h2>
${browserFlow ? `<p><a href="${escapeHtml(signInPath)}">Sign in</a></p>` : '<p>Sign-in is currently unavailable.</p>'}
<p><a href="/access-help">Get access help</a></p>`, 401);
        const entries = await workspaces.listWorkspaces(actor);
        return page(`<h2>Your account</h2><dl><dt>Flex Alchemy account ID</dt><dd><code>${escapeHtml(actor)}</code></dd></dl>
<h3>Workspace access</h3>${entries.length
          ? workspaceLinks(entries)
          : '<p>You do not have access to any workspaces.</p>'}
<p><a href="/access-help">Get workspace access or recover your sign-in</a></p>
<form method="post" action="/account/sessions/revoke-others"><button>Sign out of other Flex Alchemy sessions</button></form>
<form method="post" action="/sign-out"><button>Sign out of this browser</button></form>`);
      }
      if (request.method === 'GET' && url.pathname === '/access-help') {
        return page(`<a href="/">Back to Flex Alchemy</a><h2>Get workspace access</h2>
<h3>Can't sign in?</h3><p>Use your organization's sign-in provider to recover your account. If that fails, contact your organization's account administrator.</p>
<h3>Signed in with no workspace?</h3><p>Ask a workspace owner or administrator to check your membership and confirm which account to use.</p>
${browserFlow ? '<p><a href="/auth/sign-in">Try signing in again</a></p>' : ''}`);
      }
      if (request.method === 'GET' && url.pathname === '/') {
        if (!actor) return page(browserFlow
          ? `<h2>Direct work and review the evidence</h2><p>Use Flex Alchemy to define project missions, review decisions, and inspect saved source catalog checks.</p><p><a href="/auth/sign-in">Sign in</a></p><p><a href="/access-help">Get workspace access</a></p>`
          : '<p>Sign-in is currently unavailable.</p>');
        const entries = await workspaces.listWorkspaces(actor);
        return page('<h2>Your workspaces</h2>' + (entries.length
          ? workspaceLinks(entries)
          : '<p>No workspaces available. Contact your workspace administrator for access.</p><p><a href="/access-help">Get workspace access</a></p>') +
          (entries.length ? '<section><h2>Recent activity</h2>' + activityList(await workspaces.recentActivity(actor), { showWorkspace: true }) + '</section>' : '') +
          '<form method="post" action="/sign-out"><button>Sign out</button></form>');
      }
      const workspaceMatch = workspaceRoute.exec(url.pathname);
      if (['GET', 'POST'].includes(request.method) && workspaceMatch) {
        if (!actor) return signedOut();
        if (workspaceMatch[2] === '/export') {
          if (request.method !== 'GET') return reply(405, { error: 'Use GET to download a workspace' }, { Allow: 'GET' });
          const bundle = await workspaces.exportProjects(actor, workspaceMatch[1]);
          if (!bundle) return page('<a href="/">All workspaces</a><h2>Workspace export unavailable</h2>', 404);
          const { projects, ...workspace } = bundle;
          return reply(200, { schemaVersion: 1, exportedAt: new Date().toISOString(), workspace, projects },
            { 'Content-Disposition': `attachment; filename="alchemy-workspace-${workspace.id}.json"` });
        }
        const workspace = await workspaces.getWorkspace(actor, workspaceMatch[1]);
        const back = '<a href="/">All workspaces</a>';
        if (!workspace) return page(back + '<h2>Workspace unavailable</h2>', 404);
        navigationWorkspace = workspace;
        if (workspaceMatch[2] === '/settings/audit') {
          const base = '/workspaces/' + workspace.id;
          const back = `<a href="${base}/knowledge">Back to knowledge</a>`;
          if (workspace.role !== 'owner') return page(back + '<h2>Audit history is available to workspace owners</h2>', 403);
          if (request.method !== 'GET') return reply(405, { error: 'Use GET to view audit history' }, { Allow: 'GET' });
          const auditPath = base + '/settings/audit';
          const auditDownload = (view, events, source = null) => reply(200, {
            schemaVersion: 1,
            workspaceId: workspace.id,
            view,
            source,
            exportedAt: new Date().toISOString(),
            limit: 50,
            events,
          }, { 'Content-Disposition': `attachment; filename="alchemy-${view}-audit-${workspace.id}.json"` });
          if (url.searchParams.get('view') === 'access') {
            const events = await workspaces.revocationAudit(actor, workspace.id);
            if (url.searchParams.get('format') === 'json') return auditDownload('access', events);
            const rows = events.map(event => {
              const time = new Date(event.revoked_at).toISOString();
              return `<li><strong>Access revoked</strong> · ${escapeHtml(event.role)}
<p>Affected account <code>${escapeHtml(event.actor_id)}</code></p>
<p>${event.revoked_by ? 'Recorded by <code>' + escapeHtml(event.revoked_by) + '</code>' : 'No actor was recorded'}
 · <time datetime="${time}">${time}</time></p></li>`;
            }).join('');
            return page(`<a href="${base}/team">Back to Team access</a><h2>Access revocation history</h2>
<p><a href="${auditPath}">Knowledge audit history</a></p><p><a href="${auditPath}?view=access&amp;format=json">Download recent revocations (JSON)</a></p><p>Showing up to 50 recent revocations.</p>
${rows ? '<ol>' + rows + '</ol>' : '<p>No recorded access revocations.</p>'}`);
          }
          const source = (url.searchParams.get('source') ?? '').trim().toUpperCase();
          if (source && !/^K[0-9]{1,12}$/.test(source)) return page(back + '<h2>Enter a valid source ID</h2>', 400);
          const events = await workspaces.sourceAudit(actor, workspace.id, source || null);
          if (url.searchParams.get('format') === 'json') return auditDownload('knowledge', events, source || null);
          const rows = events.map(event => {
            const time = new Date(event.recorded_at).toISOString();
            return `<li><strong>${event.suppressed ? 'Suppressed' : 'Restored'}</strong>
<a href="${base}/knowledge?record=${encodeURIComponent(event.source_id)}">${escapeHtml(event.source_id)}</a>
<p class="preserve">${escapeHtml(event.reason)}</p>
<p>Recorded by <code>${escapeHtml(event.actor_id)}</code> · <time datetime="${time}">${time}</time></p></li>`;
          }).join('');
          return page(back + `<h2>Knowledge audit history</h2><p><a href="${auditPath}?view=access">Access revocation history</a></p><p><a href="${auditPath}?format=json${source ? '&amp;source=' + encodeURIComponent(source) : ''}">Download recent lookup decisions (JSON)</a></p><p>Showing up to 50 recent lookup decisions.</p>
<form method="get"><label for="audit-source">Source ID</label>
<input id="audit-source" name="source" maxlength="13" value="${escapeHtml(source)}"><button>Filter</button></form>
${rows ? '<ol>' + rows + '</ol>' : '<p>No lookup decisions match.</p>'}`);
        }
        if (workspaceMatch[2] === '/knowledge') {

          const back = `<a href="/workspaces/${workspace.id}">Back to workspace</a>`;
          const catalog = await catalogRecords().catch(() => null);
          if (!catalog || catalog.failures.length) return page(back + '<h2>Source register unavailable</h2><p>Try again after the deployed catalog has been checked.</p>', 503);
          const selectedId = url.searchParams.get('record');
          const suppressions = await workspaces.sourceSuppressions(actor, workspace.id);
          if (selectedId !== null) {
            const record = catalog.records.find(entry => entry.id === selectedId);
            const register = `<a href="/workspaces/${workspace.id}/knowledge">Back to source register</a>`;
            if (!record) return page(register + '<h2>Source record unavailable</h2>', 404);
            if (request.method === 'POST') {
              if (workspace.role !== 'owner') return page(register + '<h2>Only workspace owners can suppress references</h2>', 403);
              if (request.headers.get('content-type')?.split(';')[0] !== 'application/x-www-form-urlencoded') {
                return page(register + '<h2>Submit the source suppression form</h2>', 415);
              }
              const form = new URLSearchParams(await request.text());
              const reason = form.get('reason')?.trim();
              const intent = form.get('intent') ?? 'suppress';
              const expected = form.get('event');
              if (form.size !== 1 + Number(form.has('intent')) + Number(form.has('event')) ||
                  !['suppress', 'restore'].includes(intent) || (intent === 'restore' && !expected) ||
                  (expected && !/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(expected)) ||
                  !reason || reason.length > 500) {
                return page(`<a href="?record=${encodeURIComponent(record.id)}">Return to source record</a><h2>Enter a suppression reason of 1 to 500 characters</h2>`, 400);
              }
              try {
                if (!await workspaces.recordSourceDecision(actor, workspace.id, record.id, reason, intent === 'suppress', expected)) {
                  return page(register + '<h2>Source decision changed</h2><p>Open the record to review the latest decision.</p>', 409);
                }
              } catch (error) {
                if (error.code === '42501') return page(register + '<h2>Source suppression access changed</h2>', 403);
                throw error;
              }
              return new Response(null, { status: 303, headers: {
                Location: url.pathname + '?record=' + encodeURIComponent(record.id), 'Cache-Control': 'no-store',
              } });
            }
            const decisions = await workspaces.sourceDecisions(actor, workspace.id, record.id);
            const latest = decisions[0];
            const history = decisions.map(item => `<li><strong>${item.suppressed ? 'Suppressed' : 'Restored'}</strong>
<p>${escapeHtml(item.reason)}</p><p>Recorded by <code>${escapeHtml(item.actor_id)}</code> · ${escapeHtml(new Date(item.recorded_at).toISOString())}</p></li>`).join('');
            const status = (latest?.suppressed ? '<h3>Suppressed in this workspace</h3>' : '') +
              (history ? '<h3>Lookup decision history</h3><ol>' + history + '</ol>' : '') +
              (workspace.role === 'owner' ? `<form method="post">
${latest ? `<input type="hidden" name="event" value="${escapeHtml(latest.event_id)}">` : ''}
<label for="suppression-reason">Reason for ${latest?.suppressed ? 'restoring' : 'suppressing'} this reference in mission lookup</label>
<textarea id="suppression-reason" name="reason" maxlength="500" required></textarea>
<button name="intent" value="${latest?.suppressed ? 'restore' : 'suppress'}">${latest?.suppressed ? 'Restore reference' : 'Suppress reference'}</button></form>` : '');
            return page(register + `<h2>${escapeHtml(record.title)}</h2>
<dl><dt>Record ID</dt><dd>${escapeHtml(record.id)}</dd>
<dt>Source class</dt><dd>${escapeHtml(record.category)}</dd>
<dt>Proposed application</dt><dd>${escapeHtml(record.application)}</dd>
<dt>Usage rights</dt><dd>Copying, full-text indexing, redistribution, and training rights are unreviewed.</dd>
<dt>Catalog SHA-256</dt><dd><code>${catalog.catalogSha256}</code></dd></dl>
<p><a href="${escapeHtml(record.locator)}">Open original source</a></p>${status}`);
          }
          if (request.method !== 'GET') return reply(405, { error: 'Open a source record to manage it' }, { Allow: 'GET' });
          const query = (url.searchParams.get('q') ?? '').trim();
          if (query.length > 200) return page(back + '<h2>Search is too long</h2><p>Use 200 characters or fewer.</p>', 400);
          const needle = query.toLowerCase();
          const rows = catalog.records.filter(record =>
            [record.id, record.title, record.category, record.application].some(value => value.toLowerCase().includes(needle))
          ).map(record => `<li id="${escapeHtml(record.id)}"><h3><a href="?record=${encodeURIComponent(record.id)}">${escapeHtml(record.title)}</a></h3>
<p>${escapeHtml(record.id)} · ${escapeHtml(record.category)}${suppressions.has(record.id) ? ' · Suppressed' : ''}</p><p>${escapeHtml(record.application)}</p></li>`).join('');
          return page(back + `<h2>Knowledge source register</h2>${workspace.role === 'owner' ? `<p><a href="/workspaces/${workspace.id}/settings/audit">Knowledge audit history</a></p>` : ''}
<p>These link-only references describe ways to evaluate Alchemy. Permissions for copying, full-text indexing, redistribution, and training remain unreviewed.</p>
<form method="get"><label for="source-search">Find a reference by name, ID, class, or application</label>
<input id="source-search" name="q" maxlength="200" value="${escapeHtml(query)}"><button>Search</button></form>
<p>Catalog SHA-256 <code>${catalog.catalogSha256}</code></p>
${rows ? '<ul>' + rows + '</ul>' : '<p>No references match your search.</p>'}`);
        }
        if (workspaceMatch[2] === '/team/grant') {
          const teamPath = '/workspaces/' + workspace.id + '/team';
          const backToTeam = `<a href="${teamPath}">Back to team access</a>`;
          if (workspace.role !== 'owner') return page('<h2>Only workspace owners can grant access</h2>', 403);
          const grantForm = (message = '', member = '', role = '') => backToTeam + `<section><h2>Grant workspace access</h2>
<p>Ask the person to sign in and copy their account ID from Account.</p>
${message ? `<p role="alert">${escapeHtml(message)}</p>` : ''}
<form method="post"><label for="member">Flex Alchemy account ID</label>
<input id="member" name="member" value="${escapeHtml(member)}" required maxlength="36" spellcheck="false">
<label for="role">Workspace role</label><select id="role" name="role" required>
<option value="">Choose a role</option><option value="viewer"${role === 'viewer' ? ' selected' : ''}>Viewer</option>
<option value="editor"${role === 'editor' ? ' selected' : ''}>Editor</option></select>
<p><button>Grant access</button></p></form></section>`;
          if (request.method === 'GET') return page(grantForm());
          if (request.headers.get('content-type')?.split(';')[0] !== 'application/x-www-form-urlencoded') {
            return page(grantForm('Submit the grant access form.'), 415);
          }
          const form = new URLSearchParams(await request.text());
          const member = form.get('member')?.trim().slice(0, 37) ?? '';
          const role = form.get('role');
          if (form.size !== 2 || !accountIdPattern.test(member) || !['viewer', 'editor'].includes(role)) {
            return page(grantForm('Enter a valid account ID and choose Viewer or Editor.', member, role), 400);
          }
          if (!await workspaces.grantWorkspaceMember(actor, workspace.id, member, role)) {
            return page(grantForm('Access could not be granted. Check the account ID and whether the account already has a membership record.', member, role), 409);
          }
          return new Response(null, { status: 303, headers: { Location: teamPath, 'Cache-Control': 'no-store' } });
        }
        if (workspaceMatch[2] === '/team') {
          const backToWorkspace = `<a href="/workspaces/${workspace.id}">Back to workspace</a>`;
          if (request.method === 'POST') {
            if (workspace.role !== 'owner') return page(backToWorkspace + '<h2>Only owners can manage team access</h2>', 403);
            if (request.headers.get('content-type')?.split(';')[0] !== 'application/x-www-form-urlencoded') {
              return page(backToWorkspace + '<h2>Submit the team access form</h2>', 415);
            }
            const form = new URLSearchParams(await request.text());
            const member = form.get('member');
            if (form.has('changeRole')) {
              const previous = form.get('previous');
              if (form.size !== 3 || form.get('changeRole') !== 'yes' || !accountIdPattern.test(member ?? '')
                || !['editor', 'viewer'].includes(previous)) {
                return page(backToWorkspace + '<h2>Submit a valid role change</h2>', 400);
              }
              const next = previous === 'viewer' ? 'editor' : 'viewer';
              if (!await workspaces.changeWorkspaceMemberRole(actor, workspace.id, member, previous, next)) {
                return page(`<a href="${url.pathname}">Return to team access</a><h2>The role could not be changed</h2><p>Check the member’s current access and try again.</p>`, 409);
              }
              return new Response(null, { status: 303, headers: { Location: url.pathname + '?history=roles', 'Cache-Control': 'no-store' } });
            }
            if (form.size !== 2 || form.get("confirm") !== "yes" || !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(member ?? '')) {
              return page(backToWorkspace + '<h2>Choose a team member</h2>', 400);
            }
            if (!await workspaces.revokeWorkspaceMember(actor, workspace.id, member)) {
              return page(backToWorkspace + '<h2>Access could not be revoked</h2><p>Check the current team access list.</p>', 409);
            }
            return new Response(null, { status: 303, headers: { Location: url.pathname, 'Cache-Control': 'no-store' } });
          }
          const team = await workspaces.workspaceTeam(actor, workspace.id);
          if (!team.length) return page(backToWorkspace + '<h2>Team access is available to workspace owners</h2>', 403);
          const backToTeam = `<a href="${url.pathname}">Back to team access</a>`;
          if (url.searchParams.get('history') === 'roles') {
            const changes = await workspaces.workspaceMemberRoleHistory(actor, workspace.id);
            const events = changes.map(change => {
              const time = new Date(change.changed_at).toISOString();
              return `<li><code>${escapeHtml(change.actor_id)}</code> changed from ${escapeHtml(change.previous_role)} to
${escapeHtml(change.new_role)} by <code>${escapeHtml(change.changed_by)}</code> · <time datetime="${time}">${time}</time></li>`;
            });
            return page(backToTeam + '<h2>Role change history</h2>' + (events.length
              ? '<p>Showing up to 50 recent changes.</p><ol>' + events.join('') + '</ol>' : '<p>No role changes recorded.</p>'));
          }
          if (url.searchParams.has('edit-role')) {
            const target = team.find(member => member.actor_id === url.searchParams.get('edit-role')
              && !member.revoked_at && ['editor', 'viewer'].includes(member.role));
            if (!target) return page(backToTeam + '<h2>This account is no longer eligible for a role change</h2>', 409);
            const next = target.role === 'viewer' ? 'editor' : 'viewer';
            return page(backToTeam + `<h2>Change workspace role</h2>
<p>Change <code>${escapeHtml(target.actor_id)}</code> from ${escapeHtml(target.role)} to ${next}.</p>
<form method="post" action="${url.pathname}">
<input type="hidden" name="member" value="${escapeHtml(target.actor_id)}">
<input type="hidden" name="previous" value="${escapeHtml(target.role)}">
<button name="changeRole" value="yes">Change role to ${next}</button></form>`);
          }
          if (url.searchParams.has('revoke')) {
            const target = team.find(member => member.actor_id === url.searchParams.get('revoke')
              && !member.revoked_at && member.role !== 'owner');
            const cancel = `<a href="${url.pathname}">Back to team access</a>`;
            if (!target) return page(cancel + '<h2>This account is no longer eligible for revocation</h2>', 409);
            return page(cancel + `<h2>Confirm access revocation</h2>
<p>Account <code>${escapeHtml(target.actor_id)}</code> will lose ${escapeHtml(target.role)} access to
${escapeHtml(workspace.name)}. Earlier work will retain its attribution.</p>
<form method="post" action="${url.pathname}">
<input type="hidden" name="member" value="${escapeHtml(target.actor_id)}">
<button name="confirm" value="yes">Confirm revocation</button>
</form>`);
          }
          const rows = team.map(member => `<tr><td><code>${escapeHtml(member.actor_id)}</code></td>
<td>${escapeHtml(member.role)}</td><td>${member.revoked_at
  ? 'Revoked ' + escapeHtml(new Date(member.revoked_at).toISOString()) : 'Active'}${!member.revoked_at && member.role !== 'owner' ? ` <a href="${url.pathname}?revoke=${encodeURIComponent(member.actor_id)}" aria-label="Revoke access for ${escapeHtml(member.actor_id)}">Revoke access</a>
<a href="${url.pathname}?edit-role=${encodeURIComponent(member.actor_id)}" aria-label="Change role for ${escapeHtml(member.actor_id)}">Change role</a>` : ''}</td></tr>`).join('');
          return page(backToWorkspace + `<h2>Team access for ${escapeHtml(workspace.name)}</h2><p><a href="${url.pathname}/grant">Grant access</a></p><p><a href="/workspaces/${workspace.id}/settings/audit?view=access">Access revocation history</a> · <a href="${url.pathname}?history=roles">Role change history</a></p>
<table class="team-table"><caption>Workspace memberships</caption><thead><tr>
<th scope="col">Account ID</th><th scope="col">Role</th><th scope="col">Access</th>
</tr></thead><tbody>${rows}</tbody></table>`);
        }
        if (workspaceMatch[2] === '/reviews') {
          if (request.method !== 'GET') return reply(405, { error: 'Use GET to view pending reviews' }, { Allow: 'GET' });
          const base = '/workspaces/' + workspace.id;
          const pending = await workspaces.pendingReviews(actor, workspace.id);
          const items = pending.map(mission => `<li><a href="${base}/projects/${mission.project_id}/missions/${mission.id}">${escapeHtml(mission.title)}</a>
· ${escapeHtml(mission.project_name)} · Revision ${mission.revision}</li>`).join('');
          return page(`<a href="${base}">Back to workspace</a><h2>Pending reviews across ${escapeHtml(workspace.name)}</h2>
<p>Missions appear here when their current revision has no decision.</p>
${items ? '<ol>' + items + '</ol>' : '<p>No mission revisions are awaiting review.</p>'}`);
        }

        if (workspaceMatch[2] === '/activity') {
          if (request.method !== 'GET') return reply(405, { error: 'Use GET to view activity' }, { Allow: 'GET' });
          const events = await workspaces.recentActivity(actor, workspace.id);
          return page(`<a href="/workspaces/${workspace.id}">Back to workspace</a><h2>Recent activity for ${escapeHtml(workspace.name)}</h2>` +
            activityList(events));
        }
        const canCreate = ['owner', 'editor'].includes(workspace.role);
        const projectForm = (name = '', error = '', purpose = '', key = randomUUID()) => `<section><h3>Create a project</h3>
${error ? `<p role="alert">${escapeHtml(error)}</p>` : ''}
<form method="post"><input type="hidden" name="key" value="${escapeHtml(key)}"><label for="project-name">Project name</label>
<input id="project-name" name="name" maxlength="100" required value="${escapeHtml(name)}">
<label for="project-purpose">Purpose</label><textarea id="project-purpose" name="purpose" maxlength="2000">${escapeHtml(purpose)}</textarea><button>Create project</button></form></section>`;
        const dedicatedIntake = workspaceMatch[2] === '/projects/new';
        if (dedicatedIntake && request.method === 'GET') {
          const backToWorkspace = `<a href="/workspaces/${workspace.id}">Back to workspace</a>`;
          if (!canCreate) return page(backToWorkspace + '<h2>Your role cannot create projects</h2>', 403);
          return page(backToWorkspace + `<h2>New project in ${escapeHtml(workspace.name)}</h2>` + projectForm());
        }
        if (request.method === 'POST') {
          const returnLink = `<a href="/workspaces/${workspace.id}">Return to workspace</a>`;
          if (!canCreate) return page('<h2>Your role cannot create projects</h2>' + returnLink, 403);
          if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/x-www-form-urlencoded') {
            return page('<h2>Submit the project form from the workspace page</h2>' + returnLink, 415);
          }
          const content = await request.text();
          if (Buffer.byteLength(content) > 24_576) return page('<h2>Project form is too large</h2>' + returnLink, 413);
          const form = new URLSearchParams(content);
          const name = form.get('name')?.trim();
          const purpose = form.get('purpose') ?? '';
          const key = form.get('key');
          if ((key !== null && !new RegExp('^' + id + '$').test(key)) || form.getAll('key').length > 1 ||
              form.size !== 1 + Number(form.has('purpose')) + Number(form.has('key')) || form.getAll('name').length !== 1 ||
              form.getAll('purpose').length > 1 || !name || name.length > 100 || purpose.length > 2000) {
            return page(returnLink + projectForm(form.getAll('name').length === 1 ? form.get('name') : '', 'Enter a project name of 1 to 100 characters and a purpose of up to 2,000 characters.', purpose), 400);
          }
          const created = await workspaces.createProject(actor, workspace.id, name, purpose, key);
          if (!created) return page(returnLink + projectForm(name,
            'This form already created a project. Review these details before creating a separate project.', purpose), 409);
          return new Response(null, { status: 303, headers: {
            Location: `/workspaces/${workspace.id}/projects/${created.id}`, 'Cache-Control': 'no-store',
          } });
        }
        const entries = await workspaces.listProjects(actor, workspace.id);
        return page(back + `<h2>${escapeHtml(workspace.name)}</h2>${url.searchParams.get('project') === 'deleted' ? '<p role="status">Project deleted.</p>' : ''}<h3>Projects</h3>` + (entries.length
          ? '<ul>' + entries.map(({ id, name }) =>
            `<li><a href="/workspaces/${workspace.id}/projects/${id}">${escapeHtml(name)}</a></li>`).join('') + '</ul>'
          : '<p>No projects available.</p>') +
          (workspace.role === 'owner' ? `<p><a href="/workspaces/${workspace.id}/export">Download workspace projects, reviews, and verification (JSON)</a></p>` : '') +
          (canCreate ? `<p><a href="/workspaces/${workspace.id}/projects/new">New project</a></p>` + projectForm() : ''));
      }
      const reviewPage = reviewRoute.exec(url.pathname);
      if (['GET', 'POST'].includes(request.method) && reviewPage) {
        if (!actor) return signedOut();
        const [, workspaceId, projectId, missionId, action] = reviewPage;
        if (action && !['/verification', '/revise', '/plan'].includes(action) && request.method !== 'GET') {
          return reply(405, { error: 'Use GET for this resource' }, { Allow: 'GET' });
        }
        const back = `<a href="/workspaces/${workspaceId}/projects/${projectId}">Back to project</a>`;
        const project = await workspaces.getProject(actor, workspaceId, projectId);
        const review = project && await workspaces.missionReview(actor, workspaceId, projectId, missionId, { includeEvidence: action === '/export' });
        if (!review) return page(back + '<h2>Mission unavailable</h2>', 404);
        const canReview = ['owner', 'editor'].includes(project.role);
        navigationWorkspace = { id: workspaceId, role: project.role };
        navigationProject = { path: `/workspaces/${workspaceId}/projects/${projectId}`, name: project.name };
        const { mission, history, revisions } = review;
        const active = revisions[0] ?? { ...mission, revision: 1 };
        const activeReview = history[0]?.mission_revision === active.revision ? history[0] : null;
        if (action === '/plan') {
          const missionPath = url.pathname.slice(0, -'/plan'.length);
          const backToMission = `<a href="${missionPath}">Back to mission</a>`;
          if (request.method === 'POST') {
            if (url.searchParams.has('version')) return reply(405, { error: 'Use GET to view a saved plan version' }, { Allow: 'GET' });
            if (!canReview) return page(backToMission + '<h2>Your role can view work plans</h2>', 403);
            if (request.headers.get('content-type')?.split(';')[0] !== 'application/x-www-form-urlencoded') {
              return page(backToMission + '<h2>Submit the work plan form</h2>', 415);
            }
            const form = new URLSearchParams(await request.text());
            if (form.has('decision')) {
              if (project.role !== 'owner') return page(backToMission + '<h2>Only workspace owners can decide work plans</h2>', 403);
              const fields = ['revision', 'version', 'decision', 'reason'];
              if (form.size !== fields.length || fields.some(field => form.getAll(field).length !== 1) ||
                  !/^\d+$/.test(form.get('revision')) || !/^\d+$/.test(form.get('version'))) {
                return page(backToMission + '<h2>Check the plan decision fields</h2>', 400);
              }
              const reopen = `<a href="${url.pathname}">Open the work plan</a>`;
              try {
                const saved = await workspaces.decideMissionPlan(actor, workspaceId, projectId, missionId, {
                  revision: Number(form.get('revision')), version: Number(form.get('version')),
                  decision: form.get('decision'), reason: form.get('reason'),
                });
                if (!saved) return page(reopen + '<h2>Plan changed or already has a decision</h2>', 409);
              } catch (error) {
                if (error instanceof TypeError) return page(reopen + `<h2>Check the decision</h2><p>${escapeHtml(error.message)}</p>`, 400);
                if (error.code === '42501') return page(reopen + '<h2>Plan decision access changed</h2>', 403);
                throw error;
              }
              return new Response(null, { status: 303, headers: { Location: url.pathname, 'Cache-Control': 'no-store' } });
            }
            const steps = form.get('steps') ?? '';
            const fields = ['revision', 'version', 'steps'];
            if (form.size !== fields.length || fields.some(field => form.getAll(field).length !== 1) ||
                !/^\d+$/.test(form.get('revision')) || !/^\d+$/.test(form.get('version'))) {
              return page(backToMission + '<h2>Check the plan fields</h2>', 400);
            }
            try {
              const saved = await workspaces.saveMissionPlan(actor, workspaceId, projectId, missionId, {
                revision: Number(form.get('revision')), version: Number(form.get('version')), steps,
              });
              if (!saved) return page(backToMission + `<h2>Plan or mission changed</h2>
<p><a href="${url.pathname}">Open the latest work plan</a></p>
<h3>Your proposed work plan</h3><p class="preserve">${escapeHtml(steps)}</p>`, 409);
            } catch (error) {
              if (error instanceof TypeError) return page(backToMission + `<h2>Check the work plan</h2>
<p>${escapeHtml(error.message)}</p><p class="preserve">${escapeHtml(steps)}</p>`, 400);
              if (error.code === '42501') return page(backToMission + '<h2>Plan access changed</h2>', 403);
              throw error;
            }
            return new Response(null, { status: 303, headers: { Location: url.pathname, 'Cache-Control': 'no-store' } });
          }
          const requested = url.searchParams.get('version');
          const match = /^([1-9]\d{0,9})-([1-9]\d{0,9})$/.exec(requested ?? '');
          const allPlans = `<a href="${url.pathname}">Latest work plan and history</a>`;
          if (requested !== null && (!match || match.slice(1).some(value => Number(value) > 2147483647))) {
            return page(backToMission + allPlans + '<h2>Work plan version unavailable</h2>', 404);
          }
          const selected = match ? { revision: Number(match[1]), version: Number(match[2]) } : null;
          const plans = await workspaces.missionPlans(actor, workspaceId, missionId, selected);
          if (selected && !plans.length) return page(backToMission + allPlans + '<h2>Work plan version unavailable</h2>', 404);
          const current = plans.find(plan => plan.revision === active.revision);
          const history = plans.map(plan => `<li id="plan-${plan.revision}-${plan.version}"><strong>Mission revision ${plan.revision} · Plan version ${plan.version}
${selected ? '' : plan === current ? ' · Current' : ' · Historical'}</strong><p class="preserve">${escapeHtml(plan.steps)}</p>
<p>Author <code>${escapeHtml(plan.author_id)}</code> · ${escapeHtml(new Date(plan.recorded_at).toISOString())}</p>
${plan.decision ? `<p><strong>${plan.decision === 'approved' ? 'Approved' : 'Denied'}</strong> · <code>${escapeHtml(plan.reviewer_id)}</code>
· ${escapeHtml(new Date(plan.decided_at).toISOString())}</p><p class="preserve">${escapeHtml(plan.reason)}</p>` : '<p>Awaiting owner decision</p>'}
${plan.withdrawn_at ? `<p><strong>Approval withdrawn</strong> · <code>${escapeHtml(plan.withdrawn_by)}</code>
· ${escapeHtml(new Date(plan.withdrawn_at).toISOString())}</p><p class="preserve">${escapeHtml(plan.withdrawal_reason)}</p>` : ''}</li>`).join('');
          if (selected) {
            const plan = plans[0];
            const scope = plan.revision === 1 ? mission : revisions.find(item => item.revision === plan.revision);
            return page(backToMission + ' · ' + allPlans + `<h2>Saved work plan for ${escapeHtml(mission.title)}</h2>
${scope ? `<dl><dt>Goal</dt><dd class="preserve">${escapeHtml(scope.goal)}</dd>
<dt>Acceptance criteria</dt><dd class="preserve">${escapeHtml(scope.acceptance)}</dd></dl>` : ''}
<ol>${history}</ol>`);
          }
          return page(backToMission + `<h2>Work plan for ${escapeHtml(mission.title)}</h2>
<p>Mission revision ${active.revision}</p>
<dl><dt>Goal</dt><dd class="preserve">${escapeHtml(active.goal)}</dd>
<dt>Acceptance criteria</dt><dd class="preserve">${escapeHtml(active.acceptance)}</dd></dl>
${canReview ? `<form method="post"><input type="hidden" name="revision" value="${active.revision}">
<input type="hidden" name="version" value="${current?.version ?? 0}">
<label for="plan-steps">Steps, dependencies, and planned checks</label>
<textarea id="plan-steps" name="steps" required maxlength="4000">${escapeHtml(current?.steps ?? '')}</textarea>
<button>Save work plan</button></form>` : ''}
${project.role === 'owner' && current && !current.decision ? `<section><h3>Decide plan version ${current.version}</h3>
<p>Review the steps saved for mission revision ${current.revision}, plan version ${current.version}.</p>
<h4>Saved steps</h4><pre>${escapeHtml(current.steps)}</pre>
<p>Save any edits as a new version before deciding on them.</p><form method="post">
<input type="hidden" name="revision" value="${current.revision}"><input type="hidden" name="version" value="${current.version}">
<label for="plan-reason">Decision reason</label><textarea id="plan-reason" name="reason" maxlength="2000" required></textarea>
<button name="decision" value="approved">Approve work plan</button>
<button name="decision" value="denied">Deny work plan</button></form></section>` : ''}
${project.role === 'owner' && current?.decision === 'approved' && !current.withdrawn_at ? `<section><h3>Withdraw plan approval</h3>
<p>Withdraw approval for mission revision ${current.revision}, plan version ${current.version}. The original decision stays in history.</p>
<form method="post"><input type="hidden" name="revision" value="${current.revision}">
<input type="hidden" name="version" value="${current.version}">
<label for="withdrawal-reason">Withdrawal reason</label><textarea id="withdrawal-reason" name="reason" maxlength="2000" required></textarea>
<button name="decision" value="withdrawn">Withdraw approval</button></form></section>` : ''}
<h3>Plan history</h3>${history ? '<ol>' + history + '</ol>' : '<p>No work plans recorded.</p>'}`);
        }

        if (action === '/revise') {
          const missionPath = url.pathname.slice(0, -7);
          const returnLink = `<a href="${missionPath}">Return to mission</a>`;
          if (!canReview) return page(returnLink + '<h2>Your role can view revisions</h2>', 403);
          const edit = (values, message = '', status = 200) => page(returnLink + `<h2>Revise ${escapeHtml(mission.title)}</h2>
${message ? `<p role="alert">${escapeHtml(message)}</p>` : ''}
<form method="post"><input type="hidden" name="revision" value="${active.revision}">
<label for="goal">Goal</label><textarea id="goal" name="goal" maxlength="2000" required>${escapeHtml(values.goal)}</textarea>
<label for="acceptance">Acceptance criteria</label><textarea id="acceptance" name="acceptance" maxlength="2000" required>${escapeHtml(values.acceptance)}</textarea>
<button>Save revision</button></form>`, status);
          if (request.method === 'GET') return edit(active);
          if (request.headers.get('content-type')?.split(';')[0] !== 'application/x-www-form-urlencoded') return edit(active, 'Submit the revision form.', 415);
          const form = new URLSearchParams(await request.text());
          const values = { goal: form.get('goal') ?? '', acceptance: form.get('acceptance') ?? '' };
          const keys = ['revision', 'goal', 'acceptance'];
          if (form.size !== keys.length || keys.some(key => form.getAll(key).length !== 1) ||
              !/^\d+$/.test(form.get('revision'))) return edit(values, 'Check the revision fields.', 400);
          try {
            if (!await workspaces.reviseMission(actor, workspaceId, projectId, missionId, { ...values, revision: Number(form.get('revision')) })) {
              return page(returnLink + `<h2>Mission changed</h2><p>Open the current mission before revising again.</p>
<h3>Your proposed goal</h3><p class="preserve">${escapeHtml(values.goal)}</p>
<h3>Your proposed criteria</h3><p class="preserve">${escapeHtml(values.acceptance)}</p>`, 409);
            }
          } catch (error) {
            if (error instanceof TypeError) return edit(values, error.message, 400);
            if (error.code === '42501') return page(returnLink + '<h2>Revision access changed</h2>', 403);
            throw error;
          }
          return new Response(null, { status: 303, headers: { Location: missionPath, 'Cache-Control': 'no-store' } });
        }
        if (action === '/verification') {
          const backToMission = `<a href="${url.pathname.slice(0, -13)}">Return to mission</a>`;
          const planLink = `<a href="${url.pathname}?view=plan">Inspect verification plan</a>`;
          if (request.method === 'GET' && url.searchParams.get('view') === 'catalog') {
            const expected = url.searchParams.get('sha256');
            const snapshot = await catalogSnapshot();
            if (expected !== snapshot.catalogSha256) {
              return page(planLink + '<h2>Catalog snapshot unavailable</h2><p>Open the current plan to inspect its catalog.</p>', 409);
            }
            if (url.searchParams.get('format') === 'text') {
              return new Response(snapshot.catalog, { headers: {
                'Content-Type': 'text/plain; charset=utf-8',
                'Content-Disposition': 'attachment; filename="source-index.md"',
                'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
              } });
            }
            return page(planLink + `<h2>Source catalog preview</h2>
<p>Catalog SHA-256 <code>${snapshot.catalogSha256}</code></p>
<p><a href="${url.pathname}?view=catalog&amp;sha256=${snapshot.catalogSha256}&amp;format=text">Download catalog input</a></p>
<pre>${escapeHtml(snapshot.catalog.toString('utf8'))}</pre>`);
          }
          if (request.method === 'GET' && url.searchParams.get('view') === 'plan') {
            const snapshot = await catalogSnapshot();
            const canRun = canReview && activeReview?.decision === 'accepted';
            return page(backToMission + `<h2>Source catalog verification plan</h2>
<p>Mission revision ${active.revision}${activeReview ? ' · Review ' + activeReview.version : ''}</p>
<ol><li>Read the deployed source catalog.</li><li>Check required fields, unique record IDs, and HTTPS URL syntax.</li>
<li>Save the result and any failures as a receipt linked to the accepted review.</li></ol>
<p>This check reads a bundled file and writes a receipt in this workspace. It makes no network requests.</p>
<dl><dt>Catalog SHA-256</dt><dd><code>${snapshot.catalogSha256}</code></dd>
<dt>Checker SHA-256</dt><dd><code>${snapshot.checkerSha256}</code></dd></dl>
<p><a href="${url.pathname}?view=catalog&amp;sha256=${snapshot.catalogSha256}">Preview catalog input</a></p>
${canRun ? `<form method="post" action="${url.pathname}">
<input type="hidden" name="version" value="${activeReview.version}">
<input type="hidden" name="catalog" value="${snapshot.catalogSha256}">
<input type="hidden" name="checker" value="${snapshot.checkerSha256}">
<button>Check source catalog</button></form>` : '<p>An owner or editor can run this check after accepting the mission.</p>'}`);
          }
          if (request.method === 'POST') {
            if (!canReview) return page(backToMission + '<h2>Your role can view verification evidence</h2>', 403);
            if (request.headers.get('content-type')?.split(';')[0] !== 'application/x-www-form-urlencoded') {
              return page(backToMission + '<h2>Submit the verification form</h2>', 415);
            }
            const form = new URLSearchParams(await request.text());
            const version = Number(form.get('version'));
            if (form.size !== 3 || !form.has('catalog') || !form.has('checker') || activeReview?.decision !== 'accepted' || version !== activeReview.version) {
              return page(backToMission + '<h2>Review changed</h2><p>Check the current mission decision before running verification.</p>', 409);
            }
            const snapshot = await catalogSnapshot();
            if (form.get('catalog') !== snapshot.catalogSha256 || form.get('checker') !== snapshot.checkerSha256) {
              return page(planLink + '<h2>Verification inputs changed</h2><p>Review the updated plan before running the check.</p>', 409);
            }
            const evidence = checkCatalog(snapshot);
            try {
              if (await workspaces.recordCatalogCheck(actor, workspaceId, projectId, missionId, version, evidence, snapshot.catalog)) {
                const key = [version, evidence.catalogSha256, evidence.checkerSha256].join('-');
                return new Response(null, { status: 303, headers: {
                  Location: verificationReceiptPath(url.pathname, key), 'Cache-Control': 'no-store',
                } });
              }
            } catch (error) {
              if (error.code !== '42501') throw error;
              return page(backToMission + '<h2>Verification access changed</h2>', 403);
            }
            return page(backToMission + '<h2>Review changed</h2>', 409);
          }
          const selected = url.searchParams.get('receipt');
          const match = /^([1-9][0-9]{0,9})-([a-f0-9]{64})-([a-f0-9]{64})$/.exec(selected ?? '');
          const historyLink = `<a href="${url.pathname}">All verification evidence</a>`;
          if (selected !== null && (!match || Number(match[1]) > 2147483647)) {
            return page(historyLink + '<h2>Verification receipt unavailable</h2>', 404);
          }
          const receipt = match ? { version: Number(match[1]), catalog: match[2], checker: match[3] } : null;
          const evidence = await workspaces.catalogChecks(actor, workspaceId, missionId, receipt);
          if (receipt && !evidence.length) return page(historyLink + '<h2>Verification receipt unavailable</h2>', 404);
          if (receipt && url.searchParams.get('format') === 'catalog') {
            const bytes = await workspaces.catalogReceiptInput(actor, workspaceId, missionId, receipt);
            if (!bytes) return page(historyLink + '<h2>Saved catalog input unavailable</h2>', 404);
            return new Response(bytes, { headers: {
              'Content-Type': 'text/plain; charset=utf-8',
              'Content-Disposition': 'attachment; filename="source-index.md"',
              'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
            } });
          }
          const deployed = await catalogSnapshot().catch(() => null);
          if (receipt && url.searchParams.get('format') === 'json') {
            return reply(200, {
              schemaVersion: 1, workspaceId, projectId, missionId, receipt: evidence[0],
              comparison: {
                comparedAt: new Date().toISOString(),
                inputStatus: catalogInputStatus(evidence[0], deployed),
                currentReview: evidence[0].review_version === activeReview?.version,
                deployedCatalogSha256: deployed?.catalogSha256 ?? null,
                deployedCheckerSha256: deployed?.checkerSha256 ?? null,
              },
            }, { 'Content-Disposition': `attachment; filename="alchemy-catalog-receipt-${missionId}-${receipt.version}.json"` });
          }
          const download = receipt
            ? `<p><a href="${url.pathname}?receipt=${encodeURIComponent(selected)}&amp;format=json">Download receipt (JSON)</a></p>`
            : '';
          const inputLink = !receipt ? '' : evidence[0].has_catalog_input
            ? `<p><a href="${verificationReceiptPath(url.pathname, selected)}&amp;format=catalog">Download saved catalog input</a></p>`
            : '<p>This receipt predates catalog input retention.</p>';
          const entries = evidence.map(check => `<li><h3>${check.failures.length ? 'Failed' : 'Passed'}</h3>
<p>Review ${check.review_version} · ${check.record_count} source records · ${escapeHtml(new Date(check.checked_at).toISOString())}</p>
${receipt ? '' : `<p><a href="${verificationReceiptPath(url.pathname, [check.review_version, check.catalog_sha256, check.checker_sha256].join('-'))}">Open this receipt</a></p>`}
<p>Mission revision ${check.mission_revision}${check.review_version !== activeReview?.version
  ? ' · Historical evidence. The current review needs its own check.' : ''}</p>
<p>${inputStatusLabels[catalogInputStatus(check, deployed)]}</p><dl><dt>Recorded by</dt><dd>${escapeHtml(check.actor_id)}</dd>
<dt>Catalog SHA-256</dt><dd><code>${escapeHtml(check.catalog_sha256)}</code></dd>
<dt>Checker SHA-256</dt><dd><code>${escapeHtml(check.checker_sha256)}</code></dd></dl>
${check.failures.length ? '<ul>' + check.failures.map(failure => '<li>' + escapeHtml(failure) + '</li>').join('') + '</ul>' : ''}</li>`).join('');
          return page(backToMission + (receipt ? ' · ' + historyLink : '') + `<h2>Source catalog verification</h2>
${download}${inputLink}<p>Checks record IDs, required fields, and HTTPS URL syntax in the deployed Alchemy catalog.</p>
${receipt ? '' : `<p>${planLink}</p>`}
<h3>Evidence history</h3>${entries ? '<ol>' + entries + '</ol>' : '<p>No verification evidence recorded.</p>'}`);
        }
        if (action === '/sources') {
          const returnLink = `<a href="${url.pathname.slice(0, -8)}">Return to mission</a>`;
          try {
            const { referenceCandidates, projectRecords } = retrieve(active.goal + '\n' + active.acceptance);
            const suppressions = await workspaces.sourceSuppressions(actor, workspaceId);
            const references = referenceCandidates.filter(source => !suppressions.has(source.id)).map(source =>
              `<li><a href="/workspaces/${workspaceId}/knowledge?record=${encodeURIComponent(source.id)}">${escapeHtml(source.title)}</a> · ${escapeHtml(source.id)}</li>`).join('');
            const decisions = projectRecords.map(source =>
              `<li>${escapeHtml(source.title)} · ${escapeHtml(source.role)} · ${escapeHtml(source.id)}</li>`).join('');
            return page(returnLink + `<h2>Sources for ${escapeHtml(mission.title)}</h2>
<p>Candidates matched to the goal and acceptance criteria. Review their applicability before using them.</p>
<h3>External references</h3>${references ? '<ul>' + references + '</ul>' : '<p>No matching external references.</p>'}
<h3>Alchemy product records</h3>${decisions ? '<ul>' + decisions + '</ul>' : '<p>No matching product records.</p>'}`);
          } catch {
            return page(returnLink + '<h2>Source lookup unavailable</h2><p>Try again after the source catalog has been checked.</p>', 503);
          }
        }
        if (action === '/export') return reply(200, {
          schemaVersion: 1,
          exportedAt: new Date().toISOString(),
          workspaceId,
          project: { id: project.id, name: project.name, purpose: project.purpose },
          mission,
          revisions,
          reviews: history,
          plans: review.plans,
          catalogChecks: review.catalogChecks,
        }, { 'Content-Disposition': `attachment; filename="alchemy-mission-${mission.id}.json"` });
        function reviewPageContent({ reviews = history, revision = active, note = '', error = '', status = 200 } = {}) {
          const currentDecision = reviews[0]?.mission_revision === revision.revision ? reviews[0].decision : null;
          const nextAction = currentDecision === 'accepted'
            ? `<p><a href="${url.pathname}/verification?view=plan">Inspect verification plan</a></p>`
            : currentDecision === 'changes-requested' && canReview
              ? `<p><a href="${url.pathname}/revise">Revise mission in response to feedback</a></p>`
              : '';
          const prior = reviews.map(item => `<li><strong>${decisionLabel(item.decision)}</strong>
<p class="preserve">${escapeHtml(item.evidence)}</p><small>Revision ${item.mission_revision} · Reviewer ${escapeHtml(item.reviewer)} · ${escapeHtml(new Date(item.recorded_at).toISOString())}</small></li>`).join('');
          return page(back + `<h2>${escapeHtml(mission.title)}</h2><p class="status">${currentDecision ? decisionLabel(currentDecision) : 'Awaiting review'}</p>${nextAction}
<p><a href="${url.pathname}/export">Download mission, reviews, and verification (JSON)</a></p>
<p><a href="${url.pathname}/plan">Work plan</a></p><p><a href="${url.pathname}/sources">Find sources for this mission</a></p><p><a href="${url.pathname}/verification">Source catalog verification</a></p>
<dl><dt>Revision</dt><dd>${revision.revision}</dd><dt>Goal</dt><dd class="preserve">${escapeHtml(revision.goal)}</dd><dt>Acceptance criteria</dt><dd class="preserve">${escapeHtml(revision.acceptance)}</dd></dl>
${canReview ? `<section><h3>Record a decision</h3><p><a href="${url.pathname}/revise">Revise mission</a></p>${error ? `<p role="alert">${escapeHtml(error)}</p>` : ''}<form method="post">
<input type="hidden" name="version" value="${reviews[0]?.version ?? 0}">${revision.revision > 1 ? `<input type="hidden" name="revision" value="${revision.revision}">` : ''}
<label for="review-evidence">Evidence and reasoning</label><textarea id="review-evidence" name="evidence" maxlength="2000" required>${escapeHtml(note)}</textarea>
<button name="decision" value="accepted">Accept mission</button>
<button name="decision" value="changes-requested">Request changes</button></form></section>` : ''}
<section><h3>Revision history</h3><ol>${[...revisions, { ...mission, revision: 1 }].map(item => `<li id="revision-${item.revision}"><strong>Revision ${item.revision}</strong><p class="preserve">${escapeHtml(item.goal)}</p><p class="preserve">${escapeHtml(item.acceptance)}</p></li>`).join('')}</ol></section><section><h3>Review history</h3>${prior ? '<ol>' + prior + '</ol>' : '<p>No decisions yet.</p>'}</section>`, status);

        }
        if (request.method === 'POST') {
          const retry = `<a href="${url.pathname}">Return to mission review</a>`;
          if (!canReview) return page('<h2>Your role can view reviews</h2>' + retry, 403);
          if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/x-www-form-urlencoded') {
            return page('<h2>Submit the review form from the mission page</h2>' + retry, 415);
          }
          const body = await request.text();
          if (Buffer.byteLength(body) > 24_576) return page('<h2>Review is too large</h2>' + retry, 413);
          const form = new URLSearchParams(body);
          const keys = ['version', 'decision', 'evidence'];
          if (form.has('revision')) keys.push('revision');
          if (form.size !== keys.length || keys.some(key => form.getAll(key).length !== 1) ||
              !/^\d+$/.test(form.get('version'))) return page('<h2>Check the review fields</h2>' + retry, 400);
          let saved;
          try {
            saved = await workspaces.recordReview(actor, workspaceId, projectId, missionId, {
              version: Number(form.get('version')), revision: Number(form.get('revision') ?? 1), decision: form.get('decision'), evidence: form.get('evidence'),
            });
          } catch (error) {
            if (error instanceof TypeError) return reviewPageContent({ note: form.get('evidence'), error: 'Choose a decision and enter 1 to 2,000 characters of evidence.', status: 400 });
            if (error.code === '42501') return page('<h2>Review access changed</h2>' + retry, 403);
            throw error;
          }
          if (!saved) {
            const current = await workspaces.missionReview(actor, workspaceId, projectId, missionId);
            if (!current) return page(back + '<h2>Mission unavailable</h2>', 404);
            return reviewPageContent({
              reviews: current.history, revision: current.revisions[0] ?? { ...current.mission, revision: 1 }, note: form.get('evidence'),
              error: 'The review changed. Read the latest decision below before submitting again.', status: 409,
            });
          }
          return new Response(null, { status: 303, headers: { Location: url.pathname, 'Cache-Control': 'no-store' } });
        }
        return reviewPageContent();
      }
      const projectPage = projectRoute.exec(url.pathname);
      if (['GET', 'POST'].includes(request.method) && projectPage) {
        if (!actor) return signedOut();
        const [, workspaceId, projectId, action] = projectPage;
        if (action === '/export') {
          if (request.method !== 'GET') return reply(405, { error: 'Use GET to download a project' }, { Allow: 'GET' });
          const bundle = await workspaces.exportProjects(actor, workspaceId, projectId);
          if (!bundle?.projects.length) return page('<a href="/">All workspaces</a><h2>Project unavailable</h2>', 404);
          const { missions, ...project } = bundle.projects[0];
          return reply(200, { schemaVersion: 1, exportedAt: new Date().toISOString(), workspaceId, project, missions },
            { 'Content-Disposition': `attachment; filename="alchemy-project-${project.id}.json"` });
        }
        const project = await workspaces.getProject(actor, workspaceId, projectId);
        if (!project) return page('<a href="/">All workspaces</a><h2>Project unavailable</h2>', 404);
        navigationWorkspace = { id: workspaceId, role: project.role };
        navigationProject = { path: `/workspaces/${workspaceId}/projects/${projectId}`, name: project.name };
        if (action === '/releases') {
          const releasePath = url.pathname;
          const back = `<a href="${releasePath}">Back to release candidates</a>`;
          const sourceLink = release => repositoryPreview(navigationProject.path + '/repository',
            release.owner_name + '/' + release.repository_name, release.commit_sha);
          if (url.searchParams.get('approvers') === '1') {
            if (project.role !== 'owner') return page(back + '<h2>Only workspace owners can manage release approvers</h2>', 403);
            const approversPath = releasePath + '?approvers=1';
            const renderApprovers = async (status = 200, error = '') => {
              const grants = await workspaces.releaseApproverGrants(actor, workspaceId, projectId);
              const items = grants.map(grant => `<li><code>${grant.reviewer_id}</code> · ${escapeHtml(grant.environment)}
· ${grant.revoked_at ? 'Revoked' : 'Active'}
${grant.revoked_at ? '' : `<form method="post"><input type="hidden" name="grant" value="${grant.id}">
<button name="action" value="revoke">Revoke ${escapeHtml(grant.environment)} approval access for ${grant.reviewer_id}</button></form>`}</li>`);
              return page(back + `<h2>Release approvers</h2>${error ? `<p role="alert">${escapeHtml(error)}</p>` : ''}
${items.length ? '<ol>' + items.join('') + '</ol>' : '<p>No release approver grants recorded.</p>'}
<section><h3>Grant release approval access</h3><form method="post">
<label for="release-reviewer">Workspace member account ID</label>
<input id="release-reviewer" name="reviewer" required maxlength="36">
<label for="release-environment">Environment</label><select id="release-environment" name="environment" required>
<option value="">Choose an environment</option><option value="staging">Staging</option><option value="production">Production</option></select>
<p><button name="action" value="grant">Grant approval access</button></p></form></section>`, status);
            };
            if (request.method === 'GET') return renderApprovers();
            if (request.headers.get('content-type')?.split(';')[0] !== 'application/x-www-form-urlencoded') {
              return renderApprovers(415, 'Submit the release approver form.');
            }
            const form = new URLSearchParams(await request.text());
            const environment = form.get('environment');
            const reviewer = form.get('reviewer')?.trim();
            const grant = form.get('grant');
            let changed;
            if (form.size === 3 && form.get('action') === 'grant' &&
              releaseEnvironments.includes(environment) && accountIdPattern.test(reviewer ?? '')) {
              changed = await workspaces.setReleaseApproverGrant(actor, workspaceId, projectId, reviewer, environment);
            } else if (form.size === 2 && form.get('action') === 'revoke' && accountIdPattern.test(grant ?? '')) {
              changed = await workspaces.revokeReleaseApproverGrant(actor, workspaceId, projectId, grant);
            } else {
              return renderApprovers(400, 'Enter a workspace member ID and choose an environment, or select an active grant to revoke.');
            }
            if (!changed) return renderApprovers(409, 'The grant could not be changed. Check the current grants and workspace membership.');
            return new Response(null, { status: 303, headers: { Location: approversPath, 'Cache-Control': 'no-store' } });
          }
          const runId = url.searchParams.get('from');
          if (runId !== null) {
            if (project.role !== 'owner') return page(back + '<h2>Only workspace owners can prepare release candidates</h2>', 403);
            if (!accountIdPattern.test(runId ?? '')) return page(back + '<h2>Invalid release candidate source</h2>', 400);
            const run = await workspaces.eligibleArchiveReleaseRun(actor, workspaceId, projectId, runId);
            if (!run) return page(back + '<h2>A verified passing archive run is required</h2>', 409);
            const render = (reason = '', error = '', status = 200) => page(back + `<h2>Prepare a release candidate</h2>
<p>Commit <code>${run.commit_sha}</code> · Archive SHA-256 <code>${run.archive_sha256}</code></p>
<p><a href="${escapeHtml(sourceLink(run) + '&archive=runs&run=' + run.id)}">Review Node test evidence</a></p>
${error ? `<p role="alert">${escapeHtml(error)}</p>` : ''}
<form method="post"><input type="hidden" name="digest" value="${run.archive_sha256}">
<label for="release-reason">Release rationale</label><textarea id="release-reason" name="reason" required maxlength="1000">${escapeHtml(reason)}</textarea>
<button>Save release candidate</button></form>`, status);
            if (request.method === 'GET') return render();
            if (request.headers.get('content-type')?.split(';')[0] !== 'application/x-www-form-urlencoded') return render('', 'Submit the release candidate form.', 415);
            const form = new URLSearchParams(await request.text());
            const reason = (form.get('reason') ?? '').trim().slice(0, 1001);
            if (form.size !== 2 || !reason || reason.length > 1000) return render(reason, 'Enter a release rationale of 1 to 1000 characters.', 400);
            if (form.get('digest') !== run.archive_sha256) return render(reason, 'The archive digest changed. Verify the new digest before continuing.', 409);
            const candidate = await workspaces.proposeArchiveRelease(actor, workspaceId, projectId, run.id, run.archive_sha256, reason);
            return new Response(null, { status: 303, headers: { Location: candidate ? releasePath + '?candidate=' + candidate.id : releasePath,
              'Cache-Control': 'no-store' } });
          }
          const selected = url.searchParams.get('candidate');
          if (selected !== null && !accountIdPattern.test(selected)) return page(back + '<h2>Invalid release candidate address</h2>', 400);
          const candidates = await workspaces.archiveReleaseCandidates(actor, workspaceId, projectId, selected);
          if (selected !== null) {
            const [candidate] = candidates;
            if (!candidate) return page(back + '<h2>Release candidate unavailable</h2>', 404);
            const repository = sourceLink(candidate);
            const renderCandidate = async (status = 200, error = '') => {
              const decisions = await workspaces.releaseEnvironmentDecisions(actor, workspaceId, projectId, selected);
              const grants = await workspaces.releaseApproverGrants(actor, workspaceId, projectId, actor);
              const records = decisions.map(decision => `<li><strong>${escapeHtml(decision.environment)} · ${escapeHtml(decision.decision)}</strong>
· ${new Date(decision.decided_at).toISOString()} by <code>${decision.reviewer_id}</code>
<p class="preserve">${escapeHtml(decision.reason)}</p>${decision.expires_at
  ? `<p>${decision.expired ? 'Expired' : 'Approval expires'} ${new Date(decision.expires_at).toISOString()}</p>` : ''}</li>`);
              const forms = grants.filter(grant => grant.reviewer_id === actor && !grant.revoked_at &&
                !decisions.some(decision => decision.environment === grant.environment)).map(grant => `<section>
<h3>Review for ${escapeHtml(grant.environment)}</h3>
<form method="post"><input type="hidden" name="grant" value="${grant.id}">
<input type="hidden" name="environment" value="${escapeHtml(grant.environment)}">
<input type="hidden" name="digest" value="${candidate.archive_sha256}">
<label for="decision-${grant.environment}">Reason for ${escapeHtml(grant.environment)} decision</label>
<textarea id="decision-${grant.environment}" name="reason" required maxlength="1000"></textarea>
<button name="decision" value="approved">Approve for ${escapeHtml(grant.environment)}</button>
<button name="decision" value="denied">Deny for ${escapeHtml(grant.environment)}</button></form></section>`);
              return page(back + `<h2>Release candidate</h2><p>Proposed ${new Date(candidate.proposed_at).toISOString()} by <code>${candidate.proposed_by}</code></p>
<p>Commit <code>${candidate.commit_sha}</code> · Archive SHA-256 <code>${candidate.archive_sha256}</code></p>
<p class="preserve">${escapeHtml(candidate.reason)}</p>
<p><a href="${escapeHtml(repository + '&archive=runs&run=' + candidate.run_id)}">View Node test evidence</a> ·
<a href="${escapeHtml(repository + '&archive=download')}">Download candidate archive</a></p>
<h3>Environment decisions</h3>${error ? `<p role="alert">${escapeHtml(error)}</p>` : ''}
${records.length ? '<ol>' + records.join('') + '</ol>' : '<p>No environment decisions recorded.</p>'}${forms.join('')}`, status);
            };
            if (request.method === 'GET') return renderCandidate();
            if (request.headers.get('content-type')?.split(';')[0] !== 'application/x-www-form-urlencoded') return renderCandidate(415, 'Submit the release decision form.');
            const form = new URLSearchParams(await request.text());
            const environment = form.get('environment');
            const grant = form.get('grant');
            const decision = form.get('decision');
            const reason = form.get('reason')?.trim() ?? '';
            if (form.size !== 5 || !releaseEnvironments.includes(environment) ||
              !accountIdPattern.test(grant ?? '') || !['approved', 'denied'].includes(decision) || !reason || reason.length > 1000) {
              return renderCandidate(400, 'Choose a valid environment and decision, and enter a reason.');
            }
            const grants = await workspaces.releaseApproverGrants(actor, workspaceId, projectId, actor);
            if (!grants.some(entry => entry.id === grant && entry.environment === environment && entry.reviewer_id === actor && !entry.revoked_at)) {
              return renderCandidate(403, 'An active approval grant for this environment is required.');
            }
            if (!await workspaces.decideReleaseEnvironment(actor, workspaceId, projectId, selected, grant, environment, form.get('digest'), decision, reason)) {
              return renderCandidate(409, 'The decision could not be saved. Check the candidate and current environment decision.');
            }
            return new Response(null, { status: 303, headers: {
              Location: releasePath + '?candidate=' + selected, 'Cache-Control': 'no-store',
            } });
          }
          if (request.method === 'POST') return page(back + '<h2>Choose a release candidate</h2>', 400);
          const items = candidates.map(candidate => `<li><a href="${releasePath}?candidate=${candidate.id}">Candidate for <code>${candidate.commit_sha}</code></a>
· ${new Date(candidate.proposed_at).toISOString()}</li>`);
          return page(`<h2>Release candidates</h2>${project.role === 'owner' ? `<p><a href="${releasePath}?approvers=1">Manage release approvers</a></p>` : ''}
${items.length ? '<ol>' + items.join('') + '</ol>' :
            `<p>No release candidates. Prepare one from a passing run in <a href="${navigationProject.path}/repository">Repository</a>.</p>`}`);
        }
        if (action === '/repository') {
          const writable = ['owner', 'editor'].includes(project.role);
          if (request.method === 'GET' && url.searchParams.get('saved') === 'files') {
            const savedFiles = await workspaces.projectSourceFiles(actor, workspaceId, projectId);
            const items = savedFiles.map(source => {
              const name = source.owner_name + '/' + source.repository_name;
              const parts = source.file_path.split('/');
              const file = parts.pop();
              const link = repositoryFilePreview(url.pathname, name, source.commit_sha, parts.join('/'), file);
              return `<li><a href="${escapeHtml(link)}">${escapeHtml(source.file_path)}</a> · ${escapeHtml(name)} · <code>${source.commit_sha}</code></li>`;
            });
            return page(`<a href="${url.pathname}">Back to repository revisions</a><h2>Saved source files</h2>` + (items.length
              ? '<p>Showing up to 50 recently saved files.</p><ol>' + items.join('') + '</ol>'
              : '<p>No source files are saved. Open a recorded revision and choose a file to save.</p>'));
          }
          if (url.searchParams.has('commit') || url.searchParams.has('repository')) {
            const back = `<a href="${url.pathname}">Back to repository revisions</a>`;
            const name = url.searchParams.get('repository') ?? '';
            const commit = url.searchParams.get('commit') ?? '';
            const source = parseGitHubSource('https://github.com/' + name, commit);
            const directory = url.searchParams.get('directory') ?? '';
            const file = url.searchParams.get('file');
            const filePath = file === null ? null : [directory, file].filter(Boolean).join('/');
            const offsetText = url.searchParams.get('offset') ?? '0';
            if (!source || (directory && !browsableDirectory(directory)) || !/^\d{1,5}$/.test(offsetText)
              || (file !== null && (!previewableName(file) || Buffer.byteLength(filePath) > 2000))) {
              return page(back + '<h2>Invalid repository preview address</h2>', 400);
            }
            const canonicalName = source.owner + '/' + source.repository;
            if (url.searchParams.has('archive')) {
              const action = url.searchParams.get('archive');
              if (!['view', 'download', 'inventory', 'compare', 'runs'].includes(action) || file !== null || directory ||
                (!['view', 'runs'].includes(action) && request.method !== 'GET')) {
                return page(back + '<h2>Invalid repository archive address</h2>', 400);
              }
              if (request.method === 'POST' && !writable) {
                return page(back + '<h2>Only workspace Owners and Editors can import a repository archive</h2>', 403);
              }
              const revision = await workspaces.projectSource(actor, workspaceId, projectId, source);
              if (!revision) return page(back + '<h2>Repository revision unavailable</h2>', 404);
              const archiveUrl = repositoryPreview(url.pathname, canonicalName, source.commit);
              const returnUrl = archiveUrl + '&archive=view';
              const saved = await workspaces.projectSourceArchive(actor, workspaceId, projectId, source,
                ['download', 'inventory', 'compare'].includes(action));
              if (action === 'runs') {
                const runsUrl = archiveUrl + '&archive=runs';
                const backToArchive = `<a href="${escapeHtml(returnUrl)}">Back to archive</a>`;
                if (!saved) return page(backToArchive + '<h2>Repository archive unavailable</h2>', 404);
                if (request.method === 'POST') {
                  if (!nodeRunsEnabled) return page(backToArchive + '<h2>Node test dispatch is unavailable</h2>', 503);
                  if (request.headers.get('content-type')?.split(';')[0] !== 'application/x-www-form-urlencoded') {
                    return page(backToArchive + '<h2>Submit the Node test form</h2>', 415);
                  }
                  const form = new URLSearchParams(await request.text());
                  const submission = form.get('submission');
                  if (form.size !== 1 || !accountIdPattern.test(submission ?? '')) {
                    return page(backToArchive + '<h2>Invalid run request</h2>', 400);
                  }
                  await workspaces.queueArchiveTestRun(actor, workspaceId, projectId, source, submission);
                  return new Response(null, { status: 303, headers: { Location: runsUrl, 'Cache-Control': 'no-store' } });
                }
                const runId = url.searchParams.get('run');
                if (runId !== null && !accountIdPattern.test(runId)) return page(backToArchive + '<h2>Invalid run address</h2>', 400);
                const runs = await workspaces.archiveTestRuns(actor, workspaceId, projectId, source, runId);
                if (runId !== null && !runs.length) return page(backToArchive + '<h2>Test run unavailable</h2>', 404);
                const headline = run => `<strong>${escapeHtml(run.state)}</strong> · ${new Date(run.requested_at).toISOString()}`;
                if (runId !== null) {
                  const [run] = runs;
                  const candidateLink = project.role === 'owner' && run.state === 'finished' &&
                    run.result?.status === 'finished' && run.result?.exitCode === 0 &&
                    run.result?.commit === source.commit && run.result?.archiveSha256 === saved.archive_sha256
                    ? `<p><a href="${navigationProject.path}/releases?from=${run.id}">Prepare release candidate</a></p>` : '';
                  return page(`<a href="${escapeHtml(runsUrl)}">Back to Node test runs</a><h2>Node test run</h2>
<p>${headline(run)}</p><p>Requested by <code>${escapeHtml(run.requested_by)}</code></p>
${run.result ? `<p>Runner result</p><pre>${escapeHtml(JSON.stringify(run.result, null, 2))}</pre>`
  : '<p>Refresh for the latest state.</p>'}${candidateLink}`);
                }
                const active = runs.some(run => ['queued', 'running'].includes(run.state));
                const items = runs.map(run => `<li><a href="${escapeHtml(runsUrl + '&run=' + run.id)}">${headline(run)}</a></li>`);
                return page(backToArchive + `<h2>Node test runs</h2><p>Commit <code>${source.commit}</code> · Archive SHA-256 <code>${saved.archive_sha256}</code></p>
${items.length ? '<ol>' + items.join('') + '</ol>' : '<p>No Node test runs for this archive.</p>'}
${writable && !nodeRunsEnabled ? '<p>Node test dispatch is unavailable on this deployment.</p>' : ''}
${writable && nodeRunsEnabled && !active ? `<form method="post" action="${escapeHtml(runsUrl)}">
<input type="hidden" name="submission" value="${randomUUID()}"><button>Queue Node tests</button></form>` : ''}`);
              }
              if (action === 'inventory' || action === 'compare') {
                if (!saved) return page(back + '<h2>Repository archive unavailable</h2>', 404);
                const inventory = await inventoryArchive(saved.content, source.commit);
                if (inventory.status !== 'verified') {
                  return page(`<a href="${escapeHtml(returnUrl)}">Back to archive</a><h2>Archive inventory unavailable</h2>
<p>${inventory.status === 'too-large' ? 'The archive exceeds the inventory limits.' : 'The archive could not be read as a valid source inventory.'}</p>`, 422);
                }
                if (action === 'compare') {
                  const comparison = await compareGitHubArchiveFiles(source, revision.tree_sha, inventory.entries, githubRequest);
                  if (comparison.status !== 'compared') {
                    const errors = {
                      missing: [404, 'GitHub could not find the recorded tree.'],
                      'too-large': [422, 'The recorded tree exceeds the comparison limit.'],
                      'invalid-archive': [422, 'The archive does not have a single source root.'],
                      unavailable: [503, 'GitHub could not provide a complete tree. Try again shortly.'],
                    };
                    const [status, message] = errors[comparison.status];
                    return page(`<a href="${escapeHtml(returnUrl)}">Back to archive</a><h2>Archive comparison unavailable</h2><p>${message}</p>`, status);
                  }
                  const { matched, mismatched, missing, extra } = comparison;
                  return reply(200, { schemaVersion: 1, repository: canonicalName, commit: source.commit,
                    tree: revision.tree_sha, archiveSha256: saved.archive_sha256, scope: 'regular files',
                    result: mismatched.length || missing.length || extra.length ? 'differences' : 'match',
                    matched, mismatched, missing, extra },
                  { 'Content-Disposition': `attachment; filename="source-${source.commit}-comparison.json"` });
                }
                return reply(200, { schemaVersion: 1, repository: canonicalName, commit: source.commit, archiveSha256: saved.archive_sha256,
                  expandedBytes: inventory.expandedSize, entries: inventory.entries },
                { 'Content-Disposition': `attachment; filename="source-${source.commit}-inventory.json"` });
              }
              if (action === 'download') {
                if (!saved) return page(back + '<h2>Repository archive unavailable</h2>', 404);
                return new Response(saved.content, { headers: {
                  'Content-Type': 'application/gzip', 'Cache-Control': 'no-store',
                  'Content-Disposition': `attachment; filename="source-${source.commit}.tar.gz"`,
                  'X-Content-Type-Options': 'nosniff',
                } });
              }
              if (request.method === 'POST') {
                const formType = request.headers.get('content-type')?.split(';')[0];
                const form = formType === 'application/x-www-form-urlencoded' ? new URLSearchParams(await request.text()) : null;
                if (form?.size !== 1 || form.get('confirm') !== 'import') {
                  return page(back + '<h2>Submit the archive import form</h2>', 400);
                }
                if (!saved) {
                  const imported = await readGitHubArchive(source, githubRequest);
                  if (imported.status !== 'verified') {
                    const outcomes = {
                      missing: [422, 'GitHub could not find an archive for this commit.'],
                      'too-large': [422, 'The archive exceeds 8 MiB compressed or 64 MiB expanded.'],
                      'invalid-archive': [422, 'GitHub did not return a valid compressed tar envelope.'],
                      'wrong-revision': [422, 'The archive could not be matched to the recorded commit.'],
                      unavailable: [503, 'GitHub did not provide a usable archive. Try again shortly.'],
                    };
                    const [status, message] = outcomes[imported.status];
                    return page(back + `<h2>Archive import unavailable</h2><p>${message}</p><a href="${escapeHtml(returnUrl)}">Return to archive</a>`, status);
                  }
                  await workspaces.recordProjectSourceArchive(actor, workspaceId, projectId, source, imported.bytes);
                }
                return new Response(null, { status: 303, headers: { Location: returnUrl, 'Cache-Control': 'no-store' } });
              }
              return page(back + `<h2>Repository archive</h2><p>${escapeHtml(canonicalName)} · <code>${source.commit}</code></p>
${saved ? `<p>Imported ${saved.size} bytes on ${new Date(saved.recorded_at).toISOString()} by <code>${saved.recorded_by}</code>.</p>
<p>SHA-256 <code>${saved.archive_sha256}</code></p><p><a href="${escapeHtml(archiveUrl + '&archive=download')}">Download saved archive</a>
· <a href="${escapeHtml(archiveUrl + '&archive=inventory')}">Download file inventory (JSON)</a>
· <a href="${escapeHtml(archiveUrl + '&archive=compare')}">Compare with GitHub tree (JSON)</a>
· <a href="${escapeHtml(archiveUrl + '&archive=runs')}">Node test runs</a></p>`
  : `<p>No archive is saved for this revision.</p>${writable ? '<p>Import the GitHub source archive for this commit, up to 8 MiB compressed and 64 MiB expanded.</p><form method="post"><button name="confirm" value="import">Import repository archive</button></form>' : ''}`}`);
            }
            if (request.method === 'POST' && (!file || !writable)) {
              return page(back + '<h2>Only workspace Owners and Editors can save source files</h2>', 403);
            }
            const fileUrl = file === null ? '' : repositoryFilePreview(url.pathname, canonicalName, source.commit, directory, file, Number(offsetText));
            let expectedBlob;
            if (request.method === 'POST') {
              if (request.headers.get('content-type')?.split(';')[0] !== 'application/x-www-form-urlencoded') {
                return page(back + '<h2>Submit the save source form</h2>', 415);
              }
              const form = new URLSearchParams(await request.text());
              expectedBlob = form.get('blob');
              if (form.size !== 1 || !/^[a-f0-9]{40}$/.test(expectedBlob ?? '')) {
                return page(back + '<h2>Invalid source save confirmation</h2>', 400);
              }
            }
            const saved = filePath === null ? null : await workspaces.projectSourceFile(actor, workspaceId, projectId, source, filePath);
            const redirectToFile = () => new Response(null, { status: 303, headers: { Location: fileUrl, 'Cache-Control': 'no-store' } });
            if (saved) {
              if (request.method === 'POST') return expectedBlob === saved.blob_sha ? redirectToFile()
                : page(back + '<h2>The saved source does not match this confirmation</h2>', 409);
              const content = new TextDecoder('utf-8', { fatal: true }).decode(saved.content);
              return page(`<a href="${url.pathname}?saved=files">Back to saved source files</a><h2>${escapeHtml(file)}</h2>
<p>${escapeHtml(canonicalName)} · Commit <code>${source.commit}</code></p>
<p>Blob <code>${saved.blob_sha}</code> · ${saved.content.byteLength} bytes</p>
<p>Saved ${new Date(saved.recorded_at).toISOString()} by <code>${saved.recorded_by}</code></p>
${saved.content.byteLength ? `<pre><code>${escapeHtml(content)}</code></pre>` : '<p>This file is empty.</p>'}`);
            }
            const recorded = await workspaces.projectSource(actor, workspaceId, projectId, source);
            if (!recorded) return page(back + '<h2>Repository revision unavailable</h2>', 404);
            const segments = directory ? directory.split('/') : [];
            const listing = await inspectGitHubDirectory(source, recorded.tree_sha, segments, githubRequest);
            const github = `https://github.com/${canonicalName}/tree/${source.commit}`;
            const openGitHub = `<p><a href="${github}">Open the pinned revision on GitHub</a></p>`;
            if (listing.status !== 'verified') {
              const message = { missing: 'GitHub could not find the recorded tree or directory.',
                'too-large': 'The directory is too large to preview here.',
                unavailable: 'GitHub could not provide the tree. Try again shortly.' }[listing.status];
              return page(back + '<h2>Repository preview unavailable</h2><p>' + message + '</p>' + openGitHub,
                listing.status === 'missing' ? 404 : listing.status === 'too-large' ? 422 : 503);
            }
            const offset = Number(offsetText);
            const pageSize = 100;
            const count = listing.entries.length;
            if (offset && (offset % pageSize !== 0 || offset >= count)) {
              return page(back + '<h2>Repository preview page unavailable</h2>', 404);
            }
            const browse = (path, start) => escapeHtml(repositoryPreview(url.pathname, canonicalName, source.commit, path, start));
            if (file !== null) {
              const returnToDirectory = `<a href="${browse(directory, offset)}">Back to directory</a>`;
              const entry = listing.entries.find(item => item.path === file && isRegularGitHubFile(item));
              if (!entry) return page(returnToDirectory + '<h2>Source file unavailable</h2>', 404);
              if (request.method === 'POST' && entry.sha !== expectedBlob) {
                return page(returnToDirectory + '<h2>Source file no longer matches the save confirmation</h2>', 409);
              }
              const result = await readGitHubTextFile(source, entry, githubRequest);
              if (result.status !== 'verified') {
                const errors = {
                  missing: [404, 'GitHub could not find this file.'],
                  unsupported: [422, 'This file cannot be displayed as UTF-8 text.'],
                  'too-large': [422, 'The file exceeds the 64 KiB preview limit.'],
                  unavailable: [503, 'GitHub did not return verifiable file contents. Try again shortly.'],
                };
                const [status, message] = errors[result.status];
                return page(returnToDirectory + '<h2>Source preview unavailable</h2><p>' + message + '</p>' + openGitHub, status);
              }
              if (request.method === 'POST') {
                await workspaces.recordProjectSourceFile(actor, workspaceId, projectId, source, filePath, entry.sha, result.bytes);
                return redirectToFile();
              }
              return page(returnToDirectory + `<h2>${escapeHtml(file)}</h2>
<p>${escapeHtml(canonicalName)} · Commit <code>${source.commit}</code></p>
<p>Blob <code>${entry.sha}</code> · ${result.size} bytes</p>
${writable ? `<form method="post" action="${escapeHtml(fileUrl)}"><input type="hidden" name="blob" value="${entry.sha}"><button>Save file to project</button></form>` : ''}
${result.size ? `<pre><code>${escapeHtml(result.text)}</code></pre>` : '<p>This file is empty.</p>'}`);
            }
            const rows = listing.entries.slice(offset, offset + pageSize).map(entry => {
              const childPath = [...segments, entry.path].join('/');
              const label = escapeHtml(entry.path);
              const type = { tree: 'Directory', blob: 'File', commit: 'Submodule' }[entry.type];
              const href = entry.type === 'tree' && browsableDirectory(childPath) ? browse(childPath)
                : isRegularGitHubFile(entry) && previewableName(entry.path) && Buffer.byteLength(childPath) <= 2000
                  ? browse(directory, offset) + '&amp;' + escapeHtml(new URLSearchParams({ file: entry.path }).toString()) : '';
              return `<li>${href ? `<a href="${href}">${label}</a>` : `<code>${label}</code>`} · ${type}</li>`;
            });
            return page(back + `<h2>Repository preview</h2><p>${escapeHtml(canonicalName)} · <code>${source.commit}</code></p>
<p>Directory <code>/${escapeHtml(directory)}</code></p>${directory ? `<p><a href="${browse(segments.slice(0, -1).join('/'))}">Parent directory</a></p>` : ''}${openGitHub}
${count ? `<p>Showing ${offset + 1}–${Math.min(offset + pageSize, count)} of ${count} entries.</p><ul>${rows.join('')}</ul>` : '<p>This directory is empty.</p>'}
${offset ? `<p><a href="${browse(directory, offset - pageSize)}">Previous entries</a></p>` : ''}
${offset + pageSize < count ? `<p><a href="${browse(directory, offset + pageSize)}">Next entries</a></p>` : ''}`);
          }
          const render = async (status = 200, message = '', repository = '', revision = '') => {
            const sources = await workspaces.projectSources(actor, workspaceId, projectId);
            const entries = sources.map(source => {
              const name = source.owner_name + '/' + source.repository_name;
              return `<li><a href="https://github.com/${escapeHtml(name)}/commit/${source.commit_sha}">${escapeHtml(name)} · ${source.commit_sha}</a>
<p><a href="${escapeHtml(repositoryPreview(url.pathname, name, source.commit_sha))}">Browse files for this revision</a> ·
<a href="${escapeHtml(repositoryPreview(url.pathname, name, source.commit_sha) + '&archive=view')}">Repository archive</a></p>
<p>Tree <code>${source.tree_sha}</code> · Recorded ${new Date(source.recorded_at).toISOString()} by <code>${source.recorded_by}</code></p></li>`;
            });
            return page(`<h2>Repository revisions</h2><p><a href="${url.pathname}?saved=files">Saved source files</a></p>${entries.length ? '<p>Showing up to 50 recently recorded revisions.</p><ol>' + entries.join('') + '</ol>' : '<p>No repository revisions recorded.</p>'}
${writable ? `<section><h3>Record a public GitHub revision</h3>
<p>Flex Alchemy checks the commit and saves its tree identifier as project evidence.</p>
${message ? `<p role="alert">${escapeHtml(message)}</p>` : ''}
<form method="post"><label for="repository">GitHub repository URL</label>
<input id="repository" name="repository" type="url" maxlength="165" value="${escapeHtml(repository)}" required>
<label for="revision">Full commit SHA</label><input id="revision" name="revision" maxlength="40" value="${escapeHtml(revision)}" required>
<button>Verify and record revision</button></form></section>` : ''}`, status);
          };
          if (request.method === 'GET') return render();
          if (!writable) return page('<h2>Your role cannot record repository revisions</h2>', 403);
          if (request.headers.get('content-type')?.split(';')[0] !== 'application/x-www-form-urlencoded') {
            return render(415, 'Submit the repository form.');
          }
          const form = new URLSearchParams(await request.text());
          const repository = (form.get('repository') ?? '').trim().slice(0, 166);
          const revision = (form.get('revision') ?? '').trim().slice(0, 41);
          const source = form.size === 2 && parseGitHubSource(repository, revision);
          if (!source) return render(400, 'Enter a public GitHub repository URL and a 40-character commit SHA.', repository, revision);
          const result = await verifyGitHubSource(source, githubRequest);
          if (result.status === 'missing') return render(422, 'GitHub could not find this public repository revision.', repository, revision);
          if (result.status !== 'verified') return render(503, 'GitHub verification is temporarily unavailable. Try again shortly.', repository, revision);
          await workspaces.recordProjectSource(actor, workspaceId, projectId, source, result.tree);
          return new Response(null, { status: 303, headers: { Location: url.pathname, 'Cache-Control': 'no-store' } });
        }
        if (action === '/delete') {
          const backToProject = `<a href="${navigationProject.path}">Back to project</a>`;
          if (project.role !== 'owner') return page(backToProject + '<h2>Only workspace owners can delete projects</h2>', 403);
          if (request.method === 'GET') return page(backToProject + `<h2>Delete ${escapeHtml(project.name)}?</h2>
<p>Only projects with no missions or saved drafts can be deleted. Deleting a project also removes its recorded revisions, saved source files, and repository archives.</p>
<form method="post"><input type="hidden" name="expectedName" value="${escapeHtml(project.name)}">
<button>Delete project permanently</button></form>`);
          if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/x-www-form-urlencoded') {
            return page(backToProject + '<h2>Use the project deletion form</h2>', 415);
          }
          const form = new URLSearchParams(await request.text());
          if (form.size !== 1 || !form.has('expectedName')) return page(backToProject + '<h2>Invalid confirmation</h2>', 400);
          try {
            if (!await workspaces.deleteProject(actor, workspaceId, projectId, form.get('expectedName'))) {
              return page(backToProject + '<h2>Project or access changed</h2><p>Reopen the project before trying again.</p>', 409);
            }
          } catch (error) {
            if (error.code === '23503') return page(backToProject + '<h2>Project has saved work</h2><p>Deletion is available only for projects with no missions or saved drafts.</p>', 409);
            throw error;
          }
          return new Response(null, { status: 303, headers: {
            Location: `/workspaces/${workspaceId}?project=deleted`, 'Cache-Control': 'no-store',
          } });
        }

        if (action === '/edit') {
          const backToProject = `<a href="${navigationProject.path}">Back to project</a>`;
          if (!['owner', 'editor'].includes(project.role)) return page(backToProject + '<h2>Your role cannot rename projects</h2>', 403);
          const edit = (current, name, purpose = current.purpose, message = '', status = 200) => page(backToProject + `<h2>Edit project details</h2>
<p>Current name: ${escapeHtml(current.name)}</p>${message ? `<p class="preserve">Current purpose: ${escapeHtml(current.purpose)}</p>` : ''}
${message ? `<p role="alert">${escapeHtml(message)}</p>` : ''}
<form method="post"><input type="hidden" name="expectedName" value="${escapeHtml(current.name)}">
<label for="project-name">New project name</label><input id="project-name" name="name" required maxlength="100" value="${escapeHtml(name)}">
<input type="hidden" name="expectedPurpose" value="${escapeHtml(current.purpose.replace(/\r\n?/g, '\n'))}">
<label for="project-purpose">Purpose</label><textarea id="project-purpose" name="purpose" maxlength="2000">${escapeHtml(purpose)}</textarea>
<button>Save project details</button></form>`, status);
          if (request.method === 'GET') return edit(project, project.name);
          if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/x-www-form-urlencoded') {
            return edit(project, project.name, project.purpose, 'Use the project details form.', 415);
          }
          const form = new URLSearchParams(await request.text());
          const name = form.get('name') ?? '';
          const expectedName = form.get('expectedName');
          const purpose = form.get('purpose')?.replace(/\r\n?/g, '\n');
          const expectedPurpose = form.get('expectedPurpose')?.replace(/\r\n?/g, '\n');
          const fields = purpose === undefined && expectedPurpose === undefined
            ? ['name', 'expectedName'] : ['name', 'expectedName', 'purpose', 'expectedPurpose'];
          if (form.size !== fields.length || fields.some(field => form.getAll(field).length !== 1) ||
              (purpose?.length ?? 0) > 2000 || form.getAll('name').length !== 1 || expectedName === null ||
              !name.trim() || name.trim().length > 100) {
            return edit(project, name, purpose, 'Enter a name of 1 to 100 characters and a purpose of up to 2,000 characters.', 400);
          }
          if (!await workspaces.editProject(actor, workspaceId, projectId, name, expectedName, purpose, expectedPurpose)) {
            const latest = await workspaces.getProject(actor, workspaceId, projectId);
            if (!latest) return page('<h2>Project unavailable</h2><a href="/">Return home</a>', 404);
            if (!['owner', 'editor'].includes(latest.role)) return page(backToProject + '<h2>Your role cannot rename projects</h2>', 403);
            return edit(latest, name, purpose, 'The project details changed. Review the saved details before saving again.', 409);
          }
          return new Response(null, { status: 303, headers: {
            Location: navigationProject.path + '?updated=name', 'Cache-Control': 'no-store',
          } });
        }

        if (action === '/decisions') {
          if (request.method !== 'GET') return reply(405, { error: 'Use GET to view pending plan decisions' }, { Allow: 'GET' });
          const pending = await workspaces.projectPlans(actor, workspaceId, projectId, true);
          const items = pending.map(plan => `<li><a href="${navigationProject.path}/missions/${plan.id}/plan">${escapeHtml(plan.title)}</a>
· Mission revision ${plan.revision} · Plan version ${plan.version}</li>`).join('');
          return page(`<h2>Pending plan decisions for ${escapeHtml(project.name)}</h2>
<p>Workspace owners can approve or deny the latest plan for each mission.</p>
${items ? '<ol>' + items + '</ol>' : '<p>No current work plans are awaiting a decision.</p>'}`);
        }
        if (action === '/plans') {
          if (request.method !== 'GET') return reply(405, { error: 'Use GET to view work plans' }, { Allow: 'GET' });
          const plans = await workspaces.projectPlans(actor, workspaceId, projectId);
          const items = plans.map(plan => `<li><a href="${navigationProject.path}/missions/${plan.id}/plan">${escapeHtml(plan.title)}</a>
 · Revision ${plan.revision}, plan version ${plan.version}
 · ${plan.revision === plan.current_revision ? 'Current revision' : 'Historical plan. Current revision has no plan.'} · ${plan.decision === 'approved' ? 'Approved' : plan.decision === 'denied' ? 'Denied' : plan.decision === 'withdrawn' ? 'Approval withdrawn' : 'Awaiting owner decision'}</li>`).join('');
          return page(`<h2>Work plans for ${escapeHtml(project.name)}</h2>
${items ? '<ul>' + items + '</ul>' : '<p>No work plans recorded. Open a mission to view or create its plan.</p>'}`);
        }
        if (action === '/reviews') {
          if (request.method !== 'GET') return reply(405, { error: 'Use GET to view pending reviews' }, { Allow: 'GET' });
          const projectPath = url.pathname.slice(0, -'/reviews'.length);
          const pending = await workspaces.pendingReviews(actor, workspaceId, projectId);
          const items = pending.map(mission => `<li><a href="${projectPath}/missions/${mission.id}">${escapeHtml(mission.title)}</a>
· Revision ${mission.revision}</li>`).join('');
          return page(`<a href="${projectPath}">Back to project</a><h2>Pending reviews for ${escapeHtml(project.name)}</h2>
<p>Missions appear here when their current revision has no decision.</p>
${items ? '<ol>' + items + '</ol>' : '<p>No mission revisions are awaiting review.</p>'}`);
        }
        if (action === '/evidence') {
          if (request.method !== 'GET') return reply(405, { error: 'Use GET to view evidence' }, { Allow: 'GET' });
          const projectPath = url.pathname.slice(0, -9);
          const back = `<a href="${projectPath}">Back to project</a>`;
          const filter = url.searchParams.get('result') ?? '';
          if (!['', 'passed', 'failed'].includes(filter)) return page(back + '<h2>Choose a valid evidence filter</h2>', 400);
          const checks = await workspaces.projectEvidence(actor, workspaceId, projectId, filter ? filter === 'passed' : null);
          const deployed = await catalogSnapshot().catch(() => null);
          const rows = checks.map(check => `<li>
<strong>${check.passed ? 'Passed' : 'Failed'}</strong> ·
<a href="${projectPath}/missions/${check.mission_id}/verification?receipt=${encodeURIComponent(check.receipt)}">${escapeHtml(check.title)}</a>
<p>Mission revision ${check.mission_revision} · Review ${check.review_version}${check.current_review ? '' : ' · Historical evidence'}
· ${escapeHtml(new Date(check.checked_at).toISOString())}</p><p>${inputStatusLabels[catalogInputStatus(check, deployed)]}</p></li>`).join('');
          return page(back + `<h2>Evidence for ${escapeHtml(project.name)}</h2>
<p>Showing up to 50 recent source catalog checks.</p>
<form method="get"><label for="evidence-result">Result</label><select id="evidence-result" name="result">
<option value="">All results</option><option value="passed"${filter === 'passed' ? ' selected' : ''}>Passed</option>
<option value="failed"${filter === 'failed' ? ' selected' : ''}>Failed</option></select> <button>Filter</button></form>
${rows ? '<ol>' + rows + '</ol>' : '<p>No source catalog checks match this filter.</p>'}`);
        }
        const canCreate = ['owner', 'editor'].includes(project.role);
        const intake = action === '/missions/new';
        const missionIndex = action === '/missions';
        const projectPath = intake || missionIndex ? url.pathname.slice(0, -action.length) : url.pathname;
        if (intake && !canCreate) return page(`<a href="${projectPath}">Back to project</a><h2>Your role cannot create missions</h2>`, 403);
        if (missionIndex) {
          if (request.method !== 'GET') return reply(405, { error: 'Use GET to view missions' }, { Allow: 'GET' });
          const labels = { all: 'All missions', pending: 'Awaiting review', accepted: 'Accepted', 'changes-requested': 'Changes requested' };
          const status = url.searchParams.get('status') ?? 'all';
          const back = `<a href="${projectPath}">Back to project</a>`;
          if (!Object.hasOwn(labels, status)) return page(back + '<h2>Choose a valid review status</h2>', 400);
          const entries = await workspaces.listMissions(actor, workspaceId, projectId, {});
          const filtered = entries.filter(mission => status === 'all' || status === (mission.decision ?? 'pending'));
          const rows = filtered.map(mission => `<li><a href="${projectPath}/missions/${mission.id}">${escapeHtml(mission.title)}</a>
 · Revision ${mission.revision} · ${labels[mission.decision ?? 'pending']}</li>`).join('');
          return page(back + `<h2>Missions for ${escapeHtml(project.name)}</h2>
${canCreate ? `<p><a href="${projectPath}/missions/new">New mission</a></p>` : ''}
<form method="get"><label for="mission-status">Review status</label><select id="mission-status" name="status">
${Object.entries(labels).map(([value, label]) => `<option value="${value}"${value === status ? ' selected' : ''}>${label}</option>`).join('')}
</select> <button>Filter</button></form>
${rows ? '<ul>' + rows + '</ul>' : '<p>No missions match this filter.</p>'}`);
        }

        if (url.searchParams.get('draft') === 'discard') {
          const back = `<a href="${url.pathname}">Return to project</a>`;
          if (!canCreate) return page(back + '<h2>Your role cannot discard a draft</h2>', 403);
          if (request.method === 'POST') {
            if (request.headers.get('content-type')?.split(';')[0] !== 'application/x-www-form-urlencoded') {
              return page(back + '<h2>Submit the discard confirmation form</h2>', 415);
            }
            const form = new URLSearchParams(await request.text());
            const digest = form.get('digest');
            if (form.size !== 1 || !/^[a-f0-9]{64}$/.test(digest ?? '')) {
              return page(back + '<h2>Invalid discard confirmation</h2>', 400);
            }
            if (!await workspaces.discardMissionDraft(actor, workspaceId, projectId, digest)) {
              return page(back + '<h2>Draft changed or is already gone</h2><p>Return to the project to see the current draft.</p>', 409);
            }
            return new Response(null, { status: 303, headers: {
              Location: url.pathname + '?draft=discarded', 'Cache-Control': 'no-store',
            } });
          }
          const draft = await workspaces.missionDraft(actor, workspaceId, projectId);
          if (!draft) return page(back + '<h2>No saved draft to discard</h2>', 404);
          return page(back + `<h2>Discard saved draft?</h2>
<p>This removes your saved draft for ${escapeHtml(project.name)}.</p>
<dl><dt>Title</dt><dd>${escapeHtml(draft.title || 'Untitled draft')}</dd>
<dt>Goal</dt><dd class="preserve">${escapeHtml(draft.goal)}</dd>
<dt>Acceptance criteria</dt><dd class="preserve">${escapeHtml(draft.acceptance)}</dd></dl>
<form method="post"><input type="hidden" name="digest" value="${draft.digest}">
<button>Discard saved draft</button></form>`);
        }
        if (request.method === 'POST') {
          if (!canCreate) return page('<h2>Your role cannot create missions</h2><a href="' + url.pathname + '">Return to project</a>', 403);
          if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/x-www-form-urlencoded') {
            return page('<h2>Unsupported mission form format</h2><a href="' + url.pathname + '">Return to project</a>', 415);
          }
          const content = await request.text();
          if (Buffer.byteLength(content) > 24_576) {
            return page('<h2>Mission form is too large</h2><a href="' + url.pathname + '">Return to project</a>', 413);
          }
          const form = new URLSearchParams(content);
          const fields = ['title', 'goal', 'acceptance', 'submissionKey'];
          const saveDraft = form.get('intent') === 'draft';
          if (saveDraft) fields.push('intent');
          if (form.has('draftDigest')) fields.push('draftDigest');
          if (form.size !== fields.length || fields.some(field => form.getAll(field).length !== 1)) {
            return page('<h2>Check the mission fields</h2><a href="' + url.pathname + '">Return to project</a>', 400);
          }
          const draft = { title: form.get('title'), goal: form.get('goal'), acceptance: form.get('acceptance') };
          const submissionKey = form.get('submissionKey');
          const expectedDigest = form.get('draftDigest') ?? '';
          if (expectedDigest && !/^[a-f0-9]{64}$/.test(expectedDigest)) return page('<h2>Invalid draft version</h2>', 400);
          const recover = (message, status, key, button) => page(
            `<a href="${url.pathname}">Return to project</a><h2>${escapeHtml(project.name)}</h2>` +
            missionForm({ ...draft, submissionKey: key, digest: expectedDigest }, message, button), status);
          try {
            if (saveDraft) {
              if (draft.title.length > 100 || draft.goal.length > 2000 || draft.acceptance.length > 2000) {
                return recover('Shorten the draft to fit the field limits.', 400, submissionKey);
              }
              if (!await workspaces.saveMissionDraft(actor, workspaceId, projectId, draft, expectedDigest)) {
                const current = await workspaces.missionDraft(actor, workspaceId, projectId);
                const saved = current ? `<section><h3>Currently saved draft</h3>
<dl><dt>Title</dt><dd>${escapeHtml(current.title)}</dd><dt>Goal</dt><dd class="preserve">${escapeHtml(current.goal)}</dd>
<dt>Acceptance criteria</dt><dd class="preserve">${escapeHtml(current.acceptance)}</dd></dl></section>`
                  : '<p>There is no longer a saved draft for this project.</p>';
                return page(`<a href="${url.pathname}">Return to project</a><h2>Draft conflict</h2>` + saved +
                  missionForm({ ...draft, submissionKey, digest: current?.digest ?? '' },
                    'The saved draft changed. Compare your edits below before saving again.'), 409);
              }
              return new Response(null, { status: 303, headers: {
                Location: url.pathname + '?draft=saved', 'Cache-Control': 'no-store',
              } });
            }
            const saved = await workspaces.createMission(actor, workspaceId, projectId, draft, submissionKey, { clearDraft: true });
            return new Response(null, { status: 303, headers: {
              Location: projectPath + '/missions/' + saved.id, 'Cache-Control': 'no-store',
            } });
          } catch (error) {
            if (error.code === 'MISSION_SUBMISSION_CONFLICT') {
              return recover('This form already saved a different mission. Review the draft before creating a separate mission.', 409, randomUUID(), 'Save as a separate mission');
            }
            if (error.code === '42501') return page('<h2>Your role cannot create missions</h2><a href="' + url.pathname + '">Return to project</a>', 403);
            if (error instanceof TypeError) {
              const key = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(submissionKey) ? submissionKey : randomUUID();
              return recover(error.message, 400, key);
            }
            throw error;
          }
        }
        const draft = canCreate ? await workspaces.missionDraft(actor, workspaceId, projectId) : undefined;
        const draftState = url.searchParams.get('draft');
        const intakeForm = canCreate ? [
          draft && draftState === 'saved' ? '<p role="status">Draft saved.</p>' : '',
          !draft && draftState === 'discarded' ? '<p role="status">Draft discarded.</p>' : '',
          missionForm(draft),
          draft ? `<p><a href="${url.pathname}?draft=discard">Discard saved draft</a></p>` : '',
        ].join('') : '<p>Your role can view missions.</p>';
        if (intake) return page(`<a href="${projectPath}">Back to project</a><h2>New mission for ${escapeHtml(project.name)}</h2>` + intakeForm);
        const snapshot = await catalogSnapshot().catch(() => ({}));
        const entries = await workspaces.listMissions(actor, workspaceId, project.id, snapshot);
        return page(`<a href="/workspaces/${workspaceId}">Back to workspace</a>
<h2>${escapeHtml(project.name)}</h2>${project.purpose ? `<p class="preserve">${escapeHtml(project.purpose)}</p>` : ''}${url.searchParams.get('updated') === 'name' ? '<p role="status">Project details saved.</p>' : ''}${canCreate ? `<p><a href="${projectPath}/edit">Edit project details</a></p>` : ''}${project.role === 'owner' ? `<p><a href="${projectPath}/delete">Delete project</a></p>` : ''}<p><a href="${url.pathname}/export">Download project, reviews, and verification (JSON)</a></p>${canCreate ? `<p><a href="${projectPath}/missions/new">New mission</a></p>` : ''}<h3>Missions</h3><p><a href="${projectPath}/missions">Browse missions by review status</a></p>` + (entries.length
          ? '<ul>' + entries.map(({ id, title, goal, acceptance, revision, decision, catalog_passed }) => `<li><h4><a href="${url.pathname}/missions/${id}">${escapeHtml(title)}</a></h4>
<p>Revision ${revision} · ${decision ? decisionLabel(decision) : 'Awaiting review'}</p>
${decision === 'accepted' ? `<p><a href="${url.pathname}/missions/${id}/verification">${!snapshot.catalogSha256 ? 'Catalog check status unavailable' : catalog_passed === null
  ? 'Current catalog check needed' : catalog_passed ? 'Current catalog check passed' : 'Current catalog check failed'}</a></p>` : ''}
<dl><dt>Goal</dt><dd>${escapeHtml(goal)}</dd><dt>Acceptance criteria</dt><dd>${escapeHtml(acceptance)}</dd></dl></li>`).join('') + '</ul>'
          : '<p>No missions yet.</p>') + intakeForm);
      }
      if (browserPage) return page('<h2>Page unavailable</h2><p>Check the address or return to Flex Alchemy.</p><a href="/">Return home</a>', 404);
      if (!actor) return reply(401, { error: 'Sign in required' });
      if (request.method === 'GET' && url.pathname === '/api/workspaces') {
        return reply(200, { workspaces: await workspaces.listWorkspaces(actor) });
      }
      const projectMatch = projects.exec(url.pathname);
      if (request.method === 'GET' && projectMatch) {
        return reply(200, { projects: await workspaces.listProjects(actor, projectMatch[1]) });
      }
      const missionMatch = missions.exec(url.pathname);
      if (missionMatch) {
        const [, workspaceId, projectId] = missionMatch;
        if (request.method === 'GET') {
          return reply(200, { missions: await workspaces.listMissions(actor, workspaceId, projectId) });
        }
        if (request.method === 'POST') {
          const input = await missionInput(request);
          return reply(201, { mission: await workspaces.createMission(actor, workspaceId, projectId, input,
            request.headers.get('idempotency-key')) });
        }
      }
      return reply(404, { error: 'Page unavailable' });
    } catch (error) {
      if (error.code === 'MISSION_SUBMISSION_CONFLICT') return reply(409, { error: 'Submission key already used for a different mission' });
      if (error.code === '42501') return reply(403, { error: 'Action denied' });
      if (error.code === '23503') return reply(404, { error: 'Project unavailable' });
      if (error instanceof TypeError || error instanceof SyntaxError) return reply(400, { error: 'Invalid request' });
      if (browserPage) {
        const unavailable = /^08|^57P0[123]$/.test(error.code ?? '') || ['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT'].includes(error.code);
        return page('<h2>Workspace temporarily unavailable</h2><p>Try again in a moment or return to Flex Alchemy.</p><a href="/">Return home</a>',
          unavailable ? 503 : 500);
      }
      return reply(503, { error: 'Workspace temporarily unavailable' });
    }
  };
}
