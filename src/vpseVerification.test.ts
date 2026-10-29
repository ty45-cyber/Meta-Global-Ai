import { describe, it, expect } from "bun:test";
import {
  RleBitstreamScanner,
  PhysicalMetrologyCalculator,
  SubPixelScanlineReconstructor,
} from "./rleMetrologyKernel";
import { SamWireExtractor } from "./samParallelEngine";
import { GlimmerTraceParser, EpistemicDivergenceAuditor } from "./epistemicFirewall";
import {
  RefractiveProjectiveCompensator,
  RleSolidOfRevolutionIntegrator,
  KalmanMeniscusFlowPredictor,
  PharmacokineticSafetyVerifier,
  PatientPharmacokineticProfile,
} from "./volumetricPharmacokineticKernel";
import {
  ByzantineConsensusValidator,
  AutonomousSelfHealingOrchestrator,
  GENESIS_FRAME_HASH,
} from "./byzantineConsensusOrchestrator";
import { AudioIngressGuard, GlimmerEdgeEndpointGuard } from "./glimmerVoiceIngress";

/**
 * Factory for deterministic test fixtures across 2D RLE, 3D cylindrical barrels,
 * and Muse Glimmer 30B dual-channel traces.
 * Strict 2-method boundary: createCylindricalBarrelRle and createGlimmerFixture.
 */
export class TestFixtureFactory {
  public createCylindricalBarrelRle(
    frameWidth: number,
    startRow: number,
    rowCount: number,
    cylinderDiameterPx: number
  ): string {
    const runs: number[] = [];
    let currentCursor = 0;

    for (let r = 0; r < rowCount; r++) {
      const rowStartPx = (startRow + r) * frameWidth + 20;
      const zeroGap = rowStartPx - currentCursor;
      runs.push(zeroGap, cylinderDiameterPx);
      currentCursor = rowStartPx + cylinderDiameterPx;
    }

    return `~${runs.join(",")}`;
  }

  public createGlimmerFixture(selfText: string, userText: string): string {
    return `assistant to=self\n${selfText}\nassistant to=user\n${userText}`;
  }
}

/**
 * Mathematical, optical, fluid-mechanical, kinematic, and cryptographic assertions for VPSE-Rx.
 * Strict 2-method boundary: assertSubPixelSnellAndYoungLaplacePhysics and assertKalmanByzantineHashChainAndSecurity.
 */
export class VpseMathematicalVerifier {
  public assertSubPixelSnellAndYoungLaplacePhysics(): void {
    const scanner = new RleBitstreamScanner();
    const reconstructor = new SubPixelScanlineReconstructor();
    const calculator = new PhysicalMetrologyCalculator();
    const compensator = new RefractiveProjectiveCompensator();
    const integrator = new RleSolidOfRevolutionIntegrator();
    const factory = new TestFixtureFactory();

    // 1. Sub-Pixel Savitzky-Golay quantization smoothing proof
    // Alternating +/- 1px Bresenham raster noise around true 24.0px diameter
    const quantizedChords = [24, 25, 23, 25, 23, 25, 23, 25, 23, 24];
    const cusumProfile = reconstructor.analyzeMeniscusAndCavitationCusum(quantizedChords);
    expect(cusumProfile.quantizationNoiseReductionRatio).toBeGreaterThan(2.0);
    expect(cusumProfile.smoothedChordsPx[4]).toBeCloseTo(24.0, 0);

    // 2. Young-Laplace capillary meniscus void & chemical surface-tension adulteration proof
    // Internal radius R_i = 5.0 mm, meniscus wetting rim height h_m = 1.5 mm
    // Analytical spherical cap void: (pi * 1.5 / 6) * (3 * 25 + 2.25) = 0.25 * pi * 77.25 = 60.6719 mm^3 = 0.06067 mL
    const meniscusReport = compensator.computeYoungLaplaceMeniscusCorrection(5.0, 1.5);
    expect(meniscusReport.meniscusCapillaryVoidMl).toBeCloseTo(0.060672, 5);
    expect(meniscusReport.hasSurfaceTensionAdulteration).toBe(false);

    // Adulterated surfactant spike (h_m = 4.6 mm on R_i = 5.0 mm -> xi = 0.92 > 0.85)
    const adulteratedReport = compensator.computeYoungLaplaceMeniscusCorrection(5.0, 4.6);
    expect(adulteratedReport.hasSurfaceTensionAdulteration).toBe(true);

    // 3. Combined Snell-Descartes + Tilt + Young-Laplace 3D Solid-of-Revolution integration
    const refSpans = scanner.parseWireToSpans("~0,100", 100_000);
    const barrelWire = factory.createCylindricalBarrelRle(200, 10, 40, 10);
    const liquidSpans = scanner.parseWireToSpans(barrelWire, 100_000);

    const planarReport = calculator.calibratePhysicalMetrics(
      liquidSpans,
      refSpans,
      liquidSpans,
      100.0,
      200,
      scanner
    );

    const fullPhysicsReport = integrator.integrateCylindricalVolumeMl(
      liquidSpans,
      planarReport,
      100.0,
      200,
      0.08,
      {
        fiducialObservedBbox: [0, 0, 85.60, 53.98],
        liquidRefractiveIndex: 1.333,
        barrelWallThicknessRatio: 0.10,
        explicitMeniscusHeightMm: 1.2,
      },
      compensator
    );

    expect(fullPhysicsReport.tiltForeshorteningGamma).toBeCloseTo(1.0, 5);
    expect(fullPhysicsReport.snellRadialContractionEta).toBeCloseTo(1 / 1.2997, 5);
    expect(fullPhysicsReport.meniscusCapillaryVoidMl).toBeGreaterThan(0.02);
    expect(fullPhysicsReport.calibratedVolumeMl).toBeLessThan(
      fullPhysicsReport.uncompensatedVolumeMl
    );
  }

  public assertKalmanByzantineHashChainAndSecurity(): void {
    const kalman = new KalmanMeniscusFlowPredictor();
    const pkVerifier = new PharmacokineticSafetyVerifier();
    const scanner = new RleBitstreamScanner();
    const calculator = new PhysicalMetrologyCalculator();
    const integrator = new RleSolidOfRevolutionIntegrator();
    const factory = new TestFixtureFactory();

    const horizonAssessment = kalman.evaluatePredictiveHorizonBreach(
      {
        filteredVolumeMl: 0.75,
        flowVelocityMlPerSec: 0.80,
        frameTimestampMs: 1000,
      },
      1.02,
      1250,
      1.20,
      0.50
    );
    expect(horizonAssessment.isPreemptiveBreachImminent).toBe(true);

    const refSpans = scanner.parseWireToSpans("~0,100", 100_000);
    const subCeilingSpans = scanner.parseWireToSpans(
      factory.createCylindricalBarrelRle(200, 10, 13, 10),
      100_000
    );
    const planar = calculator.calibratePhysicalMetrics(
      subCeilingSpans,
      refSpans,
      subCeilingSpans,
      100.0,
      200,
      scanner
    );
    const volReport = integrator.integrateCylindricalVolumeMl(
      subCeilingSpans,
      planar,
      100.0,
      200,
      0.08
    );

    const pediatricProfile: PatientPharmacokineticProfile = {
      patientIdHash: "pediatric-icu-094",
      weightKg: 15,
      renalClearanceFactor: 0.8,
      drugName: "Heparin Sodium High-Alert",
      concentrationMgPerMl: 100,
      minSafeDoseMgPerKg: 5,
      maxSafeDoseMgPerKg: 10,
      maxAllowedKappa: 0.08,
    };

    const preemptiveVerdict = pkVerifier.evaluateVolumetricSafetyInvariant(
      volReport,
      pediatricProfile,
      horizonAssessment
    );
    expect(preemptiveVerdict.isSafeToAdminister).toBe(false);

    // Verify Temporal Hash-Chain Anti-Replay Consensus across <0f> -> <1f>
    const parser = new GlimmerTraceParser();
    const auditor = new EpistemicDivergenceAuditor();
    const epistemicVerdict = auditor.auditChannelConsistency(
      factory.createGlimmerFixture("Measured 1.02 mL", "Measured 1.02 mL"),
      0.05,
      parser
    );

    const byzantineOrchestrator = new AutonomousSelfHealingOrchestrator(
      new ByzantineConsensusValidator()
    );
    const frame0Directive = byzantineOrchestrator.orchestrateConsensusAndHealing(
      "session-chain-01",
      volReport,
      preemptiveVerdict,
      epistemicVerdict,
      null,
      {
        frameIndex: 0,
        previousFrameIndex: -1,
        previousFrameProofHash: GENESIS_FRAME_HASH,
      }
    );

    const frame1Directive = byzantineOrchestrator.orchestrateConsensusAndHealing(
      "session-chain-01",
      volReport,
      preemptiveVerdict,
      epistemicVerdict,
      null,
      {
        frameIndex: 1,
        previousFrameIndex: 0,
        previousFrameProofHash: frame0Directive.consensusReport.cryptographicProofHash,
      }
    );

    expect(frame1Directive.consensusReport.parentProofHash).toBe(
      frame0Directive.consensusReport.cryptographicProofHash
    );

    // Replay attack (re-submitting frameIndex 1 when previousFrameIndex is already 1) must fail fast
    expect(() =>
      byzantineOrchestrator.orchestrateConsensusAndHealing(
        "session-chain-01",
        volReport,
        preemptiveVerdict,
        epistemicVerdict,
        null,
        {
          frameIndex: 1,
          previousFrameIndex: 1,
          previousFrameProofHash: frame1Directive.consensusReport.cryptographicProofHash,
        }
      )
    ).toThrow("Anti-replay invariant violation");

    // Verify SSRF, Audio Magic Bytes, and Inverse-SSRF Air-Gap Guards
    const extractor = new SamWireExtractor();
    expect(() => extractor.validateMediaEndpoint("https://169.254.169.254/meta")).toThrow();

    const audioGuard = new AudioIngressGuard();
    const wavHeader = new Uint8Array([
      0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x41, 0x56, 0x45, 0x00, 0x00,
    ]);
    expect(audioGuard.validateAudioMagicBytes(wavHeader, 1024)).toBe("wav");

    const airGapGuard = new GlimmerEdgeEndpointGuard();
    expect(() =>
      airGapGuard.enforceLocalAirGapEndpoint("https://public-cloud-host.com/v1")
    ).toThrow();
  }
}

describe("VPSE-Rx Level-5 Fluid Physics, Sub-Pixel Signal Processing & Hash-Chain Suite", () => {
  it("proves Savitzky-Golay sub-pixel smoothing, Snell refraction, and Young-Laplace meniscus calculus", () => {
    const verifier = new VpseMathematicalVerifier();
    verifier.assertSubPixelSnellAndYoungLaplacePhysics();
  });

  it("proves Kalman pre-emptive lockout, temporal hash-chain anti-replay, and air-gap security", () => {
    const verifier = new VpseMathematicalVerifier();
    verifier.assertKalmanByzantineHashChainAndSecurity();
  });
});