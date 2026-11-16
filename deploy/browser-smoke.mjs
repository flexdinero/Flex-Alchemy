import assert from 'node:assert/strict';
import { createHash, X509Certificate } from 'node:crypto';
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
    console.log('Browser sign-in, keyboard skip link, workspace and project creation, reload, appearance, and responsive axe checks passed.');
  } finally {
    await browser.close();
  }
}
