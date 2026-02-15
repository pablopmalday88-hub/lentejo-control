# 🛡️ Lentejo Control - Security Features

## ✅ Implementado (v1.1)

### 1. **Rate Limiting Anti Brute-Force**
- **Límite**: 5 intentos de login por 15 minutos (por IP)
- **Acción**: Bloqueo temporal + notificación Telegram
- **Implementación**: `express-rate-limit` en `/api/auth`
- **Bypass**: No hay bypass, rate limit estricto

### 2. **Login Notifications (Telegram)**
- **Evento**: Cada login exitoso envía notificación
- **Info incluida**: IP, User-Agent, método 2FA usado
- **Alertas especiales**:
  - ✅ Login normal con TOTP
  - ⚠️ Login con código de respaldo (+ códigos restantes)
  - 🚨 Rate limit excedido (intento de brute force)

### 3. **Security Headers**
Implementados con `helmet`:

```
Content-Security-Policy: default-src 'self'
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
X-XSS-Protection: 1; mode=block
```

**Protección contra:**
- XSS (Cross-Site Scripting)
- Clickjacking
- MIME sniffing
- Man-in-the-middle (HSTS)

### 4. **Audit Log Completo**
- **Archivo**: `/data/audit-log.jsonl` (JSONL append-only)
- **Eventos registrados**:
  - `login_success` → Login exitoso (con IP, UA, método)
  - `login_failed` → Login fallido (con razón)
  - `rate_limit_exceeded` → Brute force detectado
- **Consulta**: `GET /api/audit?limit=50` (requiere autenticación)
- **Formato**:
  ```json
  {
    "timestamp": "2026-02-15T10:30:00.000Z",
    "event": "login_success",
    "ip": "1.2.3.4",
    "userAgent": "Mozilla/5.0...",
    "twoFA": true,
    "method": "totp"
  }
  ```

### 5. **Constant-Time Password Comparison**
- **Problema**: Timing attacks (deducir password por tiempo de respuesta)
- **Solución**: `crypto.timingSafeEqual()` (Node.js native)
- **Resultado**: Tiempo de respuesta constante independientemente del password

---

## 🔐 Security Stack Completo

### Capa 1: Transport
- ✅ HTTPS (Railway automático)
- ✅ HSTS headers (fuerza HTTPS)

### Capa 2: Authentication
- ✅ Password (variable entorno)
- ✅ 2FA TOTP (Google Authenticator, Authy)
- ✅ Backup codes (10, uso único)
- ✅ Constant-time comparison

### Capa 3: Rate Limiting
- ✅ Login: 5 intentos/15min
- ⚠️ API endpoints: Sin límite (solo autenticados)

### Capa 4: Monitoring
- ✅ Audit log (JSONL)
- ✅ Telegram alerts (login + brute force)
- ⚠️ No monitoring activo (logs pasivos)

### Capa 5: Headers
- ✅ CSP (Content Security Policy)
- ✅ XSS Protection
- ✅ Clickjacking protection
- ✅ MIME sniffing protection

---

## 📊 Threat Model

### Atacante Nivel 1 (Script Kiddie)
- ❌ **Brute force**: Bloqueado por rate limit (5/15min)
- ❌ **XSS**: Bloqueado por CSP headers
- ❌ **Clickjacking**: Bloqueado por X-Frame-Options

### Atacante Nivel 2 (Profesional)
- ❌ **Password leak**: Inútil sin 2FA
- ❌ **Timing attack**: Mitigado por constant-time
- ❌ **Session hijack**: Sin sesiones persistentes (stateless)
- ⚠️ **Phishing 2FA**: Posible (TOTP no es phishing-resistant)

### Atacante Nivel 3 (APT / Nation-State)
- ⚠️ **Server compromise**: Secretos en plaintext (2fa-secret.json)
- ⚠️ **Stolen device**: Password + móvil físico = acceso
- ✅ **Network MITM**: Protegido por HTTPS + HSTS

### Atacante Nivel 4 (Wrench Attack 🔧)
- 💀 **Coerción física**: Sin protección técnica posible

---

## 🔄 Próximas Mejoras (Roadmap)

### High Priority
- [ ] JWT sessions con expiración (24h)
- [ ] Encriptar `2fa-secret.json` con clave derivada
- [ ] IP whitelist opcional (geofencing)
- [ ] Session management (logout todas las sesiones)

### Medium Priority
- [ ] WebAuthn / YubiKey (phishing-resistant)
- [ ] Honeypot endpoints (detect intrusions)
- [ ] Encrypted data at rest (tasks.json, costs.json)
- [ ] Failed login dashboard (visualizar ataques)

### Low Priority
- [ ] DDoS protection (Cloudflare)
- [ ] Certificate pinning
- [ ] Anomaly detection (ML-based)

---

## 🚨 Incident Response

### Si detectas login no autorizado:

1. **Verifica el audit log**:
   ```bash
   curl -H "x-access-password: YOUR_PASSWORD" \
     https://lentejo-control-production.up.railway.app/api/audit?limit=100
   ```

2. **Revisa notificaciones Telegram**: ¿Login desde IP desconocida?

3. **Cambia password inmediatamente**:
   - Railway dashboard → Variables → `ACCESS_PASSWORD`
   - Restart automático

4. **Regenera 2FA**:
   ```bash
   ssh servidor
   rm /path/to/data/2fa-secret.json
   # Reconfigura 2FA desde cero
   ```

5. **Revisa datos**:
   - ¿Tareas modificadas?
   - ¿Costos alterados?
   - ¿Nuevas tareas creadas?

---

## 📝 Audit Log Analysis

### Ver últimos 50 eventos:
```bash
curl -H "x-access-password: YOUR_PASSWORD" \
  https://lentejo-control-production.up.railway.app/api/audit?limit=50
```

### Buscar intentos fallidos:
```bash
grep "login_failed" data/audit-log.jsonl | tail -20
```

### Contar intentos por IP:
```bash
grep "login_failed" data/audit-log.jsonl | \
  jq -r '.ip' | sort | uniq -c | sort -nr
```

### Ver logins exitosos hoy:
```bash
grep "login_success" data/audit-log.jsonl | \
  grep "$(date +%Y-%m-%d)" | jq
```

---

## 🐕 Lentejo Control - Fortaleza Mode Activated
_Ahora es más difícil entrar aquí que a Fort Knox._
