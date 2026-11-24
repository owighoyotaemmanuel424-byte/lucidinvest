"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu, X, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import styles from "./dashboard.module.css";

type ShellUser = { name: string; email: string };
type Area = "customer" | "admin";

type NavItem = { href: string; label: string; exact?: boolean; icon: React.ReactNode };

function Icon({ children }: { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
      {children}
    </svg>
  );
}

const CUSTOMER_NAV: NavItem[] = [
  {
    href: "/dashboard",
    label: "Overview",
    exact: true,
    icon: (
      <Icon>
        <rect x="3" y="3" width="7.5" height="7.5" rx="2" stroke="currentColor" strokeWidth="1.7" />
        <rect x="13.5" y="3" width="7.5" height="7.5" rx="2" stroke="currentColor" strokeWidth="1.7" />
        <rect x="3" y="13.5" width="7.5" height="7.5" rx="2" stroke="currentColor" strokeWidth="1.7" />
        <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2" stroke="currentColor" strokeWidth="1.7" />
      </Icon>
    ),
  },
  {
    href: "/dashboard/portfolio",
    label: "My Portfolio",
    icon: (
      <Icon>
        <path d="M3.5 19.5h17" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        <path d="M6 16V9m4 7V5m4 11v-5m4 5v-8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </Icon>
    ),
  },
  {
    href: "/dashboard/plans",
    label: "Investment Plans",
    icon: (
      <Icon>
        <rect x="4" y="3.5" width="16" height="17" rx="2.5" stroke="currentColor" strokeWidth="1.7" />
        <path d="M8 8h8M8 12h8M8 16h4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </Icon>
    ),
  },
  {
    href: "/dashboard/markets",
    label: "Markets",
    icon: (
      <Icon>
        <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.7" />
        <path d="M3.5 12h17M12 3.5c2.6 2.4 2.6 14.6 0 17M12 3.5c-2.6 2.4-2.6 14.6 0 17" stroke="currentColor" strokeWidth="1.7" />
      </Icon>
    ),
  },
  {
    href: "/dashboard/buy",
    label: "Buy Investments",
    icon: (
      <Icon>
        <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </Icon>
    ),
  },
  {
    href: "/dashboard/sell",
    label: "Sell Investments",
    icon: (
      <Icon>
        <path d="M5 12h14" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </Icon>
    ),
  },
  {
    href: "/dashboard/deposit",
    label: "Deposit Funds",
    icon: (
      <Icon>
        <path d="M12 4v12m0 0 4-4m-4 4-4-4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M4 19h16" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </Icon>
    ),
  },
  {
    href: "/dashboard/withdraw",
    label: "Withdraw Funds",
    icon: (
      <Icon>
        <path d="M12 20V8m0 0 4 4m-4-4-4 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M4 5h16" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </Icon>
    ),
  },
  {
    href: "/dashboard/wallet",
    label: "Wallet",
    icon: (
      <Icon>
        <rect x="3" y="6" width="18" height="13" rx="3" stroke="currentColor" strokeWidth="1.7" />
        <path d="M3 10.5h18" stroke="currentColor" strokeWidth="1.7" />
        <circle cx="17" cy="14.5" r="1.3" fill="currentColor" />
      </Icon>
    ),
  },
  {
    href: "/dashboard/accounts",
    label: "Accounts",
    icon: (
      <Icon>
        <rect x="3" y="6" width="18" height="13" rx="3" stroke="currentColor" strokeWidth="1.7" />
        <path d="M3 10.5h18" stroke="currentColor" strokeWidth="1.7" />
        <path d="M7 15.5h4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </Icon>
    ),
  },
  {
    href: "/dashboard/investments",
    label: "Investments",
    icon: (
      <Icon>
        <path d="M4 17.5 9 11l3.5 3.2L20 6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M15.5 6H20v4.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      </Icon>
    ),
  },
  {
    href: "/dashboard/transactions",
    label: "Transactions",
    icon: (
      <Icon>
        <path d="M4 8h13l-3-3M20 16H7l3 3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      </Icon>
    ),
  },
  {
    href: "/dashboard/statements",
    label: "Statements",
    icon: (
      <Icon>
        <path d="M6 3.5h8l4 4v13H6z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
        <path d="M14 3.5v4h4M9 12h6M9 16h6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </Icon>
    ),
  },
  {
    href: "/dashboard/referrals",
    label: "Referrals",
    icon: (
      <Icon>
        <circle cx="8" cy="9" r="3" stroke="currentColor" strokeWidth="1.7" />
        <circle cx="17" cy="10.5" r="2.4" stroke="currentColor" strokeWidth="1.7" />
        <path d="M2.5 19c1-3 3-4.4 5.5-4.4s4.5 1.4 5.5 4.4M14 19c.6-1.9 1.8-3 3.4-3.3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </Icon>
    ),
  },
  {
    href: "/dashboard/notifications",
    label: "Notifications",
    icon: (
      <Icon>
        <path d="M6 9a6 6 0 0 1 12 0v4l2 3H4l2-3V9Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
        <path d="M10 19a2 2 0 0 0 4 0" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </Icon>
    ),
  },
  {
    href: "/dashboard/support",
    label: "Support",
    icon: (
      <Icon>
        <path d="M4 5.5h16v11H9l-5 4z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
        <path d="M8 9.5h8M8 12.5h5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </Icon>
    ),
  },
  {
    href: "/dashboard/profile",
    label: "Profile",
    icon: (
      <Icon>
        <circle cx="12" cy="8.5" r="3.7" stroke="currentColor" strokeWidth="1.7" />
        <path d="M4.5 20c1.4-3.4 4.2-5.1 7.5-5.1s6.1 1.7 7.5 5.1" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </Icon>
    ),
  },
  {
    href: "/dashboard/security",
    label: "Security",
    icon: (
      <Icon>
        <path d="M12 3.5 19 6v5.4c0 4.2-2.9 7.6-7 9.1-4.1-1.5-7-4.9-7-9.1V6l7-2.5Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
        <path d="m9 12 2.2 2.2L15.5 10" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      </Icon>
    ),
  },
];

const ADMIN_NAV: NavItem[] = [
  {
    href: "/admin",
    label: "Overview",
    exact: true,
    icon: (
      <Icon>
        <path d="M12 3.5 19 6v5.4c0 4.2-2.9 7.6-7 9.1-4.1-1.5-7-4.9-7-9.1V6l7-2.5Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      </Icon>
    ),
  },
  {
    href: "/admin/customers",
    label: "Customers",
    icon: (
      <Icon>
        <circle cx="9" cy="8.5" r="3.5" stroke="currentColor" strokeWidth="1.7" />
        <path d="M2.5 20c1.2-3.2 3.6-4.9 6.5-4.9s5.3 1.7 6.5 4.9" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        <path d="M16.5 5.4a3.2 3.2 0 0 1 0 6.2M18 15.4c2 .5 3.2 2 3.8 4.1" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </Icon>
    ),
  },
  {
    href: "/admin/accounts",
    label: "Investor Accounts",
    icon: (
      <Icon>
        <rect x="3" y="6" width="18" height="13" rx="3" stroke="currentColor" strokeWidth="1.7" />
        <path d="M3 10.5h18" stroke="currentColor" strokeWidth="1.7" />
        <path d="M7 15.5h4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </Icon>
    ),
  },
  {
    href: "/admin/products",
    label: "Investment Products",
    icon: (
      <Icon>
        <rect x="4" y="4" width="16" height="16" rx="2.5" stroke="currentColor" strokeWidth="1.7" />
        <path d="M8 9h8M8 13h8M8 17h4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </Icon>
    ),
  },
  {
    href: "/admin/deposits",
    label: "Deposits",
    icon: (
      <Icon>
        <path d="M12 4v10m0 0 3.5-3.5M12 14 8.5 10.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M4 18h16" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </Icon>
    ),
  },
  {
    href: "/admin/withdrawals",
    label: "Withdrawals",
    icon: (
      <Icon>
        <path d="M12 18V8m0 0 3.5 3.5M12 8 8.5 11.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M4 5h16" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </Icon>
    ),
  },
  {
    href: "/admin/transactions",
    label: "Transactions",
    icon: (
      <Icon>
        <path d="M4 8h13l-3-3M20 16H7l3 3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      </Icon>
    ),
  },
  {
    href: "/admin/orders",
    label: "Orders",
    icon: (
      <Icon>
        <path d="M5 6h14l-1.4 11.5H6.4z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
        <path d="M9 6a3 3 0 0 1 6 0" stroke="currentColor" strokeWidth="1.7" />
      </Icon>
    ),
  },
  {
    href: "/admin/kyc",
    label: "KYC Verification",
    icon: (
      <Icon>
        <rect x="4" y="3.5" width="16" height="17" rx="2.5" stroke="currentColor" strokeWidth="1.7" />
        <circle cx="9.5" cy="10" r="2.2" stroke="currentColor" strokeWidth="1.7" />
        <path d="M6.5 16c.7-1.7 1.7-2.5 3-2.5s2.3.8 3 2.5M14 9h4M14 13h4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </Icon>
    ),
  },
  {
    href: "/admin/portfolios",
    label: "Portfolio Management",
    icon: (
      <Icon>
        <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.7" />
        <path d="M12 7v5l3 2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </Icon>
    ),
  },
  {
    href: "/admin/market-data",
    label: "Market Data",
    icon: (
      <Icon>
        <path d="M4 17.5 9 11l3.5 3.2L20 6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M15.5 6H20v4.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      </Icon>
    ),
  },
  {
    href: "/admin/referrals",
    label: "Referrals",
    icon: (
      <Icon>
        <circle cx="8" cy="9" r="3" stroke="currentColor" strokeWidth="1.7" />
        <path d="M2.5 19c1-3 3-4.4 5.5-4.4s4.5 1.4 5.5 4.4M16 6.5 20 10m0-3.5L16 10" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </Icon>
    ),
  },
  {
    href: "/admin/support",
    label: "Support Tickets",
    icon: (
      <Icon>
        <path d="M4 5.5h16v11H9l-5 4z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      </Icon>
    ),
  },
  {
    href: "/admin/notifications",
    label: "Notifications",
    icon: (
      <Icon>
        <path d="M6 9a6 6 0 0 1 12 0v4l2 3H4l2-3V9Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      </Icon>
    ),
  },
  {
    href: "/admin/reports",
    label: "Reports",
    icon: (
      <Icon>
        <path d="M6 3.5h8l4 4v13H6z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
        <path d="M9 12h6M9 16h6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </Icon>
    ),
  },
  {
    href: "/admin/staff",
    label: "Staff Management",
    icon: (
      <Icon>
        <circle cx="9" cy="8.5" r="3.3" stroke="currentColor" strokeWidth="1.7" />
        <path d="M3 19c1.2-3.2 3.4-4.8 6-4.8s4.8 1.6 6 4.8M17 8h4M19 6v4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </Icon>
    ),
  },
  {
    href: "/admin/roles",
    label: "Roles & Permissions",
    icon: (
      <Icon>
        <path d="M12 3.5 19 6v5.4c0 4.2-2.9 7.6-7 9.1-4.1-1.5-7-4.9-7-9.1V6l7-2.5Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
        <path d="M9 12h6M12 9v6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </Icon>
    ),
  },
  {
    href: "/admin/audit",
    label: "Audit Logs",
    icon: (
      <Icon>
        <path d="M4 4.5h16v15H4z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
        <path d="M8 9h8M8 13h8M8 17h4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </Icon>
    ),
  },
  {
    href: "/admin/settings",
    label: "Platform Settings",
    icon: (
      <Icon>
        <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.7" />
        <path d="M12 3.5v2M12 18.5v2M3.5 12h2M18.5 12h2M6 6l1.4 1.4M16.6 16.6 18 18M18 6l-1.4 1.4M7.4 16.6 6 18" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </Icon>
    ),
  },
  {
    href: "/admin/investments",
    label: "Investments",
    icon: (
      <Icon>
        <path d="M4 17.5 9 11l3.5 3.2L20 6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M15.5 6H20v4.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      </Icon>
    ),
  },
  {
    href: "/admin/wallet-requests",
    label: "Wallet requests",
    icon: (
      <Icon>
        <rect x="3" y="6" width="18" height="13" rx="3" stroke="currentColor" strokeWidth="1.7" />
        <path d="M3 10.5h18" stroke="currentColor" strokeWidth="1.7" />
        <path d="m14 16 2.5-2.5L19 16" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      </Icon>
    ),
  },
  {
    href: "/admin/enquiries",
    label: "Enquiries",
    icon: (
      <Icon>
        <path d="M3.5 6.5h17v11h-17z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
        <path d="m3.5 7.5 8.5 6 8.5-6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      </Icon>
    ),
  },
];

const AREA: Record<Area, { nav: NavItem[]; label: string }> = {
  customer: { nav: CUSTOMER_NAV, label: "Customer area" },
  admin: { nav: ADMIN_NAV, label: "Operations" },
};

export default function DashboardShell({
  user,
  area = "customer",
  showAdminLink = false,
  children,
}: {
  user: ShellUser;
  area?: Area;
  showAdminLink?: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem("lucid-sidebar-collapsed") === "true");
    } catch {
      // Keep the expanded navigation when storage is unavailable.
    }
  }, []);

  function toggleCollapsed() {
    setCollapsed((current) => {
      const next = !current;
      try {
        window.localStorage.setItem("lucid-sidebar-collapsed", String(next));
      } catch {
        // The control still works for this session when storage is unavailable.
      }
      return next;
    });
  }
  const { nav, label } = AREA[area];
  const crossLink: NavItem | null =
    area === "admin"
      ? {
          href: "/dashboard",
          label: "Customer view",
          icon: (
            <Icon>
              <path d="M14 5H6a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
              <path d="M20 4v5h-5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
            </Icon>
          ),
        }
      : showAdminLink
        ? {
            href: "/admin",
            label: "Admin console",
            icon: (
              <Icon>
                <path d="M12 3.5 19 6v5.4c0 4.2-2.9 7.6-7 9.1-4.1-1.5-7-4.9-7-9.1V6l7-2.5Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
              </Icon>
            ),
          }
        : null;
  const items = crossLink ? [...nav, crossLink] : nav;

  function isActive(item: NavItem) {
    return item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
  }

  async function signOut() {
    setBusy(true);
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
    } finally {
      router.replace("/login");
      router.refresh();
      setBusy(false);
    }
  }

  return (
    <div className={`${styles.shell} ${collapsed ? styles.shellCollapsed : ""}`}>
      {mobileOpen && <button type="button" className={styles.mobileBackdrop} aria-label="Close navigation" onClick={() => setMobileOpen(false)} />}
      <aside className={`${styles.sidebar} ${mobileOpen ? styles.sidebarOpen : ""}`}>
        <div className={styles.sidebarTop}>
          <Link href="/" className={styles.brand} aria-label="Lucid Global Invest home">
            <Image
              src="/assets/images/resources/lucid-global-invest-logo.png"
              alt="Lucid Global Invest"
              width={142}
              height={71}
              className={styles.brandImage}
              priority
            />
          </Link>
          <button type="button" className={styles.collapseButton} onClick={toggleCollapsed} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} aria-expanded={!collapsed} title={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
            {collapsed ? <PanelLeftOpen size={19} /> : <PanelLeftClose size={19} />}
          </button>
          <button type="button" className={styles.mobileClose} onClick={() => setMobileOpen(false)} aria-label="Close navigation"><X size={20} /></button>
        </div>

        <p className={styles.navLabel}>{label}</p>
        <nav className={styles.nav} aria-label={area === "admin" ? "Admin" : "Dashboard"}>
          {items.map((item) => {
            const active = isActive(item);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`${styles.navItem} ${active ? styles.navItemActive : ""}`}
                aria-current={active ? "page" : undefined}
                title={collapsed ? item.label : undefined}
                onClick={() => setMobileOpen(false)}
              >
                <span className={styles.navIcon}>{item.icon}</span>
                <span className={styles.navText}>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className={styles.sidebarFooter}>
          <div className={styles.userBlock}>
            <span className={styles.userName}>{user.name}</span>
            <span className={styles.userEmail}>{user.email}</span>
          </div>
          <button type="button" className={styles.signOut} onClick={signOut} disabled={busy}>
            <span className={styles.signOutText}>{busy ? "Signing out…" : "Sign out"}</span>
          </button>
        </div>
      </aside>

      <div className={styles.main}>
        <header className={styles.mobileHeader}>
          <button type="button" className={styles.mobileMenuButton} onClick={() => setMobileOpen(true)} aria-label="Open navigation" aria-expanded={mobileOpen}><Menu size={21} /></button>
          <span className={styles.mobileHeaderTitle}>LucidInvest</span>
          <span className={styles.mobileHeaderArea}>{label}</span>
        </header>
        <div className={styles.content}>{children}</div>
      </div>
    </div>
  );
