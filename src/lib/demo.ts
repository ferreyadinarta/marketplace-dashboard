export const DEMO_MESSAGE = {
  id: "Demo hanya-baca: perubahan dimatikan",
  en: "Read-only demo: changes are turned off",
};

export function blockedByDemo(): boolean {
  if (typeof document === "undefined" || document.documentElement.dataset.demo !== "1") return false;
  const en = document.documentElement.lang === "en";
  window.dispatchEvent(new CustomEvent("app:toast", { detail: en ? DEMO_MESSAGE.en : DEMO_MESSAGE.id }));
  return true;
}
