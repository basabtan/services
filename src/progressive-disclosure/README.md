# Progressive Disclosure

A host-agnostic information-sequencing model for interfaces that should feel like they reveal **the information you need, when you need it**.

This package contains no DSS, KAU, ZEAL, TIX, or other product-specific data. Hosts supply their own content and rules.

## Core sequence

`signal → context → explanation → evidence → action → implementation → alternatives`

This is a default information journey, not a requirement that every screen show every layer.

## Design rule

Show the minimum information needed to understand the current state. When the user acts, reveal the layer most likely to answer the question created by what they just saw.

## Interaction principles

1. **Priority before completeness.** Do not surface everything merely because it exists.
2. **Each expansion answers a question.** A nested card should justify itself by answering a natural follow-up.
3. **Recommended action is singular.** When evidence supports a logical next step, make one action primary and keep alternatives quieter.
4. **Preserve user agency.** Hosts may expose alternatives at every action layer.
5. **Do not bury evidence.** Evidence can be quieter than the recommendation, but it must remain reachable.
6. **Motion communicates hierarchy.** Expanding and collapsing should be spatial inverses.
7. **No product knowledge in the service.** Scoring thresholds, owners, interventions, and domain meaning belong to the host.

## API

```ts
import { nextNodes, rankNext, recommendedNext, validateJourney, type DisclosureJourney }
  from '@basabtan/repair-report/progressive-disclosure';
```

## Recommended host pattern

```text
glance
  ↓ click
focused detail
  ↓ expand
why / evidence
  ↓ continue
recommended action
  ↓ inspect
implementation detail
  ↘ alternatives
```

## Playground

Open `demo/progressive-disclosure-playground.html`.

The demo uses neutral placeholder information to test sequencing, nested disclosure, recommendations, and reversible transitions before applying the pattern to a real application.