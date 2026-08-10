import { describe, expect, it } from "vitest";

import { getFileIconUrl } from "./file-icon";

describe("getFileIconUrl", () => {
  it("uses the Pi icon for AGENTS.md files", () => {
    expect(getFileIconUrl("AGENTS.md")).toContain("agents");
    expect(getFileIconUrl("nested/agents.md")).toBe(getFileIconUrl("AGENTS.md"));
  });

  it("uses the MetaTrader 5 icon for MQ5 source files", () => {
    expect(getFileIconUrl("Scalper.mq5")).toContain("metatrader5");
    expect(getFileIconUrl("Indicators/Momentum.MQ5")).toBe(getFileIconUrl("Scalper.mq5"));
  });

  it("uses NestJS icons for dotted Nest convention files", () => {
    expect(getFileIconUrl("src/modules/auth/auth.service.ts")).toContain("nest-service.clone.svg");
    expect(getFileIconUrl("src/modules/auth/auth.controller.ts")).toContain(
      "nest-controller.clone.svg",
    );
    expect(getFileIconUrl("src/app.module.ts")).toContain("nest-module.clone.svg");
    expect(getFileIconUrl("src/core/filters/http-exception.filter.ts")).toContain(
      "nest-filter.clone.svg",
    );
    expect(getFileIconUrl("src/core/security/basic-auth.middleware.ts")).toContain(
      "nest-middleware.clone.svg",
    );
    expect(getFileIconUrl("src/common/decorators/string-field.decorator.ts")).toContain(
      "nest-decorator.clone.svg",
    );
  });

  it("keeps NestJS spec files on the Material Icon Theme test icon", () => {
    expect(getFileIconUrl("src/modules/auth/auth.service.spec.ts")).toBe(
      getFileIconUrl("src/example.spec.ts"),
    );
  });

  it("resolves clone icons through the Material Icon Theme manifest", () => {
    expect(getFileIconUrl("src/users/users.guard.ts")).toContain("nest-guard.clone.svg");
  });
});
