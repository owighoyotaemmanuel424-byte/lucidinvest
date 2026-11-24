import type { Metadata } from "next";
import Layout from "@/components/layout/Layout";
import PlatformLanding from "@/components/sections/InnerPage/PlatformLanding";

export const metadata: Metadata = {
  title: "Stocks | LucidInvest",
  description: "Listed equity investing with company profiles, indicative pricing and reviewed buy and sell orders.",
};

export default function StocksPage() {
  return (
    <div className="body-bg-1">
      <Layout headerStyle={1} footerStyle={1} breadcrumbTitle="Stocks" breadcrumbTitleTwo="Stocks">
        <PlatformLanding
          eyebrow="Equities"
          title="Listed equity investing"
          lead="Research company information, follow indicative prices and place buy or sell orders through a reviewed settlement workflow."
          cards={[
            {
              title: "Company profiles",
              text: "Sector, exchange and business description for each listed instrument in the marketplace.",
            },
            {
              title: "Indicative pricing",
              text: "The latest recorded quote and percentage change are displayed with their data source label.",
            },
            {
              title: "Price history",
              text: "Recorded quote history supports the portfolio chart and instrument detail pages.",
            },
            {
              title: "Buy and sell orders",
              text: "Orders are validated against your cash balance or holding quantity, then settled by operations.",
            },
            {
              title: "Holdings",
              text: "Filled buys create a holding with an average cost; filled sells reduce it and credit your account.",
            },
            {
              title: "Risk disclosure",
              text: "Equity prices can move sharply and dividends are not guaranteed. Position sizing is your decision.",
            },
          ]}
          notice="Equity investing carries the risk of loss of capital. Prices in this platform are recorded quotes, not a live exchange feed, and simulated demonstration prices are labelled. Past performance does not predict future returns."
        />
      </Layout>
    </div>
  );
}
