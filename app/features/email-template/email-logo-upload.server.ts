import { authenticate } from "~/shopify.server";

type AdminApiClient = Awaited<ReturnType<typeof authenticate.admin>>["admin"];

export async function uploadLogoToShopifyFiles(
  admin: AdminApiClient,
  file: File,
  shopName: string,
) {
  const stagedResponse = await admin.graphql(
    `#graphql
      mutation CreateEmailLogoUpload($input: [StagedUploadInput!]!) {
        stagedUploadsCreate(input: $input) {
          stagedTargets { url resourceUrl parameters { name value } }
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
          files { id fileStatus ... on MediaImage { image { url } } }
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

  for (let attempt = 0; attempt < 8; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 350));
    const statusResponse = await admin.graphql(
      `#graphql
        query EmailLogoFileStatus($id: ID!) {
          node(id: $id) {
            ... on MediaImage { fileStatus image { url } }
          }
        }`,
      { variables: { id: createdFile.id } },
    );
    const node = (await statusResponse.json()).data?.node;
    if (node?.image?.url) return String(node.image.url);
    if (node?.fileStatus === "FAILED") {
      throw new Error("Shopify could not process the uploaded logo.");
    }
  }
  throw new Error("Logo is still processing in Shopify Files. Please try again in a moment.");
}
