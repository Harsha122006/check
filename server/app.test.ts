import { afterEach, describe, expect, it } from "vitest";
import { createApp } from "./app";

const servers: Array<{ close: (callback?: (error?: Error) => void) => void }> = [];

afterEach(() => {
  for (const server of servers.splice(0)) server.close();
});

describe("external application bootstrap", () => {
  it("creates the Express app without starting a listener", async () => {
    const result = await createApp({ development: false });
    servers.push(result.server);

    expect(typeof result.app).toBe("function");
    expect(typeof result.server.listen).toBe("function");
  });
});
