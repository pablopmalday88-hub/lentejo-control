# 🐕 Lentejo Control

**Mission Control para tu asistente IA - Monitoreo, optimización y control total en tiempo real**

## Features v1.0 (MVP)

✅ **Dashboard en Tiempo Real**
- Estado actual del agente
- Próximo heartbeat
- Bandwidth/capacidad
- Costos (hoy + mes)

✅ **Workshop (Kanban)**
- Queue: Tareas pendientes
- In Progress: Trabajando ahora
- Done: Completadas
- Ranking por "momentum" (% fit)

✅ **Cost Tracking**
- Registro de cada llamada API
- Tracking diario y mensual
- Historial de costos

✅ **Sub-Agents Dashboard**
- 6 agentes planificados (Scout, Builder, Analyst, Content, Guardian)
- Lentejo Core activo

## Tech Stack

- **Backend:** Node.js + Express
- **Frontend:** Vanilla JS + Glassmorphism UI
- **Data:** JSON files (filesystem)
- **Auth:** Password simple
- **Deploy:** Railway

## Setup Local

```bash
# Instalar dependencias
npm install

# Configurar password
cp .env.example .env
# Editar .env con tu contraseña

# Iniciar
npm start

# Abre http://localhost:3000
```

## Deploy a Railway

1. Conecta este repo a Railway
2. Añade variable de entorno: `ACCESS_PASSWORD`
3. Railway auto-deploy en cada push

## API Endpoints

### Auth
- `POST /api/auth` - Login

### Status
- `GET /api/status` - Estado actual
- `PATCH /api/status` - Actualizar estado

### Tasks
- `GET /api/tasks` - Lista todas
- `POST /api/tasks` - Crear nueva
- `PATCH /api/tasks/:id` - Actualizar
- `DELETE /api/tasks/:id` - Eliminar

### Costs
- `GET /api/costs` - Historial de costos
- `POST /api/costs` - Registrar nuevo coste

### Stats
- `GET /api/stats` - Estadísticas generales

## Roadmap

- [x] v1.0 - MVP (Dashboard + Kanban + Costs)
- [ ] v1.1 - Intelligence Feed
- [ ] v1.2 - Performance Analytics
- [ ] v1.3 - Context Memory Navigator
- [ ] v1.4 - Content Pipeline
- [ ] v1.5 - Social Media Monitoring
- [ ] v2.0 - Multi-Agent System

## Licencia

MIT

---

**🐕 "Útil, confiable, despeluchado"**
