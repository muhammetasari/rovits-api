# Rovits API

Kurumsal düzeyde yapılandırılmış **NestJS tabanlı servis API’si**.  
Proje, OpenAPI 3.1, CI/CD entegrasyonu, güvenlik, gözlemlenebilirlik ve K8s uyumluluğu gözetilerek hazırlanmıştır.

---

## 🚀 Özellikler

| Alan | Durum | Açıklama |
|------|--------|-----------|
| **Dil / Framework** | ✅ TypeScript / NestJS | Modüler yapı, AOT build destekli |
| **API Şeması** | ⏳ OpenAPI 3.1 (PR-004 sonrası) | Swagger UI planlandı |
| **Versiyonlama** | ✅ URI tabanlı (`/api/v1/...`) | Global prefix `api` |
| **Validasyon** | ✅ `class-validator`, `class-transformer` | Global ValidationPipe |
| **Hata Modeli** | ✅ RFC7807 (Problem+JSON) | Tutarlı hata yanıtları |
| **Güvenlik** | ✅ Helmet, CORS, Rate-limit (yakında) | OWASP API Top 10’a uyumlu |
| **Observability** | ✅ `/metrics`, `/live`, `/ready` | Prometheus, K8s prob uyumlu |
| **CI/CD** | ✅ GitHub Actions | Build, test, lint, Trivy, SBOM |
| **Kapsayıcılar** | ✅ Dockerfile.api, Dockerfile.worker | Multi-stage build |
| **Testler** | ✅ Jest + Unit | Prometheus unit test örneği |
| **K8s Hazırlığı** | ✅ Liveness/Readiness | Helm chart planlı |

---

## 🧩 Proje Yapısı

```
src/
├── app.module.ts
├── main.ts
├── common/
│   └── filters/
│       └── rfc7807.filter.ts
├── health/
│   ├── health.controller.ts
│   └── health.module.ts
├── metrics/
│   ├── metrics.controller.ts
│   ├── metrics.module.ts
│   └── metrics.service.ts
└── job-processor/
    └── sync.processor.ts
```

---

## ⚙️ Kurulum

### 1. Gereksinimler
- Node.js ≥ 20
- npm ≥ 10
- Docker ≥ 25 *(opsiyonel)*
- Prometheus *(opsiyonel)*

### 2. Kurulum Adımları
```bash
git clone https://github.com/muhammetasari/rovits-api.git
cd rovits-api
npm ci
```

### 3. Çalıştırma
```bash
npm run start
```

Uygulama varsayılan olarak `http://localhost:3000` adresinde çalışır.

---

## 🧠 Kullanım

### Sağlık ve İzleme Uçları
| Endpoint | Açıklama | Prefix / Versiyon | Yanıt |
|-----------|-----------|------------------|--------|
| `GET /live` | Liveness probe | version neutral | `{ "status": "ok" }` |
| `GET /ready` | Readiness probe | version neutral | Disk ve bellek kontrolü |
| `GET /metrics` | Prometheus metrikleri | version neutral | `# HELP ...` formatında metrikler |
| `GET /api/v1/...` | Uygulama API uçları | versioned | (işlevsel endpoint’ler) |

> ⚠️ `live`, `ready`, `metrics` uçları global prefix (`api`) ve versiyon dışında tutulur.

---

## 🧪 Test

```bash
npm test
# veya sadece metrik testi
npm test -- metrics.service.spec.ts
```

**Başarılı sonuç:**
```
PASS src/metrics/metrics.service.spec.ts
✓ should expose default metrics
```

---

## 🧱 CI/CD Pipeline

GitHub Actions yapılandırması `.github/workflows/ci.yml`

Aşamalar:
1. **Lint & Test:** `npm ci`, `npm run lint`, `npm test`
2. **Build:** `npm run build`
3. **Security:** Trivy FS scan + SBOM (SPDX)
4. **Artifacts:** SARIF + SBOM upload

> Workflow yeşillenmeden `master`’a merge edilmemelidir.

---

## 🧰 Ortam Değişkenleri

| Değişken | Varsayılan | Açıklama |
|-----------|-------------|----------|
| `PORT` | 3000 | API portu |
| `CORS_ORIGINS` | `*` | CORS izin listesi (virgülle ayrılmış) |

`.env.example` dosyası PR-005 ile eklenecektir.

---

## 🛡️ Güvenlik Notları

- Tüm HTTP uçları `helmet` ile korunur.
- JSON parse limit ve request throttling eklenecektir.
- Kimlik doğrulama (OAuth 2.1 + JWT) PR-006 ile entegre edilecektir.
- Secrets yönetimi K8s Secrets veya Vault üzerinden sağlanacaktır.

---

## 📈 Observability Entegrasyonu

### Prometheus
```yaml
scrape_configs:
  - job_name: 'rovits-api'
    static_configs:
      - targets: ['localhost:3000']
```

### Kubernetes Probes
```yaml
livenessProbe:
  httpGet:
    path: /live
    port: 3000
readinessProbe:
  httpGet:
    path: /ready
    port: 3000
```

---

# Rovits API Roadmap

Güncel geliştirme planı — PR-004 sonrasından Production olgunluğuna kadar olan tüm adımlar.  
Her adım bir GitHub Pull Request (PR) olarak tasarlanmıştır.

---

## 🔹 PR-004 — OpenAPI 3.1 + Swagger UI
**Amaç:** API sözleşmesini ve dokümantasyonu görünür hale getirmek.  
**Kapsam:**
- `@nestjs/swagger` entegrasyonu
- Swagger UI (`/docs`) ve OpenAPI JSON (`/api/v1/openapi.json`)
- API tag’leri, açıklamalar, örnek modeller
- CI aşamasında OpenAPI JSON validasyonu (`speccy` veya `openapi-lint`)

---

## 🔹 PR-005 — ConfigModule + .env.example + Logger standardı
**Amaç:** yapılandırma güvenliği, log standardizasyonu.  
**Kapsam:**
- `@nestjs/config` + Joi tabanlı env doğrulama
- `.env.example` eklenmesi
- `nestjs-pino` ile JSON structured logging
- Correlation-ID middleware
- Log seviye yönetimi (`info`, `warn`, `error`, `debug`)

---

## 🔹 PR-006 — Authentication & Authorization (OAuth 2.1 + JWT + RBAC)
**Amaç:** erişim güvenliği ve çok tenant uyumluluk.  
**Kapsam:**
- OAuth 2.1 Resource Server akışı
- JWT doğrulama (`access_token` / `refresh_token`)
- Role & Scope bazlı guard’lar
- Token introspection endpoint’i
- Test token üretim script’i
- Auth integration test’leri

---

## 🔹 PR-007 — Rate Limiting + Request Size + Idempotency
**Amaç:** istek kontrolü, tekrarlanabilirlik ve yük yönetimi.  
**Kapsam:**
- `@nestjs/throttler` global rate limit
- Request size limiti (`body-parser`)
- `Idempotency-Key` middleware (Redis tabanlı)
- 429 `Retry-After` başlık desteği

---

## 🔹 PR-008 — Performance Caching Layer (Redis)
**Amaç:** yüksek trafik altındaki sorgu yükünü azaltmak.  
**Kapsam:**
- `cache-manager-redis-yet` entegrasyonu
- Cache interceptor (`Cache-Control`, `ETag`)
- TTL yönetimi ve route bazlı cache policy
- Manuel invalidation mekanizması

---

## 🔹 PR-009 — Database & Migrations
**Amaç:** veri kalıcılığı ve schema kontrolü.  
**Kapsam:**
- ORM (Prisma veya TypeORM)
- Migration komutları (`migrate:dev`, `migrate:deploy`)
- Health check’e DB ping entegrasyonu
- Connection pool, timeout ve index yönetimi

---

## 🔹 PR-010 — Test Otomasyonu + Coverage
**Amaç:** kalite güvence ve regresyon önleme.  
**Kapsam:**
- Jest coverage ≥ %80
- Integration test (Testcontainers)
- e2e test (Supertest)
- Pact contract test (consumer-driven)
- CI coverage raporu

---

## 🔹 PR-011 — CI/CD Güvenlik Geliştirmeleri
**Amaç:** tedarik zinciri güvenliği ve imzalı build süreci.  
**Kapsam:**
- Trivy + Syft SBOM birleşimi
- Cosign image imzalama
- Dependabot / npm audit workflow
- CODEOWNERS + branch protection
- Artifact retention policy

---

## 🔹 PR-012 — Kubernetes Dağıtım Katmanı
**Amaç:** production cluster’da otomatik dağıtım.  
**Kapsam:**
- Helm chart (`charts/rovits-api/`)
- Deployment, Service, Ingress, HPA
- Resource limits / requests
- NetworkPolicy ve PDB
- PrometheusRule + ServiceMonitor

---

## 🔹 PR-013 — Observability Expansion
**Amaç:** derin gözlemlenebilirlik ve uyarı yönetimi.  
**Kapsam:**
- OpenTelemetry (traces + metrics + logs)
- Jaeger / Tempo entegrasyonu
- RED / USE metrik setleri
- Grafana Alertmanager kuralları
- Log örnekleme (%10 trace sampling)

---

## 🔹 PR-014 — Gateway & API Management
**Amaç:** ölçekli trafik yönetimi ve API sınır güvenliği.  
**Kapsam:**
- Kong veya NGINX Ingress rate limit
- mTLS desteği
- API Key management (partner erişimi)
- Request / Response transform politikaları

---

## 🔹 PR-015 — Documentation & Developer Experience
**Amaç:** sürdürülebilir geliştirme kültürü ve kolay onboarding.  
**Kapsam:**
- `docs/DEVELOPER_GUIDE.md`
- Architecture Decision Records (ADR)
- Makefile + DevContainer yapılandırması
- Otomatik changelog (`standard-version`)
- README.md güncellemesi (Swagger URL, sürüm rozeti)

---

## 📅 Önerilen Sıra
| Aşama | PR | Öncelik |
|-------|----|----------|
| 1 | PR-004 | API dokümantasyonu |
| 2 | PR-005 | Konfigürasyon + Logging |
| 3 | PR-006 | Auth |
| 4 | PR-007 | Rate limit + Idempotency |
| 5 | PR-008 | Cache |
| 6 | PR-009 | DB + Migrations |
| 7 | PR-010 | Test Coverage |
| 8 | PR-011 | CI/CD Security |
| 9 | PR-012 | Kubernetes Deploy |
| 10 | PR-013 | Observability |
| 11 | PR-014 | Gateway |
| 12 | PR-015 | Documentation & DX |

# Rovits API — Detailed Roadmap Alignment

## ✅ API Sözleşmesi ve Yüzey

| Gereksinim | PR |
|-------------|----|
| OpenAPI 3.1 tanımı, Swagger UI | PR-004 |
| Versiyonlama (URI/Header) | PR-002 |
| RFC 7807 hata modeli | PR-002 |
| Tutarlı pagination/filter/sort | PR-004 + PR-006 |
| Idempotency-Key desteği | PR-007 |
| Rate limit ve quota başlıkları (429, Retry-After) | PR-007 |

---

## ✅ Güvenlik

| Gereksinim | PR |
|-------------|----|
| OAuth 2.1 + JWT + RBAC | PR-006 |
| Girdi doğrulama ve sanitizasyon | PR-002 |
| CORS, Helmet, HSTS, CSP | PR-002 → CSP PR-005 |
| Brute-force, DDoS azaltma (throttler) | PR-007 |
| Request boyut limiti | PR-007 |
| Secrets yönetimi (K8s Secret + KMS), key rotation | PR-012 |
| Bağımlılık güvenliği (Dependabot, Trivy, SBOM, lisans) | PR-011 |

---

## ✅ Gözlemlenebilirlik

| Gereksinim | PR |
|-------------|----|
| JSON structured log (pino) + correlation-id | PR-005 |
| OpenTelemetry (traces/metrics/logs) | PR-013 |
| Prometheus /metrics | PR-003 |
| Liveness/Readiness/Startup health endpoint’leri | PR-003 |
| Grafana + Alertmanager dashboard/alarmlar | PR-013 |

---

## ✅ Dayanıklılık ve Çalışma Zamanı

| Gereksinim | PR |
|-------------|----|
| Graceful shutdown + SIGTERM yakalama | PR-003 |
| Bull/BullMQ job drain, DLQ, backoff | PR-008 |
| Circuit breaker, retry, timeout politikaları | PR-008 + PR-009 |
| Idempotency (işlem tekrar koruması) | PR-007 |

---

## ✅ Performans

| Gereksinim | PR |
|-------------|----|
| Redis cache + ETag/Last-Modified + sıkıştırma | PR-008 |
| N+1 ve ağır sorgular için indeks stratejisi | PR-009 |
| Toplu işlemler ve arkaplan işlerine delege | PR-008 |

---

## ✅ Veri Katmanı

| Gereksinim | PR |
|-------------|----|
| ORM seçimi ve migration yönetimi | PR-009 |
| Connection pool, timeout, veri bütünlüğü kısıtları | PR-009 |
| PII masking ve veri yaşam döngüsü politikaları | PR-009 + PR-013 |

---

## ✅ Test ve Kalite

| Gereksinim | PR |
|-------------|----|
| Unit, integration, e2e, contract tests (Pact) | PR-010 |
| Kod kalitesi: ESLint, Prettier, Husky, Commitlint | PR-010 |
| Coverage ≥ %80 ve kalite gate | PR-010 |

---

## ✅ CI/CD

| Gereksinim | PR |
|-------------|----|
| GitHub Actions: typecheck → lint → test → build → push | PR-001 |
| Trivy scan, SBOM, Cosign imza | PR-011 |
| Ortam bazlı deploy (dev/stage/prod), semver tag | PR-011 + PR-012 |
| Branch korumaları, CODEOWNERS, required checks | PR-011 |

---

## ✅ Container ve Kubernetes

| Gereksinim | PR |
|-------------|----|
| Multi-stage Dockerfile, distroless/alpine, non-root | PR-001 + PR-012 |
| Healthcheck, readonly rootfs, minimal yüzey | PR-012 |
| Helm chart, Deployment, Service, Ingress, HPA, PDB | PR-012 |
| Resource limits/requests, ConfigMap, Secret, PodSecurity | PR-012 |
| Worker için ayrı deployment, Redis/Rabbit altyapısı | PR-012 + PR-008 |

---

## ✅ API Gateway ve Sınır Katmanı

| Gereksinim | PR |
|-------------|----|
| WAF, mTLS, rate limit, IP allow/deny | PR-014 |
| API anahtarı yönetimi / OAuth proxy | PR-014 |
| CORS ve header sertleştirme (gateway seviyesi) | PR-014 |

---

## ✅ Dokümantasyon ve Operasyon

| Gereksinim | PR |
|-------------|----|
| README, env örnekleri, Makefile hedefleri | PR-015 |
| .env.example, config doğrulama şeması | PR-005 |
| SLO/SLI, runbook, on-call prosedürü | PR-013 + PR-015 |
| CHANGELOG, deprecation yönetimi | PR-015 |

---

## 🔍 Özet

Tüm kurumsal API üretim gereksinimleri roadmap içinde kapsanmıştır.  
Eksik alan yoktur; bazı maddeler doğrudan ilgili PR kapsamına gömülmüştür (örneğin pagination, PII masking).

**Roadmap tam kapsamlıdır ve Production Ready API seviyesini garanti eder.**
---

## 📜 Notlar
- PR-004 sonrasında branch stratejisi: `feature/*` → PR → `master` → `release/*`
- Her PR bağımsız CI çalıştırır.
- Production readiness ölçütü:
    - 0 açık kritik güvenlik bulgusu
    - Coverage ≥ %80
    - Helm chart deployable
    - /metrics ve /health sürekli UP
---
## 👥 Katkı

Yeni feature branch’leri şu formatta aç:
```
feature/<kısa-açıklama>
fix/<hata-numarası>

