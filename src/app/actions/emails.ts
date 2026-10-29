"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { chatJson } from "@/lib/ai/client";
import { isAiConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { confirmReservationImportAction } from "@/app/actions/settings";

export async function summarizeImportedEmailAction(emailId: string) {
  if (!isAiConfigured()) {
    throw new Error("AI is not configured. Set OPENAI_API_KEY to summarize.");
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data: email } = await supabase
    .from("imported_emails")
    .select("*")
    .eq("id", emailId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!email) throw new Error("Email not found");

  const body =
    (email.raw_text as string | null) ||
    (email.raw_html as string | null) ||
    "";
  if (!body.trim()) {
    throw new Error(
      "No raw email body stored for this message (older imports may lack it).",
    );
  }

  const result = await chatJson({
    system:
      "Summarize a travel confirmation email for a traveler. Include provider, confirmation numbers, dates, places, and action items. Do not invent details missing from the email. Return JSON { summary: string }.",
    user: `Subject: ${email.subject ?? "(none)"}\nFrom: ${email.from_address ?? "(unknown)"}\n\n${body.slice(0, 12000)}`,
    schema: z.object({ summary: z.string().min(1) }),
    temperature: 0.2,
  });

  const { error } = await supabase
    .from("imported_emails")
    .update({ ai_summary: result.summary })
    .eq("id", emailId);
  if (error) throw new Error(error.message);
  revalidatePath("/emails");
  return result.summary;
}

export async function assignEmailTripAction(input: {
  reviewId: string;
  tripId: string;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { error } = await supabase
    .from("reservation_reviews")
    .update({
      trip_id: input.tripId,
      match_reason: "manual_assign",
    })
    .eq("id", input.reviewId)
    .eq("user_id", user.id);
  if (error) throw new Error(error.message);
  revalidatePath("/emails");
}

export async function confirmEmailImportFromInboxAction(input: {
  reviewId: string;
  tripId: string;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data: review } = await supabase
    .from("reservation_reviews")
    .select("extracted_data")
    .eq("id", input.reviewId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!review) throw new Error("Review not found");

  await confirmReservationImportAction({
    reviewId: input.reviewId,
    tripId: input.tripId,
    extracted: (review.extracted_data ?? {}) as Record<string, unknown>,
  });
  revalidatePath("/emails");
}
