import assert from "node:assert/strict";
import test from "node:test";
import { createDescriptionTranslator } from "./descriptionTranslation.js";

test("unsupported browsers reject explicitly and empty descriptions need no API", async () => {
  const translate = createDescriptionTranslator({});
  assert.equal(await translate(" \n "), "");
  await assert.rejects(translate("Coffee"), /TRANSLATION_UNSUPPORTED/);
});

test("English fallback preserves original text and deduplicates concurrent translations", async () => {
  let creates = 0;
  let calls = 0;
  const original = "Notes: <b>Berry</b> & cocoa.\nSecond line.";
  const translate = createDescriptionTranslator({
    Translator: {
      create: async (options) => {
        creates++;
        assert.deepEqual(options, {
          sourceLanguage: "en",
          targetLanguage: "ja",
        });
        return {
          translate: async (text) => {
            calls++;
            assert.equal(text, original);
            return "ベリーとココア。\n2行目。";
          },
        };
      },
    },
  });
  const results = await Promise.all([translate(original), translate(original)]);
  assert.equal(results[0], results[1]);
  assert.equal(await translate(original), results[0]);
  assert.equal(creates, 1);
  assert.equal(calls, 1);
});

test("language detection selects the original language and skips Japanese translation", async () => {
  const options = [];
  const translate = createDescriptionTranslator({
    LanguageDetector: {
      create: async () => ({
        detect: async (text) => [
          { detectedLanguage: text === "日本語" ? "ja" : "fr" },
        ],
      }),
    },
    Translator: {
      create: async (value) => {
        options.push(value);
        return { translate: async () => "果実の風味" };
      },
    },
  });
  assert.equal(await translate("日本語"), "日本語");
  assert.equal(await translate("Notes de fruits"), "果実の風味");
  assert.deepEqual(options, [{ sourceLanguage: "fr", targetLanguage: "ja" }]);
});

test("failed session creation can be retried with a fresh user gesture", async () => {
  let calls = 0;
  const translate = createDescriptionTranslator({
    Translator: {
      create: async () => {
        if (++calls === 1) throw new Error("NotAllowedError");
        return { translate: async () => "日本語訳" };
      },
    },
  });
  await assert.rejects(translate("Coffee"), /NotAllowedError/);
  assert.equal(await translate("Coffee"), "日本語訳");
  assert.equal(calls, 2);
});

test("translation failures and empty results are retryable", async () => {
  let calls = 0;
  const translate = createDescriptionTranslator({
    Translator: {
      create: async () => ({
        translate: async () => {
          calls++;
          if (calls === 1) throw new Error("Download failed");
          return calls === 2 ? "" : "日本語訳";
        },
      }),
    },
  });
  await assert.rejects(translate("Coffee"), /Download failed/);
  await assert.rejects(translate("Coffee"), /TRANSLATION_EMPTY/);
  assert.equal(await translate("Coffee"), "日本語訳");
});
