import { pickTemplate, titleCaseCuisine } from './cuisine.js';

const DEFAULT_OPEN_TIME = '11:00';
const DEFAULT_CLOSE_TIME = '23:00';
const DEFAULT_SLOT_MINUTES = 60;
const MAX_NAME = 80;
const MAX_AREA = 60;
const MAX_ADDRESS = 160;
const MAX_CUISINE = 40;

const clean = (value) => String(value ?? '').trim();

export function mapOsmElement(element) {
  const tags = element?.tags ?? {};
  const name = clean(tags.name);
  if (!name || !element?.type || element?.id === undefined || element?.id === null) return null;

  const area = clean(tags['addr:suburb']) || clean(tags['addr:neighbourhood']);
  const street = [clean(tags['addr:housenumber']), clean(tags['addr:street'])].filter(Boolean).join(' ');
  const address = [street, area].filter(Boolean).join(', ') || 'Bangalore';
  const cuisineTag = clean(tags.cuisine);

  return {
    externalId: `${element.type}/${element.id}`,
    name: name.slice(0, MAX_NAME),
    area: area.slice(0, MAX_AREA),
    address: address.slice(0, MAX_ADDRESS),
    cuisine: titleCaseCuisine(cuisineTag).slice(0, MAX_CUISINE),
    cuisineKey: pickTemplate(cuisineTag),
    city: 'Bangalore',
    openTime: DEFAULT_OPEN_TIME,
    closeTime: DEFAULT_CLOSE_TIME,
    slotMinutes: DEFAULT_SLOT_MINUTES,
    source: 'osm',
    isSample: true,
  };
}
