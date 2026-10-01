import { getPool, query } from './pool';
import { hashPassword } from '../utils/password';
import { calculateLeadScore, priorityFromScore } from '../services/scoringService';
import { slugify } from '../utils/slug';

const DEMO_BUSINESS_NAME = 'Nova Growth Agency';
const DEMO_PASSWORD = 'Demo1234!';

interface LeadSeed {
  name: string;
  company: string;
  email: string;
  phone: string;
  source: string;
  industry: string;
  interestedIn: string;
  budget: number | null;
  timeline: string;
  description: string;
  status: string;
  assignedTo: 'owner' | 'alex' | 'jamie' | null;
  utmCampaign?: string;
}

const LEADS: LeadSeed[] = [
  { name: 'Maria Chen', company: 'Brightline Retail', email: 'maria.chen@brightline-demo.com', phone: '555-0101', source: 'Website', industry: 'Retail', interestedIn: 'Website redesign', budget: 8000, timeline: 'This month', description: 'Needs a full e-commerce redesign before the holiday season.', status: 'New', assignedTo: null, utmCampaign: 'website-audit' },
  { name: 'David Okafor', company: 'Okafor Logistics', email: 'david@okafor-demo.com', phone: '555-0102', source: 'Referral', industry: 'Logistics', interestedIn: 'Fleet tracking dashboard', budget: 15000, timeline: 'Next quarter', description: 'Referred by an existing client, wants a custom dashboard for fleet tracking.', status: 'New', assignedTo: 'alex' },
  { name: 'Priya Nair', company: 'GreenLeaf Cafe', email: 'priya@greenleaf-demo.com', phone: '555-0103', source: 'Instagram', industry: 'Food & Beverage', interestedIn: 'Online ordering system', budget: 3000, timeline: 'Flexible', description: 'Small cafe chain wants online ordering integrated with POS.', status: 'Contacted', assignedTo: 'jamie', utmCampaign: 'spring-promo' },
  { name: 'Tom Becker', company: 'Becker Legal', email: 'tom.becker@becker-demo.com', phone: '555-0104', source: 'Phone', industry: 'Legal', interestedIn: 'Client intake automation', budget: 6000, timeline: 'This month', description: 'Law firm looking to automate client intake forms.', status: 'Contacted', assignedTo: 'alex' },
  { name: 'Aisha Rahman', company: 'Rahman Consulting', email: 'aisha@rahman-demo.com', phone: '555-0105', source: 'Website', industry: 'Consulting', interestedIn: 'CRM implementation', budget: 12000, timeline: 'ASAP', description: 'Growing consultancy needs a CRM to replace spreadsheets urgently.', status: 'Qualified', assignedTo: 'alex', utmCampaign: 'website-audit' },
  { name: 'Luca Romano', company: 'Romano Fitness', email: 'luca@romano-demo.com', phone: '555-0106', source: 'Facebook', industry: 'Fitness', interestedIn: 'Membership app', budget: 9000, timeline: 'Next quarter', description: 'Gym chain wants a membership management mobile app.', status: 'Qualified', assignedTo: 'jamie' },
  { name: 'Grace Kim', company: 'Kim & Partners', email: 'grace.kim@kimpartners-demo.com', phone: '555-0107', source: 'Referral', industry: 'Finance', interestedIn: 'Reporting automation', budget: 20000, timeline: 'This month', description: 'Accounting firm needs automated client reporting.', status: 'Proposal', assignedTo: 'alex' },
  { name: 'Samuel Osei', company: 'Osei Builders', email: 'samuel@osei-demo.com', phone: '555-0108', source: 'Website', industry: 'Construction', interestedIn: 'Project management tool', budget: 11000, timeline: 'Next quarter', description: 'Construction firm wants project tracking software.', status: 'Proposal', assignedTo: 'jamie' },
  { name: 'Elena Petrova', company: 'Petrova Design Studio', email: 'elena@petrova-demo.com', phone: '555-0109', source: 'Instagram', industry: 'Design', interestedIn: 'Portfolio + booking site', budget: 4000, timeline: 'Flexible', description: 'Design studio wants a new portfolio site with booking.', status: 'Negotiation', assignedTo: 'alex', utmCampaign: 'spring-promo' },
  { name: 'James Whitfield', company: 'Whitfield Realty', email: 'james@whitfield-demo.com', phone: '555-0110', source: 'Referral', industry: 'Real Estate', interestedIn: 'Listings CRM', budget: 18000, timeline: 'ASAP', description: 'Realty group wants a listings CRM integrated with their site.', status: 'Negotiation', assignedTo: 'jamie' },
  { name: 'Nadia Hussain', company: 'Hussain Events', email: 'nadia@hussain-demo.com', phone: '555-0111', source: 'Website', industry: 'Events', interestedIn: 'Event booking platform', budget: 7000, timeline: 'This month', description: 'Event planning company closed a deal for a booking platform.', status: 'Won', assignedTo: 'alex', utmCampaign: 'website-audit' },
  { name: 'Marcus Lee', company: 'Lee Automotive', email: 'marcus@lee-demo.com', phone: '555-0112', source: 'Phone', industry: 'Automotive', interestedIn: 'Service scheduling app', budget: 10000, timeline: 'Next quarter', description: 'Auto service chain signed for a scheduling app.', status: 'Won', assignedTo: 'jamie' },
  { name: 'Olivia Martin', company: 'Martin Boutique', email: 'olivia@martin-demo.com', phone: '555-0113', source: 'Facebook', industry: 'Retail', interestedIn: 'Online store', budget: 2000, timeline: 'Flexible', description: 'Budget too low for scope requested, went with a competitor.', status: 'Lost', assignedTo: 'alex' },
  { name: 'Ravi Shankar', company: 'Shankar Textiles', email: 'ravi@shankar-demo.com', phone: '555-0114', source: 'Other', industry: 'Manufacturing', interestedIn: 'Inventory system', budget: 5000, timeline: 'Flexible', description: 'Went quiet after the proposal, marked as lost.', status: 'Lost', assignedTo: 'jamie' },
  { name: 'Sophie Turner', company: 'Turner Wellness', email: 'sophie@turner-demo.com', phone: '555-0115', source: 'WhatsApp', industry: 'Health & Wellness', interestedIn: 'Appointment booking', budget: 6500, timeline: 'This month', description: 'Wellness clinic reached out via WhatsApp about booking software.', status: 'New', assignedTo: null },
  { name: 'Ben Foster', company: 'Foster Media', email: 'ben@foster-demo.com', phone: '555-0116', source: 'Website', industry: 'Media', interestedIn: 'Content management system', budget: 13000, timeline: 'Next quarter', description: 'Media company wants a custom CMS for their editorial team.', status: 'Contacted', assignedTo: 'alex', utmCampaign: 'spring-promo' },
];

async function findOrCreateUser(
  businessId: string,
  name: string,
  email: string,
  role: 'owner' | 'sales',
  passwordHash: string
): Promise<string> {
  const existing = await query<{ id: string }>('SELECT id FROM users WHERE email = $1', [email]);
  if (existing.rows[0]) {
    return existing.rows[0].id;
  }
  const result = await query<{ id: string }>(
    'INSERT INTO users (business_id, name, email, password_hash, role) VALUES ($1,$2,$3,$4,$5) RETURNING id',
    [businessId, name, email, passwordHash, role]
  );
  return result.rows[0].id;
}

async function seed(): Promise<void> {
  console.log('Seeding demo data for', DEMO_BUSINESS_NAME);

  const existingBusiness = await query<{ id: string }>('SELECT id FROM businesses WHERE name = $1', [DEMO_BUSINESS_NAME]);
  let businessId: string;

  if (existingBusiness.rows[0]) {
    businessId = existingBusiness.rows[0].id;
    console.log('Existing demo business found, clearing its data for a fresh reseed...');
    await query('DELETE FROM businesses WHERE id = $1', [businessId]);
  }

  const businessResult = await query<{ id: string }>(
    'INSERT INTO businesses (name, email, phone, industry, slug) VALUES ($1,$2,$3,$4,$5) RETURNING id',
    [DEMO_BUSINESS_NAME, 'hello@novagrowth-demo.com', '555-0100', 'Marketing & Software Consulting', slugify(DEMO_BUSINESS_NAME)]
  );
  businessId = businessResult.rows[0].id;

  const passwordHash = await hashPassword(DEMO_PASSWORD);

  const ownerId = await findOrCreateUser(businessId, 'Sarah Bennett', 'owner@novagrowth.com', 'owner', passwordHash);
  const alexId = await findOrCreateUser(businessId, 'Alex Rivera', 'alex@novagrowth.com', 'sales', passwordHash);
  const jamieId = await findOrCreateUser(businessId, 'Jamie Park', 'jamie@novagrowth.com', 'sales', passwordHash);

  const userMap: Record<string, string> = { owner: ownerId, alex: alexId, jamie: jamieId };

  // A couple of demo campaigns so /campaigns and the attribution dashboard
  // are meaningful immediately after seeding.
  const campaignIdByUtm: Record<string, string> = {};
  for (const [utm, name, source] of [
    ['website-audit', 'Free Website Audit', 'Website'],
    ['spring-promo', 'Spring Promo', 'Instagram'],
  ] as const) {
    const result = await query<{ id: string }>(
      `INSERT INTO campaigns (business_id, name, source, utm_campaign) VALUES ($1,$2,$3,$4) RETURNING id`,
      [businessId, name, source, utm]
    );
    campaignIdByUtm[utm] = result.rows[0].id;
  }

  for (const leadSeed of LEADS) {
    const score = calculateLeadScore({
      budget: leadSeed.budget,
      timeline: leadSeed.timeline,
      email: leadSeed.email,
      phone: leadSeed.phone,
      source: leadSeed.source,
      interestedIn: leadSeed.interestedIn,
      description: leadSeed.description,
    });
    const priority = priorityFromScore(score);

    const assignedUserId = leadSeed.assignedTo ? userMap[leadSeed.assignedTo] : null;
    const campaignId = leadSeed.utmCampaign ? campaignIdByUtm[leadSeed.utmCampaign] ?? null : null;

    const leadResult = await query<{ id: string }>(
      `INSERT INTO leads (
         business_id, assigned_user_id, name, company, email, phone, source, industry, interested_in,
         budget, timeline, description, status, score, priority, campaign_id, utm_campaign, utm_source, captured_at
       )
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18, now()) RETURNING id`,
      [
        businessId, assignedUserId, leadSeed.name, leadSeed.company, leadSeed.email, leadSeed.phone,
        leadSeed.source, leadSeed.industry, leadSeed.interestedIn, leadSeed.budget, leadSeed.timeline,
        leadSeed.description, leadSeed.status, score, priority, campaignId,
        leadSeed.utmCampaign ?? null, leadSeed.utmCampaign ? leadSeed.source : null,
      ]
    );
    const leadId = leadResult.rows[0].id;

    await query(
      `INSERT INTO activities (business_id, lead_id, user_id, type, description) VALUES ($1,$2,$3,'Lead created',$4)`,
      [businessId, leadId, assignedUserId ?? ownerId, `Lead "${leadSeed.name}" created via ${leadSeed.source}.`]
    );

    if (assignedUserId) {
      await query(
        `INSERT INTO activities (business_id, lead_id, user_id, type, description) VALUES ($1,$2,$3,'Lead assigned',$4)`,
        [businessId, leadId, ownerId, 'Lead assigned to a salesperson.']
      );
    }

    if (['Qualified', 'Proposal', 'Negotiation', 'Won', 'Lost'].includes(leadSeed.status)) {
      await query(
        `INSERT INTO notes (business_id, lead_id, user_id, content) VALUES ($1,$2,$3,$4)`,
        [businessId, leadId, assignedUserId ?? ownerId, `Had a productive call with ${leadSeed.name.split(' ')[0]}. They are interested in ${leadSeed.interestedIn.toLowerCase()}.`]
      );
      await query(
        `INSERT INTO activities (business_id, lead_id, user_id, type, description) VALUES ($1,$2,$3,'Call completed',$4)`,
        [businessId, leadId, assignedUserId ?? ownerId, 'Discovery call completed.']
      );
    }

    if (['Proposal', 'Negotiation', 'Won'].includes(leadSeed.status)) {
      await query(
        `INSERT INTO quotations (business_id, lead_id, created_by, title, amount, status, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [
          businessId, leadId, assignedUserId ?? ownerId,
          `${leadSeed.interestedIn} proposal`,
          leadSeed.budget ?? 5000,
          leadSeed.status === 'Won' ? 'Accepted' : 'Sent',
          'Initial scope and pricing proposal.',
        ]
      );
      await query(
        `INSERT INTO activities (business_id, lead_id, user_id, type, description) VALUES ($1,$2,$3,'Proposal sent',$4)`,
        [businessId, leadId, assignedUserId ?? ownerId, 'Proposal sent to client.']
      );
    }

    if (!['Won', 'Lost'].includes(leadSeed.status)) {
      const daysOffset = Math.floor(Math.random() * 10) - 3; // some overdue, some upcoming
      await query(
        `INSERT INTO follow_ups (business_id, lead_id, user_id, type, scheduled_at, notes)
         VALUES ($1,$2,$3,$4, now() + ($5 || ' days')::interval, $6)`,
        [
          businessId, leadId, assignedUserId ?? ownerId,
          ['Call', 'Email', 'Meeting', 'WhatsApp'][Math.floor(Math.random() * 4)],
          String(daysOffset),
          'Follow up on proposal status and answer outstanding questions.',
        ]
      );
    }
  }

  // Demo capture form so /forms and the public /f/:businessSlug/:formSlug
  // route have something to show immediately.
  const formResult = await query<{ id: string }>(
    `INSERT INTO lead_forms (business_id, name, slug, description, thank_you_message)
     VALUES ($1, 'Website Contact Form', 'contact', 'Tell us about your project and we will get back to you.', 'Thanks for reaching out! A member of our team will contact you within one business day.')
     RETURNING id`,
    [businessId]
  );
  const formId = formResult.rows[0].id;
  const formFields: Array<[string, string, string, boolean]> = [
    ['company', 'Company', 'text', false],
    ['interested_in', 'What are you interested in?', 'textarea', true],
    ['budget', 'Approximate budget (USD)', 'number', false],
  ];
  for (let i = 0; i < formFields.length; i++) {
    const [name, label, type, required] = formFields[i];
    await query(
      `INSERT INTO lead_form_fields (form_id, name, label, type, required, sort_order) VALUES ($1,$2,$3,$4,$5,$6)`,
      [formId, name, label, type, required, i]
    );
  }

  // Demo routing rules: Instagram leads round-robin between sales reps,
  // hot leads go straight to the owner, everything else falls back to
  // round robin.
  await query(
    `INSERT INTO lead_routing_rules (business_id, name, priority, field, operator, value, assignment_type)
     VALUES
       ($1, 'Hot leads to owner', 0, 'score', 'gte', '85', 'owner'),
       ($1, 'Instagram round robin', 1, 'source', 'equals', 'Instagram', 'round_robin'),
       ($1, 'Default round robin', 99, 'always', 'equals', null, 'round_robin')`,
    [businessId]
  );

  console.log('Seed complete.');
  console.log('');
  console.log('Demo credentials:');
  console.log('  Owner:  owner@novagrowth.com / ' + DEMO_PASSWORD);
  console.log('  Sales:  alex@novagrowth.com  / ' + DEMO_PASSWORD);
  console.log('  Sales:  jamie@novagrowth.com / ' + DEMO_PASSWORD);
}

if (require.main === module) {
  seed()
    .then(() => {
      return getPool().end();
    })
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Seeding failed:', err);
      process.exit(1);
    });
}

export { seed };
