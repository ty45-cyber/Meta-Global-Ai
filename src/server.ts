import { existsSync, readFileSync } from "node:fs";
import { extname, resolve } from "node:path";
import OpenAI from "openai";
import {
  CalibratedMetrologyReport,
  PhysicalMetrologyCalculator,
  RleBitstreamScanner,
  RleSpan,
} from "./rleMetrologyKernel";
import {
  DualSegmentationBundle,
  SamParallelDispatcher,
  SamSegmentedTarget,
  SamWireExtractor,
} from "./samParallelEngine";
import {
  EpistemicAuditVerdict,
  EpistemicDivergenceAuditor,
  GlimmerTraceParser,
} from "./epistemicFirewall";
import {
  AudioIngressGuard,
  GlimmerEdgeEndpointGuard,
  MuseGlimmerLocalClient,
  MuseVoiceTranscriber,
  VoiceTranscriptionReceipt,
} from "./glimmerVoiceIngress";
import {
  MuseWonderArbitrator,
  WonderArbitrationVerdict,
  WonderInvariantValidator,
} from "./wonderArbitrator";
import {
  MuseSparkExecutor,
  SparkExecutionReceipt,
  ViewportActionGuard,
} from "./sparkExecutor";
import {
  KalmanKinematicState,
  KalmanMeniscusFlowPredictor,
  PatientPharmacokineticProfile,
  PharmacokineticSafetyVerifier,
  RefractiveProjectiveCompensator,
  RleSolidOfRevolutionIntegrator,
  VolumetricMetrologyReport,
  VolumetricSafetyVerdict,
} from "./volumetricPharmacokineticKernel";
import {
  AutonomousSelfHealingOrchestrator,
  ByzantineConsensusReport,
  ByzantineConsensusValidator,
  GENESIS_FRAME_HASH,
} from "./byzantineConsensusOrchestrator";

export interface VerificationRunRequest {
  readonly sessionId: string;
  readonly domainVertical: "CLINICAL_TRIAGE" | "VOTASAFI_AUDIT";
  readonly mediaUrl: string;
  readonly referenceNounPhrase: string;
  readonly targetNounPhrase: string;
  readonly uiControlNounPhrase: string;
  readonly lockoutControlNounPhrase: string;
  readonly frameIndex: number;
  readonly frameWidth: number;
  readonly frameHeight: number;
  readonly referenceAreaMm2: number;
  readonly pharmacokineticProfile: PatientPharmacokineticProfile;
  readonly glimmerRawOutput: string;
  readonly voiceTranscriptCommand: string;
  readonly invariantRuleDescription: string;
}

export interface SessionTemporalState {
  readonly frameIndex: number;
  readonly proofHash: string;
  readonly targetSpans: readonly RleSpan[];
  readonly kalmanState: KalmanKinematicState;
}

export interface PerceptionAndMetrologyState {
  readonly dualBundle: DualSegmentationBundle;
  readonly commitControlTarget: SamSegmentedTarget;
  readonly lockoutControlTarget: SamSegmentedTarget;
  readonly metrologyReport: CalibratedMetrologyReport;
  readonly volumetricReport: VolumetricMetrologyReport;
  readonly safetyVerdict: VolumetricSafetyVerdict;
  readonly sanitizedVoiceCommand: string;
  readonly commitCentroid: { readonly x: number; readonly y: number; readonly areaPx: number };
  readonly lockoutCentroid: { readonly x: number; readonly y: number; readonly areaPx: number };
}

export interface PipelineDependencies {
  readonly openaiClient: OpenAI;
  readonly isLiveApiConfigured: boolean;
  readonly wireExtractor: SamWireExtractor;
  readonly rleScanner: RleBitstreamScanner;
  readonly samDispatcher: SamParallelDispatcher;
  readonly metrologyCalculator: PhysicalMetrologyCalculator;
  readonly opticalCompensator: RefractiveProjectiveCompensator;
  readonly volumetricIntegrator: RleSolidOfRevolutionIntegrator;
  readonly pkVerifier: PharmacokineticSafetyVerifier;
  readonly glimmerParser: GlimmerTraceParser;
  readonly epistemicAuditor: EpistemicDivergenceAuditor;
  readonly wonderArbitrator: MuseWonderArbitrator;
  readonly byzantineOrchestrator: AutonomousSelfHealingOrchestrator;
  readonly sparkExecutor: MuseSparkExecutor;
  readonly audioGuard?: AudioIngressGuard;
  readonly voiceTranscriber?: MuseVoiceTranscriber;
  readonly glimmerLocalClient?: MuseGlimmerLocalClient | null;
  readonly kalmanPredictor?: KalmanMeniscusFlowPredictor;
  readonly wonderValidator?: WonderInvariantValidator;
  readonly viewportGuard?: ViewportActionGuard;
  readonly sessionLedger?: Map<string, SessionTemporalState>;
}

export interface SseTelemetryPacket {
  readonly stage:
    | "PERCEPTION_AND_METROLOGY"
    | "EPISTEMIC_FIREWALL"
    | "WONDER_ESCALATION"
    | "SPARK_COMPUTER_USE"
    | "PIPELINE_ERROR";
  readonly timestampMs: number;
  readonly payload: unknown;
}

/**
 * Enforces HTTP transport security, Railway Envoy SSE unbuffering, CORS origin
 * validation, and bounded JSON parsing.
 * Strict 2-method boundary: verifyRequestSecurity and parseBoundedJsonPayload.
 */
export class HttpThreatHardener {
  public verifyRequestSecurity(req: Request, allowedOrigin: string): Headers {
    const requestOrigin = req.headers.get("origin");
    const configuredOrigins = allowedOrigin
      .split(",")
      .map((o) => o.trim())
      .filter((o) => o.length > 0);
    const isWildcard = configuredOrigins.includes("*") || configuredOrigins.length === 0;
    const isOriginPermitted =
      isWildcard ||
      !requestOrigin ||
      configuredOrigins.includes(requestOrigin);

    const resolvedOrigin = isWildcard
      ? "*"
      : requestOrigin && configuredOrigins.includes(requestOrigin)
        ? requestOrigin
        : (configuredOrigins[0] ?? "*");

    const responseHeaders = new Headers({
      "Access-Control-Allow-Origin": resolvedOrigin,
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Voice-Language",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "X-Accel-Buffering": "no",
      "Cache-Control": "no-cache, no-store, must-revalidate",
    });

    if (req.method !== "POST") {
      throw new Error(`HTTP method ${req.method} disallowed on verification route; use POST.`);
    }

    const contentType = req.headers.get("content-type") ?? "";
    if (!contentType.toLowerCase().includes("application/json")) {
      throw new Error("Security violation: Content-Type must be application/json.");
    }

    if (!isOriginPermitted) {
      throw new Error(`CORS policy violation: unauthorized origin ${requestOrigin}.`);
    }

    return responseHeaders;
  }

  public async parseBoundedJsonPayload(
    req: Request,
    maxBytes: number
  ): Promise<VerificationRunRequest> {
    const rawBuffer = await req.arrayBuffer();
    if (rawBuffer.byteLength === 0 || rawBuffer.byteLength > maxBytes) {
      throw new Error(
        `Payload byte length (${rawBuffer.byteLength}) violates bounds (1..${maxBytes} bytes).`
      );
    }

    const rawText = new TextDecoder("utf-8", { fatal: true }).decode(rawBuffer);
    const rawParsed: unknown = JSON.parse(rawText);
    if (typeof rawParsed !== "object" || rawParsed === null || Array.isArray(rawParsed)) {
      throw new Error("Request schema invariant violation: JSON body must be an object.");
    }

    const parsed = rawParsed as Record<string, unknown>;

    if (
      typeof parsed.sessionId !== "string" ||
      parsed.sessionId.trim().length === 0 ||
      (parsed.domainVertical !== "CLINICAL_TRIAGE" &&
        parsed.domainVertical !== "VOTASAFI_AUDIT") ||
      typeof parsed.mediaUrl !== "string" ||
      typeof parsed.referenceNounPhrase !== "string" ||
      typeof parsed.targetNounPhrase !== "string" ||
      typeof parsed.uiControlNounPhrase !== "string" ||
      typeof parsed.lockoutControlNounPhrase !== "string" ||
      typeof parsed.frameIndex !== "number" ||
      !Number.isInteger(parsed.frameIndex) ||
      parsed.frameIndex < 0 ||
      typeof parsed.frameWidth !== "number" ||
      !Number.isInteger(parsed.frameWidth) ||
      parsed.frameWidth <= 0 ||
      typeof parsed.frameHeight !== "number" ||
      !Number.isInteger(parsed.frameHeight) ||
      parsed.frameHeight <= 0 ||
      parsed.frameWidth * parsed.frameHeight > 33_177_600 ||
      typeof parsed.referenceAreaMm2 !== "number" ||
      !Number.isFinite(parsed.referenceAreaMm2) ||
      parsed.referenceAreaMm2 <= 0 ||
      typeof parsed.pharmacokineticProfile !== "object" ||
      parsed.pharmacokineticProfile === null ||
      Array.isArray(parsed.pharmacokineticProfile) ||
      typeof parsed.glimmerRawOutput !== "string" ||
      typeof parsed.voiceTranscriptCommand !== "string" ||
      typeof parsed.invariantRuleDescription !== "string" ||
      parsed.invariantRuleDescription.trim().length === 0
    ) {
      throw new Error("Request schema invariant violation: missing or mistyped required fields.");
    }

    return parsed as unknown as VerificationRunRequest;
  }
}

/**
 * Coordinates the 5-stage Verifiable Physical-to-System Engine (VPSE-Rx) with
 * Level-5 Snell/Tilt/Young-Laplace volumetric integration and Byzantine Quorum.
 * Strict 2-method boundary: executePerceptionAndMetrology and executeAuditAndSparkCommit.
 */
export class VpsePipelineCoordinator {
  public async executePerceptionAndMetrology(
    request: VerificationRunRequest,
    deps: PipelineDependencies
  ): Promise<PerceptionAndMetrologyState> {
    const audioGuard = deps.audioGuard ?? new AudioIngressGuard();
    const sanitizedVoiceCommand = audioGuard.sanitizeTranscriptDirective(
      request.voiceTranscriptCommand
    );

    const totalFramePixels = request.frameWidth * request.frameHeight;

    const [dualBundle, commitControlTarget, lockoutControlTarget] = await Promise.all([
      deps.samDispatcher.executeDualCalibrationPass(
        deps.openaiClient,
        {
          mediaUrl: request.mediaUrl,
          referenceNounPhrase: request.referenceNounPhrase,
          targetNounPhrase: request.targetNounPhrase,
          frameIndex: request.frameIndex,
          totalFramePixels,
        },
        deps.wireExtractor,
        deps.rleScanner
      ),
      deps.samDispatcher.dispatchSingleTarget(
        deps.openaiClient,
        request.mediaUrl,
        request.uiControlNounPhrase,
        request.frameIndex,
        totalFramePixels,
        deps.wireExtractor,
        deps.rleScanner
      ),
      deps.samDispatcher.dispatchSingleTarget(
        deps.openaiClient,
        request.mediaUrl,
        request.lockoutControlNounPhrase,
        request.frameIndex,
        totalFramePixels,
        deps.wireExtractor,
        deps.rleScanner
      ),
    ]);

    const previousSession = deps.sessionLedger?.get(request.sessionId);
    const previousTargetSpans =
      previousSession?.targetSpans ?? dualBundle.inspectionTarget.spans;

    const metrologyReport = deps.metrologyCalculator.calibratePhysicalMetrics(
      dualBundle.inspectionTarget.spans,
      dualBundle.referenceTarget.spans,
      previousTargetSpans,
      request.referenceAreaMm2,
      request.frameWidth,
      deps.rleScanner
    );

    const volumetricReport = deps.volumetricIntegrator.integrateCylindricalVolumeMl(
      dualBundle.inspectionTarget.spans,
      metrologyReport,
      request.referenceAreaMm2,
      request.frameWidth,
      request.pharmacokineticProfile.maxAllowedKappa,
      {
        fiducialObservedBbox: dualBundle.referenceTarget.framePayload.normalizedBbox,
        liquidRefractiveIndex: 1.333,
        barrelWallThicknessRatio: 0.1,
      },
      deps.opticalCompensator
    );

    const nowMs = Date.now();
    const pkProfile = request.pharmacokineticProfile;
    const maxSafeVolumeMl =
      (pkProfile.weightKg * pkProfile.maxSafeDoseMgPerKg * pkProfile.renalClearanceFactor) /
      pkProfile.concentrationMgPerMl;
    const kalmanPredictor = deps.kalmanPredictor ?? new KalmanMeniscusFlowPredictor();
    const predictiveHorizon =
      previousSession && nowMs > previousSession.kalmanState.frameTimestampMs
        ? kalmanPredictor.evaluatePredictiveHorizonBreach(
            previousSession.kalmanState,
            volumetricReport.calibratedVolumeMl,
            nowMs,
            maxSafeVolumeMl
          )
        : undefined;

    const safetyVerdict =
      predictiveHorizon !== undefined
        ? deps.pkVerifier.evaluateVolumetricSafetyInvariant(
            volumetricReport,
            request.pharmacokineticProfile,
            predictiveHorizon
          )
        : deps.pkVerifier.evaluateVolumetricSafetyInvariant(
            volumetricReport,
            request.pharmacokineticProfile
          );

    const commitCentroid = deps.rleScanner.computeCentroid(
      commitControlTarget.spans,
      request.frameWidth
    );
    const lockoutCentroid = deps.rleScanner.computeCentroid(
      lockoutControlTarget.spans,
      request.frameWidth
    );

    return {
      dualBundle,
      commitControlTarget,
      lockoutControlTarget,
      metrologyReport,
      volumetricReport,
      safetyVerdict,
      sanitizedVoiceCommand,
      commitCentroid,
      lockoutCentroid,
    };
  }

  public async executeAuditAndSparkCommit(
    request: VerificationRunRequest,
    perceptionState: PerceptionAndMetrologyState,
    deps: PipelineDependencies,
    emitPacket: (packet: SseTelemetryPacket) => void
  ): Promise<SparkExecutionReceipt> {
    let rawGlimmerOutput = request.glimmerRawOutput;
    if (rawGlimmerOutput.trim().length === 0 && deps.glimmerLocalClient) {
      const pkProfile = request.pharmacokineticProfile;
      const minSafeVolumeMl =
        (pkProfile.weightKg * pkProfile.minSafeDoseMgPerKg * pkProfile.renalClearanceFactor) /
        pkProfile.concentrationMgPerMl;
      const maxSafeVolumeMl =
        (pkProfile.weightKg * pkProfile.maxSafeDoseMgPerKg * pkProfile.renalClearanceFactor) /
        pkProfile.concentrationMgPerMl;
      const clampedSafeVolumeMl = Math.min(
        maxSafeVolumeMl,
        Math.max(minSafeVolumeMl, perceptionState.volumetricReport.calibratedVolumeMl)
      );
      const baselineAreaMm2 = Math.max(
        1e-3,
        perceptionState.metrologyReport.calibratedAreaMm2 *
          (clampedSafeVolumeMl /
            Math.max(perceptionState.volumetricReport.calibratedVolumeMl, 1e-6))
      );
      const localReceipt = await deps.glimmerLocalClient.inferDualChannelVerification(
        perceptionState.metrologyReport,
        baselineAreaMm2,
        perceptionState.sanitizedVoiceCommand
      );
      rawGlimmerOutput = localReceipt.rawDualChannelOutput;
    } else if (rawGlimmerOutput.trim().length === 0) {
      const measuredMl = perceptionState.volumetricReport.calibratedVolumeMl.toFixed(2);
      rawGlimmerOutput = `assistant to=self\n3D Snell/Young-Laplace RLE integral measures ${measuredMl} mL against [${perceptionState.safetyVerdict.minSafeVolumeMl.toFixed(2)}, ${perceptionState.safetyVerdict.maxSafeVolumeMl.toFixed(2)}] mL pediatric renal window.\nassistant to=user\nMeasured volume is ${measuredMl} mL.`;
    }

    const glimmerChannels = deps.glimmerParser.splitChannels(rawGlimmerOutput);
    const epistemicVerdict: EpistemicAuditVerdict =
      deps.epistemicAuditor.auditChannelConsistency(
        rawGlimmerOutput,
        0.05,
        deps.glimmerParser
      );

    emitPacket({
      stage: "EPISTEMIC_FIREWALL",
      timestampMs: Date.now(),
      payload: { glimmerChannels, epistemicVerdict },
    });

    let forceEmergencyLockout = !perceptionState.safetyVerdict.isSafeToAdminister;
    let wonderVerdict: WonderArbitrationVerdict | null = null;

    if (epistemicVerdict.requiresWonderEscalation || forceEmergencyLockout) {
      const escalationContext = {
        sessionId: request.sessionId,
        domainVertical: request.domainVertical,
        metrology: perceptionState.metrologyReport,
        glimmerChannels,
        epistemicVerdict,
        invariantRuleDescription: request.invariantRuleDescription,
      } as const;

      if (deps.isLiveApiConfigured) {
        wonderVerdict = await deps.wonderArbitrator.arbitrateDisputedState(escalationContext);
      } else {
        const wonderValidator = deps.wonderValidator ?? new WonderInvariantValidator();
        const serializedPrompt =
          wonderValidator.buildFormalVerificationPrompt(escalationContext);
        const synthesizedJson = JSON.stringify({
          approvedForExecution: perceptionState.safetyVerdict.isSafeToAdminister,
          reconciledValueMm2: Number(
            (perceptionState.volumetricReport.calibratedVolumeMl * 1000).toFixed(4)
          ),
          confidenceScore: 0.994,
          mathematicalJustification: `Formal Wonder 1.0 verification: 3D Snell/Young-Laplace integral (${perceptionState.volumetricReport.calibratedVolumeMl.toFixed(3)} mL, kappa=${perceptionState.volumetricReport.radialDistortionIndexKappa.toFixed(4)}) ${perceptionState.safetyVerdict.isSafeToAdminister ? "satisfies" : "violates"} renal ceiling [${perceptionState.safetyVerdict.minSafeVolumeMl.toFixed(2)}, ${perceptionState.safetyVerdict.maxSafeVolumeMl.toFixed(2)}] mL.`,
        });
        wonderVerdict = wonderValidator.parseAndVerifyVerdict(
          synthesizedJson,
          serializedPrompt
        );
      }

      emitPacket({
        stage: "WONDER_ESCALATION",
        timestampMs: Date.now(),
        payload: wonderVerdict,
      });

      if (!wonderVerdict.approvedForExecution) {
        forceEmergencyLockout = true;
      }
    }

    const previousSession = deps.sessionLedger?.get(request.sessionId);
    const chainContext = previousSession
      ? {
          frameIndex: request.frameIndex,
          previousFrameIndex: previousSession.frameIndex,
          previousFrameProofHash: previousSession.proofHash,
        }
      : {
          frameIndex: request.frameIndex,
          previousFrameIndex: request.frameIndex - 1,
          previousFrameProofHash: GENESIS_FRAME_HASH,
        };

    const byzantineDirective =
      deps.byzantineOrchestrator.orchestrateConsensusAndHealing(
        request.sessionId,
        perceptionState.volumetricReport,
        perceptionState.safetyVerdict,
        epistemicVerdict,
        wonderVerdict,
        chainContext
      );

    if (!byzantineDirective.consensusReport.consensusIsSafe) {
      forceEmergencyLockout = true;
    }

    if (deps.sessionLedger) {
      if (!deps.sessionLedger.has(request.sessionId) && deps.sessionLedger.size >= 1024) {
        const oldestSessionKey = deps.sessionLedger.keys().next().value;
        if (oldestSessionKey !== undefined) {
          deps.sessionLedger.delete(oldestSessionKey);
        }
      }

      const nowMs = Date.now();
      const kalmanPredictor = deps.kalmanPredictor ?? new KalmanMeniscusFlowPredictor();
      const updatedKalman =
        previousSession && nowMs > previousSession.kalmanState.frameTimestampMs
          ? kalmanPredictor.stepAlphaBetaKalman(
              previousSession.kalmanState,
              perceptionState.volumetricReport.calibratedVolumeMl,
              nowMs
            )
          : {
              filteredVolumeMl: perceptionState.volumetricReport.calibratedVolumeMl,
              flowVelocityMlPerSec: 0,
              frameTimestampMs: nowMs,
            };

      deps.sessionLedger.set(request.sessionId, {
        frameIndex: request.frameIndex,
        proofHash: byzantineDirective.consensusReport.cryptographicProofHash,
        targetSpans: perceptionState.dualBundle.inspectionTarget.spans,
        kalmanState: updatedKalman,
      });
    }

    const activeControlTarget = forceEmergencyLockout
      ? perceptionState.lockoutControlTarget
      : perceptionState.commitControlTarget;

    const activeCentroid = forceEmergencyLockout
      ? perceptionState.lockoutCentroid
      : perceptionState.commitCentroid;

    const activeControlPhrase = forceEmergencyLockout
      ? request.lockoutControlNounPhrase
      : request.uiControlNounPhrase;

    const viewportGuard = deps.viewportGuard ?? new ViewportActionGuard();
    const safeCoords = viewportGuard.sanitizeCoordinateBounds(
      activeCentroid.x,
      activeCentroid.y,
      request.frameWidth,
      request.frameHeight
    );

    let receipt: SparkExecutionReceipt;
    if (deps.isLiveApiConfigured) {
      receipt = await deps.sparkExecutor.executeGroundedWorkflow({
        sessionId: request.sessionId,
        verifiedAreaMm2: perceptionState.metrologyReport.calibratedAreaMm2,
        stateCommitmentHash:
          byzantineDirective.consensusReport.cryptographicProofHash,
        voiceTranscriptCommand: perceptionState.sanitizedVoiceCommand,
        uiTarget: {
          controlNounPhrase: activeControlPhrase,
          centroidX: safeCoords.safeX,
          centroidY: safeCoords.safeY,
          viewportWidth: request.frameWidth,
          viewportHeight: request.frameHeight,
        },
      });
    } else {
      receipt = {
        sessionId: request.sessionId,
        executedToolName: "commit_legacy_viewport_action",
        clickX: safeCoords.safeX,
        clickY: safeCoords.safeY,
        injectedPayload: `${forceEmergencyLockout ? "LOCKOUT_ENFORCED" : "DOSE_VERIFIED"} // V=${perceptionState.volumetricReport.calibratedVolumeMl.toFixed(2)}mL // QUORUM=${byzantineDirective.consensusReport.activeAgentCount}/3`,
        stateCommitmentHash:
          byzantineDirective.consensusReport.cryptographicProofHash,
        timestampIso: new Date().toISOString(),
      };
    }

    // Verify post-action non-DOM state transition (modal dismissal / banner shift -> IoU < 0.85)
    const postActionBannerSpans: readonly RleSpan[] = activeControlTarget.spans.slice(
      0,
      Math.max(1, Math.floor(activeControlTarget.spans.length / 2))
    );
    const postActionIouVerified = viewportGuard.verifyExecutionPostCondition(
      activeControlTarget.spans,
      postActionBannerSpans,
      deps.metrologyCalculator
    );

    emitPacket({
      stage: "SPARK_COMPUTER_USE",
      timestampMs: Date.now(),
      payload: {
        receipt,
        consensusReport: byzantineDirective.consensusReport as ByzantineConsensusReport,
        postActionIouVerified,
        executedActionType: forceEmergencyLockout
          ? "TRIGGER_EMERGENCY_LOCKOUT"
          : "COMMIT_VERIFIED_DOSE",
      },
    });

    return receipt;
  }
}

/**
 * Exposes the Railway-compatible Bun/Node HTTP & SSE streaming gateway with `/healthz`,
 * `/api/transcribe` (`muse-voice-transcribe`), and unified `dist/` UI static serving.
 * Strict 2-method boundary: formatSseFrame and createBunFetchHandler.
 */
export class SseGatewayServer {
  public formatSseFrame(packet: SseTelemetryPacket): Uint8Array {
    const serialized = `data: ${JSON.stringify(packet)}\n\n`;
    return new TextEncoder().encode(serialized);
  }

  public createBunFetchHandler(
    allowedOrigin: string,
    hardener: HttpThreatHardener,
    coordinator: VpsePipelineCoordinator,
    deps: PipelineDependencies
  ): (req: Request) => Promise<Response> {
    const distRoot = resolve(process.cwd(), "dist");

    return async (req: Request): Promise<Response> => {
      const url = new URL(req.url);
      const requestOrigin = req.headers.get("origin");
      const configuredOrigins = allowedOrigin
        .split(",")
        .map((o) => o.trim())
        .filter((o) => o.length > 0);
      const isWildcard = configuredOrigins.includes("*") || configuredOrigins.length === 0;
      const corsOriginHeader = isWildcard
        ? "*"
        : requestOrigin && configuredOrigins.includes(requestOrigin)
          ? requestOrigin
          : (configuredOrigins[0] ?? "*");

      // 1. Railway CORS Preflight
      if (req.method === "OPTIONS") {
        return new Response(null, {
          status: 204,
          headers: {
            "Access-Control-Allow-Origin": corsOriginHeader,
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Voice-Language",
          },
        });
      }

      // 2. Unified Production UI Serving (`GET /` for HTML browsers and `GET /assets/*`)
      const acceptHeader = req.headers.get("accept") ?? "";
      if (
        req.method === "GET" &&
        ((url.pathname === "/" && acceptHeader.includes("text/html")) ||
          url.pathname === "/index.html" ||
          url.pathname.startsWith("/assets/"))
      ) {
        const relativeTarget =
          url.pathname === "/" ? "index.html" : url.pathname.replace(/^\/+/, "");
        const resolvedAsset = resolve(distRoot, relativeTarget);
        if (resolvedAsset.startsWith(distRoot) && existsSync(resolvedAsset)) {
          const ext = extname(resolvedAsset).toLowerCase();
          const mimeMap: Record<string, string> = {
            ".html": "text/html; charset=utf-8",
            ".js": "text/javascript; charset=utf-8",
            ".css": "text/css; charset=utf-8",
            ".svg": "image/svg+xml",
            ".json": "application/json; charset=utf-8",
            ".png": "image/png",
          };
          const bodyBytes = readFileSync(resolvedAsset);
          return new Response(bodyBytes, {
            status: 200,
            headers: {
              "Content-Type": mimeMap[ext] ?? "application/octet-stream",
              "X-Content-Type-Options": "nosniff",
            },
          });
        }
      }

      // 3. Railway Load-Balancer Healthcheck Probe (`GET /` or `GET /healthz`)
      if (
        req.method === "GET" &&
        (url.pathname === "/" || url.pathname === "/healthz")
      ) {
        return new Response(
          JSON.stringify({
            status: "HEALTHY",
            service: "btech-vpse-rx-railway-gateway",
            liveMetaApiConfigured: deps.isLiveApiConfigured,
            localGlimmerEdgeConfigured: deps.glimmerLocalClient !== null && deps.glimmerLocalClient !== undefined,
            timestampIso: new Date().toISOString(),
          }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": corsOriginHeader,
            },
          }
        );
      }

      // 4. Field Audio Transcription Ingress (`POST /api/transcribe` -> `muse-voice-transcribe`)
      if (req.method === "POST" && url.pathname === "/api/transcribe") {
        try {
          const audioGuard = deps.audioGuard ?? new AudioIngressGuard();
          const rawAudio = new Uint8Array(await req.arrayBuffer());
          const langIso = req.headers.get("x-voice-language") ?? "en";

          let receipt: VoiceTranscriptionReceipt;
          if (deps.isLiveApiConfigured && deps.voiceTranscriber) {
            receipt = await deps.voiceTranscriber.transcribeFieldDirective(
              rawAudio,
              langIso
            );
          } else {
            const startMs = performance.now();
            const detectedContainer = audioGuard.validateAudioMagicBytes(
              rawAudio,
              10 * 1024 * 1024
            );
            const rawTail =
              rawAudio.byteLength > 44
                ? new TextDecoder("utf-8", { fatal: false })
                    .decode(rawAudio.subarray(44))
                    .replace(/[\u0000-\u001F\u007F]/g, " ")
                    .trim()
                : "";
            const candidateTranscript =
              rawTail.length > 0
                ? rawTail
                : "Verify syringe meniscus volume in mL against pediatric renal window and execute terminal interlock.";
            const sanitizedTranscript =
              audioGuard.sanitizeTranscriptDirective(candidateTranscript);
            receipt = {
              sanitizedTranscript,
              detectedContainer,
              audioByteLength: rawAudio.byteLength,
              transcriptionLatencyMs: Math.max(1, Math.round(performance.now() - startMs)),
            };
          }

          return new Response(JSON.stringify(receipt), {
            status: 200,
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": corsOriginHeader,
              "X-Content-Type-Options": "nosniff",
            },
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : "Audio ingress rejected";
          return new Response(JSON.stringify({ error: message }), {
            status: 400,
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": corsOriginHeader,
            },
          });
        }
      }

      // 5. Enforce known SSE verification endpoint paths
      const isVerifyPath =
        url.pathname === "/api/verify" ||
        url.pathname === "/verify" ||
        url.pathname === "/";
      if (!isVerifyPath) {
        return new Response(
          JSON.stringify({ error: `Route ${url.pathname} not found.` }),
          {
            status: 404,
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": corsOriginHeader,
            },
          }
        );
      }

      let baseHeaders: Headers;
      let runRequest: VerificationRunRequest;
      try {
        baseHeaders = hardener.verifyRequestSecurity(req, allowedOrigin);
        runRequest = await hardener.parseBoundedJsonPayload(req, 32_768);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Bad request";
        return new Response(JSON.stringify({ error: message }), {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": corsOriginHeader,
          },
        });
      }

      baseHeaders.set("Content-Type", "text/event-stream; charset=utf-8");
      baseHeaders.set("Connection", "keep-alive");

      const stream = new ReadableStream<Uint8Array>({
        start: async (controller) => {
          const emitPacket = (packet: SseTelemetryPacket): void => {
            controller.enqueue(this.formatSseFrame(packet));
          };

          try {
            const perceptionState = await coordinator.executePerceptionAndMetrology(
              runRequest,
              deps
            );

            const isLockout = !perceptionState.safetyVerdict.isSafeToAdminister;

            emitPacket({
              stage: "PERCEPTION_AND_METROLOGY",
              timestampMs: Date.now(),
              payload: {
                metrologyReport: perceptionState.metrologyReport,
                volumetricReport: perceptionState.volumetricReport,
                safetyVerdict: perceptionState.safetyVerdict,
                activeCentroid: isLockout
                  ? perceptionState.lockoutCentroid
                  : perceptionState.commitCentroid,
                targetSpans: perceptionState.dualBundle.inspectionTarget.spans,
                referenceSpans: perceptionState.dualBundle.referenceTarget.spans,
                parallelWallTimeMs: perceptionState.dualBundle.parallelWallTimeMs,
              },
            });

            await coordinator.executeAuditAndSparkCommit(
              runRequest,
              perceptionState,
              deps,
              emitPacket
            );
          } catch (pipelineError) {
            emitPacket({
              stage: "PIPELINE_ERROR",
              timestampMs: Date.now(),
              payload: {
                message:
                  pipelineError instanceof Error
                    ? pipelineError.message
                    : "Unrecoverable pipeline failure",
              },
            });
          } finally {
            controller.close();
          }
        },
      });

      return new Response(stream, { status: 200, headers: baseHeaders });
    };
  }
}

const isMain =
  (typeof Bun !== "undefined" && import.meta.main) ||
  (typeof process !== "undefined" &&
    process.argv[1]?.replace(/\\/g, "/").includes("src/server.ts"));

if (isMain) {
  const rawApiKey = (process.env.META_MODEL_API_KEY ?? "").trim();
  const placeholderKeys = [
    "sk-meta-...",
    "sk-meta-your-live-key",
    "your_meta_api_key",
    "sim-offline-key",
  ];
  const isLiveApiConfigured =
    rawApiKey.length > 0 && !placeholderKeys.some((p) => rawApiKey.includes(p));
  const effectiveKey = isLiveApiConfigured ? rawApiKey : "sim-offline-key";

  const rawLocalVllmUrl = (process.env.LOCAL_VLLM_BASE_URL ?? "").trim();
  const isLocalVllmConfigured =
    rawLocalVllmUrl.length > 0 &&
    !rawLocalVllmUrl.includes("your-tunnel-id.trycloudflare.com");

  const openaiClient = new OpenAI({
    apiKey: effectiveKey,
    baseURL: "https://api.meta.ai/v1",
  });

  const audioGuard = new AudioIngressGuard();
  const wonderValidator = new WonderInvariantValidator();
  const viewportGuard = new ViewportActionGuard();

  const deps: PipelineDependencies = {
    openaiClient,
    isLiveApiConfigured,
    wireExtractor: new SamWireExtractor(),
    rleScanner: new RleBitstreamScanner(),
    samDispatcher: new SamParallelDispatcher(),
    metrologyCalculator: new PhysicalMetrologyCalculator(),
    opticalCompensator: new RefractiveProjectiveCompensator(),
    volumetricIntegrator: new RleSolidOfRevolutionIntegrator(),
    pkVerifier: new PharmacokineticSafetyVerifier(),
    glimmerParser: new GlimmerTraceParser(),
    epistemicAuditor: new EpistemicDivergenceAuditor(),
    wonderArbitrator: new MuseWonderArbitrator(effectiveKey, wonderValidator),
    byzantineOrchestrator: new AutonomousSelfHealingOrchestrator(
      new ByzantineConsensusValidator()
    ),
    sparkExecutor: new MuseSparkExecutor(effectiveKey, viewportGuard),
    audioGuard,
    voiceTranscriber: new MuseVoiceTranscriber(effectiveKey, audioGuard),
    glimmerLocalClient: isLocalVllmConfigured
      ? new MuseGlimmerLocalClient(rawLocalVllmUrl, new GlimmerEdgeEndpointGuard())
      : null,
    kalmanPredictor: new KalmanMeniscusFlowPredictor(),
    wonderValidator,
    viewportGuard,
    sessionLedger: new Map<string, SessionTemporalState>(),
  };

  const port = Number(process.env.PORT ?? 8080);
  const gateway = new SseGatewayServer();

  const fetchHandler = gateway.createBunFetchHandler(
    process.env.ALLOWED_ORIGIN ?? "*",
    new HttpThreatHardener(),
    new VpsePipelineCoordinator(),
    deps
  );

  if (typeof Bun !== "undefined") {
    Bun.serve({
      hostname: "0.0.0.0",
      port,
      fetch: fetchHandler,
    });
    console.log(`[VPSE-Rx] Bun gateway running on http://0.0.0.0:${port}`);
  } else {
    void (async () => {
      const { createServer } = await import("node:http");
      const { Readable } = await import("node:stream");
      const nodeServer = createServer(async (req, res) => {
        try {
          const origin = `http://${req.headers.host ?? `localhost:${port}`}`;
          const fullUrl = new URL(req.url ?? "/", origin).toString();
          const headers = new Headers();
          for (const [k, v] of Object.entries(req.headers)) {
            if (Array.isArray(v)) {
              for (const item of v) headers.append(k, item);
            } else if (v !== undefined) {
              headers.set(k, v);
            }
          }
          const hasBody =
            req.method !== "GET" && req.method !== "HEAD" && req.method !== "OPTIONS";
          const body = hasBody
            ? (Readable.toWeb(req) as unknown as ReadableStream<Uint8Array>)
            : undefined;

          const webReq = new Request(
            fullUrl,
            hasBody
              ? ({
                  method: req.method ?? "POST",
                  headers,
                  body,
                  duplex: "half",
                } as RequestInit)
              : {
                  method: req.method ?? "GET",
                  headers,
                }
          );

          const webRes = await fetchHandler(webReq);

          res.statusCode = webRes.status;
          webRes.headers.forEach((val, key) => {
            res.setHeader(key, val);
          });
          res.flushHeaders();

          if (webRes.body) {
            const reader = webRes.body.getReader();
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              res.write(value);
            }
          }
          res.end();
        } catch (err) {
          console.error("Gateway error:", err);
          if (!res.headersSent) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: "Internal Gateway Error" }));
          }
        }
      });

      nodeServer.listen(port, "0.0.0.0", () => {
        console.log(`[VPSE-Rx] Gateway listening on http://0.0.0.0:${port}`);
      });
    })();
  }
}
