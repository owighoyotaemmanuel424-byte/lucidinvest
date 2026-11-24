import type { Metadata } from "next";
import Layout from "@/components/layout/Layout";
import PlatformLanding from "@/components/sections/InnerPage/PlatformLanding";

export const metadata: Metadata = {
  title: "Bonds | LucidInvest",
  description: "Government and corporate bonds with coupon, maturity and yield information.",
};

export default function BondsPage() {
  return (
    <div className="body-bg-1">
      <Layout headerStyle={1} footerStyle={1} breadcrumbTitle="Bonds" breadcrumbTitleTwo="Bonds">
        <PlatformLanding
          eyebrow="Fixed income"
          title="Government and corporate bonds"
          lead="Fixed income can play a role in income and capital preservation, but it is not risk-free. Review issuer, coupon, maturity and yield together."
          cards={[
            {
              title: "Government bonds",
              text: "Sovereign issuance including US Treasury and UK Gilt instruments in the demonstration catalogue.",
            },
            {
              title: "Corporate bonds",
              text: "Investment-grade credit with a stated coupon and maturity, subject to issuer credit risk.",
            },
            {
              title: "Coupon and yield",
              text: "Coupon is the contractual interest rate; yield reflects the price paid. Both are disclosed in the profile.",
            },
            {
              title: "Maturity dates",
              text: "The date the principal is due back is shown before you invest, where the instrument has one.",
            },
            {
              title: "Interest-rate risk",
              text: "Bond prices fall when market yields rise. Longer maturities typically carry more price sensitivity.",
            },
            {
              title: "Managed income plans",
              text: "Diversified bond mandates are available through the investment plan catalogue with disclosed fees.",
            },
          ]}
          notice="Bonds carry issuer, interest-rate, inflation and liquidity risk. A coupon is not a guarantee of total return, and selling before maturity may realise a loss."
        />
      </Layout>
    </div>
  );
}
