import {
  CalibratedMetrologyReport,
  RleSpan,
  SubPixelScanlineReconstructor,
} from "./rleMetrologyKernel";

export interface OpticalCompensationConfig {
  readonly fiducialObservedBbox: readonly [number, number, number, number];
  readonly liquidRefractiveIndex: number;
  readonly barrelWallThicknessRatio: number;
  readonly explicitMeniscusHeightMm?: number;
}

export interface YoungLaplaceMeniscusReport {
  readonly meniscusCapillaryVoidMl: number;
  readonly estimatedContactAngleDeg: number;
  readonly capillaryAspectRatioXi: number;
  readonly hasSurfaceTensionAdulteration: boolean;
}

export interface ScanlineChordProfile {
  readonly activeScanlineCount: number;
  readonly chordWidthsPx: readonly number[];
  readonly smoothedChordsPx: readonly number[];
  readonly meanChordWidthPx: number;
  readonly radialDistortionIndexKappa: number;
  readonly meniscusTaperRowsPx: number;
}

export interface VolumetricMetrologyReport {
  readonly calibratedVolumeMl: number;
  readonly uncompensatedVolumeMl: number;
  readonly meniscusCapillaryVoidMl: number;
  readonly estimatedContactAngleDeg: number;
  readonly hasSurfaceTensionAdulteration: boolean;
  readonly linearScaleMmPerPx: number;
  readonly tiltForeshorteningGamma: number;
  readonly snellRadialContractionEta: number;
  readonly activeScanlineCount: number;
  readonly meanDiameterMm: number;
  readonly radialDistortionIndexKappa: number;
  readonly hasCavitationOrTamperAnomaly: boolean;
}

export interface KalmanKinematicState {
  readonly filteredVolumeMl: number;
  readonly flowVelocityMlPerSec: number;
  readonly frameTimestampMs: number;
}

export interface PredictiveHorizonAssessment {
  readonly updatedState: KalmanKinematicState;
  readonly projectedVolumeAtHorizonMl: number;
  readonly timeToOverdoseBreachSec: number;
  readonly isPreemptiveBreachImminent: boolean;
}

export interface PatientPharmacokineticProfile {
  readonly patientIdHash: string;
  readonly weightKg: number;
  readonly renalClearanceFactor: number;
  readonly drugName: string;
  readonly concentrationMgPerMl: number;
  readonly minSafeDoseMgPerKg: number;
  readonly maxSafeDoseMgPerKg: number;
  readonly maxAllowedKappa: number;
}

export interface VolumetricSafetyVerdict {
  readonly isSafeToAdminister: boolean;
  readonly measuredVolumeMl: number;
  readonly minSafeVolumeMl: number;
  readonly maxSafeVolumeMl: number;
  readonly overdoseRatio: number;
  readonly recommendedUiAction: "COMMIT_VERIFIED_DOSE" | "TRIGGER_EMERGENCY_LOCKOUT";
  readonly clinicalViolationReason: string;
}

const ISO_7810_ASPECT_RATIO = 85.60 / 53.98; // 1.5857725

/**
 * Computes projective camera-tilt foreshortening (SE(3)), Snell-Descartes radial
 * refraction contraction, and Young-Laplace capillary meniscus void & contact angle.
 * Strict 2-method boundary: computeTiltAndSnellFactors and computeYoungLaplaceMeniscusCorrection.
 */
export class RefractiveProjectiveCompensator {
  public computeTiltAndSnellFactors(
    fiducialBbox: readonly [number, number, number, number],
    liquidRefractiveIndex: number,
    barrelWallThicknessRatio: number
  ): { readonly tiltGamma: number; readonly snellEta: number } {
    const [xMin, yMin, xMax, yMax] = fiducialBbox;
    const widthSpan = Math.abs(xMax - xMin);
    const heightSpan = Math.abs(yMax - yMin);

    if (widthSpan <= 1e-6 || heightSpan <= 1e-6) {
      throw new Error("Invalid fiducial bounding box: zero-area extent.");
    }
    if (liquidRefractiveIndex < 1.0 || liquidRefractiveIndex > 2.0) {
      throw new Error("Physical invariant violation: liquidRefractiveIndex must be in [1.0, 2.0].");
    }
    if (barrelWallThicknessRatio < 0.0 || barrelWallThicknessRatio >= 0.5) {
      throw new Error("Physical invariant violation: barrelWallThicknessRatio must be in [0.0, 0.5).");
    }

    const observedAspect = Math.max(widthSpan, heightSpan) / Math.min(widthSpan, heightSpan);
    const rawGamma = Math.min(
      observedAspect / ISO_7810_ASPECT_RATIO,
      ISO_7810_ASPECT_RATIO / observedAspect
    );
    const tiltGamma = Math.max(0.5, Math.min(1.0, rawGamma));

    const opticalMagnification =
      1.0 + (liquidRefractiveIndex - 1.0) * (1.0 - barrelWallThicknessRatio);
    const snellEta = 1.0 / opticalMagnification;

    return { tiltGamma, snellEta };
  }

  public computeYoungLaplaceMeniscusCorrection(
    internalRadiusMm: number,
    meniscusHeightMm: number
  ): YoungLaplaceMeniscusReport {
    if (internalRadiusMm <= 0 || meniscusHeightMm < 0) {
      throw new Error("Young-Laplace invariant violation: radius must be > 0 and height >= 0.");
    }

    if (meniscusHeightMm === 0) {
      return {
        meniscusCapillaryVoidMl: 0,
        estimatedContactAngleDeg: 90.0,
        capillaryAspectRatioXi: 0,
        hasSurfaceTensionAdulteration: false,
      };
    }

    // Spherical-cap void volume: dV_cap = (pi * h_m / 6) * (3 * R_i^2 + h_m^2) [mm^3]
    const voidMm3 =
      ((Math.PI * meniscusHeightMm) / 6.0) *
      (3.0 * internalRadiusMm * internalRadiusMm + meniscusHeightMm * meniscusHeightMm);
    const meniscusCapillaryVoidMl = voidMm3 / 1000.0;

    // Capillary contact angle: sin(theta_c) = (R_i^2 - h_m^2) / (R_i^2 + h_m^2)
    const rSq = internalRadiusMm * internalRadiusMm;
    const hSq = meniscusHeightMm * meniscusHeightMm;
    const sinTheta = Math.max(-1.0, Math.min(1.0, (rSq - hSq) / (rSq + hSq)));
    const estimatedContactAngleDeg = (Math.asin(sinTheta) * 180.0) / Math.PI;

    const capillaryAspectRatioXi = meniscusHeightMm / internalRadiusMm;
    // If xi > 0.85 (extreme foaming/surfactant tampering) or negative/inverted, flag chemical adulteration
    const hasSurfaceTensionAdulteration = capillaryAspectRatioXi > 0.85;

    return {
      meniscusCapillaryVoidMl,
      estimatedContactAngleDeg,
      capillaryAspectRatioXi,
      hasSurfaceTensionAdulteration,
    };
  }
}

/**
 * Integrates 2D SAM 3.1 RLE bitstreams into Savitzky-Golay smoothed, tilt-, Snell-,
 * and Young-Laplace meniscus-compensated 3D liquid volume (mL).
 * Strict 2-method boundary: extractScanlineChords and integrateCylindricalVolumeMl.
 */
export class RleSolidOfRevolutionIntegrator {
  public extractScanlineChords(
    spans: readonly RleSpan[],
    frameWidth: number,
    reconstructor?: SubPixelScanlineReconstructor
  ): ScanlineChordProfile {
    if (frameWidth <= 0 || !Number.isInteger(frameWidth)) {
      throw new Error("Fail-fast invariant violated: frameWidth must be a positive integer.");
    }
    if (spans.length === 0) {
      throw new Error("Fail-fast invariant violated: cannot integrate empty RLE span set.");
    }

    const rowWidthMap = new Map<number, number>();

    for (const span of spans) {
      let remaining = span.length;
      let cursor = span.startPixel;

      while (remaining > 0) {
        const rowY = Math.floor(cursor / frameWidth);
        const colX = cursor % frameWidth;
        const pixelsInCurrentRow = Math.min(remaining, frameWidth - colX);

        rowWidthMap.set(rowY, (rowWidthMap.get(rowY) ?? 0) + pixelsInCurrentRow);
        cursor += pixelsInCurrentRow;
        remaining -= pixelsInCurrentRow;
      }
    }

    const chordWidthsPx = Array.from(rowWidthMap.values());
    const activeScanlineCount = chordWidthsPx.length;
    const activeReconstructor = reconstructor ?? new SubPixelScanlineReconstructor();
    const cusumProfile = activeReconstructor.analyzeMeniscusAndCavitationCusum(chordWidthsPx);
    const smoothedChordsPx = cusumProfile.smoothedChordsPx;

    let sumWidth = 0;
    for (const w of smoothedChordsPx) {
      sumWidth += w;
    }
    const meanChordWidthPx = sumWidth / activeScanlineCount;

    let varianceSum = 0;
    for (const w of smoothedChordsPx) {
      const diff = w - meanChordWidthPx;
      varianceSum += diff * diff;
    }
    const stdDevPx = Math.sqrt(varianceSum / activeScanlineCount);
    const radialDistortionIndexKappa =
      meanChordWidthPx === 0 ? 0 : stdDevPx / meanChordWidthPx;

    return {
      activeScanlineCount,
      chordWidthsPx,
      smoothedChordsPx,
      meanChordWidthPx,
      radialDistortionIndexKappa,
      meniscusTaperRowsPx: cusumProfile.meniscusTaperRowsPx,
    };
  }

  public integrateCylindricalVolumeMl(
    liquidColumnSpans: readonly RleSpan[],
    metrologyReport: CalibratedMetrologyReport,
    referenceAreaMm2: number,
    frameWidth: number,
    maxAllowedKappa: number = 0.08,
    opticalConfig?: OpticalCompensationConfig,
    compensator?: RefractiveProjectiveCompensator
  ): VolumetricMetrologyReport {
    if (referenceAreaMm2 <= 0 || metrologyReport.referencePixelCount <= 0) {
      throw new Error("Invalid fiducial reference calibration parameters.");
    }

    const activeCompensator = compensator ?? new RefractiveProjectiveCompensator();
    const { tiltGamma, snellEta } = opticalConfig
      ? activeCompensator.computeTiltAndSnellFactors(
          opticalConfig.fiducialObservedBbox,
          opticalConfig.liquidRefractiveIndex,
          opticalConfig.barrelWallThicknessRatio
        )
      : { tiltGamma: 1.0, snellEta: 1.0 };

    const uncompensatedAlpha = Math.sqrt(
      referenceAreaMm2 / metrologyReport.referencePixelCount
    );
    const linearScaleMmPerPx = Math.sqrt(
      (referenceAreaMm2 * tiltGamma) / metrologyReport.referencePixelCount
    );

    const chordProfile = this.extractScanlineChords(liquidColumnSpans, frameWidth);

    let sumSquaredSmoothedPx2 = 0;
    for (const widthPx of chordProfile.smoothedChordsPx) {
      sumSquaredSmoothedPx2 += widthPx * widthPx;
    }

    const uncompensatedVolumeMl =
      (Math.PI * Math.pow(uncompensatedAlpha, 3) * sumSquaredSmoothedPx2) / 4000.0;

    const alphaCubed = Math.pow(linearScaleMmPerPx, 3);
    const etaSquared = snellEta * snellEta;
    const rawCompensatedVolumeMl =
      (Math.PI * alphaCubed * etaSquared * sumSquaredSmoothedPx2) / 4000.0;

    const meanDiameterMm =
      chordProfile.meanChordWidthPx * linearScaleMmPerPx * snellEta;
    const internalRadiusMm = Math.max(0.1, meanDiameterMm / 2.0);
    const meniscusHeightMm =
      opticalConfig?.explicitMeniscusHeightMm ??
      chordProfile.meniscusTaperRowsPx * linearScaleMmPerPx;

    const meniscusReport = activeCompensator.computeYoungLaplaceMeniscusCorrection(
      internalRadiusMm,
      meniscusHeightMm
    );

    const calibratedVolumeMl = Math.max(
      0,
      rawCompensatedVolumeMl - meniscusReport.meniscusCapillaryVoidMl
    );

    return {
      calibratedVolumeMl,
      uncompensatedVolumeMl,
      meniscusCapillaryVoidMl: meniscusReport.meniscusCapillaryVoidMl,
      estimatedContactAngleDeg: meniscusReport.estimatedContactAngleDeg,
      hasSurfaceTensionAdulteration: meniscusReport.hasSurfaceTensionAdulteration,
      linearScaleMmPerPx,
      tiltForeshorteningGamma: tiltGamma,
      snellRadialContractionEta: snellEta,
      activeScanlineCount: chordProfile.activeScanlineCount,
      meanDiameterMm,
      radialDistortionIndexKappa: chordProfile.radialDistortionIndexKappa,
      hasCavitationOrTamperAnomaly:
        chordProfile.radialDistortionIndexKappa > maxAllowedKappa ||
        meniscusReport.hasSurfaceTensionAdulteration,
    };
  }
}

/**
 * Tracks multi-frame SAM 3.1 meniscus kinematics ([V_k, dV/dt]) via an alpha-beta
 * Kalman filter and predicts time-to-overdose breach before plunger completion.
 * Strict 2-method boundary: stepAlphaBetaKalman and evaluatePredictiveHorizonBreach.
 */
export class KalmanMeniscusFlowPredictor {
  public stepAlphaBetaKalman(
    previousState: KalmanKinematicState,
    measuredVolumeMl: number,
    currentTimestampMs: number,
    gainAlpha: number = 0.65,
    gainBeta: number = 0.25
  ): KalmanKinematicState {
    const dtSec = (currentTimestampMs - previousState.frameTimestampMs) / 1000.0;
    if (dtSec <= 0) {
      throw new Error("Kalman temporal invariant violation: dtSec must be strictly positive.");
    }
    if (gainAlpha <= 0 || gainAlpha > 1 || gainBeta <= 0 || gainBeta > 1) {
      throw new Error("Kalman filter gains alpha and beta must reside in (0, 1].");
    }

    const predictedVolumeMl =
      previousState.filteredVolumeMl + previousState.flowVelocityMlPerSec * dtSec;
    const innovationResidualMl = measuredVolumeMl - predictedVolumeMl;

    const filteredVolumeMl =
      predictedVolumeMl + gainAlpha * innovationResidualMl;
    const flowVelocityMlPerSec =
      previousState.flowVelocityMlPerSec + (gainBeta / dtSec) * innovationResidualMl;

    return {
      filteredVolumeMl: Math.max(0, filteredVolumeMl),
      flowVelocityMlPerSec,
      frameTimestampMs: currentTimestampMs,
    };
  }

  public evaluatePredictiveHorizonBreach(
    previousState: KalmanKinematicState,
    measuredVolumeMl: number,
    currentTimestampMs: number,
    maxSafeVolumeMl: number,
    actuationHorizonSec: number = 0.50
  ): PredictiveHorizonAssessment {
    const updatedState = this.stepAlphaBetaKalman(
      previousState,
      measuredVolumeMl,
      currentTimestampMs
    );

    const projectedVolumeAtHorizonMl =
      updatedState.filteredVolumeMl +
      updatedState.flowVelocityMlPerSec * actuationHorizonSec;

    const remainingMarginMl = maxSafeVolumeMl - updatedState.filteredVolumeMl;
    const timeToOverdoseBreachSec =
      updatedState.flowVelocityMlPerSec > 1e-6
        ? Math.max(0, remainingMarginMl / updatedState.flowVelocityMlPerSec)
        : Number.POSITIVE_INFINITY;

    const isPreemptiveBreachImminent =
      updatedState.filteredVolumeMl > maxSafeVolumeMl ||
      (updatedState.flowVelocityMlPerSec > 0.05 &&
        timeToOverdoseBreachSec <= actuationHorizonSec);

    return {
      updatedState,
      projectedVolumeAtHorizonMl,
      timeToOverdoseBreachSec,
      isPreemptiveBreachImminent,
    };
  }
}

/**
 * Evaluates calibrated physical syringe/vial volume (mL), barrel cavitation,
 * surface-tension adulteration, and predictive Kalman horizon breaches.
 * Strict 2-method boundary: computeSafeDoseBoundsMl and evaluateVolumetricSafetyInvariant.
 */
export class PharmacokineticSafetyVerifier {
  public computeSafeDoseBoundsMl(
    profile: PatientPharmacokineticProfile
  ): { readonly minSafeVolumeMl: number; readonly maxSafeVolumeMl: number } {
    if (
      profile.weightKg <= 0 ||
      profile.concentrationMgPerMl <= 0 ||
      profile.renalClearanceFactor <= 0 ||
      profile.renalClearanceFactor > 1.0 ||
      profile.minSafeDoseMgPerKg <= 0 ||
      profile.maxSafeDoseMgPerKg < profile.minSafeDoseMgPerKg
    ) {
      throw new Error("Invalid pharmacokinetic profile parameters.");
    }

    const minSafeMg =
      profile.weightKg * profile.minSafeDoseMgPerKg * profile.renalClearanceFactor;
    const maxSafeMg =
      profile.weightKg * profile.maxSafeDoseMgPerKg * profile.renalClearanceFactor;

    return {
      minSafeVolumeMl: minSafeMg / profile.concentrationMgPerMl,
      maxSafeVolumeMl: maxSafeMg / profile.concentrationMgPerMl,
    };
  }

  public evaluateVolumetricSafetyInvariant(
    volumetricReport: VolumetricMetrologyReport,
    profile: PatientPharmacokineticProfile,
    predictiveHorizon?: PredictiveHorizonAssessment
  ): VolumetricSafetyVerdict {
    const { minSafeVolumeMl, maxSafeVolumeMl } = this.computeSafeDoseBoundsMl(profile);
    const measured = volumetricReport.calibratedVolumeMl;
    const overdoseRatio = measured / maxSafeVolumeMl;

    if (volumetricReport.hasSurfaceTensionAdulteration) {
      return {
        isSafeToAdminister: false,
        measuredVolumeMl: measured,
        minSafeVolumeMl,
        maxSafeVolumeMl,
        overdoseRatio,
        recommendedUiAction: "TRIGGER_EMERGENCY_LOCKOUT",
        clinicalViolationReason: `CHEMICAL ADULTERATION INTERCEPT: Young-Laplace meniscus contact angle (${volumetricReport.estimatedContactAngleDeg.toFixed(1)} deg) violates pharmacopeia surface-tension bounds.`,
      };
    }

    if (volumetricReport.hasCavitationOrTamperAnomaly) {
      return {
        isSafeToAdminister: false,
        measuredVolumeMl: measured,
        minSafeVolumeMl,
        maxSafeVolumeMl,
        overdoseRatio,
        recommendedUiAction: "TRIGGER_EMERGENCY_LOCKOUT",
        clinicalViolationReason: `CRITICAL PHYSICAL ANOMALY: Radial distortion/cavitation index (kappa=${volumetricReport.radialDistortionIndexKappa.toFixed(3)}) exceeds barrel tolerance (${profile.maxAllowedKappa}).`,
      };
    }

    if (measured > maxSafeVolumeMl) {
      return {
        isSafeToAdminister: false,
        measuredVolumeMl: measured,
        minSafeVolumeMl,
        maxSafeVolumeMl,
        overdoseRatio,
        recommendedUiAction: "TRIGGER_EMERGENCY_LOCKOUT",
        clinicalViolationReason: `LETHAL OVERDOSE INTERCEPT: Physically measured meniscus volume (${measured.toFixed(2)} mL) is ${overdoseRatio.toFixed(2)}x above renal-adjusted ceiling (${maxSafeVolumeMl.toFixed(2)} mL) for ${profile.drugName}.`,
      };
    }

    if (predictiveHorizon?.isPreemptiveBreachImminent) {
      return {
        isSafeToAdminister: false,
        measuredVolumeMl: measured,
        minSafeVolumeMl,
        maxSafeVolumeMl,
        overdoseRatio: predictiveHorizon.projectedVolumeAtHorizonMl / maxSafeVolumeMl,
        recommendedUiAction: "TRIGGER_EMERGENCY_LOCKOUT",
        clinicalViolationReason: `PRE-EMPTIVE KALMAN FLOW INTERCEPT: Plunger velocity (+${predictiveHorizon.updatedState.flowVelocityMlPerSec.toFixed(2)} mL/s) will breach ${maxSafeVolumeMl.toFixed(2)} mL ceiling in ${(predictiveHorizon.timeToOverdoseBreachSec * 1000).toFixed(0)} ms.`,
      };
    }

    if (measured < minSafeVolumeMl) {
      return {
        isSafeToAdminister: false,
        measuredVolumeMl: measured,
        minSafeVolumeMl,
        maxSafeVolumeMl,
        overdoseRatio,
        recommendedUiAction: "TRIGGER_EMERGENCY_LOCKOUT",
        clinicalViolationReason: `SUB-THERAPEUTIC UNDERDOSE: Measured volume (${measured.toFixed(2)} mL) is below minimum therapeutic threshold (${minSafeVolumeMl.toFixed(2)} mL).`,
      };
    }

    return {
      isSafeToAdminister: true,
      measuredVolumeMl: measured,
      minSafeVolumeMl,
      maxSafeVolumeMl,
      overdoseRatio,
      recommendedUiAction: "COMMIT_VERIFIED_DOSE",
      clinicalViolationReason: `VERIFIED SAFE: ${measured.toFixed(2)} mL (Snell/Tilt/Young-Laplace compensated) within [${minSafeVolumeMl.toFixed(2)}, ${maxSafeVolumeMl.toFixed(2)}] mL window.`,
    };
  }
}