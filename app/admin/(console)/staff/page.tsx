import PageHeader, { EmptyState, StatusBadge } from "@/components/dashboard/PageHeader";
import JsonForm from "@/components/forms/JsonForm";
import styles from "@/components/dashboard/dashboard.module.css";
import { requireAdmin } from "@/lib/auth";
import { getAdminCustomers } from "@/lib/admin";
import { listRoles, listStaff } from "@/lib/admin-platform";
import { formatDateTime } from "@/lib/dashboard";

export const dynamic = "force-dynamic";

export default async function AdminStaffPage() {
  await requireAdmin();
  const [staff, users, roles] = await Promise.all([listStaff(), getAdminCustomers(200), listRoles()]);

  return (
    <>
      <PageHeader
        eyebrow="People"
        title="Staff management"
        lead="Grant or remove console access and attach a permission role. The platform always keeps at least one administrator."
      />

      <section className={styles.panel} aria-labelledby="staff-list">
        <h2 id="staff-list" className={styles.panelTitle}>Staff accounts</h2>
        {staff.length === 0 ? (
          <EmptyState title="No staff accounts" text="Promote an existing account below." />
        ) : (
          <div className={`${styles.tableWrap} ${styles.tableStacked}`}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Staff member</th>
                  <th scope="col">Access</th>
                  <th scope="col">Permission role</th>
                  <th scope="col">Status</th>
                  <th scope="col">Last sign-in</th>
                </tr>
              </thead>
              <tbody>
                {staff.map((member) => (
                  <tr key={member.id}>
                    <td data-label="Staff member">
                      <div>{member.name}</div>
                      <div className={styles.muted}>{member.email}</div>
                    </td>
                    <td data-label="Access" style={{ textTransform: "capitalize" }}>{member.role}</td>
                    <td data-label="Permission role">{member.roleName ?? <span className={styles.muted}>Full access (bootstrap)</span>}</td>
                    <td data-label="Status"><StatusBadge status={member.status} /></td>
                    <td data-label="Last sign-in">{member.lastLoginAt ? formatDateTime(member.lastLoginAt) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className={styles.panel} aria-labelledby="grant-access">
        <h2 id="grant-access" className={styles.panelTitle}>Change an account&apos;s access</h2>
        <JsonForm
          endpoint="/api/admin/staff"
          method="PATCH"
          fields={[
            {
              name: "userId",
              label: "Account",
              type: "select",
              required: true,
              options: users.map((user) => ({ value: user.id, label: `${user.full_name} · ${user.email}` })),
            },
            {
              name: "role",
              label: "Access level",
              type: "select",
              required: true,
              options: [
                { value: "compliance", label: "Compliance staff" },
                { value: "admin", label: "Administrator" },
                { value: "customer", label: "Customer (remove console access)" },
              ],
            },
            {
              name: "adminRoleId",
              label: "Permission role",
              type: "select",
              options: roles.map((role) => ({ value: role.id, label: role.name })),
              help: "Leave blank for full access on an administrator, or the default compliance set for compliance staff.",
            },
          ]}
          submitLabel="Apply access change"
          successText="Access updated and recorded in the audit log."
          confirmText="Apply this access change? It takes effect immediately."
        />
      </section>

      <p className={styles.notice}>
        Staff access is never self-service for customers: an administrator makes every change here and it is audited.
        Demoting the last administrator is refused.
      </p>
    </>
  );
}
