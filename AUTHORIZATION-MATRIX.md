# Authorization Matrix

| Capability | Guest | User/Owner | Provider | Server/Worker |
|---|---:|---:|---:|---:|
| Browse public jobs/categories | ✅ | ✅ | ✅ | — |
| Create/edit own job | ❌ | ✅ | ❌ | — |
| Publish own job | ❌ | ✅ | ❌ | — |
| Submit offer | ❌ | ❌* | ✅ | — |
| Accept own-job offer | ❌ | ✅ | ❌ | — |
| Start assigned job | ❌ | ❌ | ✅ | — |
| Submit evidence | ❌ | ❌ | ✅ assigned | — |
| Deliver assigned job | ❌ | ❌ | ✅ assigned | — |
| Fund/release owned payment | ❌ | ✅ owner | ❌ | — |
| Process payment outbox | ❌ | ❌ | ❌ | ✅ |
| Read operational metrics | ❌ | ❌ | ❌ | ✅ token |

\* Account type/state rules may further constrain mutations.
