export const consentKey = "dataConsent";
export const consentVersion = 1;
export const hasConsent = (value) =>
  value?.version === consentVersion && value?.granted === true;

export async function requireConsent() {
  const response = await chrome.runtime.sendMessage({ type: "CHECK_CONSENT" });
  if (response?.success && response.granted) return true;
  await chrome.runtime.sendMessage({ type: "OPEN_PRIVACY" });
  return false;
}
