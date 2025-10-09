// src/lib/payroll.js

// Tabla simple por estado (puedes ajustar en Ajustes después)
export const STATE_TAX = {
  TX: { statePct: 0.00 },        // Texas: sin income tax
  CO: { statePct: 0.044 },       // Colorado flat aprox 4.4%
  UT: { statePct: 0.0485 },      // Utah flat aprox 4.85%
  CA: { statePct: 0.06 },        // CA (aprox promedio para ejemplo)
  NY: { statePct: 0.058 },       // NY (aprox promedio para ejemplo)
};

// FICA básicos
export const FICA = {
  ssPct: 0.062,       // Social Security 6.2%
  medicarePct: 0.0145 // Medicare 1.45%
  // (si luego quieres agregar límites/caps de SS, lo metemos aquí)
};

/**
 * Calcula impuestos y neto.
 * @param {number} hours
 * @param {number} rate
 * @param {string} state - código de 2 letras
 * @param {number} federalPct - % federal (withholding) ej. 0.12 = 12%
 */
export function computeTaxes({ hours, rate, state, federalPct = 0.12 }) {
  const gross = Number(hours) * Number(rate);

  const ss = gross * FICA.ssPct;
  const medicare = gross * FICA.medicarePct;

  const stCfg = STATE_TAX[state] || { statePct: 0 };
  const stateTax = gross * (stCfg.statePct || 0);

  const federal = gross * Number(federalPct || 0);

  const taxes = ss + medicare + stateTax + federal;
  const net = gross - taxes;

  return {
    gross,
    ss,
    medicare,
    stateTax,
    federal,
    taxes,
    net,
  };
}
