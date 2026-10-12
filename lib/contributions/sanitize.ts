import sanitizeHtml from 'sanitize-html'

// Task briefs come from the dashboard rich-text editor and are shown to
// members, so they are cleaned on the server before they are stored. The
// allowlist matches what components/editor/RichTextEditor.tsx can produce;
// anything else (scripts, event handlers, javascript: links, foreign iframes,
// arbitrary styles) is dropped.
const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    'p', 'br', 'hr', 'h1', 'h2', 'h3', 'h4', 'strong', 'b', 'em', 'i', 'u', 's', 'code', 'pre',
    'blockquote', 'ul', 'ol', 'li', 'a', 'span', 'mark', 'img', 'iframe', 'div',
    'table', 'thead', 'tbody', 'tr', 'th', 'td', 'colgroup', 'col',
  ],
  allowedAttributes: {
    a: ['href', 'target', 'rel'],
    img: ['src', 'alt', 'title'],
    iframe: ['src', 'width', 'height', 'allowfullscreen', 'frameborder'],
    td: ['colspan', 'rowspan'],
    th: ['colspan', 'rowspan'],
    '*': ['style', 'class'],
  },
  allowedStyles: {
    '*': {
      color: [/^#[0-9a-f]{3,8}$/i, /^rgba?\([\d\s,.%]+\)$/i],
      'background-color': [/^#[0-9a-f]{3,8}$/i, /^rgba?\([\d\s,.%]+\)$/i],
      'text-align': [/^(left|right|center|justify)$/],
    },
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  allowedSchemesByTag: { img: ['http', 'https'], iframe: ['https'] },
  allowedIframeHostnames: ['www.youtube.com', 'www.youtube-nocookie.com', 'youtube.com'],
  transformTags: {
    a: sanitizeHtml.simpleTransform('a', { target: '_blank', rel: 'noopener noreferrer' }),
  },
}

export function sanitizeBrief(html: string): string {
  return sanitizeHtml(html, OPTIONS).trim()
}

/** Plain text of a brief, e.g. for the review service's `task_brief`. */
export function briefToText(html: string): string {
  return sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} })
    .replace(/&nbsp;|\u00a0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .trim()
}
