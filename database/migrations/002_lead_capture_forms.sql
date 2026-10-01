-- Lead capture forms: public-facing forms that create leads without authentication.
-- Also adds a URL-safe slug to businesses, needed for the public form route
-- /f/:businessSlug/:formSlug.

ALTER TABLE businesses ADD COLUMN IF NOT EXISTS slug TEXT;

UPDATE businesses
SET slug = lower(replace(replace(replace(name, ' ', '-'), '.', ''), '''', '')) || '-' || left(id::text, 8)
WHERE slug IS NULL;

ALTER TABLE businesses ALTER COLUMN slug SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_businesses_slug ON businesses(slug);

-- ===========================================================
-- lead_forms
-- ===========================================================
CREATE TABLE IF NOT EXISTS lead_forms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Disabled')),
  thank_you_message TEXT NOT NULL DEFAULT 'Thanks! We will be in touch shortly.',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (business_id, slug)
);

-- ===========================================================
-- lead_form_fields
-- ===========================================================
CREATE TABLE IF NOT EXISTS lead_form_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id UUID NOT NULL REFERENCES lead_forms(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  label TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('text', 'email', 'phone', 'textarea', 'select', 'number')),
  required BOOLEAN NOT NULL DEFAULT false,
  placeholder TEXT,
  options JSONB,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lead_forms_business_id ON lead_forms(business_id);
CREATE INDEX IF NOT EXISTS idx_lead_form_fields_form_id ON lead_form_fields(form_id);
