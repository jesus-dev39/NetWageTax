import { describe, expect, it } from 'vitest';
import { applyPhaseout, phaseoutReduction, phaseoutSteps, type PhaseoutRule } from './phaseout';

const TIPS: PhaseoutRule = { kind: 'step', stepSize: 1_000, perStep: 100, rounding: 'down' };
const CAR: PhaseoutRule = { kind: 'step', stepSize: 1_000, perStep: 200, rounding: 'up' };
const SENIOR: PhaseoutRule = { kind: 'rate', rate: 0.06 };

describe('phaseout', () => {
  it('no reduction at or below the threshold', () => {
    for (const rule of [TIPS, CAR, SENIOR]) {
      expect(phaseoutReduction(100_000, 100_000, rule)).toBe(0);
      expect(phaseoutReduction(50_000, 100_000, rule)).toBe(0);
    }
  });

  it("step 'down' counts only full $1,000 steps", () => {
    expect(phaseoutSteps(150_999, 150_000, TIPS)).toBe(0);
    expect(phaseoutReduction(151_000, 150_000, TIPS)).toBe(100);
    expect(phaseoutReduction(175_500, 150_000, TIPS)).toBe(2_500);
  });

  it("step 'up' counts any portion of $1,000 as a full step", () => {
    expect(phaseoutSteps(100_000.01, 100_000, CAR)).toBe(1);
    expect(phaseoutReduction(100_001, 100_000, CAR)).toBe(200);
    expect(phaseoutReduction(101_000, 100_000, CAR)).toBe(200);
    expect(phaseoutReduction(101_001, 100_000, CAR)).toBe(400);
    expect(phaseoutReduction(125_000, 100_000, CAR)).toBe(5_000);
  });

  it('rate reduces by a share of the excess, with no rounding', () => {
    expect(phaseoutReduction(100_000, 75_000, SENIOR)).toBeCloseTo(1_500, 10);
    expect(phaseoutReduction(75_010.5, 75_000, SENIOR)).toBeCloseTo(0.63, 10);
  });

  it('applyPhaseout never goes below zero', () => {
    expect(applyPhaseout(6_000, 200_000, 75_000, SENIOR)).toBe(0);
    expect(applyPhaseout(10_000, 150_000, 100_000, CAR)).toBe(0);
    expect(applyPhaseout(10_000, 149_000, 100_000, CAR)).toBe(200);
  });
});
