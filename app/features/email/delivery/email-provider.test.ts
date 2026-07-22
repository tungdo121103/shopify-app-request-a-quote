import { afterEach, describe, expect, it } from "vitest";
import {
  getEmailSenderConfig,
  htmlToPlainText,
} from "~/features/email/delivery/email-provider";
import {
  createEmailProvider,
  getConfiguredEmailProviderName,
} from "~/features/email/delivery/email-provider-factory.server";

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
});

describe("email provider configuration", () => {
  it("selects the explicitly configured provider", () => {
    process.env.EMAIL_PROVIDER = "ses";
    expect(getConfiguredEmailProviderName()).toBe("ses");
  });

  it("keeps SendGrid as a backward-compatible fallback", () => {
    delete process.env.EMAIL_PROVIDER;
    process.env.SENDGRID_API_KEY = "test-key";
    expect(getConfiguredEmailProviderName()).toBe("sendgrid");
  });

  it("uses SMTP by default outside production", () => {
    delete process.env.EMAIL_PROVIDER;
    delete process.env.SENDGRID_API_KEY;
    process.env.NODE_ENV = "development";
    expect(getConfiguredEmailProviderName()).toBe("smtp");
  });

  it("rejects an unsupported provider", () => {
    process.env.EMAIL_PROVIDER = "unknown";
    expect(() => getConfiguredEmailProviderName()).toThrow(
      /Unsupported EMAIL_PROVIDER/,
    );
  });

  it("reads the shared sender configuration", () => {
    process.env.EMAIL_FROM_ADDRESS = "quotes@example.com";
    process.env.EMAIL_FROM_NAME = "Example Shop";
    process.env.EMAIL_REPLY_TO = "support@example.com";

    expect(getEmailSenderConfig()).toEqual({
      address: "quotes@example.com",
      name: "Example Shop",
      replyTo: "support@example.com",
    });
  });

  it("constructs the SMTP adapter", () => {
    process.env.SMTP_HOST = "127.0.0.1";
    process.env.SMTP_PORT = "1025";

    expect(createEmailProvider("smtp").send).toBeTypeOf("function");
  });
});

describe("email text fallback", () => {
  it("creates readable plain text from HTML", () => {
    expect(htmlToPlainText("<h1>Quote &amp; offer</h1><p>Total&nbsp;$10</p>"))
      .toBe("Quote & offer Total $10");
  });
});
