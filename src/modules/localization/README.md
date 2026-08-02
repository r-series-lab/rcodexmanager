# Localization Module

Small optional React localization module for r-series desktop apps.

## Boundaries

- The module has no MUI, Tailwind, Tauri, network, or backend dependency.
- Message keys use the default-language source text, so an app can adopt the
  module incrementally without changing visible fallback copy.
- Unsupported or missing translations fall back to the source text.
- Locale persistence is opt-in through a caller-provided storage key.
- Runtime content from CLIs, logs, sessions, and user data is never translated.

## Integration

```tsx
const localization = createLocalization({
  defaultLocale: "zh-CN",
  supportedLocales: ["zh-CN", "en-US"] as const,
  catalogs: { "en-US": englishMessages },
  storageKey: "my-r-app-language",
});
```

The app owns the locale state and renders
`localization.LocalizationProvider`. Settings UI remains app-specific so both
legacy MUI apps and newer shadcn/Tailwind apps can share the same core.

## Coverage Guard

rCodexManager runs `npm run i18n:check` as part of `npm run check`. The guard
reports:

- a literal passed to `t()` without an English catalog entry;
- raw Chinese JSX text in production components;
- raw Chinese string props unless the receiving shared component explicitly
  owns translation.

When adopting the module in another r-series app, copy
`scripts/check-i18n-coverage.mjs` and adjust the small
`translatedPropComponents` allowlist to match that app's shared UI primitives.
