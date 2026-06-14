function hasUsableEnvValue(value: string | undefined, prefix: string) {
  return Boolean(value && value.startsWith(prefix));
}

export function isClerkConfigured() {
  return (
    hasUsableEnvValue(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY, "pk_") &&
    hasUsableEnvValue(process.env.CLERK_SECRET_KEY, "sk_")
  );
}

export function getConfiguredAdminEmails() {
  return new Set(
    (process.env.OMNIDOXA_ADMIN_EMAILS ?? "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function isConfiguredAdminEmail(email: string) {
  return getConfiguredAdminEmails().has(email.trim().toLowerCase());
}
