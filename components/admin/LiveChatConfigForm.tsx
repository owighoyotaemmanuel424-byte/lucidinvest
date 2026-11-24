"use client";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "@/components/dashboard/dashboard.module.css";
type Provider = "tawk" | "crisp" | "intercom" | "chatwoot";
type Config = { enabled: boolean; provider: Provider; siteId: string; siteUrl: string };
const PROVIDERS = [
 { value:"tawk",label:"Tawk.to",description:"Hosted live chat and agent inbox.",idLabel:"Property ID / Widget ID",placeholder:"propertyId/widgetId" },
 { value:"crisp",label:"Crisp",description:"Crisp website chat inbox.",idLabel:"Website ID",placeholder:"Your Crisp Website ID" },
 { value:"intercom",label:"Intercom",description:"Intercom Messenger for customer support.",idLabel:"App ID",placeholder:"Your Intercom App ID" },
 { value:"chatwoot",label:"Chatwoot",description:"Open-source support inbox, cloud or self-hosted.",idLabel:"Website Token",placeholder:"Your Chatwoot Website Token",urlLabel:"Chatwoot base URL" },
] as const;
export default function LiveChatConfigForm({initial}:{initial:Config}) {
 const router=useRouter(); const [config,setConfig]=useState(initial); const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState<{tone:"ok"|"error";text:string}|null>(null);
 const selected=PROVIDERS.find(p=>p.value===config.provider)??PROVIDERS[0];
 async function submit(event:FormEvent<HTMLFormElement>){event.preventDefault();setBusy(true);setMessage(null);
  try{const response=await fetch("/api/admin/live-chat",{method:"PATCH",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify(config)});
   const body=await response.json().catch(()=>({})); if(!response.ok){setMessage({tone:"error",text:body.error||"Unable to save live chat settings."});return;}
   setMessage({tone:"ok",text:"Live chat settings saved. The selected provider loads on the next page visit."});router.refresh();
  }catch{setMessage({tone:"error",text:"Connection problem. Please try again."});}finally{setBusy(false);}}
 return <form className={styles.form} onSubmit={submit}>
  <div className={styles.notice}>Choose the provider connected to your support team and enter its public website embed identifier. Never enter passwords or private API keys here.</div>
  <div className={styles.field}><label className={styles.label} htmlFor="live-chat-enabled"><input id="live-chat-enabled" type="checkbox" checked={config.enabled} disabled={busy} onChange={e=>setConfig(v=>({...v,enabled:e.target.checked}))}/> Enable live chat on the website</label></div>
  <div className={styles.formGrid}>
   <div className={styles.field}><label className={styles.label} htmlFor="live-chat-provider">Chat provider</label><select id="live-chat-provider" className={styles.input} value={config.provider} disabled={busy} onChange={e=>setConfig(v=>({...v,provider:e.target.value as Provider,siteId:"",siteUrl:""}))}>{PROVIDERS.map(p=><option key={p.value} value={p.value}>{p.label}</option>)}</select><p className={styles.hint}>{selected.description}</p></div>
   <div className={styles.field}><label className={styles.label} htmlFor="live-chat-site-id">{selected.idLabel}</label><input id="live-chat-site-id" className={styles.input} value={config.siteId} disabled={busy} placeholder={selected.placeholder} required maxLength={160} onChange={e=>setConfig(v=>({...v,siteId:e.target.value.trim()}))}/>{config.provider==="tawk"&&<p className={styles.hint}>Enter Property ID and Widget ID separated by a slash.</p>}</div>
   {"urlLabel" in selected&&<div className={styles.field}><label className={styles.label} htmlFor="live-chat-site-url">{selected.urlLabel}</label><input id="live-chat-site-url" type="url" className={styles.input} value={config.siteUrl} disabled={busy} placeholder="https://app.chatwoot.com" required maxLength={300} onChange={e=>setConfig(v=>({...v,siteUrl:e.target.value.trim()}))}/></div>}
  </div><div className={styles.formActions}><button className={styles.cta} type="submit" disabled={busy}>{busy?"Saving…":"Save live chat settings"}</button>{message&&<p className={message.tone==="ok"?styles.formOk:styles.formError} role="status">{message.text}</p>}</div>
 </form>;
}