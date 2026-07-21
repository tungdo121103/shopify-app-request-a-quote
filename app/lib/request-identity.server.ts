import { createHash } from "node:crypto";

export function requestIpHash(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0];
  const ip =
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-real-ip") ||
    forwarded ||
    "";
  const normalized = ip.trim();
  return normalized
    ? createHash("sha256").update(normalized).digest("hex")
    : null;
}

export function requestActorHash(identity?: string | null) {
  const normalized = String(identity || "").trim().toLowerCase();
  return normalized
    ? createHash("sha256").update(normalized).digest("hex")
    : null;
}
