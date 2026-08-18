import { redirect } from "next/navigation";

/**
 * /r/settings on its own has nothing to show — it is the layout's mount
 * point, not a section. Profile is the section every restaurant configures
 * first (name, branding, contact details), so it's the natural landing page
 * rather than an empty shell asking the owner to pick from the rail.
 */
export default function SettingsIndexPage() {
  redirect("/r/settings/profile");
}
