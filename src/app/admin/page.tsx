import { AdminConsole } from "@/components/admin/admin-console";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteNav } from "@/components/layout/site-nav";

export default function AdminPage() {
  return (
    <main className="min-h-dvh bg-[var(--page)] text-foreground">
      <SiteNav />
      <AdminConsole />
      <SiteFooter />
    </main>
  );
}
