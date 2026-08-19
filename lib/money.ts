export function agorotToShekels(agorot: number): number {
  return agorot / 100;
}

export function shekelsToAgorot(shekels: number): number {
  return Math.round(shekels * 100);
}

export function formatAgorotAsILS(agorot: number, locale: string = "en"): string {
  return new Intl.NumberFormat(locale === "he" ? "he-IL" : "en-IL", {
    style: "currency",
    currency: "ILS",
    minimumFractionDigits: agorot % 100 === 0 ? 0 : 2,
  }).format(agorotToShekels(agorot));
}
