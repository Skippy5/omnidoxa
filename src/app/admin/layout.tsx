import { AdminAccessPanel } from "@/components/admin/admin-access-panel";
import { AdminPortalNav } from "@/components/admin/admin-portal-nav";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteNav } from "@/components/layout/site-nav";
import { getAccessState } from "@/lib/access";
import { isClerkConfigured } from "@/lib/auth-config";

export const dynamic = "force-dynamic";

async function getAdminLayoutAccess() {
  if (!isClerkConfigured()) {
    return {
      isAuthConfigured: false,
      isSignedIn: false,
      isAdmin: true,
    };
  }

  const access = await getAccessState();

  return {
    isAuthConfigured: true,
    isSignedIn: access.isMember,
    isAdmin: access.isAdmin,
  };
}

export default async function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const access = await getAdminLayoutAccess();

  return (
    <main className="min-h-dvh bg-[var(--page)] text-foreground">
      <SiteNav />
      {access.isAdmin ? (
        <>
          <AdminPortalNav />
          {children}
        </>
      ) : (
        <AdminAccessPanel
          isAuthConfigured={access.isAuthConfigured}
          isSignedIn={access.isSignedIn}
        />
      )}
      <SiteFooter />
    </main>
  );
}
