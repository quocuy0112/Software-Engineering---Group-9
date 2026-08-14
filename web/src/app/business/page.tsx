import { redirect } from "next/navigation";

/** Public employer CTA alias for the existing employer-verification journey. */
export default function BusinessPage() {
  redirect("/dashboard/employer-verification");
}
