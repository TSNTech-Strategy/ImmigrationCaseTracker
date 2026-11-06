/**
 * The U.S. Department of State's monthly Visa Bulletin: reference data for
 * CasePingo's how-to-read guide. CasePingo doesn't copy the dates; people read
 * them on the official page (STATE_BULLETIN_URL).
 */

/** The official bulletin, published by the U.S. Department of State every month. */
export const STATE_BULLETIN_URL = "https://travel.state.gov/content/travel/en/legal/visa-law0/visa-bulletin.html";

/** USCIS's monthly page saying which chart applies for adjustment of status. */
export const USCIS_CHARTS_URL = "https://www.uscis.gov/green-card/green-card-processes-and-procedures/visa-availability-priority-dates/adjustment-of-status-filing-charts-from-the-visa-bulletin";

export type Kind = "family" | "employment";

export type CategoryInfo = { key: string; kind: Kind; code: string; en: string; es: string };

export const CATEGORIES: CategoryInfo[] = [
  { key: "F1", kind: "family", code: "F1", en: "Unmarried sons and daughters (21+) of U.S. citizens", es: "Hijos solteros (21+) de ciudadanos de EE. UU." },
  { key: "F2A", kind: "family", code: "F2A", en: "Spouses and children (under 21) of green card holders", es: "Cónyuges e hijos (menores de 21) de residentes permanentes" },
  { key: "F2B", kind: "family", code: "F2B", en: "Unmarried sons and daughters (21+) of green card holders", es: "Hijos solteros (21+) de residentes permanentes" },
  { key: "F3", kind: "family", code: "F3", en: "Married sons and daughters of U.S. citizens", es: "Hijos casados de ciudadanos de EE. UU." },
  { key: "F4", kind: "family", code: "F4", en: "Brothers and sisters of adult U.S. citizens", es: "Hermanos de ciudadanos adultos de EE. UU." },
  { key: "EB1", kind: "employment", code: "EB-1", en: "Priority workers", es: "Trabajadores prioritarios" },
  { key: "EB2", kind: "employment", code: "EB-2", en: "Advanced degrees or exceptional ability", es: "Títulos avanzados o habilidad excepcional" },
  { key: "EB3", kind: "employment", code: "EB-3", en: "Skilled workers and professionals", es: "Trabajadores calificados y profesionales" },
  { key: "EW", kind: "employment", code: "EB-3 OW", en: "Other workers", es: "Otros trabajadores" },
  { key: "EB4", kind: "employment", code: "EB-4", en: "Special immigrants", es: "Inmigrantes especiales" },
  { key: "RW", kind: "employment", code: "EB-4 RW", en: "Certain religious workers", es: "Ciertos trabajadores religiosos" },
  { key: "EB5U", kind: "employment", code: "EB-5", en: "Investors, unreserved", es: "Inversionistas, no reservado" },
  { key: "EB5R", kind: "employment", code: "EB-5 Rural", en: "Investors, rural set-aside (20%)", es: "Inversionistas, reserva rural (20%)" },
  { key: "EB5H", kind: "employment", code: "EB-5 HU", en: "Investors, high-unemployment set-aside (10%)", es: "Inversionistas, reserva de alto desempleo (10%)" },
  { key: "EB5I", kind: "employment", code: "EB-5 Infra", en: "Investors, infrastructure set-aside (2%)", es: "Inversionistas, reserva de infraestructura (2%)" },
];
