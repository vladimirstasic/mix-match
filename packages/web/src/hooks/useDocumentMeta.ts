import { useEffect } from 'react';

function setMetaTag(name: string, content: string, attr: 'name' | 'property' = 'name') {
  let tag = document.querySelector<HTMLMetaElement>(`meta[${attr}="${name}"]`);
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute(attr, name);
    document.head.appendChild(tag);
  }
  tag.setAttribute('content', content);
}

// Sets the browser tab title + OG/Twitter description for pages whose content
// (a specific shared tracklist or DJ profile) isn't known at static-HTML time.
// Crawlers that don't execute JS (Discord/Slack/etc. link unfurlers) still see
// the static index.html tags — that needs a server-side fix, this only covers
// the browser tab and JS-executing crawlers (Google, Twitter/X).
export function useDocumentMeta(title: string, description?: string) {
  useEffect(() => {
    const prevTitle = document.title;
    document.title = title;
    setMetaTag('og:title', title, 'property');
    setMetaTag('twitter:title', title);

    if (description) {
      setMetaTag('description', description);
      setMetaTag('og:description', description, 'property');
      setMetaTag('twitter:description', description);
    }

    return () => {
      document.title = prevTitle;
    };
  }, [title, description]);
}
