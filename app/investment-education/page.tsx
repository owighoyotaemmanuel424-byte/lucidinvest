import type { Metadata } from "next";
import Link from "next/link";
import Layout from "@/components/layout/Layout";
import PlatformLanding from "@/components/sections/InnerPage/PlatformLanding";

export const metadata: Metadata = {
  title: "Investment Education | LucidInvest",
  description: "Learn the fundamentals of investing, diversification, risk and portfolio construction.",
};

export default function InvestmentEducationPage() {
  return (
    <div className="body-bg-1">
      <Layout headerStyle={1} footerStyle={1} breadcrumbTitle="Investment Education" breadcrumbTitleTwo="Education">
        <PlatformLanding
          eyebrow="Investment education"
          title="Understand the risk before the return"
          lead="Education is the most reliable edge an investor has. These resources explain the mechanics behind the products on the platform."
          cards={[
            {
              title: "Risk and return",
              text: "Every expected return is compensation for uncertainty. Understanding volatility and drawdown is the starting point.",
            },
            {
              title: "Diversification",
              text: "Spreading exposure across assets, sectors and currencies reduces concentration, though not all risk.",
            },
            {
              title: "Asset allocation",
              text: "The mix between cash, bonds, equities and alternatives usually explains more of a portfolio's behaviour than individual picks.",
            },
            {
              title: "Costs matter",
              text: "Fees compound against you. Expense ratios, subscription fees and management fees are disclosed on each product.",
            },
            {
              title: "Behavioural pitfalls",
              text: "Chasing performance, overtrading and ignoring time horizon are common causes of poor outcomes.",
            },
            {
              title: "Fraud awareness",
              text: "Guaranteed returns, pressure to act and requests for remote access are warning signs. Verify before you transfer funds.",
            },
          ]}
          notice="Educational content is general information, not personal advice. If you are unsure whether an investment suits your circumstances, seek independent professional advice."
          primaryHref="/courses"
          primaryLabel="Explore courses"
        />
        <div className="container" style={{ paddingBottom: 60 }}>
          <p style={{ fontSize: 14, color: "#43584a" }}>
            Prefer to read? Visit our <Link href="/blog-1" style={{ color: "#0b6b33", fontWeight: 650 }}>market insights</Link>{" "}
            or review the <Link href="/risk-disclosure" style={{ color: "#0b6b33", fontWeight: 650 }}>risk disclosure</Link>.
          </p>
        </div>
      </Layout>
    </div>
  );
}
