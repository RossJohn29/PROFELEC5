// Reusable password policy and strength evaluation
// Policy: minimum 8 chars, at least one letter, one number, and one special character

export const PASSWORD_POLICY = {
  minLength: 8,
  // We will no longer strictly require number/special for submission; we only encourage.
  requireLetter: true,
  requireNumber: false,
  requireSpecial: false,
};

export function evaluatePasswordStrength(pw) {
  if (!pw) {
    return { score: 0, label: 'Very weak', percent: 0, checks: defaultChecks() };
  }
  const checks = {
    length: pw.length >= PASSWORD_POLICY.minLength,
    lower: /[a-z]/.test(pw),
    upper: /[A-Z]/.test(pw),
    number: /[0-9]/.test(pw),
    special: /[^A-Za-z0-9]/.test(pw),
  };

  // Score based on length and diversity
  let score = 0;
  if (pw.length >= PASSWORD_POLICY.minLength) score += 1;
  if (pw.length >= 12) score += 1;
  const diversity = [checks.lower, checks.upper, checks.number, checks.special].filter(Boolean).length;
  score += Math.max(0, diversity - 1); // 0..3
  score = Math.min(score, 5); // cap

  const labels = ['Very weak', 'Weak', 'Fair', 'Good', 'Strong', 'Very strong'];
  const percent = Math.min(100, (score / 5) * 100);

  return { score, label: labels[score], percent, checks };
}

// Baseline acceptance: length + at least one letter.
export function meetsPasswordPolicy(pw) {
  if (!pw) return false;
  const hasLetter = /[A-Za-z]/.test(pw);
  return pw.length >= PASSWORD_POLICY.minLength && hasLetter;
}

// Acceptable for submission: meets baseline AND overall strength score >= 2 (Fair or better)
export function isAcceptablePassword(pw) {
  const base = meetsPasswordPolicy(pw);
  if (!base) return false;
  const { score } = evaluatePasswordStrength(pw);
  return score >= 2; // Fair (index 2) or better
}

function defaultChecks() {
  return { length: false, lower: false, upper: false, number: false, special: false };
}
