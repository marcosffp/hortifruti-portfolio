# Auditoria do Frontend — Hortifruti SL

| Item | Valor |
| --- | --- |
| Data da auditoria | 2026-10-09 |
| Módulo auditado | `Codigo/Front` (Next.js 16 · React 19.1 · TypeScript 5 · Tailwind 4 · Biome) |
| Commit / branch | `4b9d735d` · `prod` |
| Natureza | Documental. Nenhum arquivo de produção, configuração ou dependência foi alterado. |
| Documento irmão | `Codigo/Back/docs/auditoria-backend.md` (IDs `AUD-xxx`). Aqui os IDs são `FE-xxx`; referências cruzadas indicam onde o problema atravessa as duas pontas. |
| Local | O repositório não tinha `docs/`; foi criado `Codigo/Front/docs/`. |

> **Rótulos.** *Fato* = lido no código (arquivo:linha). *Inferência* = consequência de um fato + comportamento documentado do navegador/Next/React. *Hipótese* = depende de infraestrutura ou dados não verificáveis no repositório. A adaptação do roteiro de auditoria ao frontend foi: "Controllers/Services/Repositories" ⇒ "páginas/hooks/services"; "transações/banco" ⇒ "estado, efeitos e chamadas HTTP".

---

## 1. Resumo executivo

### 1.1 Situação geral

O frontend é uma SPA Next.js (App Router) com ~30,7 mil linhas de TypeScript em 224 arquivos: 36 páginas/rotas (9,2 mil linhas), 106 componentes (14,2 mil), 25 *services* (3,6 mil), 22 *hooks* (2,0 mil), um `AuthContext`, utilitários e tipos. Autenticação por cookie `HttpOnly` via *rewrite* same-origin (`/api/*`), CSP com *nonce* gerado em `proxy.ts`, `check-env.mjs` falhando o build para configuração insegura, TypeScript `strict`, **zero `any`**, **zero `@ts-ignore`**, nenhum `dangerouslySetInnerHTML`.

`tsc --noEmit` passa limpo; `biome check` acusa 1 erro de acessibilidade. **Não existe nenhum teste** (nem unitário nem E2E) e nenhum `error.tsx`/`not-found.tsx`.

O que merece atenção não é estilo, e sim:

1. **Contratos que o frontend não cumpre ou cumpre contra o backend** — o fluxo de troca de senha temporária (`mustChangePassword`) simplesmente não existe na UI; o CSP bloqueia os *tiles* do mapa; chamadas para rota inexistente.
2. **Server Actions públicas** que consomem uma chave paga do Google sem nenhuma autenticação.
3. **Camada de acesso a dados repetitiva e com tratamento de erro heterogêneo** (122 `fetch` em 25 *services*), *hooks* sem memoização compensados por 31 `biome-ignore`, e páginas de 600–980 linhas misturando regra, estado e layout.
4. **Pequenos erros de dados na apresentação** (data deslocada em 1 dia, "Último login" que mostra a hora atual, estatísticas de marketing sem fonte).

### 1.2 Números

| Métrica | Valor |
| --- | --- |
| Arquivos / linhas (`src`) | 224 / 30.688 |
| Componentes `"use client"` | 79 de 129 `.tsx` (a maioria das páginas é cliente) |
| `fetch` | 122 (117 em `services/`, 5 fora: `httpUtils`, `useRealtimeSocket`, `actions/*`) |
| `useEffect` / `useState` | 81 / dezenas por página |
| `console.*` | 156 · `alert()` 3 · `localStorage` 21 usos · `window.open` 6 |
| `biome-ignore` | 31 (8 em `useExhaustiveDependencies`) |
| `any` / `@ts-ignore` | 0 / 0 |
| Testes | **0** |
| Achados | **26** (P0: 0 · P1: 3 · P2: 9 · P3: 14) |

### 1.3 Principais achados

| # | ID | Achado | Sev. |
| --- | --- | --- | --- |
| 1 | FE-001 | Não há tela nem chamada para trocar a senha temporária (`mustChangePassword`); o backend bloqueia todo o resto com 403 para essa conta. | P1 |
| 2 | FE-002 | Server Actions `getPlacesAutocomplete`/`getPlaceDetails` sem autenticação, usando `GOOGLE_MAPS_KEY` paga; `placeId` sem codificação. | P1 |
| 3 | FE-003 | Ausência total de testes e de CI para o frontend. | P1 |
| 4 | FE-004 | CSP `img-src 'self' data: blob:` bloqueia `*.tile.openstreetmap.org`: o mapa do frete fica sem base. | P2 |
| 5 | FE-005 | `new Date("YYYY-MM-DD")` exibe um dia antes em Recomendações (UTC-3). | P2 |
| 6 | FE-006 | Sem *error boundaries* — qualquer exceção de renderização derruba a tela. | P2 |
| 7 | FE-007 | Acoplamento a comportamentos questionáveis do backend (`GET` que emite boleto, texto fixo de sucesso, rota de teste inexistente). | P2 |
| 8 | FE-008 | Camada de *services* duplicada (122 `fetch`), erros tratados de 4 formas diferentes. | P2 |

### 1.4 O que está bem

- `AuthContext`/`authService`: três estados (`authenticated`/`unauthenticated`/`unavailable`), deduplicação de `me()`/`refresh()`, geração de checagem contra respostas obsoletas, *refresh* silencioso — raciocínio de sessão maduro e bem documentado.
- `fetchInterceptor`: 401 ⇒ *refresh* ⇒ repete **uma** vez; **não** reage a 403; só repete GET em falha de rede (não duplica escrita).
- `useRealtimeSocket`: *backoff* exponencial com teto, ticket de uso único, limpeza correta no *unmount*, tolerância a mensagens inválidas.
- `proxy.ts`: CSP com *nonce* + `strict-dynamic`; `style-src` dividido (elemento × atributo); `frame-ancestors 'none'`; `next.config.ts` com HSTS, `nosniff`, `X-Frame-Options`.
- `scripts/check-env.mjs`: o build **falha** se `NEXT_PUBLIC_API_URL` não for relativo ou `BACKEND_URL`/WS não forem `https`/`wss` em produção.
- `validationUtils`: CNPJ alfanumérico (ago/2026) já tratado corretamente; CPF/IE com validação de dígitos.
- Tokens fora de `localStorage` (cookie `HttpOnly`); chave do Google Maps só no servidor.
- Nenhuma dependência circular visível; tipos de domínio centralizados em `types/`.

---

## 2. Escopo e metodologia

**Examinado:** `Codigo/Front` inteiro (`src`, `next.config.ts`, `proxy.ts`, `package.json`, `tsconfig`, `biome.json`, `scripts/`, `.env.example`, README). Leitura integral: infraestrutura (`config/`, `contexts/`, `utils/fetchInterceptor`, `httpUtils`, `sanitizeErrorMessage`, `authService`, `useRealtimeSocket`, `actions/*`, `proxy.ts`, layouts, guardas), amostras representativas de *services*/*hooks*/páginas (`billetService`, `userService`, `userAdminService`, `productService`, `useBillet`, `lancamentos`, `login`, `perfil`, `acesso`, `recomendacoes` por trechos, `Map`, `FavoritesModal`, `landing`). O restante (modais, tabelas, formulários) foi coberto por varreduras automatizadas (métricas, `grep` estruturado, dependências, código sem referência).

**Verificações executadas:** `npx tsc --noEmit --incremental false` (sem erros) e `npx biome check` (1 erro). Não foram executados: `next build`, `npm audit` (requer rede), testes (não existem) nem a aplicação no navegador.

**Limitações:** sem execução no navegador, achados de CSP/datas/efeitos são inferências (a de data foi confirmada com `node` em `America/Sao_Paulo`); nenhuma auditoria de acessibilidade por leitor de tela; contratos com o backend foram conferidos contra o código do backend deste mesmo repositório.

---

## 3. Mapa do frontend

| Camada | Conteúdo | Observação |
| --- | --- | --- |
| `app/` | `(shell)` autenticado: dashboard, lançamentos, comercio/{boletos, clientes, compras, frete, recomendações, capturar-nota, tabela-preço, conversão-caixa, nota-fiscal-xml}, notificações, acesso, backup, admin, perfil; públicas: `/login`, `/landing`, `/acesso-negado`, `/dispositivo/vincular` | Guarda de sessão no layout `(shell)`; guarda de papel por página (`RoleGuard`), exceto `boletos/page.tsx` |
| `components/` | `ui`, `modals` (21), `modules` (cartões, filas, tabelas, mapa, câmera), `forms`, `layout`, `auth`, `landing` | `CombinedScoresCards` (575 l.), `SendGroupingDocumentsModal` (472) |
| `hooks/` | 22 *hooks* de domínio | Funções recriadas a cada render (ver FE-009) |
| `services/` | 25 objetos/classes com `fetch` | 119 verificações `!response.ok` |
| `actions/` | 2 Server Actions (`placesActions`, `routeActions`) | Únicos pontos executados no servidor |
| `contexts/`, `utils/`, `types/`, `config/` | `AuthContext`; interceptor, formatadores, validações; tipos; URLs | — |

Fluxo de dados típico: **página → hook (estado de carregamento/erro) → service (`fetch` com `credentials: "include"`) → `/api/*` (rewrite do Next) → backend**. O WebSocket vai direto ao backend (`NEXT_PUBLIC_WS_URL`), com ticket obtido por `/api/realtime/ws-ticket`.

Maiores arquivos: `lancamentos/page.tsx` 979 · `notificacoes/page.tsx` 864 · `recomendacoes/page.tsx` 776 · `acesso/page.tsx` 745 · `NfSemBoletoTab.tsx` 602 · `CombinedScoresCards.tsx` 575 · `BoletosAbertosTab.tsx` 573.

---

## 4. Fluxos analisados

| Fluxo | Entrada → saída | Observações |
| --- | --- | --- |
| **Login / sessão** | `login/page` → `AuthContext.login` → `POST /auth` → `checkAuth` (`/auth/me`, `/auth/refresh`) | `login` devolve `success: true` mesmo se `checkAuth` terminar em "unavailable" (FE-013); nenhum tratamento de `mustChangePassword` (FE-001) |
| **Guarda de rota** | `(shell)/layout` → `AuthGuard` → `RoleGuard` | Só UX; proteção real é do backend (correto). Rechecagem por navegação sem piscar |
| **Emissão de boleto/NF** | modais/`useBillet`/`useInvoice` → `GET /billet/generate/{id}`; `POST /invoices/issue-with-billet/{id}` | Sem timeout/cancelamento (FE-020); verbo GET acompanha defeito do backend (AUD-016) |
| **Lançamentos/extratos** | `lancamentos/page` → 3 totais em série + lista paginada com *debounce* 300 ms → exportações | `export-complete` envia período; backend ignora na parte bancária (AUD-005) |
| **Captura de nota (celular)** | `/dispositivo/vincular` → pareamento (cookie `device_token`) → upload → WS `captura-atualizada` → `NotasPendentesFila` → revisão → confirmar | Duas telas assinam o mesmo canal WS |
| **Mapa/frete** | `frete/page` → Server Actions (Google Places, OSRM) → `Map` (Leaflet) | CSP bloqueia tiles (FE-004); actions públicas (FE-002) |
| **Usuários** | `acesso/*` → `userAdminService` → `userService` (`/users`) | Lista tudo e filtra no cliente; "cadastrado"/"status" fabricados (FE-016) |

---

## 5. Inventário de achados

| ID | Título | Sev. | Conf. | Grupo |
| --- | --- | --- | --- | --- |
| FE-001 | Fluxo de troca de senha temporária inexistente | P1 | M | Contrato com backend |
| FE-002 | Server Actions públicas com chave paga do Google | P1 | M | Segurança |
| FE-003 | Sem testes nem CI | P1 | A | Qualidade |
| FE-004 | CSP bloqueia tiles do OpenStreetMap | P2 | A | Contrato/infra |
| FE-005 | Datas `YYYY-MM-DD` interpretadas como UTC | P2 | A | Correção |
| FE-006 | Sem *error boundaries* | P2 | A | Resiliência |
| FE-007 | Acoplamento a comportamentos questionáveis do backend | P2 | A | Contrato |
| FE-008 | *Services* duplicados e erros heterogêneos | P2 | A | Estrutura |
| FE-009 | *Hooks* sem memoização e 31 `biome-ignore` | P2 | A | Estrutura/estado |
| FE-010 | Páginas de 600–980 linhas misturando camadas | P2 | A | Coesão |
| FE-011 | Estatísticas e funcionalidades sem fonte na *landing* | P2 | A | Conteúdo |
| FE-012 | Dependências sem uso ou mal classificadas | P2 | A | Dependências |
| FE-013 | `login` sinaliza sucesso sem sessão confirmada | P3 | A | Correção |
| FE-014 | `fetch` global substituído (interceptor) | P3 | A | Arquitetura |
| FE-015 | Documentação obsoleta (README, comentários) | P3 | A | Docs |
| FE-016 | Dados de apresentação fabricados ("Último login", "cadastrado", "status") | P3 | A | Correção |
| FE-017 | `console.*` em produção (156) e `alert()` | P3 | A | Logs/UX |
| FE-018 | `localStorage`/`sessionStorage` sem proteção e *polling* de 500 ms | P3 | A | Estado |
| FE-019 | Duplicações (download de *blob*, formatação, `fetch`) e *leaks* de `ObjectURL` | P3 | A | Duplicação |
| FE-020 | Requisições longas sem tempo-limite/cancelamento; sequenciais desnecessárias | P3 | M | Desempenho |
| FE-021 | Server Actions: retorno inconsistente, `cache()` inútil, OSRM público | P3 | A | Qualidade |
| FE-022 | Parâmetros de URL sem codificação | P3 | A | Robustez |
| FE-023 | Acessibilidade (1 erro Biome, `div onClick`, `key=index`) | P3 | A | A11y |
| FE-024 | Código morto | P3 | A | Limpeza |
| FE-025 | Dados de negócio fixos no código (endereço, planilha) | P3 | A | Configuração |
| FE-026 | WebSocket com *fallback* silencioso para `ws://localhost:8080` | P3 | M | Configuração |

---

## 6–13. Achados detalhados

> Formato resumido por campo (os campos exigidos pelo roteiro estão todos presentes em cada achado).

### FE-001 — Fluxo de troca de senha temporária inexistente (P1, confiança média)

- **Localização:** `services/authService.ts:11-17` (`AuthUser` sem `mustChangePassword`); `services/userService.ts:74-…` (`updateUser` → `PUT /users`, **sem chamadores**); `services/userAdminService.ts:82-120`; `app/(shell)/perfil/page.tsx`; backend `SecurityFilter.java:100-111, 147-153`, `AuthController.java:193-201`.
- **Evidência:** o backend devolve `mustChangePassword` em `/auth` e `/auth/me` e, enquanto for `true`, responde **403** `{"erro":"PASSWORD_CHANGE_REQUIRED"}` a qualquer rota exceto `GET /auth/me` e `PUT /users`. O frontend não declara o campo, não procura `PASSWORD_CHANGE_REQUIRED` (nenhuma ocorrência em `src`) e **nenhum componente** chama `userService.updateUser`. A única alteração de senha na UI é `acesso/editar/[id]` (`PUT /users/{id}`), que o filtro bloqueia para essa conta.
- **Comportamento atual:** o admin criado pelo bootstrap em produção (`UserInitializer`, senha temporária impressa no console — AUD-019) loga, entra no `(shell)` e toda chamada falha com 403/"Erro … 403"; não há caminho na UI para concluir a troca.
- **Problema:** contrato do backend implementado só de um lado.
- **Impacto:** primeiro acesso a um ambiente novo exige chamar a API manualmente; falha silenciosa para o usuário.
- **Causa provável:** a flag foi adicionada ao backend depois (auditoria de segurança) e a UI não foi atualizada.
- **Correção:** incluir `mustChangePassword` em `AuthUser`/`AuthContext`; ao ser `true`, redirecionar para uma tela de troca que chame `PUT /users` (`username` + `password`) e depois recarregue `me`; tratar o corpo `PASSWORD_CHANGE_REQUIRED` no interceptor como fallback.
- **Preservar:** login, cookies, guardas por papel.
- **Testes:** E2E/Playwright com backend em modo bootstrap; teste de unidade do `AuthContext` com `mustChangePassword: true`.
- **Risco:** baixo. **Esforço:** pequeno–médio. **Dependências:** AUD-021 (backend: validar quem pode usar `PUT /users`), Q-F1.
- **Conclusão:** conta com senha temporária consegue trocar a senha e usar o sistema sem chamada manual.

### FE-002 — Server Actions públicas com chave paga do Google (P1, confiança média)

- **Localização:** `actions/placesActions.ts:1-101` (`"use server"`; chave em 22 e 50; `placeId` em 56 sem `encodeURIComponent`); `proxy.ts:44-46` (matcher só exclui `api`/estáticos).
- **Evidência:** Server Actions são *endpoints* POST invocáveis por qualquer cliente que conheça o ID da ação (presente nos *chunks* JS estáticos). A função não verifica sessão. O `proxy.ts` aplica CSP, não autenticação. `getPlaceDetails` interpola `placeId` cru: `...place_id=${placeId}&fields=...&key=...`.
- **Comportamento atual:** qualquer visitante pode disparar autocomplete/detalhes e consumir cota/crédito da chave `GOOGLE_MAPS_KEY`; um `placeId` com `&fields=…` altera os campos cobrados.
- **Problema:** ação de servidor sem autorização; entrada não codificada.
- **Impacto:** custo/negação por esgotamento de cota (Places é faturado por requisição).
- **Causa provável:** a proteção foi pensada só na UI (`AuthGuard`), que não protege o endpoint.
- **Correção:** validar a sessão dentro da ação (ler o cookie `auth_token` e consultar o backend, ou encaminhar via backend); `encodeURIComponent(placeId)`; limitar o tamanho de `input`; considerar *rate limit*.
- **Preservar:** formato de retorno consumido por `AddressAutocomplete`.
- **Testes:** chamada da ação sem cookie ⇒ erro; com `placeId` malicioso ⇒ URL codificada.
- **Risco:** baixo. **Esforço:** pequeno. **Dependências:** nenhuma.
- **Conclusão:** ação sem sessão válida não chega ao Google.

### FE-003 — Sem testes nem CI (P1, confiança alta)

- **Evidência:** nenhum `*.test.*`/`*.spec.*`; `package.json` sem *runner*; o único *gate* é Husky + `biome check` em *pre-commit*; o repositório só tem o workflow `sync-to-public.yml`.
- **Impacto:** a lógica crítica de cliente (sessão, interceptor, validação CPF/CNPJ/IE, cálculo de períodos, `sanitizeErrorMessage`) não tem rede de segurança; FE-001/FE-005 passaram despercebidos.
- **Correção:** Vitest + Testing Library para `authService`, `fetchInterceptor`, `validationUtils`, `dateUtils`, `AuthContext`; Playwright para login, emissão e captura; *job* de CI com `check-types`, `lint`, testes.
- **Preservar:** comportamento atual (testes de caracterização).
- **Risco:** baixo. **Esforço:** médio–grande. **Conclusão:** CI verde com a suíte mínima acima.
- *(Demais campos: localização = repositório; causa = projeto acadêmico em ritmo de entrega; dependências = nenhuma.)*

### FE-004 — CSP bloqueia os *tiles* do OpenStreetMap (P2, confiança alta)

- **Localização:** `proxy.ts:30` (`img-src 'self' data: blob:`); `components/modules/Map.tsx:73-76` (`https://{s}.tile.openstreetmap.org/...`).
- **Evidência:** a CSP é aplicada a todas as rotas (matcher em `proxy.ts:48-50`); `img-src` não lista o domínio dos *tiles*. O próprio comentário do arquivo cita o Leaflet só para `style-src-attr`.
- **Comportamento atual:** o `TileLayer` falha com violação de CSP; marcadores e rota aparecem sobre fundo vazio.
- **Impacto:** mapa do cálculo de frete degradado em produção/dev.
- **Correção:** adicionar `https://*.tile.openstreetmap.org` a `img-src` (ou servir *tiles* próprios). Verificar também `public/leaflet` (ícones) já cobertos por `'self'`.
- **Testes:** abrir `/comercio/frete` com DevTools e conferir ausência de `Refused to load the image`.
- **Risco:** baixo. **Esforço:** pequeno.

### FE-005 — Datas `YYYY-MM-DD` interpretadas como UTC (P2, confiança alta)

- **Localização:** `app/(shell)/comercio/recomendacoes/page.tsx:94, 296-298, 370, 382`; relacionados `components/modals/CriarAgrupamentoModal.tsx:59`.
- **Evidência:** `new Date("2026-10-09").toLocaleDateString("pt-BR")` em `America/Sao_Paulo` ⇒ `08/10/2026` (verificado com `node`). Linha 94 usa `new Date().toISOString().slice(0,10)` (data **UTC**: depois das 21h BRT já é "amanhã").
- **Comportamento atual:** o rótulo da data selecionada e os dias da previsão aparecem um dia antes; a data padrão passa para o dia seguinte à noite.
- **Impacto:** o gestor lê a previsão/recomendação do dia errado.
- **Causa provável:** `Date` com string ISO de data pura; o backend e `CriarAgrupamentoModal` já usam `split("-")`/`T00:00:00`.
- **Correção:** utilitário único `parseLocalDate("YYYY-MM-DD")` (`new Date(y, m-1, d)`) em `dateUtils`, e `formatLocalISODate(new Date())`.
- **Preservar:** formato de exibição `pt-BR`.
- **Testes:** unitários com `TZ=America/Sao_Paulo` e instante 23:30.
- **Risco:** baixo. **Esforço:** pequeno. **Dependências:** AUD-042 (backend, mesma classe de erro).

### FE-006 — Sem *error boundaries* (P2, confiança alta)

- **Evidência:** nenhum `error.tsx`, `global-error.tsx`, `not-found.tsx` ou `loading.tsx` em `src/app`.
- **Impacto:** exceção em renderização (ex.: `JSON.parse` de `localStorage` corrompido em `FavoritesModal:24-42`) deixa a página inteira sem UI recuperável.
- **Correção:** `app/error.tsx`, `app/(shell)/error.tsx` (com *reset*) e `not-found.tsx`; capturar erro com `toast` + reportar.
- **Testes:** componente que lança em teste de renderização.
- **Risco/Esforço:** baixo / pequeno.

### FE-007 — Acoplamento a comportamentos questionáveis do backend (P2, confiança alta)

- **Localização/evidência:** (a) `billetService.ts:17-27` — `GET /billet/generate/...` que **emite** boleto (AUD-016); (b) `lancamentos/page.tsx` envia `startDate/endDate` a `export-complete` (AUD-005: parte bancária ignora); (c) `bulkNotificationService.ts:230-247` — `testService()` chama `GET /api/notifications/test`, que **não existe** no backend (sem chamadores); (d) `userAdminService.ts:154-190` — `performBackup` (`POST /acesso`) e `restoreBackup` (`POST /acesso/restore`) apontam para rotas inexistentes e não têm chamadores; (e) `productService.ts` envia `date` sem codificação (FE-022).
- **Impacto:** quando o backend corrigir (POST no `generate`, 502 etc.), a UI quebra sem aviso; código morto parece funcionalidade.
- **Correção:** mover a chamada de `generate` para `POST` junto com AUD-016 (mudança coordenada); remover (c) e (d).
- **Testes:** testes de contrato de *service* com `msw`.
- **Risco:** médio (coordenar com backend). **Esforço:** pequeno–médio. **Dependências:** AUD-016, AUD-005.

### FE-008 — *Services* duplicados e erros heterogêneos (P2, confiança alta)

- **Evidência:** 117 `fetch` em 25 *services*, cada método repete `try/fetch/!ok/throw/console.error` (≈ 15 linhas). Das 119 verificações `!response.ok`, 30 não leem o corpo (mensagem do backend perdida: "Erro ao …: 400"); `sanitizeErrorMessage` é usado em **2** arquivos (4 usos), enquanto os demais exibem `errorData.message` cru (81 leituras) — chaves lidas: `message` (81), `error` (12), `erro` (2), com `retryAfter` só no login. `getAuthHeaders()` (`httpUtils.ts:1-5`) não tem nada de *auth* (só `Content-Type`), `fetchWithAuth` só adiciona `credentials`.
- **Comportamento atual:** o usuário vê, conforme a tela, mensagem do backend, texto com status HTTP ou texto genérico; mensagens críticas do backend ("NÃO gere outro boleto", AUD-002/003) podem não chegar.
- **Problema:** ausência de cliente HTTP único.
- **Impacto:** custo de manutenção alto; UX inconsistente; possibilidade de exibir texto interno.
- **Correção:** `apiClient.request<T>()` único (base URL, `credentials`, JSON/Blob, extração de erro com o contrato `{error,message}`/`{erro,mensagem}` + `sanitizeErrorMessage`, `AbortSignal`), migrando um *service* por vez.
- **Preservar:** URLs, métodos, formatos, mensagens atuais quando já corretas.
- **Testes:** testes do cliente (200/4xx/5xx/rede/Blob) + um teste por *service* migrado.
- **Risco:** baixo (migração incremental). **Esforço:** médio.

### FE-009 — *Hooks* sem memoização e 31 `biome-ignore` (P2, confiança alta)

- **Evidência:** `useBillet.ts`, `useTransaction.ts` etc. recriam todas as funções a cada render e compartilham um único `isLoading`/`error` por *hook* (chamadas concorrentes se sobrescrevem). As páginas compensam com `// biome-ignore lint/correctness/useExhaustiveDependencies` (`lancamentos/page.tsx:100,116`; `BoletosAbertosTab.tsx:50`; `NfSemBoletoTab.tsx:56`). `useRealtimeSocket.ts:43` atribui `onEventRef.current` durante o render.
- **Impacto:** risco de *stale closure* e de efeitos que não reagem a mudanças reais; supressões escondem erros futuros.
- **Correção:** `useCallback` nos métodos expostos (ou migrar para um *data hook* com `useQuery`/SWR), estados de carregamento por operação.
- **Testes:** `renderHook` verificando estabilidade de referência.
- **Risco:** baixo–médio. **Esforço:** médio.

### FE-010 — Páginas de 600–980 linhas misturando camadas (P2, confiança alta)

- **Evidência:** `lancamentos/page.tsx` (979 l., 11 `useState`, 2 `useEffect`, 3 chamadas de totais em série, filtros, exportações, extratos, `alert()` nos handlers), `notificacoes/page.tsx` (864 l., 10 estados, 8 efeitos), `recomendacoes/page.tsx` (776), `acesso/page.tsx` (745). Regra (clamp de período, composição de nomes, validações), estado e JSX estão no mesmo componente.
- **Impacto:** difícil testar e revisar; alterações pequenas tocam arquivos enormes.
- **Correção:** extrair por responsabilidade (cartões de resumo, filtros, tabela, modais) e mover regra para funções puras/hooks; **não** dividir por tamanho.
- **Preservar:** UI e rotas. **Testes:** funções puras extraídas (período, formatação). **Risco:** baixo. **Esforço:** médio por página.

### FE-011 — Estatísticas e funcionalidades sem fonte na *landing* (P2, confiança alta)

- **Evidência:** `components/landing/StatsSection.tsx:9-30` — "50+ Clientes Ativos", "40% Redução de Perdas", "60% Economia de Tempo", "24/7 Suporte"; `app/landing/page.tsx:26-80` — "Gestão de Estoque Inteligente: alertas de produtos em falta, controle de validade", "Rastreamento em tempo real": o backend não tem módulo de estoque nem rastreamento.
- **Impacto:** afirmações comerciais/numéricas não verificáveis numa página pública (risco reputacional/legal).
- **Correção:** substituir por dados reais/fontes ou remover; alinhar a lista de funcionalidades ao que existe.
- **Risco:** nenhum técnico; decisão de conteúdo (Q-F2). **Esforço:** pequeno.

### FE-012 — Dependências sem uso ou mal classificadas (P2, confiança alta)

- **Evidência:** `@mui/material`, `@emotion/react`, `@emotion/styled` — **0 imports** em `src` (README ainda anuncia MUI); `leaflet`/`react-leaflet`/`@types/leaflet` estão em `devDependencies` mas são importados em tempo de execução (`Map.tsx`); `@types/qrcode` em `dependencies`; `layout.tsx:35-41` carrega `bootstrap-icons` por CDN e **nenhuma** classe `bi bi-` é usada (também alarga a CSP: `style-src-elem`/`font-src` para `cdn.jsdelivr.net`).
- **Impacto:** *bundle*/instalação maiores, superfície de supply-chain e CSP mais larga sem benefício; um `npm ci --omit=dev` quebraria o mapa.
- **Correção:** remover MUI/Emotion e `bootstrap-icons`; mover `leaflet`/`react-leaflet` para `dependencies` e `@types/*` para `devDependencies`; atualizar CSP.
- **Testes:** `next build` + varredura de imports. **Risco:** baixo. **Esforço:** pequeno. *(Não foi executado `npm audit`.)*

### FE-013 — `login` sinaliza sucesso sem sessão confirmada (P3)

- **Localização:** `contexts/AuthContext.tsx:161-183` (`await checkAuth(); return { success: true }`); `app/login/page.tsx:34-46`.
- **Evidência:** `checkAuth` pode terminar em "unavailable" (retorna sem alterar estado) e `login` ainda devolve `success: true` ⇒ toast "Login realizado" + `router.push("/")` com `isAuthenticated=false`.
- **Impacto:** falso positivo de login durante instabilidade do backend; retorno ao `/login` em laço curto.
- **Correção:** `checkAuth` devolver o estado final; `login` usar `isAuthenticated` resultante. **Risco/Esforço:** baixo / pequeno.

### FE-014 — `fetch` global substituído (P3)

- **Localização:** `utils/fetchInterceptor.ts:86-114`.
- **Evidência:** `window.fetch` é sobrescrito; o *retry* de rede aplica-se a **todo** GET (inclui `viacep.com.br`), não só à API; qualquer biblioteca que dependa de `fetch` herda o comportamento; `isApiRequest` usa `startsWith(API_BASE_URL)` (com `"/api"` casa também `/apixyz`).
- **Correção:** encapsular no cliente HTTP único (FE-008) em vez de *monkey-patch*; restringir o *retry* à API. **Preservar:** semântica 401/refresh/GET. **Testes:** unitários do interceptor. **Risco:** médio. **Esforço:** pequeno–médio.

### FE-015 — Documentação obsoleta (P3)

- **Evidência:** `README.md:15, 333` (MUI 7.3 + Emotion — não usados); `README.md:41, 81, 141` (papel **ACCOUNTANT/Contador** — o backend só tem `MANAGER`/`EMPLOYEE`; `globals.css:41,124,134` mantém tokens `contador`); `README.md:296-305` (deploy na Vercel; o backend é Railway e os comentários citam Railway); `next.config.ts:9-15` (comentário sobre SSE de `/api/compras/notas/stream` — substituído por WebSocket).
- **Correção:** atualizar README/comentários; remover tokens CSS não usados. **Risco/Esforço:** nenhum / pequeno.

### FE-016 — Dados de apresentação fabricados (P3)

- **Evidência:** `perfil/page.tsx:8-14, 56` — "Último login" = `new Date()` no *mount* (hora atual, não o último login); `userAdminService.ts:52-53, 73` — `cadastrado: new Date().toLocaleDateString(...)`, `status: "ativo"` fixos ("Data atual como fallback") para todo usuário; `getUserById` carrega todos e filtra (comentário "Simulado").
- **Impacto:** informação falsa na UI de administração.
- **Correção:** ocultar os campos ou obtê-los do backend (`createdAt`; último login em `login_audit_log`). **Risco/Esforço:** baixo / pequeno. **Dependências:** campo novo no backend.

### FE-017 — `console.*` em produção e `alert()` (P3)

- **Evidência:** 156 `console.*` (todo método de *service* faz `console.error` e relança — o erro é registrado N vezes por camada); `alert()` em `lancamentos/page.tsx:185,190` e `frete/page.tsx:31` (há `toastUtils`); dados de erro do backend vão ao console do navegador.
- **Correção:** logger central (desligado em produção ou enviado a um coletor), *toast* no lugar de `alert`. **Risco/Esforço:** baixo / pequeno.

### FE-018 — `localStorage`/`sessionStorage` e *polling* (P3)

- **Evidência:** `FavoritesModal.tsx:24-42` — `JSON.parse(localStorage.getItem(...))` em inicializador de `useState` (sem `try/catch`, executado mesmo com o modal fechado, quebra em SSR se a árvore for renderizada no servidor); dados compartilhados por navegador, não por usuário; `acesso/page.tsx:63-90` — `setInterval(checkReloadFlag, 500)` em `localStorage` **e** `focus` + `visibilitychange` (duas buscas completas de usuários ao voltar à aba); `clientes/page.tsx:51,177,189` preferência de visualização.
- **Correção:** `try/catch` + leitura em `useEffect`; trocar o *polling* por evento `storage`/`BroadcastChannel` ou por *refetch* ao voltar; escopo por usuário. **Risco/Esforço:** baixo / pequeno.

### FE-019 — Duplicações e *leaks* de `ObjectURL` (P3)

- **Evidência:** download de *blob* via `<a download>` reimplementado em ≥ 8 pontos (`useBillet.downloadBillet`, `boletos/shared.tsx:29-51`, `ShowBilletDataModal.tsx:49-77`, `ShowInvoiceDataModal.tsx:33-62`, `ShowInvoiceModal`, `ShowBilletModal`, `ShowInvoiceAndBilletModal`, `CombinedScoreImagesModal`); impressão por `window.open(blobUrl)` + `onload` (3 modais) com revogação antes de a janela carregar; `NotasPendentesFila.tsx:76` cria `ObjectURL` sem revogar; `usuarioAutenticado`-like helpers repetidos.
- **Correção:** `downloadBlob(blob, name)` e `openBlobForPrint(blob)` em `utils`, com revogação adiada. **Risco/Esforço:** baixo / pequeno.

### FE-020 — Requisições longas e sequenciais (P3, confiança média)

- **Evidência:** nenhum `AbortController` nos *services*; `issue-with-billet` pode levar > 2 min (backend `spring.mvc.async.request-timeout=180000`, `proxyTimeout` do Next 300 s) sem indicação de progresso além do overlay; `lancamentos/page.tsx:100-114` faz 3 chamadas **em série** (receita, despesa, saldo — este é derivado dos outros) e `getAllCategories()` **a cada** mudança de filtro/página (122-125); respostas fora de ordem não são descartadas (sem `AbortController`/sequência).
- **Correção:** `Promise.all`, calcular saldo no cliente ou usar um endpoint único, carregar categorias uma vez, `AbortController` por requisição. **Risco/Esforço:** baixo / pequeno.

### FE-021 — Server Actions: retorno inconsistente e serviço público (P3)

- **Evidência:** `placesActions.ts:18-19` devolve `{ predictions: [] }` (objeto) em entrada curta/erro, mas um **array** em sucesso (38); `cache()` do React (16, 48) só memoiza por requisição — sem efeito em ação; `routeActions.ts:10` usa o servidor demo público do OSRM (sem SLA, uso limitado pelos termos).
- **Correção:** retorno único (`Prediction[]`), remover `cache()`, configurar instância OSRM própria/provedor pago. **Risco/Esforço:** baixo / pequeno.

### FE-022 — Parâmetros sem codificação (P3)

- **Evidência:** `productService.ts` — `?date=${date}`; `placesActions.ts:56` (`placeId`); `purchaseService.ts:64` monta `${startDate}T00:00:00` sem validar; `combinedScoreService.ts:46`.
- **Correção:** `URLSearchParams`/`encodeURIComponent` em todos os pontos. **Risco/Esforço:** baixo / pequeno.

### FE-023 — Acessibilidade (P3)

- **Evidência:** `biome check`: `lint/a11y/useSemanticElements` em `CombinedScoreImagesModal.tsx:171` (`role="button"` em elemento não semântico); 5 `div/span` com `onClick`; 10 `key={index|i}` (5 em modais com listas dinâmicas: `GroupedProductsModal:64`, `InvoiceProductsModal:278`, `CreateManualPurchaseModal:201`, `CombinedScoreImagesModal:125`); modais próprios (`fixed inset-0`) sem *focus trap*/`role="dialog"` (ex.: `ShowBilletModal`).
- **Correção:** `<button>`/`<dialog>`, chaves estáveis (id). **Risco/Esforço:** baixo / pequeno.

### FE-024 — Código morto (P3)

| Elemento | Local | Classificação |
| --- | --- | --- |
| `ClientProductsTable` | `components/modules/tables/ClientProductsTable.tsx` | Confirmadamente não utilizado (0 importações) |
| `userAdminService.performBackup/restoreBackup/getStats` | `services/userAdminService.ts` | Confirmado (0 chamadores; rotas inexistentes no backend) |
| `bulkNotificationService.testService` | `services/bulkNotificationService.ts:230` | Confirmado (0 chamadores; rota inexistente) |
| `clientService.getClientByName`, `productService.getAllProducts/getRecommendationsByTemperature`, `userService.getUserByUsername` | `services/*` | Confirmado (0 chamadores) |
| `validarIEMinasGerais`, tipos `FreightRequest`, `ClientWithLastPurchaseResponse` | `utils`, `types` | Confirmado (0 usos) |
| `getAuthHeadersForFormData` | `utils/httpUtils.ts:14-16` | Provável (conferir importações) |
| `public/image.png` e `tela-*.jpg` | `public/` | **Necessários** (usados pela *landing*) |

- **Correção:** remover em PR separado. **Risco/Esforço:** baixo / pequeno.

### FE-025 — Dados de negócio fixos no código (P3)

- **Evidência:** `compras/page.tsx:74-77` — URL de planilha do Google (ID incluso) como *fallback* da variável de ambiente; `FavoritesModal.tsx:28-39` — endereço e coordenadas da loja; `landing/page.tsx:108,116` — telefone.
- **Correção:** mover para configuração/servidor; falhar visivelmente se a variável faltar. **Risco/Esforço:** baixo / pequeno.

### FE-026 — WebSocket com *fallback* silencioso (P3, confiança média)

- **Evidência:** `useRealtimeSocket.ts:6` (`|| "ws://localhost:8080"`); `check-env.mjs` trata `NEXT_PUBLIC_WS_URL` como opcional em produção; o comentário do hook afirma que a tela "continua funcionando" sem o socket, mas o hook tenta reconectar para sempre (a cada ≤ 30 s, cada tentativa também pede um ticket ao backend).
- **Correção:** sem URL ⇒ não conectar e registrar uma vez; *build* exigir `wss://` quando o recurso de captura está habilitado. **Risco/Esforço:** baixo / pequeno.

---

## 14. Matriz de prioridade

| ID | Sev. | Impacto | Esforço | Fase |
| --- | --- | --- | --- | --- |
| FE-003 | P1 | Habilita todas as correções | M–G | 0 |
| FE-001 | P1 | Primeiro acesso bloqueado | P–M | 1 |
| FE-002 | P1 | Custo/abuso de chave paga | P | 1 |
| FE-004 | P2 | Mapa sem base | P | 1 |
| FE-005 | P2 | Data errada | P | 1 |
| FE-006 | P2 | Tela quebrada sem recuperação | P | 1 |
| FE-007 | P2 | Quebra futura com backend | P–M | 2 (com AUD-016) |
| FE-008 | P2 | Erros inconsistentes | M | 2 |
| FE-009 | P2 | *Stale closures* | M | 2 |
| FE-010 | P2 | Manutenção | M/pág. | 3 |
| FE-011 | P2 | Risco reputacional | P | 1 |
| FE-012 | P2 | *Bundle*/supply-chain | P | 1 |
| FE-013…FE-026 | P3 | Limpeza/robustez | P | 3–4 |

## 15. Plano de correção incremental

| Fase | Itens | Objetivo | Idêntico | Testes antes → depois | Riscos | Conclusão | Interromper se |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **0 — Rede de segurança** | FE-003 | Vitest + RTL + Playwright básico + CI | Todo o comportamento | n/a → suíte do `AuthContext`/interceptor/validações/datas | Testes que fixam defeitos (marcar como `todo`) | CI verde | Build não roda no CI |
| **1 — Correções pequenas e isoladas** | FE-001, 002, 004, 005, 006, 011, 012 | Contratos e segurança evidentes | Telas e rotas atuais | Caracterização → testes novos por item | FE-001 depende do backend (AUD-021) | Fluxo de troca de senha; mapa com tiles; datas corretas | Falha de login após FE-001 |
| **2 — Camada de dados** | FE-007, 008, 009, 013, 014, 017, 022 | Cliente HTTP único, erros padronizados, *hooks* estáveis | URLs, métodos, formatos | Testes do cliente + um por *service* migrado | Mudanças de mensagem exibida | Nenhum `fetch` fora do cliente | Divergência em download/upload de arquivos |
| **3 — Estrutura das páginas** | FE-010, 018, 019, 020, 023 | Extrair regra/estado/UI | UI idêntica | Testes de funções puras extraídas | Regressão visual | Páginas < 400 linhas | Diferença visual em revisão |
| **4 — Limpeza** | FE-015, 016, 021, 024, 025, 026 | Remover o que não é usado | — | Build + `tsc` + `biome` | Remover algo usado por rota dinâmica | `grep` vazio | Referência dinâmica encontrada |

Mudanças que dependem do backend (`generate` por POST, `mustChangePassword`, `createdAt` de usuário) devem ser entregues **em conjunto** com os achados `AUD-016`, `AUD-021` e novo campo de usuário.

## 16. Riscos de regressão

| Área | O que preservar |
| --- | --- |
| Sessão | Semântica de três estados; 401 ⇒ refresh ⇒ **uma** repetição; 403 não dispara refresh; GET repetido em falha de rede, escrita nunca |
| URLs | Prefixo `/api` duplicado para controllers que já têm `/api` (`config/api.ts:4-13`); `NEXT_PUBLIC_API_URL=/api` e rewrite |
| Realtime | Ticket por `/realtime/ws-ticket`; mensagens `dispositivo-pareado`, `captura-atualizada` |
| CSP | `nonce`, `strict-dynamic`, `frame-src blob:` (PDF em *iframe*), `connect-src` com viacep, API e WS |
| Datas e moeda | Formatos `pt-BR`; `T00:00:00` enviado ao backend; `formatCurrency` |
| Downloads | Nome de arquivo e `Content-Disposition` consumidos como `Blob` |
| Papéis | Menu por papel (`Sidebar`) e `RoleGuard` por página como UX; autorização real no backend |

## 17. Pontos que precisam de confirmação

| ID | Dúvida | Como investigar |
| --- | --- | --- |
| Q-F1 | O admin bootstrap já conseguiu trocar a senha em produção por algum caminho não visível (script/Postman)? | Perguntar ao autor; verificar `users.must_change_password` |
| Q-F2 | As estatísticas da *landing* têm fonte (clientes reais, medições)? | Decisão do negócio |
| Q-F3 | Os *tiles* do mapa aparecem em produção? (talvez outra camada de CSP/CDN) | Abrir `/comercio/frete` e olhar o console |
| Q-F4 | O deploy do frontend é Vercel (README) ou Railway (comentários)? Define o IP visto pelo backend (Q-01 do backend) | Painel de hospedagem |
| Q-F5 | As Server Actions já foram chamadas fora da UI (logs de cota do Google)? | Console do Google Cloud |

## 18. Registro de execução

| Comando | Resultado |
| --- | --- |
| `npx tsc --noEmit --incremental false` | Sem erros (≈ 4 s) |
| `npx biome check` | 228 arquivos; **1 erro** (`a11y/useSemanticElements`, `CombinedScoreImagesModal.tsx:171`) |
| Scripts Python de leitura (métricas, dependências, código sem referência, uso de endpoints) | Executados fora do repositório |
| `node -e` com `TZ=America/Sao_Paulo` | Confirmou `new Date("2026-10-09").toLocaleDateString("pt-BR") === "08/10/2026"` |
| `git status` | Apenas `Codigo/Front/docs/` novo; `tsconfig.tsbuildinfo` e `.next` ignorados |

**Não executado:** `next build`, `npm audit`, testes (inexistentes), navegação manual.

## 19. Conclusão

**Corrigir primeiro:** (1) FE-001 e FE-002 — um impede o primeiro acesso a um ambiente novo, o outro expõe uma chave paga; ambos pequenos. (2) FE-003 — sem testes, a Fase 2 (cliente HTTP único) é arriscada. (3) FE-004/FE-005/FE-006 — correções de uma linha a poucas linhas com efeito visível.

**Não fazer:** reescrever em outra biblioteca de estado, dividir páginas só por tamanho, ou remover os comentários de decisão de `AuthContext`, `fetchInterceptor`, `proxy.ts` e `useRealtimeSocket` (registram incidentes reais de sessão/CSP/WS).

**Estado geral:** a base é sólida (tipagem estrita, sessão bem pensada, CSP presente, build fail-fast). O risco está na borda com o backend, na falta de testes e na repetição da camada de acesso a dados.
