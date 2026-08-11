import { describe, expect, it } from "vitest";

import {
  awaitHighlighter,
  DARK_THEME,
  ensureLanguage,
  langFromPath,
  tokenizeLine,
} from "./highlighter";

describe("MQL5 syntax highlighting", () => {
  it("recognizes MetaTrader source, include, and preset files", () => {
    expect(langFromPath("MQL5/Experts/Strategy.mq5")).toBe("mql5");
    expect(langFromPath("MQL5/Include/Trade.MQH")).toBe("mql5");
    expect(langFromPath("presets/backtest.set")).toBe("ini");
  });

  it("loads and tokenizes MQL5-specific syntax", async () => {
    const highlighter = await awaitHighlighter();
    expect(await ensureLanguage("mql5")).toBe(true);

    const tokens = tokenizeLine(
      highlighter,
      "input double Lots = 0.1 * _Point; // risk",
      "mql5",
      DARK_THEME,
    );

    expect(tokens).not.toBeNull();
    expect(new Set(tokens?.map((token) => token.color)).size).toBeGreaterThan(2);
  });

  it("tokenizes MetaTrader preset values as INI", async () => {
    const highlighter = await awaitHighlighter();
    expect(await ensureLanguage("ini")).toBe(true);

    const tokens = tokenizeLine(highlighter, "Lots=0.10||0.01||0.01||1.00||Y", "ini", DARK_THEME);
    expect(tokens).not.toBeNull();
    expect(new Set(tokens?.map((token) => token.color)).size).toBeGreaterThan(1);
  });
});
