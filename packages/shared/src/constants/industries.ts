// ─── Industry List ───────────────────────────────
// Used during onboarding for company profile

export const INDUSTRIES = [
  { value: 'healthcare', label: 'Healthcare & Medical' },
  { value: 'banking', label: 'Banking & Finance' },
  { value: 'government', label: 'Government & Public Services' },
  { value: 'telecom', label: 'Telecommunications' },
  { value: 'retail', label: 'Retail & Shopping' },
  { value: 'education', label: 'Education' },
  { value: 'hospitality', label: 'Hospitality & Hotels' },
  { value: 'restaurant', label: 'Restaurants & Food Service' },
  { value: 'insurance', label: 'Insurance' },
  { value: 'automotive', label: 'Automotive & Dealerships' },
  { value: 'real_estate', label: 'Real Estate' },
  { value: 'beauty', label: 'Beauty & Salon' },
  { value: 'fitness', label: 'Fitness & Wellness' },
  { value: 'legal', label: 'Legal Services' },
  { value: 'logistics', label: 'Logistics & Shipping' },
  { value: 'travel', label: 'Travel & Tourism' },
  { value: 'utilities', label: 'Utilities' },
  { value: 'nonprofit', label: 'Nonprofit & NGOs' },
  { value: 'technology', label: 'Technology & Software' },
  { value: 'entertainment', label: 'Entertainment & Events' },
  { value: 'other', label: 'Other' },
] as const;

export type IndustryValue = (typeof INDUSTRIES)[number]['value'];
export const INDUSTRY_VALUES = INDUSTRIES.map((i) => i.value);
