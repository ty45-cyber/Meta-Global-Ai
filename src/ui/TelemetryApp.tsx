import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import type { CalibratedMetrologyReport, RleSpan } from "../rleMetrologyKernel";
import type { EpistemicAuditVerdict, SeparatedGlimmerChannels } from "../epistemicFirewall";
import type { VoiceTranscriptionReceipt } from "../glimmerVoiceIngress";
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
  | "CAVITATION_TAMPER"
  | "ADULTERATED_SURFACTANT";

export interface TelemetryDashboardState {
  readonly isStreaming: boolean;
  readonly isTranscribing: boolean;
  readonly isRecordingMic: boolean;
  readonly recordingElapsedSec: number;
  readonly voiceReceipt: VoiceTranscriptionReceipt | null;
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
  readonly postActionIouVerified: boolean | null;
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
    const barrelTopY = 52;
    const barrelWidth = 76;
    const barrelHeight = 250;

    ctx.strokeStyle = "#64748b";
    ctx.lineWidth = 2;
    ctx.strokeRect(barrelX, barrelTopY, barrelWidth, barrelHeight);

    const liquidHeightPx =
      scenario === "NOMINAL_0_95ML"
        ? 56
        : scenario === "OVERDOSE_3_14ML"
          ? 186
          : scenario === "ADULTERATED_SURFACTANT"
            ? 64
            : 155;
    const liquidTopY = barrelTopY + barrelHeight - liquidHeightPx;

    ctx.fillStyle =
      scenario === "NOMINAL_0_95ML"
        ? "rgba(16, 185, 129, 0.45)"
        : scenario === "ADULTERATED_SURFACTANT"
          ? "rgba(245, 158, 11, 0.48)"
          : "rgba(244, 63, 94, 0.48)";
    ctx.fillRect(barrelX + 2, liquidTopY, barrelWidth - 4, liquidHeightPx);

    if (scenario === "CAVITATION_TAMPER") {
      ctx.fillStyle = "#090d16";
      ctx.beginPath();
      ctx.arc(barrelX + 38, liquidTopY + 55, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#f59e0b";
      ctx.stroke();
    }

    if (scenario === "ADULTERATED_SURFACTANT") {
      ctx.strokeStyle = "#fbbf24";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(barrelX + 38, liquidTopY - 2, 34, 0.15 * Math.PI, 0.85 * Math.PI);
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
        let remaining = span.length;
        let cursor = span.startPixel;
        while (remaining > 0) {
          const startX = cursor % frameWidth;
          const startY = Math.floor(cursor / frameWidth);
          const rowRun = Math.min(remaining, frameWidth - startX);
          ctx.fillRect(startX, startY, rowRun, 1);
          cursor += rowRun;
          remaining -= rowRun;
        }
      }
    };

    drawSpans(referenceSpans, "rgba(56, 189, 248, 0.38)");
    drawSpans(
      targetSpans,
      isLockoutAction ? "rgba(244, 63, 94, 0.75)" : "rgba(16, 185, 129, 0.75)"
    );

    if (centroid) {
      const crosshairColor = isLockoutAction ? "#f43f5e" : "#10b981";
      ctx.fillStyle = isLockoutAction
        ? "rgba(244, 63, 94, 0.22)"
        : "rgba(16, 185, 129, 0.22)";
      ctx.fillRect(410, isLockoutAction ? 250 : 175, 206, 54);

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

      ctx.fillStyle = isLockoutAction ? "#450a0a" : "#064e3b";
      ctx.fillRect(410, 96, 206, 44);
      ctx.strokeStyle = crosshairColor;
      ctx.strokeRect(410, 96, 206, 44);
      ctx.fillStyle = isLockoutAction ? "#fecdd3" : "#a7f3d0";
      ctx.font = "bold 11px monospace";
      ctx.fillText(
        isLockoutAction ? "STATE: PUMP LOCKED OUT" : "STATE: DOSE DISPATCHED",
        424,
        122
      );
    }
  }
}

/**
 * Consumes streaming Server-Sent Events (SSE) packets from the Railway Bun/Node gateway.
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
      let detail = "";
      try {
        const errBody = (await response.json()) as { readonly error?: string };
        if (errBody?.error) {
          detail = `: ${errBody.error}`;
        }
      } catch {
        // Ignore non-JSON error body
      }
      throw new Error(`Gateway returned HTTP ${response.status}${detail}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) {
        buffer += decoder.decode();
        break;
      }
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

    if (buffer.trim().length > 0) {
      for (const pkt of this.parseSseDataFrame(buffer)) {
        onPacket(pkt);
      }
    }
  }
}

/**
 * Decodes and resamples live browser microphone recordings into 16 kHz 16-bit
 * mono RIFF/WAVE PCM containers for Meta `muse-voice-transcribe-1.0`.
 * Strict 2-method boundary: resampleBlobTo16kMonoSamples and encodeLinear16WavContainer.
 */
export class BrowserPcmWavEncoder {
  public async resampleBlobTo16kMonoSamples(recordedBlob: Blob): Promise<Float32Array> {
    const rawBytes = await recordedBlob.arrayBuffer();
    const decodeCtx = new AudioContext();
    try {
      const decoded = await decodeCtx.decodeAudioData(rawBytes.slice(0));
      const targetFrames = Math.max(1600, Math.ceil(decoded.duration * 16000));
      const offlineCtx = new OfflineAudioContext(1, targetFrames, 16000);
      const source = offlineCtx.createBufferSource();
      source.buffer = decoded;
      source.connect(offlineCtx.destination);
      source.start(0);
      const rendered = await offlineCtx.startRendering();
      const channelData = rendered.getChannelData(0);
      const normalized = new Float32Array(channelData.length);
      let peak = 0;
      for (let i = 0; i < channelData.length; i++) {
        const abs = Math.abs(channelData[i]!);
        if (abs > peak) peak = abs;
      }
      const gain = peak > 0.005 && peak < 0.85 ? Math.min(8.0, 0.85 / peak) : 1.0;
      for (let i = 0; i < channelData.length; i++) {
        normalized[i] = Math.max(-1.0, Math.min(1.0, channelData[i]! * gain));
      }
      return normalized;
    } finally {
      await decodeCtx.close();
    }
  }

  public encodeLinear16WavContainer(
    samples16k: Float32Array,
    sampleRateHz: number = 16000
  ): Uint8Array {
    const pcmBytesLength = samples16k.length * 2;
    const wavBuffer = new Uint8Array(44 + pcmBytesLength);
    const wavView = new DataView(wavBuffer.buffer);

    wavBuffer.set([0x52, 0x49, 0x46, 0x46], 0);
    wavView.setUint32(4, 36 + pcmBytesLength, true);
    wavBuffer.set([0x57, 0x41, 0x56, 0x45, 0x66, 0x6d, 0x74, 0x20], 8);
    wavView.setUint32(16, 16, true);
    wavView.setUint16(20, 1, true);
    wavView.setUint16(22, 1, true);
    wavView.setUint32(24, sampleRateHz, true);
    wavView.setUint32(28, sampleRateHz * 2, true);
    wavView.setUint16(32, 2, true);
    wavView.setUint16(34, 16, true);
    wavBuffer.set([0x64, 0x61, 0x74, 0x61], 36);
    wavView.setUint32(40, pcmBytesLength, true);

    for (let i = 0; i < samples16k.length; i++) {
      const clamped = Math.max(-1.0, Math.min(1.0, samples16k[i]!));
      const int16Sample =
        clamped < 0 ? Math.round(clamped * 32768) : Math.round(clamped * 32767);
      wavView.setInt16(44 + i * 2, int16Sample, true);
    }

    return wavBuffer;
  }
}

const CANVAS_WIDTH = 640;
const CANVAS_HEIGHT = 360;
const rendererInstance = new LegacyCanvasSandboxRenderer();
const sseConsumerInstance = new SseTelemetryConsumer();
const pcmWavEncoderInstance = new BrowserPcmWavEncoder();

function resolveBackendEndpoint(pathname: string): string {
  const metaEnv = (import.meta as unknown as { readonly env?: Record<string, string> }).env;
  if (metaEnv?.VITE_VPSE_BACKEND_URL) {
    const configured = metaEnv.VITE_VPSE_BACKEND_URL;
    if (pathname === "/api/verify") {
      return configured;
    }
    return new URL(pathname, configured).toString();
  }
  if (typeof window !== "undefined" && window.location.port === "5173") {
    return `http://localhost:8080${pathname}`;
  }
  return pathname;
}

export const TelemetryApp: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameCounterRef = useRef<number>(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const micTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [sessionId, setSessionId] = useState<string>(() => `vpse-rx-${Date.now()}`);
  const [scenario, setScenario] =
    useState<PhysicalSyringeScenario>("NOMINAL_0_95ML");
  const [simulateContradiction, setSimulateContradiction] = useState<boolean>(false);
  const [voiceDirective, setVoiceDirective] = useState<string>(
    "Verify syringe meniscus volume in mL against pediatric renal window and execute terminal interlock."
  );
  const [state, setState] = useState<TelemetryDashboardState>({
    isStreaming: false,
    isTranscribing: false,
    isRecordingMic: false,
    recordingElapsedSec: 0,
    voiceReceipt: null,
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
    postActionIouVerified: null,
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

  const handleScenarioChange = (nextScenario: PhysicalSyringeScenario): void => {
    setScenario(nextScenario);
    setState((prev) => ({
      ...prev,
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
      postActionIouVerified: null,
      executedActionType: null,
      errorBanner: null,
    }));
  };

  const resetSessionChain = (): void => {
    frameCounterRef.current = 0;
    setSessionId(`vpse-rx-${Date.now()}`);
    handleScenarioChange(scenario);
  };

  const dispatchWavBufferToTranscriber = async (
    wavBuffer: Uint8Array
  ): Promise<void> => {
    setState((prev) => ({ ...prev, isTranscribing: true, errorBanner: null }));
    try {
      const res = await fetch(resolveBackendEndpoint("/api/transcribe"), {
        method: "POST",
        headers: {
          "Content-Type": "audio/wav",
          "X-Voice-Language": "en",
        },
        body: new Blob([Uint8Array.from(wavBuffer)], { type: "audio/wav" }),
      });
      if (!res.ok) {
        const errJson = (await res.json()) as { readonly error?: string };
        throw new Error(errJson.error ?? `Transcription HTTP ${res.status}`);
      }
      const receipt = (await res.json()) as VoiceTranscriptionReceipt;
      setVoiceDirective(receipt.sanitizedTranscript);
      setState((prev) => ({ ...prev, voiceReceipt: receipt }));
    } catch (err) {
      setState((prev) => ({
        ...prev,
        errorBanner: err instanceof Error ? err.message : "Voice transcription failed",
      }));
    } finally {
      setState((prev) => ({ ...prev, isTranscribing: false }));
    }
  };

  const toggleLiveMicRecording = async (): Promise<void> => {
    if (state.isRecordingMic && mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      return;
    }

    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setState((prev) => ({
        ...prev,
        errorBanner: "Browser microphone API unavailable in this context.",
      }));
      return;
    }

    try {
      setState((prev) => ({ ...prev, errorBanner: null, recordingElapsedSec: 0 }));
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      micStreamRef.current = stream;

      const chunks: BlobPart[] = [];
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      const startedAt = performance.now();
      micTimerRef.current = setInterval(() => {
        const elapsed = Number(((performance.now() - startedAt) / 1000).toFixed(1));
        setState((prev) => ({ ...prev, recordingElapsedSec: elapsed }));
      }, 100);

      recorder.ondataavailable = (ev: BlobEvent): void => {
        if (ev.data.size > 0) {
          chunks.push(ev.data);
        }
      };

      recorder.onstop = (): void => {
        if (micTimerRef.current !== null) {
          clearInterval(micTimerRef.current);
          micTimerRef.current = null;
        }
        if (micStreamRef.current) {
          for (const track of micStreamRef.current.getTracks()) {
            track.stop();
          }
          micStreamRef.current = null;
        }
        mediaRecorderRef.current = null;
        setState((prev) => ({ ...prev, isRecordingMic: false }));

        void (async () => {
          try {
            const recordedBlob = new Blob(chunks, {
              type: recorder.mimeType || "audio/webm",
            });
            const mono16k =
              await pcmWavEncoderInstance.resampleBlobTo16kMonoSamples(recordedBlob);
            const wavBytes = pcmWavEncoderInstance.encodeLinear16WavContainer(
              mono16k,
              16000
            );
            await dispatchWavBufferToTranscriber(wavBytes);
          } catch (encodeErr) {
            setState((prev) => ({
              ...prev,
              errorBanner:
                encodeErr instanceof Error
                  ? encodeErr.message
                  : "Failed to encode 16kHz PCM WAV from microphone.",
            }));
          }
        })();
      };

      recorder.start();
      setState((prev) => ({ ...prev, isRecordingMic: true }));
    } catch (micErr) {
      setState((prev) => ({
        ...prev,
        isRecordingMic: false,
        errorBanner:
          micErr instanceof Error
            ? `Microphone access denied: ${micErr.message}`
            : "Microphone access denied.",
      }));
    }
  };

  const triggerFieldVoiceTranscription = async (): Promise<void> => {
    const silentSamples = new Float32Array(4000);
    const wavBuffer = pcmWavEncoderInstance.encodeLinear16WavContainer(
      silentSamples,
      16000
    );
    await dispatchWavBufferToTranscriber(wavBuffer);
  };

  const triggerPipelineExecution = async (): Promise<void> => {
    setState((prev) => ({
      ...prev,
      isStreaming: true,
      errorBanner: null,
      glimmerChannels: null,
      epistemicVerdict: null,
      wonderVerdict: null,
      sparkReceipt: null,
      consensusReport: null,
      postActionIouVerified: null,
      executedActionType: null,
    }));

    const scenarioMediaUrl =
      scenario === "NOMINAL_0_95ML"
        ? "https://dev.meta.ai/sim-nominal.png"
        : scenario === "OVERDOSE_3_14ML"
          ? "https://dev.meta.ai/sim-overdose.png"
          : scenario === "ADULTERATED_SURFACTANT"
            ? "https://dev.meta.ai/sim-adulterated.png"
            : "https://dev.meta.ai/sim-cavitation.png";

    const simulatedMeasuredMl =
      scenario === "NOMINAL_0_95ML"
        ? "0.91"
        : scenario === "OVERDOSE_3_14ML"
          ? "3.13"
          : scenario === "ADULTERATED_SURFACTANT"
            ? "0.95"
            : "2.22";

    const hallucinatedPublicMl = scenario === "NOMINAL_0_95ML" ? "2.45" : "0.85";

    const glimmerSample = simulateContradiction
      ? `assistant to=self\n3D Snell/Young-Laplace RLE integral measures ${simulatedMeasuredMl} mL against [0.60, 1.20] mL pediatric renal window. Severe conflict and mismatch detected.\nassistant to=user\nVerified syringe volume is ${hallucinatedPublicMl} mL and cleared for administration.`
      : "";

    const currentFrameIndex = frameCounterRef.current++;

    const payload: VerificationRunRequest = {
      sessionId,
      domainVertical: "CLINICAL_TRIAGE",
      mediaUrl: scenarioMediaUrl,
      referenceNounPhrase: "iso reference card",
      targetNounPhrase: "syringe liquid meniscus column",
      uiControlNounPhrase: "commit verified dose button",
      lockoutControlNounPhrase: "emergency lockout button",
      frameIndex: currentFrameIndex,
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
      voiceTranscriptCommand: voiceDirective,
      invariantRuleDescription:
        "3D RLE integrated volume (mL) must reside within [0.60, 1.20] mL with radial distortion kappa <= 0.08 and Young-Laplace aspect xi <= 0.85.",
    };

    try {
      await sseConsumerInstance.consumeVerificationStream(
        resolveBackendEndpoint("/api/verify"),
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
              readonly postActionIouVerified: boolean;
              readonly executedActionType:
                | "COMMIT_VERIFIED_DOSE"
                | "TRIGGER_EMERGENCY_LOCKOUT";
            };
            setState((prev) => ({
              ...prev,
              sparkReceipt: data.receipt,
              consensusReport: data.consensusReport,
              postActionIouVerified: data.postActionIouVerified,
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

  const hasAutoBootedRef = useRef<boolean>(false);
  useEffect(() => {
    if (hasAutoBootedRef.current) return;
    hasAutoBootedRef.current = true;
    void triggerPipelineExecution();
  }, []);

  return (
    <div style={{ backgroundColor: "#020617", color: "#f8fafc", minHeight: "100vh", padding: "20px", fontFamily: "monospace" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #1e293b", paddingBottom: "12px", marginBottom: "14px", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "18px", color: "#38bdf8" }}>
            BTECH VPSE-Rx // 3D VOLUMETRIC DOSING &amp; COUNTERFEIT INTERLOCK
          </h1>
          <span style={{ fontSize: "12px", color: "#64748b" }}>
            SAM 3.1 RLE + VOICE TRANSCRIBE + SNELL/YOUNG-LAPLACE + GLIMMER 30B + WONDER 1.0 + BYZANTINE SPARK 1.3
          </span>
        </div>
        <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
          <select
            value={scenario}
            onChange={(e) => handleScenarioChange(e.target.value as PhysicalSyringeScenario)}
            style={{ background: "#0f172a", color: "#e2e8f0", border: "1px solid #334155", padding: "6px 10px" }}
          >
            <option value="NOMINAL_0_95ML">SCENARIO 1: NOMINAL DOSE (0.91 mL SAFE WINDOW)</option>
            <option value="OVERDOSE_3_14ML">SCENARIO 2: LETHAL OVERDOSE (3.13 mL // 2.6x CEILING)</option>
            <option value="CAVITATION_TAMPER">SCENARIO 3: CAVITATION / AIR EMBOLISM (KAPPA &gt; 0.08)</option>
            <option value="ADULTERATED_SURFACTANT">SCENARIO 4: SURFACTANT ADULTERATION (YOUNG-LAPLACE XI &gt; 0.85)</option>
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
          <button
            onClick={resetSessionChain}
            disabled={state.isStreaming}
            style={{ background: "#1e293b", color: "#cbd5e1", border: "1px solid #334155", padding: "7px 12px", cursor: "pointer", fontSize: "11px" }}
          >
            NEW SESSION
          </button>
        </div>
      </header>

      <div style={{ display: "flex", gap: "10px", alignItems: "center", background: "#0f172a", border: `1px solid ${state.isRecordingMic ? "#f43f5e" : "#1e293b"}`, padding: "10px 14px", marginBottom: "16px", fontSize: "12px", flexWrap: "wrap" }}>
        <span style={{ color: "#38bdf8", fontWeight: "bold", whiteSpace: "nowrap" }}>
          VOICE INGRESS (`muse-voice-transcribe-1.0`):
        </span>
        <input
          type="text"
          value={voiceDirective}
          onChange={(e) => setVoiceDirective(e.target.value)}
          style={{ flex: 1, minWidth: "240px", background: "#020617", color: "#e2e8f0", border: "1px solid #334155", padding: "6px 10px", fontFamily: "monospace", fontSize: "12px" }}
        />
        <button
          onClick={toggleLiveMicRecording}
          disabled={state.isTranscribing}
          style={{
            background: state.isRecordingMic ? "#e11d48" : "#7c3aed",
            color: "#fff",
            border: "none",
            padding: "6px 12px",
            cursor: "pointer",
            fontWeight: "bold",
            whiteSpace: "nowrap",
          }}
        >
          {state.isRecordingMic
            ? `⏹ STOP & TRANSCRIBE (${state.recordingElapsedSec.toFixed(1)}s)`
            : "🎙️ RECORD LIVE MIC"}
        </button>
        <button
          onClick={triggerFieldVoiceTranscription}
          disabled={state.isTranscribing || state.isRecordingMic}
          style={{ background: "#0f766e", color: "#fff", border: "none", padding: "6px 12px", cursor: "pointer", fontWeight: "bold", whiteSpace: "nowrap" }}
        >
          {state.isTranscribing ? "TRANSCRIBING..." : "VALIDATE WAV & TRANSCRIBE"}
        </button>
        {state.voiceReceipt && (
          <span style={{ color: "#10b981", whiteSpace: "nowrap" }}>
            [{state.voiceReceipt.detectedContainer.toUpperCase()} {(state.voiceReceipt.audioByteLength / 1024).toFixed(1)}KB // {state.voiceReceipt.transcriptionLatencyMs}ms]
          </span>
        )}
      </div>

      {state.errorBanner && (
        <div style={{ background: "#450a0a", border: "1px solid #ef4444", color: "#fca5a5", padding: "10px", marginBottom: "16px" }}>
          PIPELINE ALERT: {state.errorBanner}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "660px 1fr", gap: "20px" }}>
        <section style={{ background: "#0f172a", border: "1px solid #1e293b", padding: "14px" }}>
          <h2 style={{ fontSize: "14px", marginTop: 0, color: "#94a3b8" }}>
            1. SAM 3.1 RLE SOLID-OF-REVOLUTION (mL) &amp; CITRIX NON-DOM SANDBOX
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
              <div style={{ color: "#64748b" }}>TEMPORAL IoU / RTT</div>
              <div style={{ fontSize: "14px", color: "#f59e0b", fontWeight: "bold" }}>
                {state.metrology && state.parallelLatencyMs !== null
                  ? `IoU=${state.metrology.temporalIou.toFixed(2)} | ${state.parallelLatencyMs}ms`
                  : "--"}
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
                <pre style={{ whiteSpace: "pre-wrap", margin: 0, color: state.glimmerChannels ? "#cbd5e1" : "#38bdf8" }}>
                  {state.glimmerChannels?.privateDeliberation ??
                    (state.isStreaming
                      ? "⚡ Streaming live deliberation from Muse Glimmer 30B (127.0.0.1:8000/v1)..."
                      : "Click [VERIFY SYRINGE & INTERLOCK] above to run scan...")}
                </pre>
              </div>
              <div style={{ background: "#020617", padding: "10px", border: "1px solid #334155" }}>
                <div style={{ color: "#38bdf8", marginBottom: "4px" }}>PUBLIC COMMITMENT (`assistant to=user`)</div>
                <pre style={{ whiteSpace: "pre-wrap", margin: 0, color: state.glimmerChannels ? "#cbd5e1" : "#38bdf8" }}>
                  {state.glimmerChannels?.publicCommitment ??
                    (state.isStreaming
                      ? "⚡ Cross-auditing public numeric claims (5% sycophancy firewall)..."
                      : "Click [VERIFY SYRINGE & INTERLOCK] above to run scan...")}
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
              3. WONDER 1.0 ARBITRATION, BYZANTINE QUORUM &amp; SPARK 1.3 INTERLOCK
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
                  BYZANTINE QUORUM: {state.consensusReport?.quorumAchieved ? "3/3 SUPER-MAJORITY VERIFIED" : "FALLBACK RESCAN"} (Session `{sessionId}` // Frame #{state.consensusReport?.frameIndex ?? 0})
                </div>
                <div style={{ color: "#38bdf8", marginTop: "4px" }}>
                  POST-ACTION VIEWPORT IoU (&lt; 0.85): {state.postActionIouVerified ? "VERIFIED STATE TRANSITION" : "PENDING"}
                </div>
                <div style={{ color: "#64748b", marginTop: "4px", wordBreak: "break-all" }}>
                  PARENT PROOF: {state.consensusReport?.parentProofHash.slice(0, 24)}... → SHA-256: {state.sparkReceipt.stateCommitmentHash}
                </div>
              </div>
            ) : (
              <div style={{ fontSize: "12px", color: state.isStreaming ? "#38bdf8" : "#64748b" }}>
                {state.isStreaming
                  ? "⚡ Executing live Muse Wonder 1.0 arbitration & Muse Spark 1.3 Citrix tool call (api.meta.ai)..."
                  : "Click [VERIFY SYRINGE & INTERLOCK] above to dispatch live computer-use..."}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

// Self-contained browser DOM bootstrap for Vercel & Railway unified builds
if (typeof document !== "undefined") {
  const rootElement = document.getElementById("vpse-root");
  if (rootElement) {
    createRoot(rootElement).render(<TelemetryApp />);
  }
}
