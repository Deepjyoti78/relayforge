# RelayForge — Sequential Workflow Execution Engine

## 1. Overview & Architecture

RelayForge has evolved from a high-throughput webhook delivery gateway into an enterprise-grade sequential workflow orchestration platform. 

The Sequential Workflow Execution Engine allows organizations to define deterministic, multi-step delivery pipelines triggered by inbound webhooks:

```
[Inbound Webhook Event] 
        │
        ▼ (Endpoint Binding & RLS Isolation)
[Workflow Trigger Node] 
        │
        ▼ (Rule Engine: ALL / ANY logic)
[Condition Filtering Node] ────(Fails)───► [FILTERED] (Terminal)
        │ (Passes)
        ▼ (Safe bounded JSON path mapper)
[JSON Transformation Node]
        │
        ▼ (Stable downstream idempotency: `wf_${executionId}_${nodeId}`)
[HTTP Action 1] ──(Succeeded)──► [HTTP Action 2] ──(Succeeded)──► [HTTP Action N]
        │                              │                              │
     (Failed)                       (Failed)                       (Failed)
        │                              │                              │
        ▼                              ▼                              ▼
 [RETRY_WAIT (Backoff)]         [RETRY_WAIT (Backoff)]         [RETRY_WAIT (Backoff)]
        │                              │                              │
        └──────────────────────────────┴──────────────────────────────┘
                                       │
                                (Manual Resume)
                                       │
                 (Skip all SUCCEEDED steps, resume at failed step)
```

---

## 2. Relational Data Model & PostgreSQL Row-Level Security

All workflow entities are tenant-owned and protected by PostgreSQL Row-Level Security (RLS) policies:

- `workflows`: Parent entity containing organization ID, endpoint binding, name, description, status (`DRAFT`, `ACTIVE`, `PAUSED`), and a pointer to `active_version_id`.
- `workflow_versions`: Immutable version snapshots (`version_number`, `definition`, `definition_hash` computed via SHA-256). Once published, workflow definitions cannot be mutated in place, guaranteeing reproducibility of historical runs.
- `workflow_executions`: Execution instances tracking `org_id`, `workflow_id`, `workflow_version_id`, `event_id`, `status` (`QUEUED`, `RUNNING`, `SUCCEEDED`, `FAILED`, `FILTERED`, `RETRY_WAIT`, `CANCELLED`), `current_step`, `started_at`, `completed_at`, and `failure_reason`.
- `workflow_step_executions`: Fine-grained checkpoint records for every step (`TRIGGER`, `CONDITION`, `TRANSFORM`, `HTTP_ACTION`), storing `attempt_count`, `input_snapshot`, `output_snapshot`, and `error_details`.

### Security Definer Helpers & RLS Session Invariant
PostgreSQL RLS policies require `NULLIF(current_setting('app.current_org_id', true), '')::UUID` to match the row's `org_id`.
Background workers and recovery services utilize SECURITY DEFINER helpers:
- `get_active_workflow_for_endpoint(p_endpoint_id UUID)`
- `get_workflow_execution_org(p_execution_id UUID)`
- `claim_pending_outbox_messages(p_limit INT, p_lease_seconds INT)`

All transaction queries on tenant tables run within `tenantContext.runInTenantContext(orgId, userId, tx)` to guarantee tenant isolation.

---

## 3. Bounded Workflow Definition Language (DSL)

### 3.1 Trigger Step
Specifies the inbound entry point:
```json
{
  "trigger": {
    "nodeId": "trigger_1",
    "endpointId": "0b30bb62-67fe-498c-8f1d-cf4f90bf4ea7",
    "eventType": "payment.succeeded"
  }
}
```

### 3.2 Condition Group
Evaluates against incoming payload, headers, and event metadata. Supports `ALL` (AND) or `ANY` (OR) logic:
```json
{
  "conditionGroup": {
    "nodeId": "condition_1",
    "logic": "ALL",
    "rules": [
      { "field": "customer.tier", "operator": "equals", "value": "enterprise" },
      { "field": "amount", "operator": "greater_than", "value": 1000 }
    ]
  }
}
```
Supported operators: `equals`, `not_equals`, `greater_than`, `less_than`, `exists`, `not_exists`, `contains`.

### 3.3 Safe JSON Transformation
Applies deterministic field mapping and extraction without evaluating arbitrary JavaScript:
- Supports bracket notation `items[0].price` and dot notation `customer.email`.
- Prototype pollution protection (`__proto__`, `constructor`, `prototype` are strictly rejected).
- Hard bounded limits: maximum depth 10, maximum payload size 1MB.

```json
{
  "transform": {
    "nodeId": "transform_1",
    "type": "map",
    "fields": {
      "recipient_email": "customer.email",
      "total_amount": "amount",
      "routed_by": "metadata.source"
    }
  }
}
```

### 3.4 Sequential HTTP Actions
Defines 1 to 5 sequential delivery steps to registered, SSRF-protected destinations:
```json
{
  "actions": [
    {
      "nodeId": "action_1",
      "destinationId": "9fa80242-b052-47d3-83f9-7e9b3bb88fa5",
      "httpMethod": "POST",
      "retryPolicy": {
        "maxRetries": 3,
        "initialBackoffMs": 500,
        "maxBackoffMs": 30000,
        "backoffMultiplier": 2
      }
    },
    {
      "nodeId": "action_2",
      "destinationId": "7ce82914-1e52-498b-967a-115f5a8942b1",
      "httpMethod": "POST"
    }
  ]
}
```

---

## 4. Execution Checkpointing & Safe Resume Guarantees

### Checkpointed State Transitions
During execution, every step state transition is recorded in `workflow_step_executions` within its own short transaction outside the outbound HTTP delivery call:
1. Step marked `RUNNING`.
2. Outbound HTTP request dispatched via `DeliveryService` using SSRF-validated, DNS socket-pinned dispatcher and HMAC-SHA256 signature.
3. If delivery returns HTTP 2xx: step marked `SUCCEEDED`, and output snapshot recorded.
4. If delivery returns HTTP 4xx/5xx or network timeout:
   - Evaluates retry policy (exponential backoff with jitter and `Retry-After` header parsing).
   - If retry attempts remain: step and execution enter `RETRY_WAIT`, scheduling next retry in transactional outbox.
   - If max retries exhausted: step and execution enter `FAILED`.

### Safe Resumption Invariant
When a user triggers `/resume` on a `FAILED` or `RETRY_WAIT` execution:
1. The engine checks `workflow_step_executions` for any step with `status === 'SUCCEEDED'`.
2. All previously completed steps (including Action 1) are strictly skipped.
3. Execution resumes directly at the failed action (Action 2).
4. Stable downstream idempotency header (`X-RelayForge-Delivery-Id: wf_${executionId}_${nodeId}`) guarantees downstream destinations can safely deduplicate duplicate delivery attempts.

---

## 5. User Interface & Management Console

The RelayForge monochromatic console (`#0E0E10`, `#232327`, `#3E3E45`, `#63636E`, `#9A9AA6`, `#C9C9D2`, `#F2F2F5`) includes:

- **Workflows Tab & Directory**: Lists active, draft, and paused pipelines with version status and action counts.
- **Visual Sequential Flow Canvas**: Visual DAG rendering Step 0 (Webhook Trigger), Step 1 (Condition Filter), Step 2 (JSON Transformer), and Step 3 (Sequential HTTP Deliveries) with live validation against the NestJS API schema.
- **Publish & Versioning**: Live SHA-256 hash calculation and one-click immutable publishing.
- **Execution Lineage Inspector**: Detailed audit trail showing input and output payloads for each node, execution duration, and one-click resumption for failed steps.
- **Zero Browser Popups**: All confirmation dialogues (activation, pausing, resumption) utilize the in-app monochromatic modal component.
