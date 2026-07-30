import "../frontend/styles/home.css";
import { getHomePageContext } from "@/backend/services/home/get-home-page-context";
import { HomePageView } from "@/frontend/features/home/components/home-page-view";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  return <HomePageView context={await getHomePageContext()} />;
}
