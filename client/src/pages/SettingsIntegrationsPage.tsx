import React, { useEffect, useState } from 'react';
import { Copy, RefreshCw, Webhook as WebhookIcon, Facebook, Mail, Sparkles, Sheet, Workflow } from 'lucide-react';
import * as integrationsApi from '../services/integrationsApi';
import * as outreachApi from '../services/outreachApi';
import { IntegrationsOverview, WebhookDelivery, OutreachProvidersOverview, EmailSettings } from '../types';
import SettingsTabs from '../components/SettingsTabs';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorState from '../components/ErrorState';
import ConfirmDialog from '../components/ConfirmDialog';
import { useToast } from '../hooks/useToast';
import { isLikelyPersonalEmailDomain } from '../lib/outreachErrors';
import PageHeader from '../components/PageHeader';

export default function SettingsIntegrationsPage(): React.ReactElement {
  const { showToast } = useToast();
  const [overview, setOverview] = useState<IntegrationsOverview | null>(null);
  const [deliveries, setDeliveries] = useState<WebhookDelivery[]>([]);
  const [providers, setProviders] = useState<OutreachProvidersOverview | null>(null);
  const [emailSettings, setEmailSettings] = useState<EmailSettings | null>(null);
  const [sheetConnection, setSheetConnection] = useState<{ name: string; spreadsheet_id: string | null; sheet_range: string } | null>(null);
  const [emailForm, setEmailForm] = useState({ defaultSenderName: '', defaultSenderEmail: '', defaultReplyTo: '', dailySendLimit: 100, voiceDescription: '' });
  const [sheetForm, setSheetForm] = useState({ name: '', spreadsheetId: '', sheetRange: 'Sheet1' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newSecret, setNewSecret] = useState<string | null>(null);
  const [confirmRotate, setConfirmRotate] = useState(false);
  const [pageIdInput, setPageIdInput] = useState('');

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [ov, dl, p, es, sc] = await Promise.all([
        integrationsApi.getIntegrationsOverview(),
        integrationsApi.listWebhookDeliveries().catch(() => ({ deliveries: [] })),
        outreachApi.getProviders(),
        outreachApi.getSettings(),
        outreachApi.getSheetConnection(),
      ]);
      setOverview(ov);
      setDeliveries(dl.deliveries);
      setPageIdInput(ov.meta.externalAccountId ?? '');
      setProviders(p.providers);
      setEmailSettings(es.settings);
      if (es.settings) {
        setEmailForm({
          defaultSenderName: es.settings.default_sender_name ?? '',
          defaultSenderEmail: es.settings.default_sender_email ?? '',
          defaultReplyTo: es.settings.default_reply_to ?? '',
          dailySendLimit: es.settings.daily_send_limit,
          voiceDescription: es.settings.voice_description ?? '',
        });
      }
      setSheetConnection(sc.connection);
      if (sc.connection) setSheetForm({ name: sc.connection.name, spreadsheetId: sc.connection.spreadsheet_id ?? '', sheetRange: sc.connection.sheet_range });
    } catch {
      setError('Unable to load integration settings.');
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveEmailSettings(e: React.FormEvent) {
    e.preventDefault();
    try {
      await outreachApi.updateSettings(emailForm);
      showToast('Outreach email settings saved.');
      load();
    } catch {
      showToast('Unable to save email settings.', 'error');
    }
  }

  async function handleSaveSheetConnection(e: React.FormEvent) {
    e.preventDefault();
    try {
      await outreachApi.upsertSheetConnection(sheetForm);
      showToast('Google Sheets connection saved.');
      load();
    } catch {
      showToast('Unable to save sheet connection.', 'error');
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleGenerateWebhook() {
    try {
      const res = await integrationsApi.createOrRotateWebhook();
      setNewSecret(res.secret);
      setConfirmRotate(false);
      load();
    } catch {
      showToast('Unable to generate webhook secret.', 'error');
    }
  }

  async function copyToClipboard(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      showToast(`${label} copied to clipboard.`);
    } catch {
      showToast('Unable to copy to clipboard.', 'error');
    }
  }

  async function handleSaveMeta(e: React.FormEvent) {
    e.preventDefault();
    try {
      await integrationsApi.configureMeta(pageIdInput);
      showToast('Meta page configured.');
      load();
    } catch {
      showToast('Unable to save Meta configuration.', 'error');
    }
  }

  async function handleDisconnectMeta() {
    try {
      await integrationsApi.disconnectMeta();
      showToast('Meta integration disconnected.');
      load();
    } catch {
      showToast('Unable to disconnect.', 'error');
    }
  }

  if (loading) return <LoadingSpinner label="Loading integrations..." />;
  if (error || !overview) return <ErrorState message={error ?? 'Unknown error'} onRetry={load} />;

  return (
    <div className="space-y-4">
      <SettingsTabs />
      <PageHeader eyebrow="Settings" title="Integrations" description="Connect external tools that send leads into SellerClutch." />

      <div className="card p-5">
        <div className="flex items-center gap-2">
          <WebhookIcon className="h-5 w-5 text-brand-600" />
          <h2 className="text-sm font-semibold text-slate-900">Generic webhook (n8n, Zapier, or any automation tool)</h2>
        </div>
        <p className="mt-1 text-sm text-slate-500">
          Send a POST request with lead data to this URL. Every business gets one secret; requests must include it in the{' '}
          <code className="rounded bg-slate-100 px-1">X-Webhook-Secret</code> header.
        </p>

        {overview.webhook ? (
          <div className="mt-3 space-y-2 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <code className="rounded bg-slate-100 px-2 py-1 text-xs">{overview.webhook.url}</code>
              <button className="btn-secondary" onClick={() => copyToClipboard(overview.webhook!.url, 'Webhook URL')}>
                <Copy className="h-3.5 w-3.5" /> Copy URL
              </button>
            </div>
            <p className="text-xs text-slate-500">
              Secret: <code>{overview.webhook.secretPrefix}&hellip;</code> (hidden after creation) &middot; {overview.webhook.isActive ? 'Active' : 'Disabled'}
              {overview.webhook.lastDeliveryAt && <> &middot; last delivery {new Date(overview.webhook.lastDeliveryAt).toLocaleString()}</>}
            </p>
          </div>
        ) : (
          <p className="mt-3 text-sm text-slate-500">No webhook secret generated yet.</p>
        )}

        <button className="btn-secondary mt-4" onClick={() => (overview.webhook ? setConfirmRotate(true) : handleGenerateWebhook())}>
          <RefreshCw className="h-4 w-4" /> {overview.webhook ? 'Rotate secret' : 'Generate webhook secret'}
        </button>

        {newSecret && (
          <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm">
            <p className="font-medium text-amber-900">Copy this secret now — it will not be shown again.</p>
            <div className="mt-1 flex items-center gap-2">
              <code className="break-all rounded bg-white px-2 py-1 text-xs">{newSecret}</code>
              <button className="btn-secondary shrink-0" onClick={() => copyToClipboard(newSecret, 'Secret')}>
                <Copy className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}

        {deliveries.length > 0 && (
          <div className="mt-4">
            <p className="text-xs font-medium uppercase text-slate-500">Recent deliveries</p>
            <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto text-xs">
              {deliveries.map((d) => (
                <li key={d.id} className={`rounded px-2 py-1 ${d.status === 'Success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                  {d.status} &middot; {new Date(d.created_at).toLocaleString()} {d.error ? `— ${d.error}` : ''}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="card p-5">
        <div className="flex items-center gap-2">
          <Facebook className="h-5 w-5 text-brand-600" />
          <h2 className="text-sm font-semibold text-slate-900">Meta (Facebook / Instagram) Lead Ads</h2>
        </div>
        <p className="mt-1 text-sm text-slate-500">
          Status: <span className="font-medium">{overview.meta.status}</span>
          {!overview.meta.hasCredentialsConfigured && ' — server-side Meta App credentials are not configured yet (see docs/INTEGRATIONS.md).'}
        </p>
        <p className="mt-2 text-xs text-slate-500">
          Webhook URL for your Meta App: <code className="rounded bg-slate-100 px-1">{overview.meta.webhookUrl}</code>
        </p>

        <form onSubmit={handleSaveMeta} className="mt-3 flex flex-wrap gap-2">
          <input
            className="input max-w-xs"
            placeholder="Meta Page ID"
            value={pageIdInput}
            onChange={(e) => setPageIdInput(e.target.value)}
          />
          <button type="submit" className="btn-primary">Save Page ID</button>
          {overview.meta.status === 'Connected' && (
            <button type="button" className="btn-secondary" onClick={handleDisconnectMeta}>Disconnect</button>
          )}
        </form>
        <p className="mt-2 text-xs text-slate-500">
          This links incoming Meta webhook events for that Page ID to your business. Full production setup (App Review, webhook subscription, and a Page Access Token) is documented in docs/INTEGRATIONS.md.
        </p>
      </div>

      {providers && (
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-slate-900">Outreach providers</h2>
          <p className="mt-1 text-sm text-slate-500">Set via environment variables on the server — see docs/OUTREACH.md for switching from mock to real.</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {([
              ['Email sending', Mail, providers.email, 'EMAIL_PROVIDER'],
              ['AI personalization', Sparkles, providers.ai, 'OUTREACH_AI_PROVIDER'],
              ['Google Sheets import', Sheet, providers.sheets, 'SHEETS_PROVIDER'],
              ['Inbound replies', Workflow, providers.inbound, 'INBOUND_PROVIDER'],
            ] as const).map(([label, Icon, p, envVar]) => (
              <div key={label} className="flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm">
                <Icon className="h-4 w-4 text-brand-600" />
                <div className="flex-1">
                  <p className="font-medium text-slate-900">{label}</p>
                  <p className="text-xs text-slate-500">{envVar}={p.selected} &middot; <span className={p.configured ? 'text-emerald-600' : 'text-amber-600'}>{p.configured ? 'configured' : 'not configured'}</span></p>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-slate-500">
            An external scheduler advances the queue by calling <code className="rounded bg-slate-100 px-1">POST /api/outreach/tick</code> with an API key from Settings &rarr; API keys — SellerClutch does the work and remains the source of truth.
          </p>
        </div>
      )}

      <div className="card p-5">
        <h2 className="text-sm font-semibold text-slate-900">Outreach email defaults</h2>
        <p className="mt-1 text-sm text-slate-500">Used as the default sender for outreach campaigns that don't specify their own.</p>
        <form onSubmit={handleSaveEmailSettings} className="mt-3 grid gap-2 sm:grid-cols-2">
          <input className="input" placeholder="Default sender name" value={emailForm.defaultSenderName} onChange={(e) => setEmailForm({ ...emailForm, defaultSenderName: e.target.value })} />
          <input className="input" placeholder="Default sender email" value={emailForm.defaultSenderEmail} onChange={(e) => setEmailForm({ ...emailForm, defaultSenderEmail: e.target.value })} />
          <input className="input" placeholder="Default reply-to" value={emailForm.defaultReplyTo} onChange={(e) => setEmailForm({ ...emailForm, defaultReplyTo: e.target.value })} />
          <input type="number" min={1} className="input" placeholder="Daily send limit" value={emailForm.dailySendLimit} onChange={(e) => setEmailForm({ ...emailForm, dailySendLimit: Number(e.target.value) })} />
          <textarea className="input sm:col-span-2" placeholder="Voice/tone description (optional) — e.g. 'friendly, concise, no exclamation points'" value={emailForm.voiceDescription} onChange={(e) => setEmailForm({ ...emailForm, voiceDescription: e.target.value })} />
          {isLikelyPersonalEmailDomain(emailForm.defaultSenderEmail) && (
            <p className="text-xs text-amber-600 sm:col-span-2">
              This looks like a personal inbox, not a domain you own. Most real email providers only send reliably from a domain you've added and verified — sends from this address may fail or land in spam. Add and verify a domain you own in your email provider's dashboard, then use an address at that domain here.
            </p>
          )}
          <div className="sm:col-span-2">
            <button type="submit" className="btn-primary">Save email defaults</button>
          </div>
        </form>
        {!emailSettings && <p className="mt-2 text-xs text-amber-600">No sender configured yet — outreach campaigns without their own sender cannot send until this is set.</p>}
      </div>

      <div className="card p-5">
        <div className="flex items-center gap-2">
          <Sheet className="h-5 w-5 text-brand-600" />
          <h2 className="text-sm font-semibold text-slate-900">Google Sheets</h2>
        </div>
        <p className="mt-1 text-sm text-slate-500">
          {providers?.sheets.selected === 'mock'
            ? 'Currently using the mock provider — imports return a realistic simulated dataset regardless of what you enter below. Set SHEETS_PROVIDER=google and GOOGLE_API_KEY to import from a real sheet.'
            : 'Connect a Google Sheet shared as "Anyone with the link can view".'}
        </p>
        <form onSubmit={handleSaveSheetConnection} className="mt-3 grid gap-2 sm:grid-cols-3">
          <input className="input" placeholder="Connection name" value={sheetForm.name} onChange={(e) => setSheetForm({ ...sheetForm, name: e.target.value })} required />
          <input className="input" placeholder="Spreadsheet ID" value={sheetForm.spreadsheetId} onChange={(e) => setSheetForm({ ...sheetForm, spreadsheetId: e.target.value })} />
          <input className="input" placeholder="Sheet range (e.g. Sheet1)" value={sheetForm.sheetRange} onChange={(e) => setSheetForm({ ...sheetForm, sheetRange: e.target.value })} />
          <div className="sm:col-span-3">
            <button type="submit" className="btn-primary">Save connection</button>
          </div>
        </form>
        {sheetConnection && <p className="mt-2 text-xs text-slate-500">Connected: {sheetConnection.name}</p>}
      </div>

      <ConfirmDialog
        open={confirmRotate}
        title="Rotate webhook secret?"
        description="The old secret will stop working immediately. Update any tools using it with the new secret."
        confirmLabel="Rotate"
        danger
        onConfirm={handleGenerateWebhook}
        onCancel={() => setConfirmRotate(false)}
      />
    </div>
  );
}
