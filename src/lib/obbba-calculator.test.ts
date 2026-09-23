/**
 * obbba-calculator.test.ts
 * Cobertura completa de los 20 casos de SPEC.md §4 (T1–T11, O1–O6, C1–C3)
 * más los edge cases de §4.4.
 */

import { describe, it, expect } from 'vitest';
import { calculateObbbaDeduction } from '../lib/obbba-calculator';
import {
  ObbbaYearNotSupportedError,
  ObbbaInvalidInputError,
  type ObbbaInput,
} from '../lib/obbba-params';

/** Input base reutilizable; cada test sobreescribe solo lo que necesita. */
function baseInput(overrides: Partial<ObbbaInput>): ObbbaInput {
  return {
    filingStatus: 'single',
    magi: 0,
    taxYear: 2026,
    hasQualifyingTips: false,
    hasQualifyingOvertime: false,
    ...overrides,
  };
}

// ===========================================================================
// 4.1 — Tips (T1–T11)
// ===========================================================================

describe('OBBBA — Tips (§4.1)', () => {
  it('T1 — por debajo del umbral y del tope', () => {
    const result = calculateObbbaDeduction(
      baseInput({ magi: 45_000, hasQualifyingTips: true, tipsAmount: 8_000 }),
    );
    expect(result.tips.deductionBeforePhaseout).toBe(8_000);
    expect(result.tips.phaseoutReduction).toBe(0);
    expect(result.tips.deductionFinal).toBe(8_000);
  });

  it('T2 — por debajo del umbral, por encima del tope (se recorta a $25,000)', () => {
    const result = calculateObbbaDeduction(
      baseInput({ magi: 60_000, hasQualifyingTips: true, tipsAmount: 30_000 }),
    );
    expect(result.tips.deductionBeforePhaseout).toBe(25_000);
    expect(result.tips.phaseoutReduction).toBe(0);
    expect(result.tips.deductionFinal).toBe(25_000);
  });

  it('T3 — justo en el umbral (sin phase-out aún)', () => {
    const result = calculateObbbaDeduction(
      baseInput({ magi: 150_000, hasQualifyingTips: true, tipsAmount: 25_000 }),
    );
    expect(result.tips.deductionBeforePhaseout).toBe(25_000);
    expect(result.tips.phaseoutReduction).toBe(0);
    expect(result.tips.deductionFinal).toBe(25_000);
  });

  it('T4 — dentro del phase-out, single', () => {
    const result = calculateObbbaDeduction(
      baseInput({ magi: 175_000, hasQualifyingTips: true, tipsAmount: 25_000 }),
    );
    expect(result.tips.deductionBeforePhaseout).toBe(25_000);
    expect(result.tips.phaseoutReduction).toBe(2_500);
    expect(result.tips.deductionFinal).toBe(22_500);
  });

  it('T5 — redondeo hacia abajo del tramo de $1,000', () => {
    const result = calculateObbbaDeduction(
      baseInput({ magi: 150_999, hasQualifyingTips: true, tipsAmount: 25_000 }),
    );
    expect(result.tips.phaseoutReduction).toBe(0);
    expect(result.tips.deductionFinal).toBe(25_000);
  });

  it('T6 — MFJ dentro del phase-out', () => {
    const result = calculateObbbaDeduction(
      baseInput({
        filingStatus: 'mfj',
        magi: 325_000,
        hasQualifyingTips: true,
        tipsAmount: 25_000,
      }),
    );
    expect(result.tips.deductionBeforePhaseout).toBe(25_000);
    expect(result.tips.phaseoutReduction).toBe(2_500);
    expect(result.tips.deductionFinal).toBe(22_500);
  });

  it('T7 — completamente eliminado (single)', () => {
    const result = calculateObbbaDeduction(
      baseInput({ magi: 400_000, hasQualifyingTips: true, tipsAmount: 25_000 }),
    );
    expect(result.tips.deductionFinal).toBe(0);
    expect(result.tips.isFullyPhasedOut).toBe(true);
  });

  it('T8 — completamente eliminado (MFJ)', () => {
    const result = calculateObbbaDeduction(
      baseInput({
        filingStatus: 'mfj',
        magi: 560_000,
        hasQualifyingTips: true,
        tipsAmount: 25_000,
      }),
    );
    expect(result.tips.deductionFinal).toBe(0);
    expect(result.tips.isFullyPhasedOut).toBe(true);
  });

  it('T9 — MFS no es elegible', () => {
    const result = calculateObbbaDeduction(
      baseInput({
        filingStatus: 'mfs',
        magi: 80_000,
        hasQualifyingTips: true,
        tipsAmount: 10_000,
      }),
    );
    expect(result.tips.deductionFinal).toBe(0);
    expect(result.tips.isEligible).toBe(false);
    expect(result.tips.ineligibilityReason).toBe('MARRIED_FILING_SEPARATELY');
  });

  it('T10 — autónomo en SSTB excluido', () => {
    const result = calculateObbbaDeduction(
      baseInput({
        magi: 60_000,
        hasQualifyingTips: true,
        tipsAmount: 15_000,
        isSelfEmployedSSTB: true,
      }),
    );
    expect(result.tips.deductionFinal).toBe(0);
    expect(result.tips.isEligible).toBe(false);
    expect(result.tips.ineligibilityReason).toBe('SELF_EMPLOYED_SSTB');
  });

  it('T11 — MAGI exactamente en el punto cero', () => {
    const result = calculateObbbaDeduction(
      baseInput({ magi: 400_000, hasQualifyingTips: true, tipsAmount: 9_000 }),
    );
    expect(result.tips.deductionBeforePhaseout).toBe(9_000);
    expect(result.tips.phaseoutReduction).toBe(25_000);
    expect(result.tips.deductionFinal).toBe(0);
    expect(result.tips.isFullyPhasedOut).toBe(true);
  });
});

// ===========================================================================
// 4.2 — Overtime (O1–O6)
// ===========================================================================

describe('OBBBA — Overtime (§4.2)', () => {
  it('O1 — soltero, dentro de tope y sin phase-out', () => {
    const result = calculateObbbaDeduction(
      baseInput({
        magi: 70_000,
        hasQualifyingOvertime: true,
        overtimePremiumAmount: 6_000,
        isFLSANonExempt: true,
      }),
    );
    expect(result.overtime.deductionBeforePhaseout).toBe(6_000);
    expect(result.overtime.phaseoutReduction).toBe(0);
    expect(result.overtime.deductionFinal).toBe(6_000);
  });

  it('O2 — soltero, por encima del tope de $12,500', () => {
    const result = calculateObbbaDeduction(
      baseInput({
        magi: 80_000,
        hasQualifyingOvertime: true,
        overtimePremiumAmount: 18_000,
        isFLSANonExempt: true,
      }),
    );
    expect(result.overtime.deductionBeforePhaseout).toBe(12_500);
    expect(result.overtime.deductionFinal).toBe(12_500);
  });

  it('O3 — soltero, dentro del phase-out', () => {
    const result = calculateObbbaDeduction(
      baseInput({
        magi: 200_000,
        hasQualifyingOvertime: true,
        overtimePremiumAmount: 12_500,
        isFLSANonExempt: true,
      }),
    );
    expect(result.overtime.deductionBeforePhaseout).toBe(12_500);
    expect(result.overtime.phaseoutReduction).toBe(5_000);
    expect(result.overtime.deductionFinal).toBe(7_500);
  });

  it('O4 — soltero, completamente eliminado', () => {
    const result = calculateObbbaDeduction(
      baseInput({
        magi: 275_000,
        hasQualifyingOvertime: true,
        overtimePremiumAmount: 12_500,
        isFLSANonExempt: true,
      }),
    );
    expect(result.overtime.deductionFinal).toBe(0);
    expect(result.overtime.isFullyPhasedOut).toBe(true);
  });

  it('O5 — MFJ, tope de $25,000, dentro del phase-out', () => {
    const result = calculateObbbaDeduction(
      baseInput({
        filingStatus: 'mfj',
        magi: 400_000,
        hasQualifyingOvertime: true,
        overtimePremiumAmount: 25_000,
        isFLSANonExempt: true,
      }),
    );
    expect(result.overtime.deductionBeforePhaseout).toBe(25_000);
    expect(result.overtime.phaseoutReduction).toBe(10_000);
    expect(result.overtime.deductionFinal).toBe(15_000);
  });

  it('O6 — empleado exento FLSA no califica', () => {
    const result = calculateObbbaDeduction(
      baseInput({
        magi: 60_000,
        hasQualifyingOvertime: true,
        overtimePremiumAmount: 5_000,
        isFLSANonExempt: false,
      }),
    );
    expect(result.overtime.deductionFinal).toBe(0);
    expect(result.overtime.isEligible).toBe(false);
    expect(result.overtime.ineligibilityReason).toBe('FLSA_EXEMPT_EMPLOYEE');
  });
});

// ===========================================================================
// 4.3 — Casos combinados (C1–C3)
// ===========================================================================

describe('OBBBA — Casos combinados (§4.3)', () => {
  it('C1 — camarero con propinas y horas extra, ingresos medios', () => {
    const result = calculateObbbaDeduction(
      baseInput({
        magi: 52_000,
        hasQualifyingTips: true,
        tipsAmount: 14_000,
        hasQualifyingOvertime: true,
        overtimePremiumAmount: 3_200,
        isFLSANonExempt: true,
      }),
    );
    expect(result.tips.deductionFinal).toBe(14_000);
    expect(result.overtime.deductionFinal).toBe(3_200);
    expect(result.totalCombinedDeduction).toBe(17_200);
  });

  it('C2 — MAGI en zona de phase-out para ambas categorías', () => {
    const result = calculateObbbaDeduction(
      baseInput({
        magi: 180_000,
        hasQualifyingTips: true,
        tipsAmount: 20_000,
        hasQualifyingOvertime: true,
        overtimePremiumAmount: 10_000,
        isFLSANonExempt: true,
      }),
    );
    // Tips: base 20,000; exceso 30,000 -> reducción 3,000 -> final 17,000
    expect(result.tips.deductionBeforePhaseout).toBe(20_000);
    expect(result.tips.phaseoutReduction).toBe(3_000);
    expect(result.tips.deductionFinal).toBe(17_000);

    // Overtime: base 10,000 (no supera el tope 12,500); exceso 30,000 -> reducción 3,000 -> final 7,000
    expect(result.overtime.deductionBeforePhaseout).toBe(10_000);
    expect(result.overtime.phaseoutReduction).toBe(3_000);
    expect(result.overtime.deductionFinal).toBe(7_000);

    expect(result.totalCombinedDeduction).toBe(24_000);
  });

  it('C3 — pareja MFJ con solo overtime, sin tips', () => {
    const result = calculateObbbaDeduction(
      baseInput({
        filingStatus: 'mfj',
        magi: 310_000,
        hasQualifyingTips: false,
        hasQualifyingOvertime: true,
        overtimePremiumAmount: 22_000,
        isFLSANonExempt: true,
      }),
    );
    expect(result.tips.deductionFinal).toBe(0);
    expect(result.tips.isEligible).toBe(false);
    expect(result.tips.ineligibilityReason).toBe('NOT_CLAIMED');

    expect(result.overtime.deductionBeforePhaseout).toBe(22_000);
    expect(result.overtime.phaseoutReduction).toBe(1_000);
    expect(result.overtime.deductionFinal).toBe(21_000);

    expect(result.totalCombinedDeduction).toBe(21_000);
  });
});

// ===========================================================================
// 4.4 — Edge cases obligatorios
// ===========================================================================

describe('OBBBA — Edge cases (§4.4)', () => {
  it('tipsAmount = 0 con hasQualifyingTips = true → deducción $0 sin error', () => {
    const result = calculateObbbaDeduction(
      baseInput({ magi: 50_000, hasQualifyingTips: true, tipsAmount: 0 }),
    );
    expect(result.tips.isEligible).toBe(true);
    expect(result.tips.deductionFinal).toBe(0);
  });

  it('magi negativo debe rechazarse con ObbbaInvalidInputError', () => {
    expect(() => calculateObbbaDeduction(baseInput({ magi: -1 }))).toThrow(
      ObbbaInvalidInputError,
    );
  });

  it('taxYear fuera de 2025–2028 debe lanzar ObbbaYearNotSupportedError', () => {
    expect(() =>
      calculateObbbaDeduction(baseInput({ taxYear: 2030 as unknown as ObbbaInput['taxYear'] })),
    ).toThrow(ObbbaYearNotSupportedError);
  });

  it('MFJ: salto correcto de $299,999 (sin phase-out) a $300,001 (phase-out mínimo)', () => {
    const belowThreshold = calculateObbbaDeduction(
      baseInput({
        filingStatus: 'mfj',
        magi: 299_999,
        hasQualifyingTips: true,
        tipsAmount: 25_000,
      }),
    );
    expect(belowThreshold.tips.phaseoutReduction).toBe(0);
    expect(belowThreshold.tips.deductionFinal).toBe(25_000);

    const aboveThreshold = calculateObbbaDeduction(
      baseInput({
        filingStatus: 'mfj',
        magi: 300_001,
        hasQualifyingTips: true,
        tipsAmount: 25_000,
      }),
    );
    // exceso = 1 -> floor(1/1000) = 0 tramos -> aún $0 de reducción
    expect(aboveThreshold.tips.phaseoutReduction).toBe(0);
    expect(aboveThreshold.tips.deductionFinal).toBe(25_000);

    const firstStepReached = calculateObbbaDeduction(
      baseInput({
        filingStatus: 'mfj',
        magi: 301_000,
        hasQualifyingTips: true,
        tipsAmount: 25_000,
      }),
    );
    // exceso = 1000 -> floor(1000/1000) = 1 tramo -> reducción de $100
    expect(firstStepReached.tips.phaseoutReduction).toBe(100);
    expect(firstStepReached.tips.deductionFinal).toBe(24_900);
  });
});