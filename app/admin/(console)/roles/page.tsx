import PageHeader, { EmptyState } from "@/components/dashboard/PageHeader";
import JsonForm from "@/components/forms/JsonForm";
import styles from "@/components/dashboard/dashboard.module.css";
import { requireAdmin } from "@/lib/auth";
import { listPermissions, listRoles } from "@/lib/admin-platform";

export const dynamic = "force-dynamic";

export default async function AdminRolesPage() {
  await requireAdmin();
  const [roles, permissions] = await Promise.all([listRoles(), listPermissions()]);

  return (
    <>
      <PageHeader
        eyebrow="Access control"
        title="Roles & permissions"
        lead="Define reusable permission sets and attach them to staff accounts. Permissions are checked in every write route, not only in the interface."
      />

      <section className={styles.panel} aria-labelledby="role-list">
        <h2 id="role-list" className={styles.panelTitle}>{roles.length} roles</h2>
        {roles.length === 0 ? (
          <EmptyState title="No roles" text="Create a permission role below." />
        ) : (
          <div className={`${styles.tableWrap} ${styles.tableStacked}`}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Role</th>
                  <th scope="col">Members</th>
                  <th scope="col">Permissions</th>
                </tr>
              </thead>
              <tbody>
                {roles.map((role) => (
                  <tr key={role.id}>
                    <td data-label="Role">
                      <div>{role.name}</div>
                      <div className={styles.muted}>{role.description || "—"}</div>
                    </td>
                    <td data-label="Members">{role.members}</td>
                    <td data-label="Permissions" className={styles.muted}>
                      {role.permissions.length ? role.permissions.join(", ") : "No permissions"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className={styles.panel} aria-labelledby="create-role">
        <h2 id="create-role" className={styles.panelTitle}>Create or update a role</h2>
        <JsonForm
          endpoint="/api/admin/roles"
          fields={[
            { name: "name", label: "Role name", required: true },
            { name: "description", label: "Description", placeholder: "What this role is for" },
            {
              name: "permissions",
              label: "Permissions",
              type: "multiselect",
              options: permissions.map((permission) => ({
                value: permission.code,
                label: `${permission.label} (${permission.category})`,
              })),
            },
          ]}
          submitLabel="Save role"
          successText="Role saved."
        />
        <p className={styles.hint}>
          Saving a role with an existing name replaces its description and permissions. Staff already assigned keep the
          updated permission set immediately.
        </p>
      </section>

      <p className={styles.notice}>
        Administrator accounts without an explicit role retain full access so a new deployment cannot lock itself out.
        Assign an explicit role once your team is set up.
      </p>
    </>
  );
}
