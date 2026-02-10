import createDOMPurify from "dompurify";
import { JSDOM } from "jsdom";

const window = new JSDOM("").window;
const DOMPurify = createDOMPurify(window);

/**
 * Sanitize user input to prevent XSS
 */
export function sanitize(input) {
  if (!input) return "";

  // Remove HTML tags and dangerous content
  const clean = DOMPurify.sanitize(input, {
    ALLOWED_TAGS: [], // No HTML allowed
    ALLOWED_ATTR: [],
  });

  // Trim and limit length
  return clean.trim().substring(0, 500);
}
