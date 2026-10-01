import { RawSheetRow, SheetConnectionConfig, SheetsProvider } from './SheetsProvider';

const MOCK_ROWS: RawSheetRow[] = [
  { company_name: 'Brightleaf Roasters', contact_name: 'Dana Cole', email: 'dana@brightleafroasters.test', website: 'brightleafroasters.test', industry: 'Food & Beverage', location: 'Austin, TX', pain_points: 'Manual wholesale order tracking across spreadsheets', possible_solution: 'A lightweight order + lead pipeline so their sales team stops losing track of wholesale inquiries' },
  { company_name: 'Northline Fitness', contact_name: 'Marcus Ibe', email: 'marcus@northlinefitness.test', website: 'northlinefitness.test', industry: 'Health & Fitness', location: 'Denver, CO', pain_points: 'Trial sign-ups from their website go untouched for days', possible_solution: 'Automatic lead routing so a coach follows up within minutes' },
  { company_name: 'Ardent Legal Group', contact_name: 'Priya Shah', email: 'priya@ardentlegalgroup.test', website: 'ardentlegalgroup.test', industry: 'Legal Services', location: 'Chicago, IL', pain_points: 'Intake consultations booked manually by phone', possible_solution: 'A public intake form with instant lead scoring and assignment' },
  { company_name: 'Coastal Grove Realty', contact_name: 'Tom Whitfield', email: 'tom@coastalgroverealty.test', website: 'coastalgroverealty.test', industry: 'Real Estate', location: 'Charleston, SC', pain_points: 'Duplicate leads from three different ad platforms', possible_solution: 'Centralized intake with automatic duplicate detection' },
  { company_name: 'Pinehill Veterinary', contact_name: 'Sarah Lund', email: 'sarah@pinehillvet.test', website: 'pinehillvet.test', industry: 'Veterinary', location: 'Portland, OR', pain_points: 'No visibility into which referrals actually convert', possible_solution: 'Campaign-level attribution reporting' },
  { company_name: 'Foundry Metalworks', contact_name: 'Diego Alvarez', email: 'diego@foundrymetalworks.test', website: 'foundrymetalworks.test', industry: 'Manufacturing', location: 'Cleveland, OH', pain_points: 'Quote requests buried in a shared inbox', possible_solution: 'A dedicated pipeline stage for quote requests with SLA tracking' },
  { company_name: 'Willow & Bloom Events', contact_name: 'Grace Tan', email: 'grace@willowbloomevents.test', website: 'willowbloomevents.test', industry: 'Events', location: 'Nashville, TN', pain_points: 'Seasonal inquiry spikes overwhelm the small team', possible_solution: 'Automated first-response follow-ups so nothing waits more than an hour' },
  { company_name: 'Summit Peak Logistics', contact_name: 'Ravi Menon', email: 'ravi@summitpeaklogistics.test', website: 'summitpeaklogistics.test', industry: 'Logistics', location: 'Salt Lake City, UT', pain_points: 'Sales reps unsure which leads to prioritize', possible_solution: 'Automatic lead scoring so reps work hottest leads first' },
];

/**
 * Returns a fixed, realistic dataset simulating a populated Google Sheet.
 * Ignores the connection config entirely — deterministic, so tests and
 * demos behave the same way every run. This is what runs by default
 * (SHEETS_PROVIDER=mock).
 */
export class MockSheetsProvider implements SheetsProvider {
  name = 'mock';

  isConfigured(): boolean {
    return true;
  }

  async fetchRows(_config: SheetConnectionConfig): Promise<RawSheetRow[]> {
    return MOCK_ROWS.map((row) => ({ ...row }));
  }
}
