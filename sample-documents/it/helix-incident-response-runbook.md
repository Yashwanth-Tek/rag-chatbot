# Helix Systems incident response runbook

_Fictional sample document created for testing the RAG chatbot. All organisations, people, figures and contact details in it are invented._

## Severity levels

| Severity | Definition | Acknowledge within | Status updates |
| --- | --- | --- | --- |
| SEV1 | A customer-facing service is completely down, or a data breach is confirmed | 15 minutes | Every 30 minutes |
| SEV2 | A major feature is degraded for many customers | 30 minutes | Every hour |
| SEV3 | A minor feature is degraded and a workaround exists | 4 business hours | Daily |
| SEV4 | Cosmetic issue or no customer impact | Next business day | On resolution |

When in doubt, choose the higher severity. It can be lowered later.

## Roles

- **Incident Commander:** runs the response, makes decisions and assigns work. The commander does not debug.
- **Communications Lead:** posts status updates for customers and internal teams.
- **Scribe:** keeps a timeline of events, decisions and actions in the incident channel.
- **Subject matter experts:** engineers who investigate and fix the problem.

Every SEV1 and SEV2 incident must have a named Incident Commander.

## Response steps

1. **Declare.** Anyone can declare an incident by typing `/incident` in PageRelay. This creates a channel and pages the on-call engineer.
2. **Assemble.** The on-call engineer becomes Incident Commander until they hand over.
3. **Stabilize.** Prefer rolling back a recent change over fixing forward.
4. **Communicate.** For SEV1 and SEV2, post on the public status page (status.helix.example) within 30 minutes of declaring.
5. **Resolve.** Confirm with monitoring that the service has recovered before closing the incident.
6. **Review.** Write a postmortem (see below).

## Escalation

If a SEV1 page is not acknowledged within 15 minutes, PageRelay pages the secondary on-call engineer, then the Engineering Manager. If the incident is still unresolved after 45 minutes, the VP of Engineering is informed.

## Security incidents

Page the Security on-call engineer for any suspected breach. Preserve evidence: do not wipe or reimage affected machines. The CISO and General Counsel decide on legal notifications. Customers must be notified within 72 hours of confirming a breach of their personal data.

## Postmortems

Postmortems are blameless: they look at systems and processes, not individuals. A draft is due within 5 business days for every SEV1 and SEV2 incident. Each action item has an owner and a due date, and open items are reviewed at the weekly reliability meeting.

## On-call

On-call rotations last one week and hand over on Mondays at 10:00 local time. Engineers receive $300 for each on-call week, plus time off in lieu for any page handled between 22:00 and 07:00.
