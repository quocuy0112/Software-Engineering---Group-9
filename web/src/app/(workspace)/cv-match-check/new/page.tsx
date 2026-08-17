import { PrivateMatchSetupRoute } from "@/app/private-match-setup-route";
import type { PrivateMatchSetupRouteProps } from "@/app/private-match-setup-route";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function CvMatchCheckNewPage(
  props: PrivateMatchSetupRouteProps,
) {
  return <PrivateMatchSetupRoute {...props} />;
}
