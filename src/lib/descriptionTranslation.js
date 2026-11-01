// Browser-owned translation: no API key or application translation server.
export function createDescriptionTranslator(browser = globalThis) {
  const results = new Map();
  const translators = new Map();
  const languages = new Map();
  let detector;

  const session = (language) => {
    if (!translators.has(language)) {
      const pending = browser.Translator.create({
        sourceLanguage: language,
        targetLanguage: "ja",
      }).catch((error) => {
        translators.delete(language);
        throw error;
      });
      translators.set(language, pending);
    }
    return translators.get(language);
  };

  return function translateDescription(text) {
    if (!text?.trim()) return Promise.resolve("");
    if (results.has(text)) return results.get(text);
    if (!browser.Translator) {
      return Promise.reject(new Error("TRANSLATION_UNSUPPORTED"));
    }
    const pending = (async () => {
      let language = languages.get(text);
      if (!language) {
        if (browser.LanguageDetector) {
          // Start create() during the original click where possible.
          detector ??= browser.LanguageDetector.create().catch((error) => {
            detector = undefined;
            throw error;
          });
          const detected = await (await detector).detect(text);
          language = detected[0]?.detectedLanguage;
          if (!language || language === "und")
            throw new Error("LANGUAGE_UNDETECTED");
        } else {
          // English is the default source language of the supplied descriptions.
          language = /[\u3040-\u30ff]/.test(text) ? "ja" : "en";
        }
        languages.set(text, language);
      }
      if (language === "ja") return text;
      const translator = await session(language);
      const translated = await translator.translate(text);
      if (!translated?.trim()) throw new Error("TRANSLATION_EMPTY");
      return translated;
    })();
    results.set(text, pending);
    // Keep failures retryable and bound the in-memory description cache.
    pending.catch(() => {
      if (results.get(text) === pending) results.delete(text);
    });
    if (results.size > 200) results.delete(results.keys().next().value);
    if (languages.size > 200) languages.delete(languages.keys().next().value);
    return pending;
  };
}

export const translateSellerDescription = createDescriptionTranslator();
