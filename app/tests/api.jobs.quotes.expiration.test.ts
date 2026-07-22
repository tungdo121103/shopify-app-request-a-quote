import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  runAllQuoteExpirationJobs: vi.fn(),
  runQuoteExpirationJobs: vi.fn(),
  processQuoteEmailDeliveries: vi.fn(),
}));

vi.mock("~/models/quote.server", () => ({
  runAllQuoteExpirationJobs: mocks.runAllQuoteExpirationJobs,
  runQuoteExpirationJobs: mocks.runQuoteExpirationJobs,
}));
vi.mock("~/features/email/quote-email.server", () => ({
  processQuoteEmailDeliveries: mocks.processQuoteEmailDeliveries,
}));

import { action, loader } from "~/routes/api.jobs.quotes.expiration";

describe("quote expiration job authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.QUOTE_JOB_SECRET = "test-job-secret";
    mocks.runAllQuoteExpirationJobs.mockResolvedValue({ expiredCount: 0 });
    mocks.processQuoteEmailDeliveries.mockResolvedValue({ processedCount: 0 });
  });

  afterEach(() => {
    delete process.env.QUOTE_JOB_SECRET;
  });

  it("rejects GET requests without running the job", async () => {
    const response = await loader({} as never);
    expect(response.status).toBe(405);
    expect(response.headers.get("Allow")).toBe("POST");
    expect(mocks.runAllQuoteExpirationJobs).not.toHaveBeenCalled();
  });

  it("does not accept the secret from the query string", async () => {
    const request = new Request(
      "https://app.example/api/jobs/quotes/expiration?secret=test-job-secret",
      { method: "POST" },
    );

    await expect(action({ request } as never)).rejects.toMatchObject({
      status: 401,
    });
    expect(mocks.runAllQuoteExpirationJobs).not.toHaveBeenCalled();
  });

  it("runs only when the POST request has the secret header", async () => {
    const request = new Request(
      "https://app.example/api/jobs/quotes/expiration",
      {
        method: "POST",
        headers: { "x-quote-job-secret": "test-job-secret" },
      },
    );

    const response = await action({ request } as never);
    expect(response.status).toBe(200);
    expect(mocks.runAllQuoteExpirationJobs).toHaveBeenCalledTimes(1);
  });
});
