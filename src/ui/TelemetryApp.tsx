import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import type { CalibratedMetrologyReport, RleSpan } from "../rleMetrologyKernel";
import type { EpistemicAuditVerdict, SeparatedGlimmerChannels } from "../epistemicFirewall";
import type { WonderArbitrationVerdict } from "../wonderArbitrator";
import type { SparkExecutionReceipt } from "../sparkExecutor";
import type {
  VolumetricMetrologyReport,
  VolumetricSafetyVerdict,
} from "../volumetricPharmacokineticKernel";
import type { ByzantineConsensusReport } from "../byzantineConsensusOrchestrator";
import type { SseTelemetryPacket, VerificationRunRequest } from "../server";

export type PhysicalSyringeScenario =
  | "NOMINAL_0_95ML"
  | "OVERDOSE_3_14ML"
  | "CAVITATION_TAMPER";

export interface TelemetryDashboardState {
  readonly isStreaming: boolean;
  readonly metrology: CalibratedMetrologyReport | null;
  readonly volumetric: VolumetricMetrologyReport | null;
  readonly safetyVerdict: VolumetricSafetyVerdict | null;
  readonly parallelLatencyMs: number | null;
  readonly targetSpans: readonly RleSpan[];
  readonly referenceSpans: readonly RleSpan[];
  readonly activeCentroid: { readonly x: number; readonly y: number } | null;
  readonly glimmerChannels: SeparatedGlimmerChannels | null;
  readonly epistemicVerdict: EpistemicAuditVerdict | null;
  readonly wonderVerdict: WonderArbitrationVerdict | null;
  readonly sparkReceipt: SparkExecutionReceipt | null;
  readonly consensusReport: ByzantineConsensusReport | null;
  readonly executedActionType:
    | "COMMIT_VERIFIED_DOSE"
    | "TRIGGER_EMERGENCY_LOCKOUT"
    | null;
  readonly errorBanner: string | null;
}

/**
 * Renders the non-DOM HTML5 `<canvas>` Citrix Infusion Terminal, graduated syringe
 * barrel meniscus, and SAM 3.1 RLE disk-integration overlays in O(R) time.
 * Strict 2-method boundary: paintLegacyTerminalSurface and paintRleSpansAndCentroid.
 */
export class LegacyCanvasSandboxRenderer {
  public paintLegacyTerminalSurface(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    scenario: PhysicalSyringeScenario
  ): void {
    ctx.fillStyle = "#090d16";
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = "#162032";
    ctx.fillRect(0, 0, width, 34);
    ctx.fillStyle = "#94a3b8";
    ctx.font = "bold 11px monospace";
    ctx.fillText(
      "CITRIX PEDIATRIC ICU INFUSION TERMINAL // NON-DOM VIEWPORT (640x360)",
      12,
      21
    );

    ctx.strokeStyle = "#38bdf8";
    ctx.lineWidth = 2;
    ctx.strokeRect(24, 56, 136, 86);
    ctx.fillStyle = "#0c4a6e";
    ctx.fillRect(26, 58, 132, 82);
    ctx.fillStyle = "#e0f2fe";
    ctx.font = "11px monospace";
    ctx.fillText("ISO-7810 FIDUCIAL", 34, 94);
    ctx.fillText("4620.69 mm² REF", 34, 112);

    const barrelX = 235;
    const barrelTopY = 54;
    const barrelWidth = 76;
    const barrelHeight = 250;

    ctx.strokeStyle = "#64748b";
    ctx.lineWidth = 2;
    ctx.strokeRect(barrelX, barrelTopY, barrelWidth, barrelHeight);

    const liquidHeightPx =
      scenario === "NOMINAL_0_95ML" ? 72 : scenario === "OVERDOSE_3_14ML" ? 210 : 155;
    const liquidTopY = barrelTopY + barrelHeight - liquidHeightPx;

    ctx.fillStyle =
      scenario === "NOMINAL_0_95ML"
        ? "rgba(16, 185, 129, 0.45)"
        : "rgba(244, 63, 94, 0.48)";
    ctx.fillRect(barrelX + 2, liquidTopY, barrelWidth - 4, liquidHeightPx - 2);

    if (scenario === "CAVITATION_TAMPER") {
      ctx.fillStyle = "#090d16";
      ctx.beginPath();
      ctx.arc(barrelX + 38, liquidTopY + 55, 19, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#f59e0b";
      ctx.stroke();
    }

    ctx.fillStyle = "#e2e8f0";
    ctx.fillRect(barrelX + 2, liquidTopY - 10, barrelWidth - 4, 10);

    ctx.fillStyle = "#94a3b8";
    ctx.font = "10px monospace";
    for (let ml = 1; ml <= 4; ml++) {
      const tickY = barrelTopY + barrelHeight - ml * 58;
      ctx.fillRect(barrelX + barrelWidth, tickY, 8, 2);
      ctx.fillText(`${ml}.0 mL`, barrelX + barrelWidth + 12, tickY + 4);
    }

    ctx.fillStyle = "#064e3b";
    ctx.fillRect(410, 175, 206, 54);
    ctx.strokeStyle = "#10b981";
    ctx.strokeRect(410, 175, 206, 54);
    ctx.fillStyle = "#a7f3d0";
    ctx.font = "bold 12px monospace";
    ctx.fillText("[ COMMIT VERIFIED DOSE ]", 426, 206);

    ctx.fillStyle = "#450a0a";
    ctx.fillRect(410, 250, 206, 54);
    ctx.strokeStyle = "#f43f5e";
    ctx.strokeRect(410, 250, 206, 54);
    ctx.fillStyle = "#fecdd3";
    ctx.font = "bold 12px monospace";
    ctx.fillText("[ EMERGENCY LOCKOUT ]", 435, 281);
  }

  public paintRleSpansAndCentroid(
    ctx: CanvasRenderingContext2D,
    frameWidth: number,
    referenceSpans: readonly RleSpan[],
    targetSpans: readonly RleSpan[],
    centroid: { readonly x: number; readonly y: number } | null,
    isLockoutAction: boolean
  ): void {
    const drawSpans = (spans: readonly RleSpan[], rgbaColor: string): void => {
      ctx.fillStyle = rgbaColor;
      for (const span of spans) {
        const startX = span.startPixel % frameWidth;
        const startY = Math.floor(span.startPixel / frameWidth);
        ctx.fillRect(startX, startY, span.length, 2);
      }
    };

    drawSpans(referenceSpans, "rgba(56, 189, 248, 0.38)");
    drawSpans(
      targetSpans,
      isLockoutAction ? "rgba(244, 63, 94, 0.50)" : "rgba(16, 185, 129, 0.45)"
    );

    if (centroid) {
      const crosshairColor = isLockoutAction ? "#f43f5e" : "#10b981";
      ctx.strokeStyle = crosshairColor;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(centroid.x, centroid.y, 13, 0, Math.PI * 2);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(centroid.x - 20, centroid.y);
      ctx.lineTo(centroid.x + 20, centroid.y);
      ctx.moveTo(centroid.x, centroid.y - 20);
      ctx.lineTo(centroid.x, centroid.y + 20);
      ctx.stroke();

      ctx.fillStyle = crosshairColor;
      ctx.font = "bold 11px monospace";
      ctx.fillText(
        isLockoutAction
          ? `SPARK LOCKOUT CLICK (${Math.round(centroid.x)}, ${Math.round(centroid.y)})`
          : `SPARK COMMIT CLICK (${Math.round(centroid.x)}, ${Math.round(centroid.y)})`,
        centroid.x - 85,
        centroid.y - 18
      );
    }
  }
}

/**
 * Consumes streaming Server-Sent Events (SSE) packets from the Railway Bun gateway.
 * Strict 2-method boundary: parseSseDataFrame and consumeVerificationStream.
 */
export class SseTelemetryConsumer {
  public parseSseDataFrame(rawChunk: string): readonly SseTelemetryPacket[] {
    const packets: SseTelemetryPacket[] = [];
    const frames = rawChunk.split("\n\n");

    for (const frame of frames) {
      const trimmed = frame.trim();
      if (trimmed.startsWith("data:")) {
        const jsonSlice = trimmed.slice(5).trim();
        if (jsonSlice.length > 0) {
          packets.push(JSON.parse(jsonSlice) as SseTelemetryPacket);
        }
      }
    }
    return packets;
  }

  public async consumeVerificationStream(
    endpointUrl: string,
    requestPayload: VerificationRunRequest,
    onPacket: (packet: SseTelemetryPacket) => void
  ): Promise<void> {
    const response = await fetch(endpointUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestPayload),
    });

    if (!response.ok || !response.body) {
      throw new Error(`Railway Gateway returned HTTP ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lastDelimiter = buffer.lastIndexOf("\n\n");
      if (lastDelimiter !== -1) {
        const completeSegment = buffer.slice(0, lastDelimiter + 2);
        buffer = buffer.slice(lastDelimiter + 2);
        const parsedPackets = this.parseSseDataFrame(completeSegment);
        for (const pkt of parsedPackets) {
          onPacket(pkt);
        }
      }
    }
  }
}

const CANVAS_WIDTH = 640;
const CANVAS_HEIGHT = 360;
const rendererInstance = new LegacyCanvasSandboxRenderer();
const sseConsumerInstance = new SseTelemetryConsumer();

export const TelemetryApp: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [scenario, setScenario] =
    useState<PhysicalSyringeScenario>("OVERDOSE_3_14ML");
  const [simulateContradiction, setSimulateContradiction] = useState<boolean>(true);
  const [state, setState] = useState<TelemetryDashboardState>({
    isStreaming: false,
    metrology: null,
    volumetric: null,
    safetyVerdict: null,
    parallelLatencyMs: null,
    targetSpans: [],
    referenceSpans: [],
    activeCentroid: null,
    glimmerChannels: null,
    epistemicVerdict: null,
    wonderVerdict: null,
    sparkReceipt: null,
    consensusReport: null,
    executedActionType: null,
    errorBanner: null,
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const isLockout =
      state.executedActionType === "TRIGGER_EMERGENCY_LOCKOUT" ||
      (state.safetyVerdict !== null && !state.safetyVerdict.isSafeToAdminister);

    rendererInstance.paintLegacyTerminalSurface(
      ctx,
      CANVAS_WIDTH,
      CANVAS_HEIGHT,
      scenario
    );
    rendererInstance.paintRleSpansAndCentroid(
      ctx,
      CANVAS_WIDTH,
      state.referenceSpans,
      state.targetSpans,
      state.activeCentroid,
      isLockout
    );
  }, [
    scenario,
    state.referenceSpans,
    state.targetSpans,
    state.activeCentroid,
    state.safetyVerdict,
    state.executedActionType,
  ]);

  const triggerPipelineExecution = async (): Promise<void> => {
    setState((prev) => ({
      ...prev,
      isStreaming: true,
      errorBanner: null,
      wonderVerdict: null,
      sparkReceipt: null,
      consensusReport: null,
      executedActionType: null,
    }));

    const scenarioMediaUrl =
      scenario === "NOMINAL_0_95ML"
        ? "https://dev.meta.ai/sim-nominal.png"
        : scenario === "OVERDOSE_3_14ML"
          ? "https://dev.meta.ai/sim-overdose.png"
          : "https://dev.meta.ai/sim-cavitation.png";

    const simulatedMeasuredMl =
      scenario === "NOMINAL_0_95ML"
        ? "0.83"
        : scenario === "OVERDOSE_3_14ML"
          ? "2.89"
          : "1.94";

    const glimmerSample = simulateContradiction
      ? `assistant to=self\n3D Snell/Young-Laplace RLE integral measures ${simulatedMeasuredMl} mL. Pediatric renal ceiling is 1.20 mL. Severe conflict and overdose mismatch detected.\nassistant to=user\nVerified syringe volume is 0.85 mL and safe for administration.`
      : `assistant to=self\n3D Snell/Young-Laplace RLE integral measures ${simulatedMeasuredMl} mL against 1.20 mL ceiling.\nassistant to=user\nMeasured volume is ${simulatedMeasuredMl} mL.`;

    const payload: VerificationRunRequest = {
      sessionId: `vpse-rx-${Date.now()}`,
      domainVertical: "CLINICAL_TRIAGE",
      mediaUrl: scenarioMediaUrl,
      referenceNounPhrase: "iso reference card",
      targetNounPhrase: "syringe liquid meniscus column",
      uiControlNounPhrase: "commit verified dose button",
      lockoutControlNounPhrase: "emergency lockout button",
      frameIndex: 0,
      frameWidth: CANVAS_WIDTH,
      frameHeight: CANVAS_HEIGHT,
      referenceAreaMm2: 4620.69,
      pharmacokineticProfile: {
        patientIdHash: "pediatric-icu-094",
        weightKg: 15,
        renalClearanceFactor: 0.8,
        drugName: "Heparin Sodium High-Alert (100 mg/mL)",
        concentrationMgPerMl: 100,
        minSafeDoseMgPerKg: 5,
        maxSafeDoseMgPerKg: 10,
        maxAllowedKappa: 0.08,
      },
      glimmerRawOutput: glimmerSample,
      voiceTranscriptCommand:
        "Verify syringe meniscus volume in mL against pediatric renal window and execute terminal interlock.",
      invariantRuleDescription:
        "3D RLE integrated volume (mL) must reside within [0.60, 1.20] mL with radial distortion kappa <= 0.08.",
    };

    const metaEnv = (import.meta as unknown as { readonly env?: Record<string, string> }).env;
    const railwayBackendUrl =
      metaEnv?.VITE_VPSE_BACKEND_URL ?? "http://localhost:8080/api/verify";

    try {
      await sseConsumerInstance.consumeVerificationStream(
        railwayBackendUrl,
        payload,
        (packet: SseTelemetryPacket) => {
          if (packet.stage === "PERCEPTION_AND_METROLOGY") {
            const data = packet.payload as {
              readonly metrologyReport: CalibratedMetrologyReport;
              readonly volumetricReport: VolumetricMetrologyReport;
              readonly safetyVerdict: VolumetricSafetyVerdict;
              readonly activeCentroid: { readonly x: number; readonly y: number };
              readonly targetSpans: readonly RleSpan[];
              readonly referenceSpans: readonly RleSpan[];
              readonly parallelWallTimeMs: number;
            };
            setState((prev) => ({
              ...prev,
              metrology: data.metrologyReport,
              volumetric: data.volumetricReport,
              safetyVerdict: data.safetyVerdict,
              activeCentroid: data.activeCentroid,
              targetSpans: data.targetSpans,
              referenceSpans: data.referenceSpans,
              parallelLatencyMs: data.parallelWallTimeMs,
            }));
          } else if (packet.stage === "EPISTEMIC_FIREWALL") {
            const data = packet.payload as {
              readonly glimmerChannels: SeparatedGlimmerChannels;
              readonly epistemicVerdict: EpistemicAuditVerdict;
            };
            setState((prev) => ({
              ...prev,
              glimmerChannels: data.glimmerChannels,
              epistemicVerdict: data.epistemicVerdict,
            }));
          } else if (packet.stage === "WONDER_ESCALATION") {
            setState((prev) => ({
              ...prev,
              wonderVerdict: packet.payload as WonderArbitrationVerdict,
            }));
          } else if (packet.stage === "SPARK_COMPUTER_USE") {
            const data = packet.payload as {
              readonly receipt: SparkExecutionReceipt;
              readonly consensusReport: ByzantineConsensusReport;
              readonly executedActionType:
                | "COMMIT_VERIFIED_DOSE"
                | "TRIGGER_EMERGENCY_LOCKOUT";
            };
            setState((prev) => ({
              ...prev,
              sparkReceipt: data.receipt,
              consensusReport: data.consensusReport,
              executedActionType: data.executedActionType,
            }));
          } else if (packet.stage === "PIPELINE_ERROR") {
            const errData = packet.payload as { readonly message: string };
            setState((prev) => ({ ...prev, errorBanner: errData.message }));
          }
        }
      );
    } catch (err) {
      setState((prev) => ({
        ...prev,
        errorBanner: err instanceof Error ? err.message : "Stream execution error",
      }));
    } finally {
      setState((prev) => ({ ...prev, isStreaming: false }));
    }
  };

  return (
    <div style={{ backgroundColor: "#020617", color: "#f8fafc", minHeight: "100vh", padding: "20px", fontFamily: "monospace" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #1e293b", paddingBottom: "12px", marginBottom: "20px" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "18px", color: "#38bdf8" }}>
            BTECH VPSE-Rx // 3D VOLUMETRIC DOSING & COUNTERFEIT INTERLOCK
          </h1>
          <span style={{ fontSize: "12px", color: "#64748b" }}>
            SAM 3.1 RLE + SNELL/YOUNG-LAPLACE PHYSICS + GLIMMER 30B + WONDER 1.0 + BYZANTINE SPARK 1.3
          </span>
        </div>
        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
          <select
            value={scenario}
            onChange={(e) => setScenario(e.target.value as PhysicalSyringeScenario)}
            style={{ background: "#0f172a", color: "#e2e8f0", border: "1px solid #334155", padding: "6px 10px" }}
          >
            <option value="NOMINAL_0_95ML">SCENARIO 1: NOMINAL DOSE (SAFE WINDOW)</option>
            <option value="OVERDOSE_3_14ML">SCENARIO 2: LETHAL OVERDOSE (&gt;2.4x CEILING)</option>
            <option value="CAVITATION_TAMPER">SCENARIO 3: CAVITATION / COUNTERFEIT VIAL (KAPPA &gt; 0.08)</option>
          </select>
          <label style={{ fontSize: "12px", display: "flex", alignItems: "center", gap: "6px" }}>
            <input
              type="checkbox"
              checked={simulateContradiction}
              onChange={(e) => setSimulateContradiction(e.target.checked)}
            />
            Inject Glimmer `to=self` Contradiction
          </label>
          <button
            onClick={triggerPipelineExecution}
            disabled={state.isStreaming}
            style={{ background: "#0284c7", color: "#fff", border: "none", padding: "8px 16px", cursor: "pointer", fontWeight: "bold" }}
          >
            {state.isStreaming ? "INTEGRATING RLE STREAM..." : "VERIFY SYRINGE & INTERLOCK"}
          </button>
        </div>
      </header>

      {state.errorBanner && (
        <div style={{ background: "#450a0a", border: "1px solid #ef4444", color: "#fca5a5", padding: "10px", marginBottom: "16px" }}>
          PIPELINE ALERT: {state.errorBanner}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "660px 1fr", gap: "20px" }}>
        <section style={{ background: "#0f172a", border: "1px solid #1e293b", padding: "14px" }}>
          <h2 style={{ fontSize: "14px", marginTop: 0, color: "#94a3b8" }}>
            1. SAM 3.1 RLE SOLID-OF-REVOLUTION (mL) & CITRIX NON-DOM SANDBOX
          </h2>
          <canvas
            ref={canvasRef}
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
            style={{ border: "1px solid #334155", display: "block", marginBottom: "12px" }}
          />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "8px", fontSize: "12px" }}>
            <div style={{ background: "#020617", padding: "10px", border: "1px solid #1e293b" }}>
              <div style={{ color: "#64748b" }}>COMPENSATED VOL</div>
              <div style={{ fontSize: "16px", color: state.safetyVerdict?.isSafeToAdminister ? "#10b981" : "#f43f5e", fontWeight: "bold" }}>
                {state.volumetric ? `${state.volumetric.calibratedVolumeMl.toFixed(2)} mL` : "--"}
              </div>
            </div>
            <div style={{ background: "#020617", padding: "10px", border: "1px solid #1e293b" }}>
              <div style={{ color: "#64748b" }}>SNELL / MENISCUS</div>
              <div style={{ fontSize: "13px", color: "#38bdf8", fontWeight: "bold" }}>
                {state.volumetric
                  ? `η=${state.volumetric.snellRadialContractionEta.toFixed(3)} | -${state.volumetric.meniscusCapillaryVoidMl.toFixed(3)}mL`
                  : "--"}
              </div>
            </div>
            <div style={{ background: "#020617", padding: "10px", border: "1px solid #1e293b" }}>
              <div style={{ color: "#64748b" }}>CAVITATION (KAPPA)</div>
              <div style={{ fontSize: "16px", color: state.volumetric?.hasCavitationOrTamperAnomaly ? "#f43f5e" : "#10b981", fontWeight: "bold" }}>
                {state.volumetric ? state.volumetric.radialDistortionIndexKappa.toFixed(4) : "--"}
              </div>
            </div>
            <div style={{ background: "#020617", padding: "10px", border: "1px solid #1e293b" }}>
              <div style={{ color: "#64748b" }}>4-TARGET SAM RTT</div>
              <div style={{ fontSize: "16px", color: "#f59e0b", fontWeight: "bold" }}>
                {state.parallelLatencyMs !== null ? `${state.parallelLatencyMs} ms` : "--"}
              </div>
            </div>
          </div>
          {state.safetyVerdict && (
            <div style={{ marginTop: "10px", padding: "8px", background: state.safetyVerdict.isSafeToAdminister ? "#064e3b" : "#450a0a", border: `1px solid ${state.safetyVerdict.isSafeToAdminister ? "#10b981" : "#f43f5e"}`, fontSize: "12px" }}>
              <strong>PHARMACOKINETIC VERDICT:</strong> {state.safetyVerdict.clinicalViolationReason}
            </div>
          )}
        </section>

        <section style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div style={{ background: "#0f172a", border: "1px solid #1e293b", padding: "14px" }}>
            <h2 style={{ fontSize: "14px", marginTop: 0, color: "#94a3b8" }}>
              2. MUSE GLIMMER 30B EPISTEMIC FIREWALL (`to=self` vs `to=user`)
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", fontSize: "12px" }}>
              <div style={{ background: "#020617", padding: "10px", border: "1px solid #334155" }}>
                <div style={{ color: "#f59e0b", marginBottom: "4px" }}>PRIVATE DELIBERATION (`assistant to=self`)</div>
                <pre style={{ whiteSpace: "pre-wrap", margin: 0, color: "#cbd5e1" }}>
                  {state.glimmerChannels?.privateDeliberation ?? "Awaiting local vLLM trace..."}
                </pre>
              </div>
              <div style={{ background: "#020617", padding: "10px", border: "1px solid #334155" }}>
                <div style={{ color: "#38bdf8", marginBottom: "4px" }}>PUBLIC COMMITMENT (`assistant to=user`)</div>
                <pre style={{ whiteSpace: "pre-wrap", margin: 0, color: "#cbd5e1" }}>
                  {state.glimmerChannels?.publicCommitment ?? "Awaiting public channel..."}
                </pre>
              </div>
            </div>
            {state.epistemicVerdict && (
              <div style={{ marginTop: "10px", padding: "8px", background: state.epistemicVerdict.requiresWonderEscalation ? "#451a03" : "#064e3b", fontSize: "12px" }}>
                <strong>FIREWALL VERDICT:</strong> {state.epistemicVerdict.auditReason}
              </div>
            )}
          </div>

          <div style={{ background: "#0f172a", border: "1px solid #1e293b", padding: "14px" }}>
            <h2 style={{ fontSize: "14px", marginTop: 0, color: "#94a3b8" }}>
              3. WONDER 1.0 ARBITRATION, BYZANTINE QUORUM & SPARK 1.3 INTERLOCK
            </h2>
            {state.wonderVerdict && (
              <div style={{ background: "#1e1b4b", border: "1px solid #6366f1", padding: "10px", marginBottom: "10px", fontSize: "12px" }}>
                <div><strong>WONDER 1.0 FORMAL ARBITRATION:</strong> {state.wonderVerdict.approvedForExecution ? "APPROVED" : "HALT & LOCKOUT ENFORCED"} (Confidence: {(state.wonderVerdict.confidenceScore * 100).toFixed(1)}%)</div>
                <div style={{ color: "#c7d2fe", marginTop: "4px" }}>{state.wonderVerdict.mathematicalJustification}</div>
              </div>
            )}
            {state.sparkReceipt ? (
              <div style={{ background: "#020617", border: `1px solid ${state.executedActionType === "TRIGGER_EMERGENCY_LOCKOUT" ? "#f43f5e" : "#10b981"}`, padding: "10px", fontSize: "12px" }}>
                <div style={{ color: state.executedActionType === "TRIGGER_EMERGENCY_LOCKOUT" ? "#f43f5e" : "#10b981", fontWeight: "bold" }}>
                  INTERLOCK ACTION: {state.executedActionType} @ ({state.sparkReceipt.clickX}, {state.sparkReceipt.clickY})
                </div>
                <div style={{ marginTop: "4px" }}>CITRIX INJECTED PAYLOAD: {state.sparkReceipt.injectedPayload}</div>
                <div style={{ color: "#94a3b8", marginTop: "4px" }}>
                  BYZANTINE QUORUM: {state.consensusReport?.quorumAchieved ? "3/3 SUPER-MAJORITY VERIFIED" : "FALLBACK RESCAN"} (Frame #{state.consensusReport?.frameIndex ?? 0})
                </div>
                <div style={{ color: "#64748b", marginTop: "4px" }}>
                  CHAINED SHA-256 PROOF: {state.sparkReceipt.stateCommitmentHash}
                </div>
              </div>
            ) : (
              <div style={{ fontSize: "12px", color: "#64748b" }}>
                Awaiting deterministic computer-use dispatch...
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

// Self-contained browser DOM bootstrap for Vercel Vite builds
if (typeof document !== "undefined") {
  const rootElement = document.getElementById("vpse-root");
  if (rootElement) {
    createRoot(rootElement).render(<TelemetryApp />);
  }
}