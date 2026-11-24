import type { Metadata } from "next";
import Layout from "@/components/layout/Layout";
import PlatformLanding from "@/components/sections/InnerPage/PlatformLanding";

export const metadata: Metadata = {
  title: "Investments | LucidInvest",
  description: "Explore stocks, ETFs, bonds, mutual funds, cryptocurrency and managed investment plans.",
};

export default function InvestmentsPage() {
  return (
    <div className="body-bg-1">
      <Layout headerStyle={1} footerStyle={1} breadcrumbTitle="Investments" breadcrumbTitleTwo="Investments">
        <PlatformLanding
          eyebrow="Investment marketplace"
          title="Invest across global markets"
          lead="Access a broad investment marketplace through one reviewed account: exchange-traded equities, funds, fixed income, digital assets and managed mandates."
          cards={[
            {
              title: "Stocks",
              text: "Company profiles, indicative prices and a reviewed order workflow for listed equities.",
              points: ["Market and company information", "Buy and sell orders", "Holdings and valuation history"],
            },
            {
              title: "ETFs & mutual funds",
              text: "Diversified funds with disclosed expense ratios and allocation information.",
              points: ["Expense ratios shown before investing", "Portfolio allocation disclosure", "Subscription and redemption workflow"],
            },
            {
              title: "Bonds",
              text: "Government and investment-grade corporate fixed income with maturity and coupon detail.",
              points: ["Coupon and yield information", "Maturity dates", "Risk classification per mandate"],
            },
            {
              title: "Cryptocurrency",
              text: "Reference pricing and portfolio tracking for supported digital assets where permitted.",
              points: ["Supported asset reference prices", "Portfolio tracking", "Trading only through authorised venues"],
            },
            {
              title: "Managed plans",
              text: "Discretionary and rules-based mandates with a defined minimum, term, fee and risk classification.",
              points: ["Full disclosure before subscription", "Reviewed subscription workflow", "Maturity and redemption handling"],
            },
            {
              title: "Wealth management",
              text: "A structured relationship for larger portfolios, with documented reviews and reporting.",
              points: ["Documented investment policy", "Periodic portfolio reviews", "Consolidated reporting"],
            },
          ]}
          notice="Capital is at risk. The value of investments can fall as well as rise and you may get back less than you invested. Nothing on this page is a promise of return, a personal recommendation or tax advice. Market prices shown in the platform are indicative records and may be simulated demonstration data where labelled."
        />
      </Layout>
    </div>
  );
}
