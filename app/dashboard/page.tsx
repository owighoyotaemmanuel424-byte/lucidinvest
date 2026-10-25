import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import DashboardSignOut from "@/components/auth/DashboardSignOut";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return (
    <main style={{minHeight:"100vh",background:"#f4f7fb",padding:"clamp(20px,5vw,56px)",color:"#17233b"}}>
      <section style={{maxWidth:900,margin:"0 auto"}}>
        <header style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:16,flexWrap:"wrap",marginBottom:36}}>
          <a href="/" style={{fontSize:24,fontWeight:800,color:"#153c75",textDecoration:"none"}}>LucidInvest</a>
          <DashboardSignOut />
        </header>
        <p style={{fontSize:12,letterSpacing:2,fontWeight:800,color:"#426bb0"}}>CUSTOMER OVERVIEW</p>
        <h1 style={{fontSize:"clamp(28px,5vw,40px)",margin:"8px 0"}}>Welcome, {user.full_name}</h1>
        <p style={{color:"#667085"}}>You are signed in as {user.email}.</p>
        <div style={{marginTop:28,padding:24,borderRadius:16,background:"#fff",border:"1px solid #e2e8f0"}}>
          <h2 style={{marginTop:0}}>Account status</h2>
          <p>Your login session is active. Investment and money-movement features remain unavailable until they have been separately reviewed and enabled.</p>
          <p style={{fontSize:13,color:"#667085"}}>Role: {user.role} · Account: {user.status}</p>
        </div>
      </section>
    </main>
  );
}
