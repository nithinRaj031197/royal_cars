function env(name: string): string | undefined {
  const v = process.env[name];
  return v && v.length > 0 ? v : undefined;
}

export const envConfig = {
  get nextAuthSecret(): string | undefined {
    return env("NEXTAUTH_SECRET");
  },
  get nextAuthUrl(): string | undefined {
    return env("NEXTAUTH_URL");
  },
  get googleClientId(): string | undefined {
    return env("GOOGLE_CLIENT_ID");
  },
  get googleClientSecret(): string | undefined {
    return env("GOOGLE_CLIENT_SECRET");
  },
  get sheetsId(): string | undefined {
    return env("GOOGLE_SHEETS_ID");
  },
  get serviceAccountFile(): string | undefined {
    return env("GOOGLE_SERVICE_ACCOUNT_FILE");
  },
  /** Inline credentials for hosts with no writable disk (Vercel, Lambda). */
  get serviceAccountJson(): string | undefined {
    return env("GOOGLE_SERVICE_ACCOUNT_JSON");
  },
  get driveRootFolderId(): string | undefined {
    return env("GOOGLE_DRIVE_ROOT_FOLDER_ID");
  },
  get drivePhotoFolderId(): string | undefined {
    return env("GOOGLE_DRIVE_PHOTO_FOLDER_ID");
  },
  get driveDocFolderId(): string | undefined {
    return env("GOOGLE_DRIVE_DOC_FOLDER_ID");
  },
  get gatewayUrl(): string | undefined {
    return env("GATEWAY_URL");
  },
  get gatewayToken(): string | undefined {
    return env("GATEWAY_TOKEN");
  },
  get gatewayHmacSecret(): string | undefined {
    return env("GATEWAY_HMAC_SECRET");
  },
  get ownerEmail(): string | undefined {
    return env("OWNER_EMAIL");
  },
  get demoMode(): boolean {
    const v = env("DEMO_MODE");
    return v === "1" || v?.toLowerCase() === "true";
  }
};
