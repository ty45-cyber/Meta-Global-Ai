import { createHash } from "crypto";
import OpenAI from "openai";
import { CalibratedMetrologyReport } from "./rleMetrologyKernel";
import { EpistemicAuditVerdict, SeparatedGlimmerChannels } from "./epistemicFirewall";

export interface EscalationContext {
  readonly sessionId: string;
  readonly domainVertical: "CLINICAL_TRIAGE" | "VOTASAFI_AUDIT";
  readonly metrology: CalibratedMetrologyReport;
  readonly glimmerChannels: SeparatedGlimmerChannels;
  readonly epistemicVerdict: EpistemicAuditVerdict;
  readonly invariantRuleDescription: string;
}

export interface WonderArbitrationVerdict {
  readonly approvedForExecution: boolean;
  readonly reconciledValueMm2: number;
  readonly confidenceScore: number;
  readonly mathematicalJustification: string;
  readonly stateCommitmentHash: string;
}

/**
 * Constructs formal verification prompts and validates JSON schema invariants
 * returned by `muse-wonder-1.0`.
 * Strict 2-method boundary: buildFormalVerificationPrompt and parseAndVerifyVerdict.
 */
export class WonderInvariantValidator {
  public buildFormalVerificationPrompt(context: EscalationContext): string {
    if (!context.sessionId || context.sessionId.trim().length === 0) {
      throw new Error("Invalid EscalationContext: sessionId is required.");
    }

    const stateSnapshot = {
      sessionId: context.sessionId,
      vertical: context.domainVertical,
      calibratedMetrology: {
        calibratedAreaMm2: Number(context.metrology.calibratedAreaMm2.toFixed(4)),
        targetPixels: context.metrology.targetPixelCount,
        referencePixels: context.metrology.referencePixelCount,
        temporalIou: Number(context.metrology.temporalIou.toFixed(4)),
      },
      disputedGlimmerState: {
        privateDeliberationTrace: context.glimmerChannels.privateDeliberation,
        publicCommitmentClaim: context.glimmerChannels.publicCommitment,
        divergenceRatio: context.epistemicVerdict.divergenceRatio,
      },
      domainInvariant: context.invariantRuleDescription,
    };

    return JSON.stringify(stateSnapshot);
  }

  public parseAndVerifyVerdict(
    rawJsonText: string,
    serializedPromptPayload: string
  ): WonderArbitrationVerdict {
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(rawJsonText) as Record<string, unknown>;
    } catch {
      throw new Error("Muse Wonder 1.0 schema violation: output is not valid JSON.");
    }

    const approved = parsed.approvedForExecution;
    const reconciledValueMm2 = parsed.reconciledValueMm2;
    const confidenceScore = parsed.confidenceScore;
    const justification = parsed.mathematicalJustification;

    if (typeof approved !== "boolean") {
      throw new Error("Schema violation: approvedForExecution must be boolean.");
    }
    if (typeof reconciledValueMm2 !== "number" || !Number.isFinite(reconciledValueMm2) || reconciledValueMm2 < 0) {
      throw new Error("Schema violation: reconciledValueMm2 must be a non-negative finite number.");
    }
    if (
      typeof confidenceScore !== "number" ||
      confidenceScore < 0 ||
      confidenceScore > 1
    ) {
      throw new Error("Schema violation: confidenceScore must be within [0.0, 1.0].");
    }
    if (typeof justification !== "string" || justification.trim().length < 10) {
      throw new Error("Schema violation: mathematicalJustification must be a non-empty proof string.");
    }

    const stateCommitmentHash = createHash("sha256")
      .update(`${serializedPromptPayload}:${approved}:${reconciledValueMm2.toFixed(4)}`)
      .digest("hex");

    return {
      approvedForExecution: approved,
      reconciledValueMm2,
      confidenceScore,
      mathematicalJustification: justification.trim(),
      stateCommitmentHash,
    };
  }
}

/**
 * Escalates disputed epistemic states to `muse-wonder-1.0` for formal mathematical arbitration.
 * Strict 2-method boundary: constructor and arbitrateDisputedState.
 */
export class MuseWonderArbitrator {
  private readonly client: OpenAI;
  private readonly validator: WonderInvariantValidator;

  constructor(apiKey: string, validator: WonderInvariantValidator) {
    if (!apiKey || apiKey.trim().length === 0) {
      throw new Error("Fail-fast invariant violated: missing META_MODEL_API_KEY.");
    }
    this.client = new OpenAI({
      apiKey,
      baseURL: "https://api.meta.ai/v1",
    });
    this.validator = validator;
  }

  public async arbitrateDisputedState(
    context: EscalationContext
  ): Promise<WonderArbitrationVerdict> {
    const serializedPayload = this.validator.buildFormalVerificationPrompt(context);

    const completion = await this.client.chat.completions.create({
      model: "muse-wonder-1.0",
      temperature: 0.0,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: [
            "You are a formal mathematical arbitration engine.",
            "Reconcile the physical SAM 3.1 RLE metrology against the disputed Muse Glimmer 30B channels.",
            "Return ONLY a JSON object with keys:",
            "approvedForExecution (boolean), reconciledValueMm2 (number), confidenceScore (number 0..1), mathematicalJustification (string).",
          ].join(" "),
        },
        {
          role: "user",
          content: serializedPayload,
        },
      ],
    });

    const rawContent = completion.choices[0]?.message?.content;
    if (!rawContent) {
      throw new Error("Muse Wonder 1.0 returned an empty arbitration payload.");
    }

    return this.validator.parseAndVerifyVerdict(rawContent, serializedPayload);
  }
}