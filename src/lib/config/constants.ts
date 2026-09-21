export const INR = {
  currency: "INR" as const,
  locale: "en-IN",
  timezone: "Asia/Kolkata"
};

export const ODOMETER_UNIT = "km" as const;

export const APP_NAME = "Royal Cars";
export const APP_TAGLINE = "Pre-owned car showroom administration";

/** Google Sheets read quota headroom used for backoff decisions. */
export const SHEETS_READ_QUOTA_PER_MINUTE = 60;

export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024; // 15 MB per file

export const IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic"];

export const DOC_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
];

export const CACHE_TTL_MS = 15_000;

/** Practical dataset sizes tested with Sheets storage (documented in README). */
export const PRACTICAL_LIMITS = {
  vehicles: 800,
  activityLogs: 20_000,
  rowsPerTab: 10_000
};

export const SCHEMA_VERSION = 2;
