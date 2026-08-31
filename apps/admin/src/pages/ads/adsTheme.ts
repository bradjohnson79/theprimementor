export function adsCardClass(isLightTheme: boolean) {
  return isLightTheme
    ? "rounded-3xl border border-slate-200 bg-white p-6"
    : "rounded-3xl border border-white/10 bg-white/5 p-6";
}

export function adsTitleClass(isLightTheme: boolean) {
  return isLightTheme ? "text-slate-900" : "text-white";
}

export function adsMutedClass(isLightTheme: boolean) {
  return isLightTheme ? "text-slate-600" : "text-white/65";
}
