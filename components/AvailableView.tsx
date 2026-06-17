"use client";

import { useMemo } from "react";
import {
  depositForAvailableProperty,
  formatBedBath,
  listAvailableProperties,
} from "@/lib/available-properties";
import { formatCurrency } from "@/lib/format";
import type { Lease, Property } from "@/lib/types";

interface AvailableViewProps {
  properties: Property[];
  leases: Lease[];
  onPropertySelect: (property: Property) => void;
}

export default function AvailableView({
  properties,
  leases,
  onPropertySelect,
}: AvailableViewProps) {
  const availableProperties = useMemo(
    () => listAvailableProperties(properties),
    [properties]
  );

  const statusSummary = useMemo(() => {
    const counts = new Map<string, number>();
    for (const property of availableProperties) {
      counts.set(property.status, (counts.get(property.status) ?? 0) + 1);
    }
    return [...counts.entries()].sort(([left], [right]) => left.localeCompare(right));
  }, [availableProperties]);

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-emerald-600/40 bg-zinc-800/90 p-4 sm:p-6">
        <h2 className="font-semibold text-lg text-zinc-100">Available Properties</h2>
        <p className="text-sm text-zinc-400 mt-1">
          Short summary of properties that are not occupied. Occupied units are excluded from this
          list.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <div className="rounded-lg border border-emerald-700/40 bg-emerald-950/30 px-4 py-3 min-w-[9rem]">
            <div className="text-xs uppercase tracking-wide text-emerald-300">Total Available</div>
            <div className="text-2xl font-semibold text-zinc-100 mt-1">
              {availableProperties.length}
            </div>
          </div>
          {statusSummary.map(([status, count]) => (
            <div
              key={status}
              className="rounded-lg border border-zinc-600/60 bg-zinc-900/50 px-4 py-3 min-w-[9rem]"
            >
              <div className="text-xs uppercase tracking-wide text-zinc-400">{status}</div>
              <div className="text-2xl font-semibold text-zinc-100 mt-1">{count}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-zinc-600/60 bg-zinc-800/90">
        {availableProperties.length === 0 ? (
          <div className="p-8 text-center text-zinc-400">
            No available properties right now. Vacant, under renovation, and for-sale units will
            appear here.
          </div>
        ) : (
          <div className="table-scroll">
            <table className="w-full text-sm border-collapse min-w-max">
              <thead>
                <tr className="bg-amber-400 text-zinc-900">
                  <th className="px-3 py-2 text-left font-semibold whitespace-nowrap border-r border-amber-500/40 text-xs uppercase tracking-wide min-w-[10rem]">
                    Property
                  </th>
                  <th className="px-3 py-2 text-left font-semibold whitespace-nowrap border-r border-amber-500/40 text-xs uppercase tracking-wide min-w-[8rem]">
                    Status
                  </th>
                  <th className="px-3 py-2 text-left font-semibold whitespace-nowrap border-r border-amber-500/40 text-xs uppercase tracking-wide min-w-[7rem]">
                    Rental Amount
                  </th>
                  <th className="px-3 py-2 text-left font-semibold whitespace-nowrap border-r border-amber-500/40 text-xs uppercase tracking-wide min-w-[7rem]">
                    Deposit
                  </th>
                  <th className="px-3 py-2 text-left font-semibold whitespace-nowrap text-xs uppercase tracking-wide min-w-[6rem]">
                    Bed / Bath
                  </th>
                </tr>
              </thead>
              <tbody>
                {availableProperties.map((property, index) => {
                  const deposit = depositForAvailableProperty(property.property_name, leases);
                  return (
                    <tr
                      key={property.id}
                      className={`border-t border-zinc-700/60 ${
                        index % 2 === 0 ? "bg-zinc-800/50" : "bg-zinc-700/30"
                      }`}
                    >
                      <td className="px-3 py-2 border-r border-zinc-700/40 text-zinc-100">
                        <button
                          type="button"
                          onClick={() => onPropertySelect(property)}
                          className="font-medium text-sky-300 hover:text-sky-200 hover:underline text-left"
                        >
                          {property.property_name}
                        </button>
                        <div className="text-xs text-zinc-400 mt-0.5">
                          {property.address}, {property.city}
                        </div>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap border-r border-zinc-700/40 text-zinc-200">
                        {property.status}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap border-r border-zinc-700/40 text-zinc-200">
                        {formatCurrency(property.monthly_rent) || "—"}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap border-r border-zinc-700/40 text-zinc-200">
                        {formatCurrency(deposit) || "—"}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-zinc-200">
                        {formatBedBath(property.bedrooms, property.bathrooms)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}