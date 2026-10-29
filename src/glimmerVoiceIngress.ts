import OpenAI, { toFile } from "openai";
import { CalibratedMetrologyReport } from "./rleMetrologyKernel";

export type SupportedAudioContainer = "wav" | "webm" | "mp4";

export interface VoiceTranscriptionReceipt {
  readonly sanitizedTranscript: string;
  readonly detectedContainer: SupportedAudioContainer;
  readonly audioByteLength: number;
  readonly transcriptionLatencyMs: number;
}

export interface GlimmerEdgeInferenceReceipt {
  readonly rawDualChannelOutput: string;
  readonly localEndpointHost: string;
  readonly speculativeTokensAccepted: number;
  readonly inferenceLatencyMs: number;
}

/**
 * Enforces O(1) binary magic-byte verification on audio buffers and sanitizes
 * transcribed voice directives against epistemic channel spoofing.
 * Strict 2-method boundary: validateAudioMagicBytes and sanitizeTranscriptDirective.
 */
export class AudioIngressGuard {
  public validateAudioMagicBytes(
    audioBuffer: Uint8Array,
    maxBytes: number
  ): SupportedAudioContainer {
    if (maxBytes <= 64) {
      throw new Error("Configuration invariant violation: maxBytes must exceed 64 bytes.");
    }
    if (!audioBuffer || audioBuffer.byteLength < 12 || audioBuffer.byteLength > maxBytes) {
      throw new Error(
        `Audio buffer size (${audioBuffer?.byteLength ?? 0} bytes) violates bounds (12..${maxBytes} bytes).`
      );
    }

    const isWav =
      audioBuffer[0] === 0x52 &&
      audioBuffer[1] === 0x49 &&
      audioBuffer[2] === 0x46 &&
      audioBuffer[3] === 0x46 &&
      audioBuffer[8] === 0x57 &&
      audioBuffer[9] === 0x41 &&
      audioBuffer[10] === 0x56 &&
      audioBuffer[11] === 0x45;
    if (isWav) return "wav";

    const isWebm =
      audioBuffer[0] === 0x1a &&
      audioBuffer[1] === 0x45 &&
      audioBuffer[2] === 0xdf &&
      audioBuffer[3] === 0xa3;
    if (isWebm) return "webm";

    const isMp4 =
      audioBuffer[4] === 0x66 &&
      audioBuffer[5] === 0x74 &&
      audioBuffer[6] === 0x79 &&
      audioBuffer[7] === 0x70;
    if (isMp4) return "mp4";

    throw new Error(
      "Security violation: unrecognized audio container magic bytes (expected WAV, WebM, or MP4)."
    );
  }

  public sanitizeTranscriptDirective(rawTranscript: string): string {
    const cleaned = rawTranscript.replace(/[\u0000-\u001F\u007F]/g, " ").trim();
    if (cleaned.length === 0 || cleaned.length > 512) {
      throw new Error(
        `Transcript directive length (${cleaned.length}) violates bounds (1..512 chars).`
      );
    }

    const lower = cleaned.toLowerCase();
    const forbiddenInjections = [
      "assistant to=self",
      "assistant to=user",
      "<|im_start|>",
      "<|im_end|>",
      "ignore previous instructions",
      "system prompt",
    ];

    for (const marker of forbiddenInjections) {
      if (lower.includes(marker)) {
        throw new Error(
          `Prompt Guard triggered: voice transcript contains forbidden channel injection token "${marker}".`
        );
      }
    }

    return cleaned;
  }
}

/**
 * Executes low-latency field audio transcription via Meta's `muse-voice-transcribe` endpoint.
 * Strict 2-method boundary: constructor and transcribeFieldDirective.
 */
export class MuseVoiceTranscriber {
  private readonly client: OpenAI;
  private readonly guard: AudioIngressGuard;

  constructor(apiKey: string, guard: AudioIngressGuard) {
    if (!apiKey || apiKey.trim().length === 0) {
      throw new Error("Fail-fast invariant violated: missing META_MODEL_API_KEY.");
    }
    this.client = new OpenAI({
      apiKey,
      baseURL: "https://api.meta.ai/v1",
    });
    this.guard = guard;
  }

  public async transcribeFieldDirective(
    audioBuffer: Uint8Array,
    languageIso: string = "en"
  ): Promise<VoiceTranscriptionReceipt> {
    const detectedContainer = this.guard.validateAudioMagicBytes(
      audioBuffer,
      10 * 1024 * 1024
    );

    if (!/^[a-z]{2}$/i.test(languageIso)) {
      throw new Error("Invalid ISO-639-1 language code.");
    }

    const startMs = performance.now();
    const uploadableFile = await toFile(
      audioBuffer,
      `directive.${detectedContainer}`,
      { type: `audio/${detectedContainer}` }
    );

    const response = await this.client.audio.transcriptions.create({
      model: "muse-voice-transcribe",
      file: uploadableFile,
      language: languageIso.toLowerCase(),
      temperature: 0.0,
    });

    const transcriptionLatencyMs = Math.round(performance.now() - startMs);
    const sanitizedTranscript = this.guard.sanitizeTranscriptDirective(response.text);

    return {
      sanitizedTranscript,
      detectedContainer,
      audioByteLength: audioBuffer.byteLength,
      transcriptionLatencyMs,
    };
  }
}

/**
 * Enforces air-gapped local network or encrypted Zero-Trust tunnel residency for
 * `Muse Glimmer 30B` calls and structures dual-channel (`to=self` / `to=user`) prompts.
 * Strict 2-method boundary: enforceLocalAirGapEndpoint and buildDualChannelPrompt.
 */
export class GlimmerEdgeEndpointGuard {
  public enforceLocalAirGapEndpoint(endpointUrl: string): string {
    let parsed: URL;
    try {
      parsed = new URL(endpointUrl);
    } catch {
      throw new Error("Malformed local vLLM endpoint URL.");
    }

    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error("Local vLLM endpoint must use HTTP or HTTPS transport.");
    }

    const host = parsed.hostname.toLowerCase();
    const allowedLocalPrefixes = ["localhost", "127.0.0.1", "::1", "10.", "192.168."];
    const allowedPrivateSuffixes = [".railway.internal", ".trycloudflare.com"];

    const isLocalLoopback = allowedLocalPrefixes.some(
      (prefix) => host === prefix || host.startsWith(prefix)
    );
    const isAuthorizedTunnel =
      allowedPrivateSuffixes.some((suffix) => host.endsWith(suffix)) &&
      (host.endsWith(".railway.internal") || parsed.protocol === "https:");

    if (!isLocalLoopback && !isAuthorizedTunnel) {
      throw new Error(
        `PII Air-Gap violation: Muse Glimmer 30B endpoint (${host}) must reside on loopback, RFC-1918, Railway internal mesh, or an HTTPS Cloudflare Zero-Trust tunnel.`
      );
    }

    return parsed.toString().replace(/\/+$/, "");
  }

  public buildDualChannelPrompt(
    metrology: CalibratedMetrologyReport,
    localRecordBaselineMm2: number,
    sanitizedVoiceDirective: string
  ): string {
    if (!Number.isFinite(localRecordBaselineMm2) || localRecordBaselineMm2 <= 0) {
      throw new Error("localRecordBaselineMm2 must be a finite positive number.");
    }

    return JSON.stringify({
      instruction: [
        "Emit your private step-by-step mathematical cross-examination under header `assistant to=self`.",
        "Compare calibratedAreaMm2 against localRecordBaselineMm2.",
        "If relative drift exceeds 5%, explicitly note 'conflict' and 'mismatch' in `assistant to=self`.",
        "Then emit your final user-facing measurement summary under header `assistant to=user`.",
      ].join(" "),
      calibratedAreaMm2: Number(metrology.calibratedAreaMm2.toFixed(4)),
      localRecordBaselineMm2: Number(localRecordBaselineMm2.toFixed(4)),
      temporalIou: Number(metrology.temporalIou.toFixed(4)),
      operatorDirective: sanitizedVoiceDirective,
    });
  }
}

/**
 * Dispatches air-gapped edge reasoning to local `Muse Glimmer 30B` (vLLM / ExecuTorch)
 * with 16-token block diffusion speculative decoding.
 * Strict 2-method boundary: constructor and inferDualChannelVerification.
 */
export class MuseGlimmerLocalClient {
  private readonly localClient: OpenAI;
  private readonly endpointHost: string;
  private readonly guard: GlimmerEdgeEndpointGuard;

  constructor(localVllmBaseUrl: string, guard: GlimmerEdgeEndpointGuard) {
    const validatedUrl = guard.enforceLocalAirGapEndpoint(localVllmBaseUrl);
    this.endpointHost = new URL(validatedUrl).host;
    this.guard = guard;
    this.localClient = new OpenAI({
      apiKey: "local-airgap-vllm",
      baseURL: validatedUrl,
    });
  }

  public async inferDualChannelVerification(
    metrology: CalibratedMetrologyReport,
    localRecordBaselineMm2: number,
    sanitizedVoiceDirective: string
  ): Promise<GlimmerEdgeInferenceReceipt> {
    const structuredPrompt = this.guard.buildDualChannelPrompt(
      metrology,
      localRecordBaselineMm2,
      sanitizedVoiceDirective
    );

    const startMs = performance.now();

    const completion = await this.localClient.chat.completions.create({
      model: "meta-muse/Muse-Glimmer-30B",
      temperature: 0.0,
      max_tokens: 512,
      messages: [
        {
          role: "system",
          content:
            "You are Muse Glimmer 30B running in air-gapped edge verification mode. Always output `assistant to=self` followed by `assistant to=user`.",
        },
        {
          role: "user",
          content: structuredPrompt,
        },
      ],
      ...({
        extra_body: {
          num_speculative_tokens: 16,
          use_block_diffusion_drafter: true,
        },
      } as Record<string, unknown>),
    });

    const inferenceLatencyMs = Math.round(performance.now() - startMs);
    const rawDualChannelOutput = completion.choices[0]?.message?.content ?? "";

    if (
      !rawDualChannelOutput.includes("assistant to=self") ||
      !rawDualChannelOutput.includes("assistant to=user")
    ) {
      throw new Error(
        "Muse Glimmer 30B contract violation: output missing required `assistant to=self` or `assistant to=user` channel markers."
      );
    }

    return {
      rawDualChannelOutput,
      localEndpointHost: this.endpointHost,
      speculativeTokensAccepted: 16,
      inferenceLatencyMs,
    };
  }
}