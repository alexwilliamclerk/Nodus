# Reviewable agent memory with provenance and revocation
# 带来源、可审阅、可撤销的 Agent 记忆

A suggestion in a source is not automatically a user preference. If a design note says a customer has not confirmed a light interface, storing “the customer requires a light interface” would change its meaning.

材料里的建议不等于用户要求。记忆应保留来源和不确定性，让用户决定它能否用于后续请求。

## Walk through the example / 体验示例

Open the memory case in **Try without a key / 免密钥体验**. The fictional design note proposes a light interface but leaves approval unresolved. The replay illustrates a qualified candidate, source review, explicit approval and later revocation. These transitions are scripted; no memory is written by the replay.

## Use real memory controls / 使用真实记忆功能

1. Create the independent trial task. Review its fictional attachment and connect a model if you want an actual response.
2. Open **Safety & permissions → Reviewable, revocable memory / 安全与授权 → 可审阅、可撤销的记忆**.
3. Create a candidate using the source. Preserve the qualification: the light interface was suggested, not confirmed. Check its source quotation and intended scope before approving it.
4. Inspect which records are active. Editing approved content requires another review; an external suggestion must not silently become a user requirement.
5. Revoke the record and inspect future use. Revocation stops future injection; it cannot recall already transmitted content or undo derived deliverables.

创建示例只复制任务材料，不会预先批准或写入记忆。审阅与撤销需要在真实记忆界面明确操作。

## Compression is a separate choice / 压缩是另一个决定

The budget/compression demo illustrates the same need to preserve unresolved details. In a real task, use **Reviewable context compression** to select eligible earlier replies or sources, review a shorter summary and its quotations, and retain important original passages before approval. User messages, recent turns and current requirements remain protected from this replacement. Revoking the summary restores original context for future requests.

A shorter context does not automatically improve reasoning. Character counts are not exact token or billing measurements. Compare actual task quality and usage before claiming an efficiency gain.

[Back to demo](../demo/README.md) · [Repository](https://github.com/alexwilliamclerk/Nodus)
