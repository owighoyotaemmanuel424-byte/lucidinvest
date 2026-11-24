import type { Metadata } from "next";
import Layout from "@/components/layout/Layout";
import PlatformLanding from "@/components/sections/InnerPage/PlatformLanding";

export const metadata: Metadata = {
  title: "ETFs | LucidInvest",
  description: "Exchange-traded funds with disclosed expense ratios, allocation detail and reviewed orders.",
};

export default function EtfsPage() {
  return (
    <div className="body-bg-1">
      <Layout headerStyle={1} footerStyle={1} breadcrumbTitle="ETFs" breadcrumbTitleTwo="ETFs">
        <PlatformLanding
          eyebrow="Exchange-traded funds"
          title="Diversified exposure, disclosed costs"
          lead="ETFs can provide broad market exposure in a single instrument. Review the mandate, expense ratio and allocation before investing."
          cards={[
            {
              title: "Fund universe",
              text: "Balanced, technology, dividend and index-oriented funds in the marketplace catalogue.",
            },
            {
              title: "Expense ratios",
              text: "The ongoing charge is shown as a percentage, so the cost of exposure is visible before you invest.",
            },
            {
              title: "Portfolio allocation",
              text: "Sector and asset allocation information for each fund mandate is disclosed in the product profile.",
            },
            {
              title: "Performance history",
              text: "Recorded quote history supports charting. It is not a forecast and past results do not repeat.",
            },
            {
              title: "Orders and holdings",
              text: "Buy and sell orders settle through the same reviewed workflow as individual equities.",
            },
            {
              title: "Tracking and currency",
              text: "Funds are denominated in a single currency; a matching account currency is required to settle.",
            },
          ]}
          notice="ETF values can fall as well as rise. Expense ratios reduce returns over time. Nothing here is a recommendation to buy or sell a particular fund."
        />
      </Layout>
    </div>
  );
}
