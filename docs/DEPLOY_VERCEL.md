# Deploy en Vercel - SICOM Patagonia Ascensores

## Prerequisitos
- Cuenta en Vercel (vercel.com)
- Proyecto en GitHub
- Supabase configurado y funcionando

---

## Paso a Paso

### A. Crear cuenta en Vercel
1. Ir a https://vercel.com
2. Crear cuenta con GitHub
3. Verificar email

### B. Importar proyecto
1. Dashboard de Vercel → "Add New..." → "Project"
2. Seleccionar repositorio `sicom-qr-ascensores`
3. Vercel detectará automáticamente Vite

### C. Configurar framework
```
Framework Preset: Vite
Build Command: npm run build
Output Directory: dist
Install Command: npm install
```

### D. Variables de entorno
Agregar en "Environment Variables":

| Variable | Valor | Ambiente |
|----------|-------|----------|
| `VITE_SUPABASE_URL` | `https://xxx.supabase.co` | Production, Preview |
| `VITE_SUPABASE_ANON_KEY` | `eyJ...` | Production, Preview |
| `VITE_PUBLIC_APP_URL` | `https://tu-proyecto.vercel.app` | Production |

**⚠️ NUNCA agregar:**
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY`
- `RESEND_API_KEY`

Estas van en Supabase Edge Functions, no en el frontend.

### E. Deploy
1. Clic en "Deploy"
2. Esperar build (~1-2 minutos)
3. Obtener URL: `https://tu-proyecto.vercel.app`

### F. Configurar dominio (opcional)
1. Settings → Domains
2. Agregar dominio personalizado
3. Configurar DNS según instrucciones de Vercel

---

## Variables de Entorno Requeridas

```bash
# Frontend (Vercel)
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...
VITE_PUBLIC_APP_URL=https://tu-proyecto.vercel.app
```

---

## Verificación Post-Deploy

1. Abrir URL de Vercel
2. Probar login
3. Probar vista pública QR
4. Verificar que las imágenes cargan
5. Probar en celular (responsive)

---

## Comandos Útiles

```bash
# Build local
npm run build

# Preview local
npm run preview

# Deploy forzar desde CLI
npx vercel --prod
```

---

## Troubleshooting

### Build falla
- Verificar que `npm run build` funciona localmente
- Revisar logs de Vercel en Deployments

### Imágenes no cargan
- Verificar que están en `public/images/sicom/`
- Verificar rutas en `src/config/assets.ts`

### Login no funciona
- Verificar `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`
- Verificar que Supabase está activo

### QR no funciona
- Verificar `VITE_PUBLIC_APP_URL` coincide con dominio real
