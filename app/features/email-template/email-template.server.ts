import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { authenticate } from "~/shopify.server";
import {
  getEmailBranding,
  getResolvedEmailBranding,
  getEmailPreviewItems,
  processQuoteEmailDeliveries,
  sendTestQuoteEmail,
  updateEmailBranding,
  type QuoteEmailBranding,
} from "~/models/quote-email.server";
import {
  emailTemplateKeys,
  type QuoteEmailTemplateKey,
} from "~/models/quote-email.shared";
import type { QuoteEmailTheme } from "~/models/quote-email-config.shared";

const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);



export type EmailTemplateLoaderData = {
  selectedTemplate: QuoteEmailTemplateKey;
  branding: QuoteEmailBranding;
  previewItems: Awaited<ReturnType<typeof getEmailPreviewItems>>;
  uploadedLogoUrl: string;
};

export type EmailTemplateActionData = {
  ok?: boolean;
  message?: string;
  error?: string;
  intent?: "save" | "send_test" | "process_queue" | "reset" | "remove_logo";
  recipient?: string;
};
export const loadEmailTemplates = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const url = new URL(request.url);
  const selectedTemplate = (String(
    url.searchParams.get("templateKey") ?? "offer_sent",
  ) as QuoteEmailTemplateKey);
  const [storedBranding, previewItems] = await Promise.all([
    getEmailBranding(session.shop),
    getEmailPreviewItems(session.shop),
  ]);
  const branding = await getResolvedEmailBranding(session.shop);

  return {
    selectedTemplate,
    branding,
    previewItems,
    uploadedLogoUrl: storedBranding.logoUrl,
  };
};

export const saveEmailTemplates = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "save");

  if (intent === "process_queue") {
    if (process.env.NODE_ENV === "production") {
      return {
        ok: false,
        intent: "process_queue" as const,
        error: "Manual queue processing is disabled in production.",
      };
    }
    const result = await processQuoteEmailDeliveries(25, session.shop);
    return {
      ok: result.failedCount === 0,
      intent: "process_queue" as const,
      message: `Processed ${result.processedCount} email(s); ${result.sentCount} sent.`,
      error:
        result.failedCount > 0
          ? `${result.failedCount} email(s) could not be sent and were scheduled for retry.`
          : undefined,
    };
  }

  const requestedTemplateKey = String(formData.get("templateKey") ?? "");
  const templateKey = emailTemplateKeys.includes(
    requestedTemplateKey as QuoteEmailTemplateKey,
  )
    ? (requestedTemplateKey as QuoteEmailTemplateKey)
    : "offer_sent";
  const brandingInput: QuoteEmailBranding = {
    senderName: String(formData.get("brandingSenderName") ?? ""),
    // This is only the uploaded fallback. Shopify Brand logo is resolved at render time.
    logoUrl: String(formData.get("brandingFallbackLogoUrl") ?? ""),
    primaryColor: String(formData.get("brandingPrimaryColor") ?? "#152f7c"),
    linkColor: String(formData.get("brandingLinkColor") ?? "#1769aa"),
    signature: String(formData.get("brandingSignature") ?? "Customer service team"),
    replyToEmail: String(formData.get("brandingReplyToEmail") ?? ""),
    footerText: String(formData.get("brandingFooterText") ?? ""),
    theme: String(formData.get("emailTheme") ?? "clean") as QuoteEmailTheme,
  };

  if (intent === "remove_logo") {
    await updateEmailBranding(session.shop, { ...brandingInput, logoUrl: "" });
    return {
      ok: true,
      intent: "remove_logo" as const,
      message: "Logo removed.",
    };
  }

  if (intent === "upload_logo") {
    const grantedScopes = new Set(
      String(session.scope ?? "")
        .split(",")
        .map((scope) => scope.trim()),
    );
    const canCreateFiles = ["write_files", "write_themes", "write_images"].some(
      (scope) => grantedScopes.has(scope),
    );
    if (!canCreateFiles) {
      return {
        ok: false,
        intent: "save" as const,
        error:
          "Logo upload needs Shopify Files permission. Restart the app and approve the new write_files access, then try again.",
      };
    }

    const logoFile = formData.get("logoFile");
    if (!(logoFile instanceof File) || logoFile.size === 0) {
      return { ok: false, intent: "save" as const, error: "Choose a logo image to upload." };
    }
    if (!(["image/png", "image/jpeg", "image/webp"] as string[]).includes(logoFile.type)) {
      return { ok: false, intent: "save" as const, error: "Logo must be a PNG, JPG, or WebP image." };
    }
    if (logoFile.size > 2 * 1024 * 1024) {
      return { ok: false, intent: "save" as const, error: "Logo must be smaller than 2 MB." };
    }

    try {
      const logoUrl = await uploadLogoToShopifyFiles(admin, logoFile, brandingInput.senderName);
      await updateEmailBranding(session.shop, { ...brandingInput, logoUrl });
      return {
        ok: true,
        intent: "save" as const,
        message: "Logo uploaded successfully.",
      };
    } catch (error) {
      console.error("Unable to upload fallback email logo", error);
      return {
        ok: false,
        intent: "save" as const,
        error: error instanceof Error ? error.message : "Unable to upload the logo.",
      };
    }
  }

  if (intent === "reset") {
    await updateEmailBranding(session.shop, { ...brandingInput, theme: "clean" });
    return { ok: true, intent: "reset" as const, message: "Email design reset to Clean." };
  }

  if (intent === "send_test") {
    const toEmail = String(formData.get("testEmail") ?? "").trim();
    if (!isValidEmail(toEmail)) {
      return {
        ok: false,
        intent: "send_test" as const,
        error: "Please enter a valid test email address.",
      };
    }
    await updateEmailBranding(session.shop, brandingInput);
    const sent = await sendTestQuoteEmail(
      session.shop,
      templateKey,
      "en",
      toEmail,
    );
    if (!sent) {
      return {
        ok: false,
        intent: "send_test" as const,
        error: "Test email was not sent. Check the SendGrid configuration and recipient address.",
      };
    }
    return {
      ok: true,
      intent: "send_test" as const,
      recipient: toEmail,
      message: `SendGrid accepted the test email for ${toEmail}. Check SendGrid Activity for the final delivery status, then check the recipient inbox and spam folder.`,
    };
  }

  await updateEmailBranding(session.shop, brandingInput);

  return { ok: true, intent: "save" as const, message: "Email design saved." };
};

type AdminApiClient = Awaited<ReturnType<typeof authenticate.admin>>["admin"];

async function uploadLogoToShopifyFiles(
  admin: AdminApiClient,
  file: File,
  shopName: string,
) {
  const stagedResponse = await admin.graphql(
    `#graphql
      mutation CreateEmailLogoUpload($input: [StagedUploadInput!]!) {
        stagedUploadsCreate(input: $input) {
          stagedTargets {
            url
            resourceUrl
            parameters { name value }
          }
          userErrors { field message }
        }
      }`,
    {
      variables: {
        input: [{
          resource: "IMAGE",
          filename: file.name || "quote-email-logo.png",
          mimeType: file.type,
          httpMethod: "POST",
        }],
      },
    },
  );
  const stagedResult = await stagedResponse.json();
  const stagedErrors = stagedResult.data?.stagedUploadsCreate?.userErrors ?? [];
  const target = stagedResult.data?.stagedUploadsCreate?.stagedTargets?.[0];
  if (stagedErrors.length || !target?.url || !target?.resourceUrl) {
    throw new Error(stagedErrors[0]?.message || "Shopify could not prepare the logo upload.");
  }

  const uploadBody = new FormData();
  for (const parameter of target.parameters ?? []) {
    uploadBody.append(String(parameter.name), String(parameter.value));
  }
  uploadBody.append("file", file, file.name);
  const uploadResponse = await fetch(target.url, { method: "POST", body: uploadBody });
  if (!uploadResponse.ok) {
    throw new Error(`Shopify logo upload failed (${uploadResponse.status}).`);
  }

  const createResponse = await admin.graphql(
    `#graphql
      mutation CreateEmailLogoFile($files: [FileCreateInput!]!) {
        fileCreate(files: $files) {
          files {
            id
            fileStatus
            ... on MediaImage { image { url } }
          }
          userErrors { field message }
        }
      }`,
    {
      variables: {
        files: [{
          originalSource: target.resourceUrl,
          contentType: "IMAGE",
          alt: `${shopName || "Shop"} email logo`,
        }],
      },
    },
  );
  const createResult = await createResponse.json();
  const createErrors = createResult.data?.fileCreate?.userErrors ?? [];
  const createdFile = createResult.data?.fileCreate?.files?.[0];
  if (createErrors.length || !createdFile?.id) {
    throw new Error(createErrors[0]?.message || "Shopify could not create the logo file.");
  }
  if (createdFile.image?.url) return String(createdFile.image.url);

  // Shopify processes Files asynchronously. Poll briefly for the permanent CDN URL.
  for (let attempt = 0; attempt < 8; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 350));
    const statusResponse = await admin.graphql(
      `#graphql
        query EmailLogoFileStatus($id: ID!) {
          node(id: $id) {
            ... on MediaImage {
              fileStatus
              image { url }
            }
          }
        }`,
      { variables: { id: createdFile.id } },
    );
    const statusResult = await statusResponse.json();
    const node = statusResult.data?.node;
    if (node?.image?.url) return String(node.image.url);
    if (node?.fileStatus === "FAILED") {
      throw new Error("Shopify could not process the uploaded logo.");
    }
  }
  throw new Error("Logo is still processing in Shopify Files. Please try again in a moment.");
}
