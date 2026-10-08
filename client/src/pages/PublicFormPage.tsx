import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Zap, CheckCircle2 } from 'lucide-react';
import * as formsApi from '../services/formsApi';
import { LeadFormField } from '../types';
import { ApiError } from '../lib/api';

interface PublicForm {
  id: string;
  name: string;
  description: string | null;
  fields: LeadFormField[];
}

export default function PublicFormPage(): React.ReactElement {
  const { businessSlug, formSlug } = useParams<{ businessSlug: string; formSlug: string }>();
  const [searchParams] = useSearchParams();

  const [form, setForm] = useState<PublicForm | null>(null);
  const [businessName, setBusinessName] = useState('');
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [thankYouMessage, setThankYouMessage] = useState('');
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [company, setCompany] = useState('');
  const [customValues, setCustomValues] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!businessSlug || !formSlug) return;
    (async () => {
      try {
        const res = await formsApi.getPublicForm(businessSlug, formSlug);
        setForm(res.form);
        setBusinessName(res.businessName);
      } catch {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    })();
  }, [businessSlug, formSlug]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!businessSlug || !formSlug) return;
    setError(null);
    setSubmitting(true);

    try {
      const res = await formsApi.submitPublicForm(businessSlug, formSlug, {
        name,
        email: email || undefined,
        phone: phone || undefined,
        company: company || undefined,
        fields: customValues,
        utmSource: searchParams.get('utm_source') ?? undefined,
        utmMedium: searchParams.get('utm_medium') ?? undefined,
        utmCampaign: searchParams.get('utm_campaign') ?? undefined,
        utmTerm: searchParams.get('utm_term') ?? undefined,
        utmContent: searchParams.get('utm_content') ?? undefined,
        landingPage: window.location.href,
        referrer: document.referrer || undefined,
      });
      setThankYouMessage(res.thankYouMessage);
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-lg">
        <div className="mb-6 flex items-center justify-center gap-2">
          <span className="rounded-lg bg-brand-600 p-2 text-white">
            <Zap className="h-5 w-5" aria-hidden="true" />
          </span>
          <span className="text-lg font-semibold text-slate-900">{businessName || 'sellerClutch'}</span>
        </div>

        <div className="card p-6 sm:p-8">
          {loading ? (
            <p className="py-8 text-center text-sm text-slate-500">Loading...</p>
          ) : notFound ? (
            <div className="py-8 text-center">
              <p className="text-sm font-medium text-slate-700">This form isn&apos;t available.</p>
              <p className="mt-1 text-sm text-slate-500">It may have been disabled or the link may be incorrect.</p>
            </div>
          ) : submitted ? (
            <div className="py-8 text-center">
              <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500" />
              <p className="mt-3 text-base font-medium text-slate-900">Thank you!</p>
              <p className="mt-1 text-sm text-slate-600">{thankYouMessage}</p>
            </div>
          ) : form ? (
            <>
              <h1 className="text-lg font-semibold text-slate-900">{form.name}</h1>
              {form.description && <p className="mt-1 text-sm text-slate-500">{form.description}</p>}

              {error && <div className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

              <form onSubmit={handleSubmit} className="mt-5 space-y-4">
                <div>
                  <label className="label" htmlFor="pf-name">Name *</label>
                  <input id="pf-name" required className="input" value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="label" htmlFor="pf-email">Email</label>
                    <input id="pf-email" type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
                  </div>
                  <div>
                    <label className="label" htmlFor="pf-phone">Phone</label>
                    <input id="pf-phone" className="input" value={phone} onChange={(e) => setPhone(e.target.value)} />
                  </div>
                </div>
                <div>
                  <label className="label" htmlFor="pf-company">Company</label>
                  <input id="pf-company" className="input" value={company} onChange={(e) => setCompany(e.target.value)} />
                </div>

                {form.fields.map((field) => (
                  <div key={field.name}>
                    <label className="label" htmlFor={`pf-${field.name}`}>
                      {field.label} {field.required && '*'}
                    </label>
                    {field.type === 'textarea' ? (
                      <textarea
                        id={`pf-${field.name}`}
                        required={field.required}
                        placeholder={field.placeholder ?? ''}
                        className="input"
                        rows={3}
                        value={customValues[field.name] ?? ''}
                        onChange={(e) => setCustomValues((v) => ({ ...v, [field.name]: e.target.value }))}
                      />
                    ) : field.type === 'select' ? (
                      <select
                        id={`pf-${field.name}`}
                        required={field.required}
                        className="select"
                        value={customValues[field.name] ?? ''}
                        onChange={(e) => setCustomValues((v) => ({ ...v, [field.name]: e.target.value }))}
                      >
                        <option value="">Select...</option>
                        {(field.options ?? []).map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        id={`pf-${field.name}`}
                        type={field.type === 'number' ? 'number' : field.type === 'email' ? 'email' : field.type === 'phone' ? 'tel' : 'text'}
                        required={field.required}
                        placeholder={field.placeholder ?? ''}
                        className="input"
                        value={customValues[field.name] ?? ''}
                        onChange={(e) => setCustomValues((v) => ({ ...v, [field.name]: e.target.value }))}
                      />
                    )}
                  </div>
                ))}

                <button type="submit" disabled={submitting} className="btn-primary w-full">
                  {submitting ? 'Submitting...' : 'Submit'}
                </button>
              </form>
            </>
          ) : null}
        </div>
        <p className="mt-6 text-center text-xs text-slate-400">Powered by sellerClutch</p>
      </div>
    </div>
  );
}
