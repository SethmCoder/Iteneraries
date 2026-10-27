/** Length of each free (and future paid) access period. */
export const ACCOUNT_PERIOD_DAYS = 30;

/**
 * Days after period end before hard-deleting the auth user.
 * Keeps a short recovery window; Stripe past_due can reuse this later.
 */
export const ACCOUNT_DELETE_GRACE_DAYS = 7;

export const REMINDER_DAYS_BEFORE = [7, 1] as const;
