import type { Metadata } from "next";
import Layout from "@/components/layout/Layout";
import PlatformLanding from "@/components/sections/InnerPage/PlatformLanding";

export const metadata: Metadata = {
  title: "Wealth Management | LucidInvest",
  description: "Discretionary and advisory wealth management with documented reviews and consolidated reporting.",
};

export default function WealthManagementPage() {
  return (
    <div className="body-bg-1">
      <Layout headerStyle={1} footerStyle={1} breadcrumbTitle="Wealth Management" breadcrumbTitleTwo="Wealth">
        <PlatformLanding
          eyebrow="Wealth management"
          title="A structured approach to larger portfolios"
          lead="For investors with more complex objectives, a documented mandate aligns allocation, risk and reporting with your circumstances."
          cards={[
            {
              title: "Discovery and objectives",
              text: "We document your time horizon, liquidity needs and tolerance for loss before proposing an allocation.",
            },
            {
              title: "Investment policy",
              text: "A written mandate covers permitted assets, target allocation and rebalancing rules.",
            },
            {
              title: "Discretionary mandates",
              text: "Where agreed, the investment team manages the portfolio within the documented policy.",
            },
            {
              title: "Periodic reviews",
              text: "Scheduled reviews revisit the mandate as circumstances or market conditions change.",
            },
            {
              title: "Consolidated reporting",
              text: "Portfolio statements and performance history are available from your dashboard.",
            },
            {
              title: "Transparent fees",
              text: "Management and subscription fees are disclosed in basis points before you commit.",
            },
          ]}
          notice="Wealth management does not remove investment risk or guarantee outcomes. Any mandate is agreed in writing and reviewed periodically. This page is information, not a personal recommendation."
        />
      </Layout>
    </div>
  );
}
