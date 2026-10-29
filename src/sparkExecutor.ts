import OpenAI from "openai";
import { PhysicalMetrologyCalculator, RleSpan } from "./rleMetrologyKernel";

export interface ViewportTargetCoordinates {
  readonly controlNounPhrase: string;
  readonly centroidX: number;
  readonly centroidY: number;
  readonly viewportWidth: number;
  readonly viewportHeight: number;
}

export interface SparkWorkflowDirective {
  readonly sessionId: string;
  readonly verifiedAreaMm2: number;
  readonly stateCommitmentHash: string;
  readonly voiceTranscriptCommand: string;
  readonly uiTarget: ViewportTargetCoordinates;
}

export interface SparkExecutionReceipt {
  readonly sessionId: string;
  readonly executedToolName: string;
  readonly clickX: number;
  readonly clickY: number;
  readonly injectedPayload: string;
  readonly stateCommitmentHash: string;
  readonly timestampIso: string;
}

/**
 * Enforces viewport boundary safety and verifies post-action visual state transitions.
 * Strict 2-method boundary: sanitizeCoordinateBounds and verifyExecutionPostCondition.
 */
export class ViewportActionGuard {
  public sanitizeCoordinateBounds(
    x: number,
    y: number,
    viewportWidth: number,
    viewportHeight: number
  ): { readonly safeX: number; readonly safeY: number } {
    if (viewportWidth <= 0 || viewportHeight <= 0) {
      throw new Error("Viewport dimensions must be strictly positive.");
    }
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      throw new Error("Centroid coordinates must be finite numbers.");
    }

    const roundedX = Math.round(x);
    const roundedY = Math.round(y);

    if (
      roundedX < 0 ||
      roundedX >= viewportWidth ||
      roundedY < 0 ||
      roundedY >= viewportHeight
    ) {
      throw new Error(
        `Viewport boundary violation: centroid (${roundedX}, ${roundedY}) outside (${viewportWidth}x${viewportHeight}).`
      );
    }

    return { safeX: roundedX, safeY: roundedY };
  }

  public verifyExecutionPostCondition(
    preActionRleSpans: readonly RleSpan[],
    postActionRleSpans: readonly RleSpan[],
    calculator: PhysicalMetrologyCalculator
  ): boolean {
    const postTransitionIou = calculator.computeIntervalIou(
      preActionRleSpans,
      postActionRleSpans
    );
    // A visual UI transition (e.g., modal dismissal, status badge update) must shift
    // the regional binary mask sufficiently that IoU drops below 0.85.
    return postTransitionIou < 0.85;
  }
}

/**
 * Orchestrates grounded agentic tool execution and SAM-guided visual computer-use
 * via `muse-spark-1.3`.
 * Strict 2-method boundary: constructor and executeGroundedWorkflow.
 */
export class MuseSparkExecutor {
  private readonly client: OpenAI;
  private readonly guard: ViewportActionGuard;

  constructor(apiKey: string, guard: ViewportActionGuard) {
    if (!apiKey || apiKey.trim().length === 0) {
      throw new Error("Fail-fast invariant violated: missing META_MODEL_API_KEY.");
    }
    this.client = new OpenAI({
      apiKey,
      baseURL: "https://api.meta.ai/v1",
    });
    this.guard = guard;
  }

  public async executeGroundedWorkflow(
    directive: SparkWorkflowDirective
  ): Promise<SparkExecutionReceipt> {
    const { safeX, safeY } = this.guard.sanitizeCoordinateBounds(
      directive.uiTarget.centroidX,
      directive.uiTarget.centroidY,
      directive.uiTarget.viewportWidth,
      directive.uiTarget.viewportHeight
    );

    const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
      {
        type: "function",
        function: {
          name: "commit_legacy_viewport_action",
          description:
            "Clicks the SAM 3.1 calibrated pixel centroid on a legacy non-DOM viewport and injects the cryptographically verified metrology payload.",
          parameters: {
            type: "object",
            properties: {
              clickX: { type: "number" },
              clickY: { type: "number" },
              verifiedPayloadString: { type: "string" },
            },
            required: ["clickX", "clickY", "verifiedPayloadString"],
            additionalProperties: false,
          },
        },
      },
    ];

    const response = await this.client.chat.completions.create({
      model: "muse-spark-1.3",
      temperature: 0.0,
      tools,
      tool_choice: {
        type: "function",
        function: { name: "commit_legacy_viewport_action" },
      },
      messages: [
        {
          role: "system",
          content:
            "You are a deterministic execution controller. Dispatch the verified physical metrology and commitment hash to the calibrated viewport coordinates.",
        },
        {
          role: "user",
          content: JSON.stringify({
            sessionId: directive.sessionId,
            voiceDirective: directive.voiceTranscriptCommand,
            calibratedAreaMm2: directive.verifiedAreaMm2,
            commitmentHash: directive.stateCommitmentHash,
            targetControl: directive.uiTarget.controlNounPhrase,
            calibratedCentroid: { x: safeX, y: safeY },
          }),
        },
      ],
    });

    const toolCall = response.choices[0]?.message?.tool_calls?.[0];
    if (!toolCall || toolCall.type !== "function") {
      throw new Error("Muse Spark 1.3 failed to emit required deterministic tool call.");
    }

    const args = JSON.parse(toolCall.function.arguments) as {
      readonly clickX: number;
      readonly clickY: number;
      readonly verifiedPayloadString: string;
    };

    const verifiedCoords = this.guard.sanitizeCoordinateBounds(
      args.clickX,
      args.clickY,
      directive.uiTarget.viewportWidth,
      directive.uiTarget.viewportHeight
    );

    return {
      sessionId: directive.sessionId,
      executedToolName: toolCall.function.name,
      clickX: verifiedCoords.safeX,
      clickY: verifiedCoords.safeY,
      injectedPayload: args.verifiedPayloadString,
      stateCommitmentHash: directive.stateCommitmentHash,
      timestampIso: new Date().toISOString(),
    };
  }
}