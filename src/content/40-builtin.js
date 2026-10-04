  async function incrementBuiltinUsage() {
    const today = new Date().toISOString().slice(0, 10);
    const data = await chrome.storage.sync.get(["usageDate", "usageCount"]);
    const next = data.usageDate === today ? (Number(data.usageCount) || 0) + 1 : 1;
    await chrome.storage.sync.set({ usageDate: today, usageCount: next });
  }

  async function translateWithBuiltin(text, context, targetCode) {
    if (!("Translator" in globalThis) || !("LanguageDetector" in globalThis)) {
      throw new Error(t("errNoBuiltin"));
    }

    const targetLanguage = BUILTIN_TARGETS[targetCode] || "zh-Hant";
    let detector;
    let translator;

    try {
      updateLoading(t("loadingDetect"));
      const detectorAvailability = await LanguageDetector.availability();
      if (detectorAvailability === "unavailable") {
        throw new Error(t("errNoDetector"));
      }

      detector = await LanguageDetector.create({
        monitor(monitor) {
          monitor.addEventListener("downloadprogress", (event) => {
            updateLoading(t("loadingDetectorProgress", [String(Math.round(event.loaded * 100))]));
          });
        },
      });

      const detectionSample = String(context || text).slice(0, 1200);
      const candidates = await detector.detect(detectionSample);
      const topCandidate = candidates?.[0];
      const fallbackLanguage = pageLanguage();
      const sourceLanguage = normalizeLanguageCode(
        topCandidate?.confidence >= 0.35
          ? topCandidate.detectedLanguage
          : fallbackLanguage || topCandidate?.detectedLanguage
      );

      if (!sourceLanguage) {
        throw new Error(t("errUnknownSource"));
      }

      setHeader("builtin", sourceLanguage);

      if (sourceLanguage === targetLanguage) return text;

      const translatorOptions = { sourceLanguage, targetLanguage };
      const translatorAvailability = await Translator.availability(translatorOptions);
      if (translatorAvailability === "unavailable") {
        throw new Error(t("errPairUnsupported"));
      }

      if (translatorAvailability !== "available") {
        updateLoading(t("loadingPackDownload"));
      } else {
        updateLoading(t("loadingTranslating"));
      }

      translator = await Translator.create({
        ...translatorOptions,
        monitor(monitor) {
          monitor.addEventListener("downloadprogress", (event) => {
            updateLoading(t("loadingPackProgress", [String(Math.round(event.loaded * 100))]));
          });
        },
      });

      updateLoading(t("loadingTranslating"));
      const result = await translator.translate(text);
      return String(result || "").trim();
    } catch (error) {
      if (error?.name === "NotSupportedError") {
        throw new Error(t("errPairUnsupported"));
      }
      if (error?.name === "NetworkError") {
        throw new Error(t("errPackFailed"));
      }
      throw error;
    } finally {
      translator?.destroy?.();
      detector?.destroy?.();
    }
  }
