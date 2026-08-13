import "../frontend/styles/home.css";
import "../frontend/styles/responsive.css";
import { getHomePageContext } from "@/backend/services/home/get-home-page-context";
import { HomePageView } from "@/frontend/features/home/components/home-page-view";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  return <HomePageView model={await getHomePageContext()} />;
}
