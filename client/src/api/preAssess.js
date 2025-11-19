

const KEY = 'theraPH_pre_assessment_v1';

export function savePreAssessmentLocal(data) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
  }
}

export function getPreAssessmentLocal() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function clearPreAssessmentLocal() {
  try { localStorage.removeItem(KEY); } catch { }
}
