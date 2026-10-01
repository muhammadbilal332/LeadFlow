import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { createFormSchema, updateFormSchema, publicFormSubmissionSchema } from '../validation/schemas';
import * as formRepo from '../repositories/leadFormRepo';
import * as businessRepo from '../repositories/businessRepo';
import { intakeLead } from '../services/leadIntakeService';
import { NotFoundError, BadRequestError } from '../utils/appError';
import { slugify, uniqueSlug } from '../utils/slug';
import { publicAppUrl } from '../config/env';

async function withFields(form: formRepo.LeadFormRow) {
  const fields = await formRepo.listFields(form.id);
  return { ...form, fields };
}

export const listForms = asyncHandler(async (req: Request, res: Response) => {
  const forms = await formRepo.listForms(req.user!.businessId);
  const withAllFields = await Promise.all(forms.map(withFields));
  res.json({ forms: withAllFields });
});

export const getForm = asyncHandler(async (req: Request, res: Response) => {
  const form = await formRepo.findFormById(req.params.id, req.user!.businessId);
  if (!form) throw new NotFoundError('Form not found');
  res.json({ form: await withFields(form) });
});

export const createForm = asyncHandler(async (req: Request, res: Response) => {
  const input = createFormSchema.parse(req.body);

  let slug = input.slug ? slugify(input.slug) : slugify(input.name);
  if (!slug || (await formRepo.slugTaken(req.user!.businessId, slug))) {
    slug = uniqueSlug(input.name);
  }

  const form = await formRepo.createForm({
    businessId: req.user!.businessId,
    name: input.name,
    slug,
    description: input.description,
    thankYouMessage: input.thankYouMessage,
    fields: input.fields,
  });

  res.status(201).json({ form: await withFields(form) });
});

export const updateForm = asyncHandler(async (req: Request, res: Response) => {
  const existing = await formRepo.findFormById(req.params.id, req.user!.businessId);
  if (!existing) throw new NotFoundError('Form not found');

  const input = updateFormSchema.parse(req.body);
  const updated = await formRepo.updateForm(req.params.id, req.user!.businessId, {
    name: input.name,
    description: input.description,
    thankYouMessage: input.thankYouMessage,
    status: input.status,
  });
  if (!updated) throw new NotFoundError('Form not found');

  if (input.fields) {
    await formRepo.replaceFields(updated.id, input.fields);
  }

  res.json({ form: await withFields(updated) });
});

export const deleteForm = asyncHandler(async (req: Request, res: Response) => {
  const deleted = await formRepo.deleteForm(req.params.id, req.user!.businessId);
  if (!deleted) throw new NotFoundError('Form not found');
  res.status(204).send();
});

/** Returns the public URL and iframe embed snippet for a form. No secrets involved — just a shareable link. */
export const getEmbedInfo = asyncHandler(async (req: Request, res: Response) => {
  const form = await formRepo.findFormById(req.params.id, req.user!.businessId);
  if (!form) throw new NotFoundError('Form not found');
  const business = await businessRepo.findBusinessById(req.user!.businessId);
  if (!business) throw new NotFoundError('Business not found');

  const publicUrl = `${publicAppUrl}/f/${business.slug}/${form.slug}`;
  const embedCode = `<iframe src="${publicUrl}" title="${form.name.replace(/"/g, '&quot;')}" width="100%" height="600" style="border:0;max-width:640px;"></iframe>`;

  res.json({ publicUrl, embedCode });
});

// ===========================================================
// Public (unauthenticated) form access
// ===========================================================

export const getPublicForm = asyncHandler(async (req: Request, res: Response) => {
  const { businessSlug, formSlug } = req.params;
  const found = await formRepo.findPublicForm(businessSlug, formSlug);
  if (!found) throw new NotFoundError('This form is not available.');

  const fields = await formRepo.listFields(found.form.id);
  res.json({
    form: {
      id: found.form.id,
      name: found.form.name,
      description: found.form.description,
      fields,
    },
    businessName: found.businessName,
  });
});

export const submitPublicForm = asyncHandler(async (req: Request, res: Response) => {
  const { businessSlug, formSlug } = req.params;
  const found = await formRepo.findPublicForm(businessSlug, formSlug);
  if (!found) throw new NotFoundError('This form is not available.');

  const input = publicFormSubmissionSchema.parse(req.body);
  const fields = await formRepo.listFields(found.form.id);

  for (const field of fields) {
    if (field.required) {
      const value = input.fields[field.name];
      if (value === undefined || value === null || String(value).trim() === '') {
        throw new BadRequestError(`"${field.label}" is required.`);
      }
    }
  }

  const interestedIn = fields
    .filter((f) => !['name', 'email', 'phone', 'company', 'message'].includes(f.name))
    .map((f) => `${f.label}: ${input.fields[f.name] ?? ''}`)
    .filter((line) => !line.endsWith(': '))
    .join('; ');

  const result = await intakeLead({
    // The business/form relationship is derived entirely from the URL
    // slugs above; the client never supplies a business_id.
    businessId: found.businessId,
    name: input.name,
    email: input.email || null,
    phone: input.phone || null,
    company: input.company || null,
    description: input.message || interestedIn || null,
    interestedIn: interestedIn || null,
    source: 'Form',
    sourceDetail: found.form.name,
    formId: found.form.id,
    utmSource: input.utmSource || null,
    utmMedium: input.utmMedium || null,
    utmCampaign: input.utmCampaign || null,
    utmTerm: input.utmTerm || null,
    utmContent: input.utmContent || null,
    landingPage: input.landingPage || null,
    referrer: input.referrer || null,
    externalSource: 'form',
  });

  void result;
  res.status(201).json({
    success: true,
    thankYouMessage: found.form.thank_you_message,
  });
});
