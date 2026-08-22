# Research: Anthropic Claude 5 model family

**Prepared:** 2026-08-04 (sources accessed 2026-08-04)
**Linear issue:** LIN-12
**Interpretation:** The issue text says “them tropic table 5.” Anthropic does not list a model named “Table 5”; this report treats it as a request about the newly released **Anthropic Claude 5 family**, with emphasis on **Claude Opus 5**, Anthropic’s latest broadly applicable premium model.

## Executive summary

Anthropic’s current Claude 5 lineup has multiple tiers rather than one model called “Claude 5.” The official documentation identifies:

- **Claude Fable 5** (`claude-fable-5`) as the most capable widely released model, positioned for long-running agents.
- **Claude Mythos 5** (`claude-mythos-5`) as an invitation-only preview model under Project Glasswing, not generally available.
- **Claude Opus 5** (`claude-opus-5`) for complex agentic coding and enterprise work; Anthropic announced its availability on 2026-07-24.
- **Claude Sonnet 5** (`claude-sonnet-5`) as the speed/intelligence balance for coding and agents; announced 2026-06-30.
- **Claude Haiku 4.5** as the lower-cost, higher-throughput option; it is not a Claude 5 model.

For an engineering workflow with difficult multi-step coding or agent tasks, **Opus 5 is the sensible model to evaluate first**. For routine/high-volume work, Sonnet 5 or Haiku 4.5 should be evaluated against a representative task set before choosing on claimed benchmark performance alone. No production rollout or provider configuration change was performed for this research.

## What is new in Claude Opus 5

Anthropic describes Opus 5 as a “step-change improvement” over Opus 4.8, especially in deep reasoning, agentic/long-horizon tasks, and test-time compute scaling. Its product announcement says it approaches Fable 5 frontier intelligence at half the price and is the new default model on Claude Max.

### Documented platform characteristics

| Item | Claude Opus 5 |
|---|---|
| API model ID | `claude-opus-5` |
| Intended use | Complex agentic coding and enterprise work |
| Context window | 1M tokens (default and maximum) |
| Maximum output | 128k tokens |
| Thinking | Enabled by default |
| API availability | Claude API, Amazon Bedrock, Claude Platform on AWS, Google Cloud, and Microsoft Foundry |
| Standard API price | $5 / million input tokens; $25 / million output tokens |
| Prompt-cache price (5-minute TTL) | $6.25 / million cache writes; $0.50 / million cache reads |
| Fast mode | Up to 2.5x faster output speed at 2x standard token pricing; research preview |

Pricing is source-observed on 2026-08-04 and should be rechecked immediately before a purchasing or production decision.

### API and migration changes worth testing

1. **Thinking is on by default.** Its output counts against `max_tokens`, so requests that previously ran without thinking may need a higher limit or explicit `thinking: {type: "disabled"}` where appropriate.
2. **Mid-conversation tool changes are beta.** The API can add or remove tools between turns while retaining prompt-cache state when the `mid-conversation-tool-changes-2026-07-01` beta header is included.
3. **Server-side fallback default mode is beta.** The `fallbacks: "default"` option uses Anthropic’s recommended fallback by refusal category, using the `server-side-fallback-2026-07-01` beta header.
4. **Prompt caching accepts shorter prompts.** The documented minimum cacheable prompt length drops from 1,024 tokens in Opus 4.8 to 512 tokens in Opus 5.
5. **Effort should be evaluated, not assumed.** Anthropic recommends starting at default effort and tuning it based on evaluations to trade off intelligence, latency, and cost.

## Reported performance and limitations

Anthropic reports state-of-the-art results on its cited coding and knowledge-work evaluations, including Frontier-Bench and GDPval-AA, and describes stronger software-engineering, scientific-research, and visual-output performance than Opus 4.8. These are vendor-reported results, so they are useful directionally but are not a substitute for a local evaluation using the actual repository, tool access, prompts, and acceptance criteria.

The product announcement also says Opus 5 remains behind Mythos 5 on cybersecurity tasks. Mythos 5 is not generally available, so it should not be treated as a selectable default for this project.

## Claude 5 tier selection

| Workload | Recommended starting point | Reason |
|---|---|---|
| Long-running autonomous agent work where highest capability is needed | Fable 5, if its higher cost and availability fit | Anthropic positions Fable 5 as next-generation intelligence for long-running agents. |
| Complex coding, debugging, multi-step repo changes, enterprise workflows | Opus 5 | Anthropic explicitly positions it for complex agentic coding and enterprise work. |
| General coding/agent work at more moderate cost | Sonnet 5 | Anthropic positions it as the speed/intelligence balance and a high-performance coding/agent model. |
| High-volume straightforward tasks and cost-sensitive prototypes | Haiku 4.5 | Anthropic recommends an efficiency-first approach for these cases. |
| Cybersecurity-specific maximum capability | Mythos 5 only if approved for Project Glasswing | Anthropic says it is limited availability, not generally available. |

## Suggested evaluation before adoption

This is a proposed evaluation plan only; it was not run and no model/provider settings were changed.

1. Define a fixed, redacted task set from this repository: a small bug fix, a multi-file feature change, a test-repair task, a documentation/research task, and a tool-using task.
2. Run the same prompts and tool budget on the current model, Sonnet 5, and Opus 5. Record task success, human-review defects, elapsed time, input/output tokens, and total cost.
3. Test migration-sensitive cases: default thinking, `max_tokens` limits, tool changes in a preserved conversation, and prompts between 512 and 1,024 tokens that should now cache.
4. Use pinned model IDs for reproducibility during the evaluation; do not rely on aliases without a controlled upgrade process.
5. Promote only the model/tier that improves the measured outcome enough to justify cost and latency. Recheck current pricing, availability, limits, safety documentation, and provider terms before any production decision.

## Sources

All sources below are first-party Anthropic documentation or announcements, accessed 2026-08-04:

1. Anthropic, “Introducing Claude Opus 5” (2026-07-24): https://www.anthropic.com/news/claude-opus-5
2. Anthropic Claude Platform Docs, “Models overview”: https://platform.claude.com/docs/en/about-claude/models/overview
3. Anthropic Claude Platform Docs, “What’s new in Claude Opus 5”: https://platform.claude.com/docs/en/about-claude/models/whats-new-opus-5
4. Anthropic Claude Platform Docs, “What’s new in Claude Sonnet 5”: https://platform.claude.com/docs/en/about-claude/models/whats-new-sonnet-5
5. Anthropic Claude Platform Docs, “Choosing the right model”: https://platform.claude.com/docs/en/about-claude/models/choosing-a-model
6. Anthropic, “Plans & Pricing” (API tab): https://claude.com/pricing#api
