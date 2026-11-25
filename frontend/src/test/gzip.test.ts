// @vitest-environment node
import { describe, it, expect } from "vitest";
import { gunzipSync } from "node:zlib";
import { gzipFile } from "@/lib/api";

describe("gzipFile", () => {
  it("compresses a plain log and appends .gz", async () => {
    const text = '198.51.100.55 - - "GET /api/users?id=1;DROP+TABLE+users HTTP/1.1" 400\n';
    const out = await gzipFile(new File([text], "apache_sample.log"));

    expect(out.name).toBe("apache_sample.log.gz");
    const bytes = new Uint8Array(await out.arrayBuffer());
    expect(new TextDecoder().decode(bytes)).not.toContain("DROP+TABLE");
    expect(gunzipSync(bytes).toString("utf8")).toBe(text);
  });

  it("leaves an already-gzipped file untouched", async () => {
    const file = new File([new Uint8Array([0x1f, 0x8b])], "logs.csv.gz");
    expect(await gzipFile(file)).toBe(file);
  });
});
