import { createContext, useContext, useMemo, type ReactNode } from "react";

export type MessageParams = Record<string, string | number>;
export type MessageCatalog = Readonly<Record<string, string>>;
export type Translator = (source: string, params?: MessageParams) => string;

export interface LocalizationConfig<TLocale extends string> {
  defaultLocale: TLocale;
  supportedLocales: readonly TLocale[];
  catalogs: Partial<Record<TLocale, MessageCatalog>>;
  storageKey?: string;
}

function interpolate(template: string, params?: MessageParams): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    Object.prototype.hasOwnProperty.call(params, key) ? String(params[key]) : match,
  );
}

export function createLocalization<TLocale extends string>(
  config: LocalizationConfig<TLocale>,
) {
  const supported = new Set<string>(config.supportedLocales);

  function isSupportedLocale(value: unknown): value is TLocale {
    return typeof value === "string" && supported.has(value);
  }

  function translate(locale: TLocale, source: string, params?: MessageParams): string {
    const template = config.catalogs[locale]?.[source] ?? source;
    return interpolate(template, params);
  }

  function createTranslator(locale: TLocale): Translator {
    return (source, params) => translate(locale, source, params);
  }

  function readStoredLocale(storage?: Pick<Storage, "getItem">): TLocale {
    if (!config.storageKey || !storage) return config.defaultLocale;
    const stored = storage.getItem(config.storageKey);
    return isSupportedLocale(stored) ? stored : config.defaultLocale;
  }

  function writeStoredLocale(
    locale: TLocale,
    storage?: Pick<Storage, "setItem">,
  ): void {
    if (!config.storageKey || !storage || !isSupportedLocale(locale)) return;
    storage.setItem(config.storageKey, locale);
  }

  const defaultValue = {
    locale: config.defaultLocale,
    t: createTranslator(config.defaultLocale),
  };
  const LocalizationContext = createContext(defaultValue);

  function LocalizationProvider({
    locale,
    children,
  }: {
    locale: TLocale;
    children: ReactNode;
  }) {
    const value = useMemo(
      () => ({ locale, t: createTranslator(locale) }),
      [locale],
    );
    return (
      <LocalizationContext.Provider value={value}>
        {children}
      </LocalizationContext.Provider>
    );
  }

  function useLocalization() {
    return useContext(LocalizationContext);
  }

  return {
    defaultLocale: config.defaultLocale,
    supportedLocales: config.supportedLocales,
    isSupportedLocale,
    translate,
    createTranslator,
    readStoredLocale,
    writeStoredLocale,
    LocalizationProvider,
    useLocalization,
  };
}
