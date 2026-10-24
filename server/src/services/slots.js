import { MS_PER_MINUTE, TZ_OFFSET_MINUTES } from '../constants.js';

const MINUTES_PER_HOUR = 60;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const toMinutes = (hhmm) => {
  const [hours, minutes] = hhmm.split(':').map(Number);
  return hours * MINUTES_PER_HOUR + minutes;
};

const pad = (value) => String(value).padStart(2, '0');

export const toHHmm = (total) => `${pad(Math.floor(total / MINUTES_PER_HOUR))}:${pad(total % MINUTES_PER_HOUR)}`;

export function generateSlots(openTime, closeTime, slotMinutes) {
  const close = toMinutes(closeTime);
  const slots = [];
  for (let start = toMinutes(openTime); start + slotMinutes <= close; start += slotMinutes) {
    slots.push(toHHmm(start));
  }
  return slots;
}

export const isOnGrid = (slotStart, { openTime, closeTime, slotMinutes }) =>
  generateSlots(openTime, closeTime, slotMinutes).includes(slotStart);

export function slotInstant(date, slotStart) {
  const [year, month, day] = date.split('-').map(Number);
  const utcMs = Date.UTC(year, month - 1, day, 0, toMinutes(slotStart));
  return new Date(utcMs - TZ_OFFSET_MINUTES * MS_PER_MINUTE);
}

export const localDateString = (now) =>
  new Date(now.getTime() + TZ_OFFSET_MINUTES * MS_PER_MINUTE).toISOString().slice(0, 10);

export function isValidDateString(value) {
  if (typeof value !== 'string' || !DATE_PATTERN.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}
