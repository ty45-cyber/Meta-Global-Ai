export interface RleSpan {
  readonly startPixel: number;
  readonly length: number;
}

export interface CalibratedMetrologyReport {
  readonly targetPixelCount: number;
  readonly referencePixelCount: number;
  readonly calibratedAreaMm2: number;
  readonly centroidX: number;
  readonly centroidY: number;
  readonly temporalIou: number;
}

export interface SubPixelMeniscusCusumProfile {
  readonly smoothedChordsPx: readonly number[];
  readonly meniscusTaperRowsPx: number;
  readonly maxInteriorCusumDrift: number;
  readonly quantizationNoiseReductionRatio: number;
}

/**
 * Parses SAM 3.1 lossless `~` RLE wire payloads into immutable span intervals
 * and computes 2D spatial centroids in O(R) time without bitmap allocation.
 * Strict 2-method boundary: parseWireToSpans and computeCentroid.
 */
export class RleBitstreamScanner {
  public parseWireToSpans(rawRlePayload: string, totalPixels: number): readonly RleSpan[] {
    if (!rawRlePayload || rawRlePayload.trim().length === 0) {
      throw new Error("Fail-fast invariant violated: empty SAM 3.1 RLE payload.");
    }
    if (totalPixels <= 0 || !Number.isInteger(totalPixels)) {
      throw new Error("Fail-fast invariant violated: totalPixels must be a positive integer.");
    }

    const sanitized = rawRlePayload.startsWith("~") ? rawRlePayload.slice(1) : rawRlePayload;
    const tokens = sanitized.split(",").map((t) => Number.parseInt(t.trim(), 10));
    const spans: RleSpan[] = [];
    let cursor = 0;

    for (let i = 0; i < tokens.length; i += 2) {
      const zeroRun = tokens[i];
      const oneRun = tokens[i + 1];
      if (zeroRun === undefined || Number.isNaN(zeroRun) || zeroRun < 0) {
        throw new Error(`Corrupted RLE wire token at index ${i}.`);
      }
      cursor += zeroRun;
      if (oneRun !== undefined) {
        if (Number.isNaN(oneRun) || oneRun < 0 || cursor + oneRun > totalPixels) {
          throw new Error(`RLE span bounds violation at cursor ${cursor}.`);
        }
        if (oneRun > 0) {
          spans.push({ startPixel: cursor, length: oneRun });
        }
        cursor += oneRun;
      }
    }
    return spans;
  }

  public computeCentroid(
    spans: readonly RleSpan[],
    frameWidth: number
  ): { readonly x: number; readonly y: number; readonly areaPx: number } {
    if (frameWidth <= 0 || !Number.isInteger(frameWidth)) {
      throw new Error("frameWidth must be a positive integer.");
    }

    let weightedX = 0;
    let weightedY = 0;
    let totalAreaPx = 0;

    for (const span of spans) {
      totalAreaPx += span.length;
      for (let offset = 0; offset < span.length; offset++) {
        const pixelIndex = span.startPixel + offset;
        weightedX += pixelIndex % frameWidth;
        weightedY += Math.floor(pixelIndex / frameWidth);
      }
    }

    if (totalAreaPx === 0) {
      return { x: 0, y: 0, areaPx: 0 };
    }

    return {
      x: weightedX / totalAreaPx,
      y: weightedY / totalAreaPx,
      areaPx: totalAreaPx,
    };
  }
}

/**
 * Reconstructs continuous sub-pixel scanline chords via a 5-tap Savitzky-Golay
 * polynomial filter and isolates top meniscus taper from interior cavitation via Page-Hinkley Cusum.
 * Strict 2-method boundary: reconstructSavitzkyGolayChords and analyzeMeniscusAndCavitationCusum.
 */
export class SubPixelScanlineReconstructor {
  public reconstructSavitzkyGolayChords(rawChordsPx: readonly number[]): readonly number[] {
    const n = rawChordsPx.length;
    if (n === 0) {
      throw new Error("Cannot apply Savitzky-Golay filter to empty scanline vector.");
    }
    if (n < 5) {
      return [...rawChordsPx];
    }

    const smoothed: number[] = new Array<number>(n);
    smoothed[0] = rawChordsPx[0];
    smoothed[1] = (rawChordsPx[0] + rawChordsPx[1] + rawChordsPx[2]) / 3.0;
    smoothed[n - 2] = (rawChordsPx[n - 3] + rawChordsPx[n - 2] + rawChordsPx[n - 1]) / 3.0;
    smoothed[n - 1] = rawChordsPx[n - 1];

    // 5-tap quadratic/cubic Savitzky-Golay coefficients: [-3, 12, 17, 12, -3] / 35
    for (let i = 2; i < n - 2; i++) {
      const val =
        (-3.0 * rawChordsPx[i - 2] +
          12.0 * rawChordsPx[i - 1] +
          17.0 * rawChordsPx[i] +
          12.0 * rawChordsPx[i + 1] -
          3.0 * rawChordsPx[i + 2]) /
        35.0;
      smoothed[i] = Math.max(0.0, val);
    }

    return smoothed;
  }

  public analyzeMeniscusAndCavitationCusum(
    rawChordsPx: readonly number[]
  ): SubPixelMeniscusCusumProfile {
    const smoothedChordsPx = this.reconstructSavitzkyGolayChords(rawChordsPx);
    const n = smoothedChordsPx.length;

    // Estimate nominal barrel shaft diameter from central 50% of scanlines
    const startShaft = Math.floor(n * 0.25);
    const endShaft = Math.max(startShaft + 1, Math.floor(n * 0.75));
    let shaftSum = 0;
    for (let i = startShaft; i < endShaft; i++) {
      shaftSum += smoothedChordsPx[i];
    }
    const nominalDiameterPx = shaftSum / (endShaft - startShaft);

    // Count top scanlines exhibiting concave capillary meniscus rim taper (< 94% of nominal shaft)
    let meniscusTaperRowsPx = 0;
    const maxSearchRows = Math.min(n, Math.floor(n * 0.25));
    for (let i = 0; i < maxSearchRows; i++) {
      if (smoothedChordsPx[i] < nominalDiameterPx * 0.94) {
        meniscusTaperRowsPx++;
      } else {
        break;
      }
    }

    // Page-Hinkley Cusum change-point detector across interior barrel shaft
    let cusumPos = 0;
    let maxInteriorCusumDrift = 0;
    const driftAllowance = nominalDiameterPx * 0.03;

    for (let i = meniscusTaperRowsPx; i < n; i++) {
      const deviation = Math.abs(smoothedChordsPx[i] - nominalDiameterPx) - driftAllowance;
      cusumPos = Math.max(0, cusumPos + deviation);
      if (cusumPos > maxInteriorCusumDrift) {
        maxInteriorCusumDrift = cusumPos;
      }
    }

    // Compute quantization variance reduction ratio
    let rawDiffSq = 0;
    let smoothDiffSq = 0;
    for (let i = startShaft + 1; i < endShaft; i++) {
      const dRaw = rawChordsPx[i] - rawChordsPx[i - 1];
      const dSmooth = smoothedChordsPx[i] - smoothedChordsPx[i - 1];
      rawDiffSq += dRaw * dRaw;
      smoothDiffSq += dSmooth * dSmooth;
    }

    const quantizationNoiseReductionRatio =
      rawDiffSq <= 1e-9 ? 1.0 : Math.max(1.0, rawDiffSq / Math.max(smoothDiffSq, 1e-6));

    return {
      smoothedChordsPx,
      meniscusTaperRowsPx,
      maxInteriorCusumDrift:
        nominalDiameterPx <= 0 ? 0 : maxInteriorCusumDrift / nominalDiameterPx,
      quantizationNoiseReductionRatio,
    };
  }
}

/**
 * Computes physical area (mm^2) from reference fiducial spans and O(R_a + R_b)
 * temporal Intersection-over-Union (IoU) across sequential video frames.
 * Strict 2-method boundary: computeIntervalIou and calibratePhysicalMetrics.
 */
export class PhysicalMetrologyCalculator {
  public computeIntervalIou(
    currentSpans: readonly RleSpan[],
    previousSpans: readonly RleSpan[]
  ): number {
    let idxA = 0;
    let idxB = 0;
    let intersectionPx = 0;
    let areaA = 0;
    let areaB = 0;

    for (const s of currentSpans) areaA += s.length;
    for (const s of previousSpans) areaB += s.length;

    while (idxA < currentSpans.length && idxB < previousSpans.length) {
      const spanA = currentSpans[idxA];
      const spanB = previousSpans[idxB];
      const endA = spanA.startPixel + spanA.length;
      const endB = spanB.startPixel + spanB.length;

      const overlapStart = Math.max(spanA.startPixel, spanB.startPixel);
      const overlapEnd = Math.min(endA, endB);

      if (overlapStart < overlapEnd) {
        intersectionPx += overlapEnd - overlapStart;
      }

      if (endA < endB) {
        idxA++;
      } else {
        idxB++;
      }
    }

    const unionPx = areaA + areaB - intersectionPx;
    return unionPx === 0 ? 0 : intersectionPx / unionPx;
  }

  public calibratePhysicalMetrics(
    targetSpans: readonly RleSpan[],
    referenceSpans: readonly RleSpan[],
    previousTargetSpans: readonly RleSpan[],
    referenceAreaMm2: number,
    frameWidth: number,
    scanner: RleBitstreamScanner
  ): CalibratedMetrologyReport {
    if (referenceAreaMm2 <= 0) {
      throw new Error("referenceAreaMm2 must be strictly positive.");
    }

    const targetStats = scanner.computeCentroid(targetSpans, frameWidth);
    const refStats = scanner.computeCentroid(referenceSpans, frameWidth);

    if (refStats.areaPx === 0) {
      throw new Error("Calibration failure: reference fiducial object has 0 segmented pixels.");
    }

    const calibratedAreaMm2 =
      referenceAreaMm2 * (targetStats.areaPx / refStats.areaPx);
    const temporalIou = this.computeIntervalIou(targetSpans, previousTargetSpans);

    return {
      targetPixelCount: targetStats.areaPx,
      referencePixelCount: refStats.areaPx,
      calibratedAreaMm2,
      centroidX: targetStats.x,
      centroidY: targetStats.y,
      temporalIou,
    };
  }
}