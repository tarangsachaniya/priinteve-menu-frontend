import { redirect } from "next/navigation";

import { getAdminSession } from "@/lib/api/server";
import { AdminSidebar } from "@/components/admin/admin-sidebar";

/**
 * Guard for the restaurant-provisioning admin, which shares the platform
 * ADMIN realm (pv_session, aud "user") with the Cards app rather than the
 * restaurant-staff realm — creating a restaurant is a platform action, not
 * something a restaurant's own staff can do to themselves. This is why the
 * login page here is /admin/login and not /r/login.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const data = await getAdminSession();
  if (data?.user.role !== "ADMIN") {
    redirect("/admin/login");
  }

  return (
    <div className="flex min-h-screen flex-col bg-muted md:flex-row">
      <AdminSidebar userEmail={data.user.email} />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
