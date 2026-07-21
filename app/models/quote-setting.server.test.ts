import { describe, expect, it } from "vitest";

import { validateExpirationSettingsForm } from "./quote-setting.server";

function expirationForm(expiresAfter: string, reminderBefore: string) {
  const formData = new FormData();
  formData.set("quoteExpiresAfterDays", expiresAfter);
  formData.set("reminderBeforeExpireDays", reminderBefore);
  return formData;
}

describe("quote expiration settings validation", () => {
  it("accepts a reminder earlier than expiration", () => {
    expect(validateExpirationSettingsForm(expirationForm("7", "3"))).toEqual(
      {},
    );
  });

  it("accepts zero as reminder disabled", () => {
    expect(validateExpirationSettingsForm(expirationForm("7", "0"))).toEqual(
      {},
    );
  });

  it("rejects a reminder on or after expiration", () => {
    expect(
      validateExpirationSettingsForm(expirationForm("7", "7")),
    ).toMatchObject({
      reminderBeforeExpireDays: expect.any(String),
    });
  });

  it("rejects blank, decimal, and out-of-range values", () => {
    expect(
      validateExpirationSettingsForm(expirationForm("", "1.5")),
    ).toMatchObject({
      quoteExpiresAfterDays: expect.any(String),
      reminderBeforeExpireDays: expect.any(String),
    });
    expect(
      validateExpirationSettingsForm(expirationForm("366", "365")),
    ).toMatchObject({
      quoteExpiresAfterDays: expect.any(String),
      reminderBeforeExpireDays: expect.any(String),
    });
  });
});
