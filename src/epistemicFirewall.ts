export interface SeparatedGlimmerChannels {
  readonly privateDeliberation: string;
  readonly publicCommitment: string;
}

export interface EpistemicAuditVerdict {
  readonly isConsistent: boolean;
  readonly divergenceRatio: number;
  readonly requiresWonderEscalation: boolean;
  readonly auditReason: string;
}

/**
 * Separates Muse Glimmer 30B raw output into private deliberation (`assistant to=self`)
 * and public commitment (`assistant to=user`) channels.
 * Strict 2-method boundary: splitChannels and extractNumericVector.
 */
export class GlimmerTraceParser {
  public splitChannels(rawModelOutput: string): SeparatedGlimmerChannels {
    const selfMarker = "assistant to=self";
    const userMarker = "assistant to=user";

    const selfIndex = rawModelOutput.indexOf(selfMarker);
    const userIndex = rawModelOutput.indexOf(userMarker);

    if (userIndex === -1) {
      throw new Error("Malformed Muse Glimmer payload: missing `assistant to=user` marker.");
    }

    const privateDeliberation =
      selfIndex !== -1 && selfIndex < userIndex
        ? rawModelOutput.slice(selfIndex + selfMarker.length, userIndex).trim()
        : "";

    const publicCommitment = rawModelOutput
      .slice(userIndex + userMarker.length)
      .trim();

    return { privateDeliberation, publicCommitment };
  }

  public extractNumericVector(text: string): readonly number[] {
    const matches = text.match(/-?\d+(?:\.\d+)?/g);
    if (!matches) {
      return [];
    }
    return matches.map((m) => Number.parseFloat(m)).filter((n) => Number.isFinite(n));
  }
}

/**
 * Audits consistency between private deliberation and public commitment.
 * Flags any numeric drift or uncertainty markers for Muse Wonder 1.0 escalation.
 * Strict 2-method boundary: evaluateUncertaintyLexicon and auditChannelConsistency.
 */
export class EpistemicDivergenceAuditor {
  public evaluateUncertaintyLexicon(privateDeliberation: string): number {
    const highRiskTokens = [
      "conflict",
      "uncertain",
      "ambiguous",
      "mismatch",
      "unverified",
      "contradicts",
    ];
    const normalized = privateDeliberation.toLowerCase();
    let hits = 0;

    for (const token of highRiskTokens) {
      if (normalized.includes(token)) {
        hits++;
      }
    }
    return hits / highRiskTokens.length;
  }

  public auditChannelConsistency(
    rawModelOutput: string,
    maxToleranceEpsilon: number,
    parser: GlimmerTraceParser
  ): EpistemicAuditVerdict {
    if (maxToleranceEpsilon < 0 || maxToleranceEpsilon > 1) {
      throw new Error("maxToleranceEpsilon must be in [0, 1].");
    }

    const { privateDeliberation, publicCommitment } = parser.splitChannels(rawModelOutput);
    if (privateDeliberation.length === 0) {
      return {
        isConsistent: false,
        divergenceRatio: 1.0,
        requiresWonderEscalation: true,
        auditReason: "Missing private deliberation trace; zero-trust escalation enforced.",
      };
    }

    const selfNums = parser.extractNumericVector(privateDeliberation);
    const userNums = parser.extractNumericVector(publicCommitment);
    const lexiconRisk = this.evaluateUncertaintyLexicon(privateDeliberation);

    let unmatchedCount = 0;
    for (const userVal of userNums) {
      const matched = selfNums.some((selfVal) => {
        const denom = Math.max(Math.abs(selfVal), 1e-9);
        return Math.abs(userVal - selfVal) / denom <= maxToleranceEpsilon;
      });
      if (!matched) {
        unmatchedCount++;
      }
    }

    const numericDivergence =
      userNums.length === 0 ? 0 : unmatchedCount / userNums.length;
    const compositeDivergence = Math.max(numericDivergence, lexiconRisk);
    const requiresEscalation = compositeDivergence > maxToleranceEpsilon;

    return {
      isConsistent: !requiresEscalation,
      divergenceRatio: compositeDivergence,
      requiresWonderEscalation: requiresEscalation,
      auditReason: requiresEscalation
        ? `Epistemic divergence (${compositeDivergence.toFixed(3)}) exceeded threshold (${maxToleranceEpsilon}). Escalating to Muse Wonder 1.0.`
        : "Private deliberation invariants verified against public output.",
    };
  }
}