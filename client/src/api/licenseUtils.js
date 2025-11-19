

export function formatLicense(input) {
  const digits = String(input || '').replace(/\D/g, '').slice(0, 11);
  const p1 = digits.slice(0, 4);
  const p2 = digits.slice(4, 8);
  const p3 = digits.slice(8, 11);
  let out = p1;
  if (p2) out += '-' + p2;
  if (p3) out += '-' + p3;
  return out;
}

export function isValidLicense(formatted) {
  return /^\d{4}-\d{4}-\d{3}$/.test(String(formatted || '').trim());
}
