---
title: 'Ambientes e dados operacionais ficam isolados'
type: 'feature'
ticket: '3'
created: '2026-10-19'
status: 'built'
baseline_revision: 'ccedbea2e49036817566b3b2b4582fba2e635839'
route: 'full'
route_source: 'auto'
risk: 'medium'
review: 'quick'
review_source: 'pinned'
lenses_ran: ['quick']
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/initiative-brief-ensaios-ia-whatsapp/architecture-ensaios-ia-whatsapp/architecture-ensaios-ia-whatsapp.md'
  - '{project-root}/_bmad-output/initiative-brief-ensaios-ia-whatsapp/prd-ensaios-ia-whatsapp/prd-ensaios-ia-whatsapp.md'
  - '{project-root}/docs/platform-staging.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** O smoke local já limita a exposição do PostgreSQL e protege rotas internas, mas a base ainda não tem uma verificação repetível desses controles nem um contrato operacional claro para staging, produção e mídia de E6. O provedor externo continua sem decisão, então a CI não pode provar controles do plano de hospedagem.

**Approach:** Criar uma verificação local e de CI para a configuração de rede, segredos e cache que o repositório controla; corrigir lacunas encontradas e documentar os gates que dependem do futuro provedor, incluindo HTTPS, escopos de segredo separados, banco privado e mídia privada. Não provisionar hospedagem nem armazenamento.

## Boundaries & Constraints

**Always:** Manter credenciais fora do repositório e do contexto de build; segredos reais de staging e produção pertencem a escopos separados do provedor e nunca são compartilhados com local/CI. No Compose local, o banco não publica porta e a web fica em loopback; rotas privadas são dinâmicas e retornam `Cache-Control: no-store` em todos os resultados. Antes de qualquer deploy externo, exigir ingress HTTPS e validar a rede privada do banco. Mídia do consumidor E6 deve usar armazenamento privado; filas e logs guardam referências, nunca bytes.

**Never:** Selecionar ou provisionar Railway ou outro serviço pago, implantar produção, adicionar credenciais reais ou provisionar armazenamento de fotos. Não alegar que CI local comprova a separação real de segredos, HTTPS público, alcance de rede do banco ou configuração de storage do provedor.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
| --- | --- | --- | --- |
| Isolamento local válido | Compose, Docker ignore e rotas privadas atuais | Verificação de plataforma passa e CI executa o mesmo comando | Nenhum erro esperado |
| Banco publicado ou web aberta além de loopback | Configuração local alterada | Verificação falha com o serviço e controle que precisam de ajuste | Código de saída não zero, sem imprimir valores secretos |
| Resposta privada sem política de cache | Rota ou smoke com resposta sem `no-store` | Verificação ou smoke falha; todas as respostas privadas permanecem não armazenáveis | Falha identificável no CI |
| Provedor ainda não aprovado | Sem configuração real de staging/produção | Deploy externo continua bloqueado e os gates ficam documentados | Não simular verificação externa |

</frozen-after-approval>

## Code Map

- `compose.yaml` — referência do ambiente local: PostgreSQL sem porta publicada, rede `private` e web restrita a `127.0.0.1`; verificar esses invariantes sem adicionar acesso público.
- `.dockerignore`, `.env.example`, `.gitignore`, `Dockerfile` — excluir arquivos `.env*` do contexto de build e manter exemplos sem valores; o exemplo atual também precisa declarar `POSTGRES_PASSWORD` usado pelo Compose.
- `src/app/api/internal/smoke/route.ts`, `src/app/api/internal/smoke/[id]/route.ts`, `src/app/api/internal/smoke/[id]/retry/route.ts`, `src/adapters/http/smoke-retry-handler.ts` — rotas dinâmicas existentes; POST não autorizado ainda não envia `no-store`.
- `scripts/smoke-local.mjs`, `tests/platform-smoke.test.mjs` — smoke sintético e testes existentes; ampliar a verificação de cabeçalhos sem alterar o fluxo durável.
- `scripts/check-platform-isolation.mjs`, `package.json`, `.github/workflows/staging-smoke.yml` — novo preflight independente de provedor e sua execução no CI local equivalente; o workflow atual não implanta.
- `docs/platform-staging.md`, arquitetura AD-5/AD-8 — registrar escopos separados, HTTPS, rede privada, cache e política E6; a decisão de hosting/region permanece em aberto.

## Tasks & Acceptance

**Execution:**
- [ ] `.dockerignore`, `.env.example` — excluir `.env` e variantes do contexto Docker e documentar as variáveis locais requeridas apenas com placeholders vazios.
- [ ] `src/app/api/internal/smoke/route.ts`, `scripts/smoke-local.mjs`, `tests/platform-smoke.test.mjs` — aplicar `no-store` também à resposta 401 e verificar cabeçalhos de respostas privadas no smoke.
- [ ] `scripts/check-platform-isolation.mjs`, `tests/platform-isolation.test.mjs`, `package.json`, `.github/workflows/staging-smoke.yml` — adicionar preflight sem dependência de Docker para validar portas/rede do Compose, bind local da web, exclusão de envs do build e política dinâmica/no-store; cobrir configurações válidas e violações e executá-lo em CI antes do smoke.
- [ ] `docs/platform-staging.md` — documentar o checklist de deploy externo: segredos em escopos distintos, webhook HTTPS, banco sem acesso público, rotas sem cache compartilhado e mídia E6 privada; declarar que CI local não comprova esses controles do provedor.

**Acceptance Criteria:**
- Given a configuração local válida, when `npm run check:platform-isolation` executa no ambiente local ou na CI, then confirma que PostgreSQL não publica porta, a web usa apenas loopback, envs não entram no contexto de build e as rotas privadas são dinâmicas e sem cache compartilhado.
- Given que um serviço expõe o banco, a web em interface pública ou uma resposta privada sem `no-store`, when o preflight/smoke executa, then falha com uma indicação acionável sem revelar credenciais.
- Given que nenhum provedor foi aprovado, when a CI local equivalente executa, then não implanta serviços externos e a documentação mantém HTTPS, escopos distintos de segredo, rede privada e mídia E6 como gates verificáveis antes do deploy.

## Implementation Notes

## Plan Change Log

## Review Triage Log

- `medium` / `patch` — `scripts/check-platform-isolation.mjs`: a quoted YAML `ports` key is accepted by Compose but missed by the preflight's literal-key regex, so a published database port can pass unnoticed; support quoted property keys and cover that configuration in the mutation test.

## Design Notes

Os controles se dividem entre o que o repositório consegue provar e o que depende do plano de hospedagem. O preflight valida a réplica local e as rotas; ele não compara valores secretos nem tenta inferir exposição pública de um endpoint gerenciado. O checklist externo evita declarar staging/produção isolados antes de validar a configuração real do provedor. O HTTP do smoke só é permitido em `127.0.0.1`; endpoints publicados exigem HTTPS.

## Verification

**Commands:**
- `npm run check:platform-isolation` — valida invariantes locais sem Docker.
- `npm test` — build e regressões de rotas/cache passam.
- `npm run smoke:local` — smoke sintético confirma autorização, cache, rede local e persistência; exige Docker Compose.
- `git diff --check` — não há erros de whitespace.
