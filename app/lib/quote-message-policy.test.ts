import { describe, expect, it } from "vitest";
import {
  QUOTE_MESSAGE_MAX_LENGTH,
  normalizeClientMessageId,
  validateQuoteFileSignature,
  validateQuoteMessage,
} from "./quote-message-policy";

const attachment = {
  fileName: "quote.pdf",
  fileUrl: "data:application/pdf;base64,JVBERg==",
  mimeType: "application/pdf;size=4",
};

describe("quote message production policy", () => {
  it("accepts a normal message and supported attachment", () => {
    expect(
      validateQuoteMessage({
        message: "Please review this quote.",
        attachments: [attachment],
      }),
    ).toBeNull();
  });

  it("rejects oversized messages and unsupported files", () => {
    expect(
      validateQuoteMessage({
        message: "x".repeat(QUOTE_MESSAGE_MAX_LENGTH + 1),
      }),
    ).toContain("characters or fewer");
    expect(
      validateQuoteMessage({
        message: "",
        attachments: [
          {
            fileName: "script.exe",
            fileUrl: "data:application/octet-stream;base64,AAAA",
            mimeType: "application/octet-stream;size=3",
          },
        ],
      }),
    ).toContain("not allowed");
  });

  it("normalizes valid client IDs and rejects unsafe IDs", () => {
    expect(normalizeClientMessageId(" message-12345678 ")).toBe(
      "message-12345678",
    );
    expect(() => normalizeClientMessageId("bad id")).toThrow();
  });

  it("rejects files whose content does not match the extension", () => {
    expect(
      validateQuoteFileSignature(
        "fake.pdf",
        Uint8Array.from([0x4d, 0x5a, 0x90, 0x00]),
      ),
    ).toContain("does not match");
  });
});
