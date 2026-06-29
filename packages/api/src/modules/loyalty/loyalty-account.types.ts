/** Shared customer profile shape for loyalty account reads. */
export const LOYALTY_ACCOUNT_CUSTOMER_SELECT = {
  id: true,
  name: true,
  email: true,
  phone: true,
  birthday: true,
  gender: true,
  city: true,
  region: true,
  postalCode: true,
} as const;
