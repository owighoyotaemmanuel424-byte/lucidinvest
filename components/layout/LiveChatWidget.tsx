"use client";

import { useEffect } from "react";

type ChatConfig = { enabled: boolean; provider: "tawk"; propertyId: string; widgetId: string };

export default function LiveChatWidget() {
  useEffect(() => {
    let cancelled = false;
    let script: HTMLScriptElement | null = null;

    async function load() {
      try {
        const response = await fetch("/api/live-chat/config", { cache: "no-store" });
        if (!response.ok) return;
        const config = (await response.json()) as ChatConfig;
        if (cancelled || !config.enabled || config.provider !== "tawk") return;
        if (!/^[a-f0-9]{16,64}$/i.test(config.propertyId) || !/^[a-z0-9]{6,64}$/i.test(config.widgetId)) return;
        if (document.querySelector('script[data-lucid-live-chat="true"]')) return;

        const w = window as Window & { Tawk_API?: Record<string, unknown>; Tawk_LoadStart?: Date };
        w.Tawk_API = w.Tawk_API || {};
        w.Tawk_LoadStart = new Date();
        script = document.createElement("script");
        script.async = true;
        script.src = `https://embed.tawk.to/${config.propertyId}/${config.widgetId}`;
        script.charset = "UTF-8";
        script.setAttribute("crossorigin", "*");
        script.dataset.lucidLiveChat = "true";
        document.head.appendChild(script);
      } catch {
        // Live chat is an optional enhancement; never block the main application.
      }
    }

    void load();
    return () => { cancelled = true; };
  }, []);

  return null;
}
