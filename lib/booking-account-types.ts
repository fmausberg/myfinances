import type { BookingAccountType } from "@/generated/prisma/enums";

export const bookingAccountTypeLabels = {
  LIQUID_ASSETS: "Liquide Mittel",
  RECEIVABLES: "Forderungen",
  PREPAYMENTS: "Rechnungsabgrenzung",
  OTHER_CURRENT_ASSETS: "Sonstiges Umlaufvermögen",
  NON_CURRENT_ASSETS: "Anlagevermögen",
  LIABILITIES: "Verbindlichkeiten",
  EQUITY: "Eigenkapital",
  INCOME: "Erträge",
  EXPENSES: "Aufwendungen",
} satisfies Record<BookingAccountType, string>;

export const bookingAccountGroups: { label: string; types: BookingAccountType[] }[] = [
  {
    label: "Balance Sheet",
    types: [
      "LIQUID_ASSETS",
      "RECEIVABLES",
      "PREPAYMENTS",
      "OTHER_CURRENT_ASSETS",
      "NON_CURRENT_ASSETS",
      "LIABILITIES",
      "EQUITY",
    ],
  },
  { label: "Income Statement", types: ["INCOME", "EXPENSES"] },
];
