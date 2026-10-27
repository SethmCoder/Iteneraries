import { Webhook } from "svix";
import { getResendWebhookSecret } from "@/lib/env";

export class WebhookConfigError extends Error {
  constructor() {
    super("Email import is not configured. Set RESEND_WEBHOOK_SECRET.");
    this.name = "WebhookConfigError";
  }
}

export class WebhookVerificationFailedError extends Error {
  constructor(message = "Invalid webhook signature.") {
    super(message);
    this.name = "WebhookVerificationFailedError";
  }
}

export type ResendWebhookEvent = {
  type: string;
  created_at?: string;
  data: Record<string, unknown>;
};

type HeaderInput =
  | Headers
  | Record<string, string | string[] | undefined>;

function readHeader(headers: HeaderInput, name: string): string | undefined {
  if (typeof Headers !== "undefined" && headers instanceof Headers) {
    return headers.get(name) ?? undefined;
  }
  const record = headers as Record<string, string | string[] | undefined>;
  for (const [key, value] of Object.entries(record)) {
    if (key.toLowerCase() === name) {
      return Array.isArray(value) ? value[0] : value;
    }
  }
  return undefined;
}

/**
 * Verify a Resend (svix) webhook. `payload` must be the raw, unparsed request body.
 * Returns the parsed event, or throws if the signature is invalid.
 */
export function verifyResendWebhook(
  payload: string,
  headers: HeaderInput,
): ResendWebhookEvent {
  const secret = getResendWebhookSecret();
  if (!secret) throw new WebhookConfigError();

  const id = readHeader(headers, "svix-id");
  const timestamp = readHeader(headers, "svix-timestamp");
  const signature = readHeader(headers, "svix-signature");
  if (!id || !timestamp || !signature) {
    throw new WebhookVerificationFailedError("Missing svix signature headers.");
  }

  let event: unknown;
  try {
    event = new Webhook(secret).verify(payload, {
      "svix-id": id,
      "svix-timestamp": timestamp,
      "svix-signature": signature,
    });
  } catch {
    throw new WebhookVerificationFailedError();
  }

  if (
    typeof event !== "object" ||
    event === null ||
    typeof (event as { type?: unknown }).type !== "string"
  ) {
    throw new WebhookVerificationFailedError("Webhook payload is not a valid event.");
  }

  const { type, created_at, data } = event as {
    type: string;
    created_at?: string;
    data?: unknown;
  };
  return {
    type,
    created_at,
    data: typeof data === "object" && data !== null ? (data as Record<string, unknown>) : {},
  };
}
