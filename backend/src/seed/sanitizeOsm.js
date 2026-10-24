// Keep only what the seed needs. OSM business nodes often carry phone numbers, emails and
// WhatsApp contacts, which must not be republished in this repository.
const ALLOWED_KEYS = new Set(['name', 'cuisine']);
const ADDRESS_PREFIX = 'addr:';
const CONTACT_PATTERN = /phone|mobile|email|fax|whatsapp|website|contact/i;

const isAllowedTag = (key) =>
  !CONTACT_PATTERN.test(key) && (ALLOWED_KEYS.has(key) || key.startsWith(ADDRESS_PREFIX));

export function sanitizeElement(element) {
  const tags = Object.fromEntries(Object.entries(element.tags ?? {}).filter(([key]) => isAllowedTag(key)));
  return { type: element.type, id: element.id, tags };
}
