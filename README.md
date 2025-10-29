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

## 🧩 Yol Haritası

| Aşama | Başlık | Durum |
|--------|---------|--------|
| PR-001 | CI Pipeline | ✅ Tamamlandı |
| PR-002 | API Bootstrap (validation, RFC7807, versioning) | ✅ Tamamlandı |
| PR-003 | Health + Metrics | ✅ Tamamlandı |
| PR-004 | OpenAPI 3.1 + Swagger UI | ⏳ Sırada |
| PR-005 | .env.example, ConfigModule, logging standardı | ⏳ Planlandı |
| PR-006 | OAuth 2.1 + JWT + RBAC | ⏳ Planlandı |

---

## 👥 Katkı

Yeni feature branch’leri şu formatta aç:
```
feature/<kısa-açıklama>
fix/<hata-numarası>
```

Pull request açıklamaları:
- **Ne değişti?**
- **Neden gerekliydi?**
- **Test kapsamı nedir?**

---

## 🪪 Lisans

MIT © 2025 Rovits API Team
