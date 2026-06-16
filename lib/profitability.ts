import type { Property } from "./types";

export interface PropertyProfitability {
  monthlyRent: number;
  monthlyMortgage: number;
  monthlyHoa: number;
  monthlyTax: number;
  monthlyInsurance: number;
  monthlyExpenses: number;
  monthlyNet: number;
  annualRent: number;
  annualExpenses: number;
  annualNet: number;
  capRate: number | null;
  cashOnCash: number | null;
}

function n(value: number | null | undefined): number {
  return value ?? 0;
}

export function propertyProfitability(property: Property): PropertyProfitability {
  const monthlyRent = n(property.monthly_rent);
  const monthlyMortgage = n(property.monthly_mortgage);
  const monthlyHoa = n(property.monthly_hoa);
  const monthlyTax = n(property.annual_property_tax) / 12;
  const monthlyInsurance = n(property.annual_insurance) / 12;
  const monthlyExpenses = monthlyMortgage + monthlyHoa + monthlyTax + monthlyInsurance;
  const monthlyNet = monthlyRent - monthlyExpenses;
  const annualRent = monthlyRent * 12;
  const annualExpenses = monthlyExpenses * 12;
  const annualNet = monthlyNet * 12;

  const capRate =
    property.current_value && property.current_value > 0
      ? (annualNet / property.current_value) * 100
      : null;
  const cashOnCash =
    property.purchase_price && property.purchase_price > 0
      ? (annualNet / property.purchase_price) * 100
      : null;

  return {
    monthlyRent,
    monthlyMortgage,
    monthlyHoa,
    monthlyTax,
    monthlyInsurance,
    monthlyExpenses,
    monthlyNet,
    annualRent,
    annualExpenses,
    annualNet,
    capRate,
    cashOnCash,
  };
}