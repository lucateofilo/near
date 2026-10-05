import { updateSilentMode } from './settings.js';

export const SILENT_DURATIONS = [
  { label: '1 ora', ms: 60 * 60 * 1000 },
  { label: '3 ore', ms: 3 * 60 * 60 * 1000 },
  { label: '10 ore', ms: 10 * 60 * 60 * 1000 },
  { label: '24 ore', ms: 24 * 60 * 60 * 1000 },
  { label: 'Finché non disattivata', ms: null },
];

export async function activateSilentMode(coupleId, uid, durationMs) {
  const until = durationMs ? Date.now() + durationMs : null;
  await updateSilentMode(coupleId, uid, { active: true, until });
}

export async function deactivateSilentMode(coupleId, uid) {
  await updateSilentMode(coupleId, uid, { active: false, until: null });
}

export function isSilentActive(silentMode) {
  if (!silentMode?.active) return false;
  if (!silentMode.until) return true;
  return silentMode.until > Date.now();
}
