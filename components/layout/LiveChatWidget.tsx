"use client";
import { useEffect } from "react";
type Provider="tawk"|"crisp"|"intercom"|"chatwoot";
type ChatConfig={enabled:boolean;provider:Provider;siteId:string;siteUrl:string};
declare global { interface Window { Tawk_API?:Record<string,unknown>;Tawk_LoadStart?:Date;$crisp?:unknown[];CRISP_WEBSITE_ID?:string;intercomSettings?:Record<string,unknown>;chatwootSettings?:Record<string,unknown>;chatwootSDK?:{run:(config:{websiteToken:string;baseUrl:string})=>void}; } }
export default function LiveChatWidget(){
 useEffect(()=>{let cancelled=false;let script:HTMLScriptElement|null=null;
  function inject(src:string,provider:string){if(document.querySelector('script[data-lucid-live-chat="true"]'))return;script=document.createElement("script");script.async=true;script.src=src;script.dataset.lucidLiveChat="true";script.dataset.provider=provider;script.onerror=()=>script?.remove();document.head.appendChild(script);}
  async function load(){try{const response=await fetch("/api/live-chat/config",{cache:"no-store"});if(!response.ok)return;const config=await response.json() as ChatConfig;if(cancelled||!config.enabled)return;
   if(config.provider==="tawk"){const [property,widget]=config.siteId.split("/");if(!/^[a-f0-9]{16,64}$/i.test(property||"")||!/^[a-z0-9]{6,64}$/i.test(widget||""))return;window.Tawk_API=window.Tawk_API||{};window.Tawk_LoadStart=new Date();inject("https://embed.tawk.to/"+property+"/"+widget,"tawk");}
   else if(config.provider==="crisp"){if(!/^[a-f0-9-]{20,40}$/i.test(config.siteId))return;window.$crisp=[];window.CRISP_WEBSITE_ID=config.siteId;inject("https://client.crisp.chat/l.js","crisp");}
   else if(config.provider==="intercom"){if(!/^[a-z0-9]{6,16}$/i.test(config.siteId))return;window.intercomSettings={app_id:config.siteId};inject("https://widget.intercom.io/widget/"+encodeURIComponent(config.siteId),"intercom");}
   else if(config.provider==="chatwoot"){let base:URL;try{base=new URL(config.siteUrl);}catch{return;}if(base.protocol!=="https:"||!/^[a-z0-9_-]{8,128}$/i.test(config.siteId))return;window.chatwootSettings={websiteToken:config.siteId,baseUrl:base.origin};inject(base.origin+"/packs/js/sdk.js","chatwoot");script?.addEventListener("load",()=>{if(!cancelled)window.chatwootSDK?.run({websiteToken:config.siteId,baseUrl:base.origin});},{once:true});}
  }catch{/* Optional widget: never block the application. */}}
  void load();return()=>{cancelled=true;};
 },[]);return null;
}