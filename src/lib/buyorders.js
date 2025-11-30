// src/lib/buyorders.js

// Tasas de ejemplo (Ajustables). State tax de Colorado aprox 2.9%.
export const STATE_SALES_PCT = 0.029; // 2.9%

// Tasas locales por ciudad en Colorado (valores en porcentajes tal como los enviaste)
export const CITY_TAX_RATES = {
  Arvada: { state: 2.90, county: 0.50, city: 3.46, cd: 0.10, rtd: 1.00 },
  Denver: { state: 2.90, county: 0.00, city: 5.15, cd: 0.10, rtd: 1.00 },
  Aurora: { state: 2.90, county: 0.25, city: 3.75, cd: 0.10, rtd: 1.00 },
  Colorado_Springs: { state: 2.90, county: 1.23, city: 3.07, cd: 0.00, rtd: 1.00 },
  Lakewood: { state: 2.90, county: 0.50, city: 3.00, cd: 0.10, rtd: 1.00 },
  Westminster: { state: 2.90, county: 0.75, city: 3.85, cd: 0.10, rtd: 1.00 },
  Thornton: { state: 2.90, county: 0.75, city: 3.75, cd: 0.10, rtd: 1.00 },
  Littleton: { state: 2.90, county: 0.25, city: 3.75, cd: 0.10, rtd: 1.00 },
  Englewood: { state: 2.90, county: 0.25, city: 3.80, cd: 0.10, rtd: 1.00 },
  Wheat_Ridge: { state: 2.90, county: 0.50, city: 3.50, cd: 0.10, rtd: 1.00 },
  Broomfield: { state: 2.90, county: 0.00, city: 4.15, cd: 0.10, rtd: 1.00 },
  Centennial: { state: 2.90, county: 0.25, city: 2.50, cd: 0.10, rtd: 1.00 },
  Parker: { state: 2.90, county: 1.00, city: 3.00, cd: 0.10, rtd: 1.00 },
  Brighton: { state: 2.90, county: 0.75, city: 3.75, cd: 0.10, rtd: 1.00 },
  Golden: { state: 2.90, county: 0.50, city: 3.00, cd: 0.10, rtd: 1.00 },
  Longmont: { state: 2.90, county: 1.19, city: 3.53, cd: 0.10, rtd: 1.00 },
  Boulder: { state: 2.90, county: 1.19, city: 3.86, cd: 0.10, rtd: 1.00 },
  Fort_Collins: { state: 2.90, county: 0.80, city: 4.35, cd: 0.00, rtd: 0.00 },
  Pueblo: { state: 2.90, county: 1.00, city: 3.70, cd: 0.00, rtd: 0.00 },
  Greeley: { state: 2.90, county: 0.00, city: 4.11, cd: 0.00, rtd: 0.00 },
};

/**
 * Calcula desglose de un buy order
 * @param {object} opts
 * @param {number} opts.price - precio del vehículo
 * @param {string} opts.city - ciudad (clave en CITY_TAX_RATES)
 * @param {number} [opts.fee=47.2]
 * @param {number} [opts.downPayment=0]
 */
export function computeBuyOrder({ price, city, fee = 47.2, downPayment = 0, state = 'CO' }, ratesMap) {
  const p = Number(price) || 0;
  const cityKey = city || 'Denver';
  const ratesSource = ratesMap || CITY_TAX_RATES;
  const rates = ratesSource[cityKey] || ratesSource['Denver'] || CITY_TAX_RATES['Denver'];

  // Map of keys -> readable names
  const TAX_NAME_MAP = {
    state: `State Tax (${state})`,
    county: 'County Tax',
    city: 'City Tax',
    cd: 'CD Tax',
    rtd: 'RTD Tax',
  };

  const taxItems = Object.keys(rates).map((k) => {
    const pctPercent = Number(rates[k] || 0); // e.g. 2.90
    const pct = pctPercent / 100; // decimal
    const amount = p * pct;
    return {
      key: k,
      name: TAX_NAME_MAP[k] || k,
      pct,
      pctPercent,
      amount,
    };
  });

  const totalTaxes = taxItems.reduce((s, t) => s + (t.amount || 0), 0);
  const subtotal = p + totalTaxes;
  const totalWithFees = subtotal + Number(fee || 0);
  const balanceDue = Math.max(0, totalWithFees - (Number(downPayment) || 0));

  return {
    price: p,
    taxItems,
    totalTaxes,
    subtotal,
    fee: Number(fee || 0),
    totalWithFees,
    downPayment: Number(downPayment || 0),
    balanceDue,
  };
}
