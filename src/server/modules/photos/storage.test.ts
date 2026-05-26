import { describe, it, expect, vi } from "vitest";
import path from "path";
import { ensurePhotosUploadsDir } from "./storage.js";

describe("photos storage directory init", () => {
  it("creates uploads/photos recursively and returns the resolved path", () => {
    const mkdirSync = vi.fn();
    const result = ensurePhotosUploadsDir({ mkdirSync });

    expect(mkdirSync).toHaveBeenCalledTimes(1);
    expect(mkdirSync).toHaveBeenCalledWith(path.resolve("uploads/photos"), { recursive: true });
    expect(result).toBe(path.resolve("uploads/photos"));
  });

  it("throws when directory creation fails", () => {
    const mkdirSync = vi.fn(() => {
      throw Object.assign(new Error("permission denied"), { code: "EACCES" });
    });

    expect(() => ensurePhotosUploadsDir({ mkdirSync })).toThrow(/permission denied/i);
  });
});
