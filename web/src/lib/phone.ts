// Her phone number as configured (any spacing), for links and for reading.

/** A dialable tel: link. */
export const telHref = (phone: string): string =>
  `tel:${phone.replace(/[^\d+]/g, '')}`;

/**
 * Israeli mobile numbers in the local form people read and dial
 * (+972-58-… → 058-…); anything else as configured.
 */
export function displayPhone(phone: string): string {
  const m = /^\+972(\d{2})(\d{3})(\d{4})$/.exec(phone.replace(/[^\d+]/g, ''));
  return m ? `0${m[1]}-${m[2]}-${m[3]}` : phone;
}
