import { useEffect } from "react";

export interface PageMetaInput {
  title: string;
  description: string;
  canonical: string;
  ogImage?: string;
  ogType?: string;
  jsonLd?: unknown[];
}

function upsertMeta(selector: string, attributes: Record<string, string>) {
  let element = document.head.querySelector(selector) as HTMLMetaElement | HTMLLinkElement | null;
  const created = !element;
  if (!element) {
    element = document.createElement(selector.startsWith("link") ? "link" : "meta");
    document.head.appendChild(element);
  }
  for (const [key, value] of Object.entries(attributes)) {
    element.setAttribute(key, value);
  }
  return { element, created };
}

export function usePageMeta({
  title,
  description,
  canonical,
  ogImage,
  ogType,
  jsonLd,
}: PageMetaInput) {
  const jsonLdSerialized = JSON.stringify(jsonLd ?? []);

  useEffect(() => {
    const previousTitle = document.title;
    document.title = title;
    const payloads = JSON.parse(jsonLdSerialized) as unknown[];

    const applied: Array<{ element: Element; created: boolean; previous?: string | null }> = [];

    const pairs: Array<[string, Record<string, string>]> = [
      ['meta[name="description"]', { name: "description", content: description }],
      ['link[rel="canonical"]', { rel: "canonical", href: canonical }],
      ['meta[property="og:title"]', { property: "og:title", content: title }],
      ['meta[property="og:description"]', { property: "og:description", content: description }],
      ['meta[property="og:url"]', { property: "og:url", content: canonical }],
      ['meta[property="og:type"]', { property: "og:type", content: ogType ?? "website" }],
      [
        'meta[name="twitter:card"]',
        { name: "twitter:card", content: ogImage ? "summary_large_image" : "summary" },
      ],
      ['meta[name="twitter:title"]', { name: "twitter:title", content: title }],
      ['meta[name="twitter:description"]', { name: "twitter:description", content: description }],
    ];

    if (ogImage) {
      pairs.push(
        ['meta[property="og:image"]', { property: "og:image", content: ogImage }],
        ['meta[name="twitter:image"]', { name: "twitter:image", content: ogImage }],
      );
    }

    for (const [selector, attributes] of pairs) {
      const existing = document.head.querySelector(selector);
      const previous = existing?.getAttribute("content") ?? existing?.getAttribute("href") ?? null;
      const result = upsertMeta(selector, attributes);
      applied.push({ ...result, previous });
    }

    const jsonScripts: HTMLScriptElement[] = [];
    for (const payload of payloads) {
      const script = document.createElement("script");
      script.type = "application/ld+json";
      script.dataset.pageMeta = "true";
      script.text = JSON.stringify(payload);
      document.head.appendChild(script);
      jsonScripts.push(script);
    }

    return () => {
      document.title = previousTitle;
      for (const item of applied) {
        if (item.created) {
          item.element.remove();
          continue;
        }
        if (item.previous == null) continue;
        if (item.element instanceof HTMLLinkElement) {
          item.element.setAttribute("href", item.previous);
        } else {
          item.element.setAttribute("content", item.previous);
        }
      }
      for (const script of jsonScripts) {
        script.remove();
      }
    };
  }, [title, description, canonical, ogImage, ogType, jsonLdSerialized]);
}
