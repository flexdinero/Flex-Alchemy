import assert from 'node:assert/strict';
import { createHash, X509Certificate } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import tls from 'node:tls';
import AxeBuilder from '@axe-core/playwright';
import { chromium } from 'playwright';

function leafPin(address, ca) {
  const destination = new URL(address);
  return new Promise((resolve, reject) => {
    const socket = tls.connect({ host: '127.0.0.1', port: Number(destination.port),
      servername: destination.hostname, ca }, () => {
      try {
        const leaf = new X509Certificate(socket.getPeerCertificate().raw);
        resolve(createHash('sha256').update(leaf.publicKey.export({ type: 'spki', format: 'der' })).digest('base64'));
      } catch (error) {
        reject(error);
      } finally {
        socket.end();
      }
    });
    socket.setTimeout(5000, () => socket.destroy(new Error('Browser certificate handshake timed out')));
    socket.on('error', reject);
  });
}

export async function checkIdentityBrowser({ origin, identityOrigin, ca, password }) {
  const addresses = [origin, identityOrigin];
  const hosts = addresses.map(url => new URL(url).hostname);
  const pins = await Promise.all(addresses.map(address => leafPin(address, ca)));
  const channel = process.env.ALCHEMY_SMOKE_BROWSER_CHANNEL ?? (process.platform === 'win32' ? 'msedge' : undefined);
  const browser = await chromium.launch({ channel, args: [
    '--no-proxy-server',
    '--host-resolver-rules=' + hosts.map(host => 'MAP ' + host + ' 127.0.0.1').join(','),
    '--ignore-certificate-errors-spki-list=' + pins.join(','),
  ] });
  try {
    const context = await browser.newContext({ viewport: { width: 320, height: 800 }, serviceWorkers: 'block' });
    await context.route('**/*', route => addresses.includes(new URL(route.request().url()).origin)
      ? route.continue() : route.abort());
    const page = await context.newPage();
    async function signIn(page) {
      await page.getByRole('link', { name: 'Sign in', exact: true }).click();
      await page.locator('#username').fill('founder');
      await page.locator('#password').fill(password);
      await page.locator('#kc-login').click();
      await page.getByRole('heading', { name: 'Your workspaces' }).waitFor();
    }
    async function audit(label) {
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
      assert.equal(overflow, false, label + ' fits within the viewport');
      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
      assert.deepEqual(results.violations.map(violation => ({ id: violation.id, nodes: violation.nodes.map(node => node.target) })),
        [], label + ' has no violations detected by axe');
    }
    await page.goto(origin, { waitUntil: 'domcontentloaded' });
    await page.keyboard.press('Tab');
    assert.equal(await page.locator(':focus').textContent(), 'Skip to content');
    await page.keyboard.press('Enter');
    assert.equal(await page.locator(':focus').getAttribute('id'), 'main');
    await audit('Public entry at 320 px');
    await signIn(page);
    await page.getByRole('link', { name: 'Create a workspace' }).click();
    await page.getByRole('heading', { name: 'Create a workspace' }).waitFor();
    await audit('Workspace setup at 320 px');
    await page.getByLabel('Workspace name').fill('Browser verification workspace');
    const workspaceSubmit = page.waitForResponse(response => response.request().method() === 'POST'
      && new URL(response.url()).pathname === '/workspaces/new');
    await page.getByRole('button', { name: 'Create workspace' }).click();
    assert.equal((await workspaceSubmit).status(), 303, 'Workspace form accepted a browser submission');
    await page.getByRole('heading', { name: 'Browser verification workspace' }).waitFor();
    const workspace = page.url();
    await audit('Workspace at 320 px');
    await page.getByRole('link', { name: 'New project', exact: true }).click();
    await audit('Project setup at 320 px');
    await page.getByLabel('Project name').fill('Browser verification project');
    await page.getByLabel('Purpose').fill('Verify the signed-in browser path.');
    await page.getByRole('button', { name: 'Create project' }).click();
    await page.getByRole('heading', { name: 'Browser verification project' }).waitFor();
    await page.reload();
    await page.getByRole('heading', { name: 'Browser verification project' }).waitFor();
    await audit('Project at 320 px');
    await page.getByRole('link', { name: 'New mission', exact: true }).click();
    await page.getByLabel('Title', { exact: true }).fill('Review source catalog');
    await page.getByLabel('Goal', { exact: true }).fill('Verify the structure of the deployed source catalog.');
    await page.getByLabel('Acceptance criteria').fill('Save a passing receipt with both input digests.');
    await audit('Mission intake at 320 px');
    await page.getByRole('button', { name: 'Save mission', exact: true }).click();
    await page.getByRole('heading', { name: 'Review source catalog', exact: true }).waitFor();
    const mission = page.url();
    await page.getByText('Awaiting review', { exact: true }).waitFor();
    await page.getByRole('link', { name: 'Work plan', exact: true }).click();
    await page.getByLabel('Steps, dependencies, and planned checks').fill('Inspect the deployed catalog and download the saved verification receipt.');
    await page.getByRole('button', { name: 'Save work plan' }).click();
    await page.getByRole('heading', { name: 'Decide plan version 1' }).waitFor();
    await page.getByRole('link', { name: 'Plan decisions', exact: true }).click();
    await page.getByRole('link', { name: 'Review source catalog', exact: true }).click();
    await page.getByLabel('Decision reason').fill('The saved plan matches the mission criteria.');
    await page.getByRole('button', { name: 'Approve work plan' }).click();
    await page.getByRole('heading', { name: 'Withdraw plan approval' }).waitFor();
    await page.getByRole('link', { name: 'Plans', exact: true }).click();
    await page.getByRole('link', { name: 'Review source catalog', exact: true }).click();
    assert.equal(new URL(page.url()).searchParams.get('version'), '1-1');
    await page.getByRole('heading', { name: 'Saved work plan for Review source catalog' }).waitFor();
    await audit('Saved work plan at 320 px');
    await page.goto(mission);
    await page.getByLabel('Evidence and reasoning').fill('The criteria specify a bounded catalog check.');
    await page.getByRole('button', { name: 'Accept mission' }).click();
    await page.getByText('Accepted by reviewer', { exact: true }).first().waitFor();
    await page.getByRole('link', { name: 'Source catalog verification', exact: true }).click();
    await page.getByRole('link', { name: 'Inspect verification plan' }).click();
    await page.getByRole('button', { name: 'Check source catalog' }).click();
    await page.getByRole('heading', { name: 'Passed', exact: true }).waitFor();
    await audit('Catalog receipt at 320 px');
    const pendingDownload = page.waitForEvent('download', { timeout: 15_000 });
    await page.getByRole('link', { name: 'Download receipt (JSON)' }).click();
    const download = await pendingDownload;
    assert.match(download.suggestedFilename(), /^alchemy-catalog-receipt-.*\.json$/);
    const evidence = JSON.parse(await readFile(await download.path(), 'utf8'));
    assert.equal(evidence.missionId, new URL(mission).pathname.split('/').at(-1));
    assert.equal(evidence.comparison.currentReview, true);
    assert.deepEqual(evidence.receipt.failures, []);
    assert.match(evidence.receipt.catalog_sha256, /^[a-f0-9]{64}$/);
    assert.match(evidence.receipt.checker_sha256, /^[a-f0-9]{64}$/);
    await page.reload();
    await page.getByRole('heading', { name: 'Passed', exact: true }).waitFor();
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(workspace, { waitUntil: 'domcontentloaded' });
    await audit('Workspace at 1440 px');
    await page.getByRole('link', { name: 'Team access', exact: true }).click();
    await audit('Team access at 1440 px');
    await page.getByRole('link', { name: 'Account', exact: true }).click();
    await page.getByRole('link', { name: 'Appearance preferences', exact: true }).click();
    const theme = page.getByLabel('Color theme');
    await theme.selectOption('light');
    await page.getByRole('button', { name: 'Save appearance' }).click();
    await page.getByRole('status').filter({ hasText: 'Appearance saved.' }).waitFor();
    assert.equal(await page.locator('body').getAttribute('data-theme'), 'light');
    assert.equal(await page.locator('body').evaluate(body => getComputedStyle(body).backgroundColor), 'rgb(245, 246, 241)');
    await audit('Light appearance at 1440 px');
    await page.goto(workspace, { waitUntil: 'domcontentloaded' });
    assert.equal(await page.locator('body').getAttribute('data-theme'), 'light');
    await audit('Light workspace at 1440 px');
    const freshContext = await browser.newContext({ serviceWorkers: 'block' });
    try {
      await freshContext.route('**/*', route => addresses.includes(new URL(route.request().url()).origin)
        ? route.continue() : route.abort());
      const freshPage = await freshContext.newPage();
      await freshPage.goto(origin, { waitUntil: 'domcontentloaded' });
      await signIn(freshPage);
      assert.equal(await freshPage.locator('body').getAttribute('data-theme'), 'light');
    } finally {
      await freshContext.close();
    }
    await page.goto(origin + '/preferences', { waitUntil: 'domcontentloaded' });
    await page.emulateMedia({ colorScheme: 'light' });
    await theme.selectOption('system');
    await page.getByRole('button', { name: 'Save appearance' }).click();
    await page.getByRole('status').filter({ hasText: 'Appearance saved.' }).waitFor();
    assert.equal(await page.locator('body').getAttribute('data-theme'), 'system');
    assert.equal(await page.locator('body').evaluate(body => getComputedStyle(body).backgroundColor), 'rgb(245, 246, 241)');
    await page.emulateMedia({ colorScheme: 'dark' });
    assert.equal(await page.locator('body').evaluate(body => getComputedStyle(body).backgroundColor), 'rgb(17, 18, 19)');
    await page.getByRole('button', { name: 'Use default appearance' }).click();
    await page.getByRole('status').filter({ hasText: 'Default appearance restored.' }).waitFor();
    assert.equal(await page.locator('body').getAttribute('data-theme'), 'dark');
    console.log('Browser sign-in, workspace and project creation, mission review, catalog receipt, appearance, and responsive axe checks passed.');
  } finally {
    await browser.close();
  }
}
