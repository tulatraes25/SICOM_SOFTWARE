# Etapa 2: Supabase Auth + Base de Datos Inicial

## Objetivo

Conectar el proyecto React/Vite con Supabase, implementar login real, crear las tablas principales, configurar roles y preparar políticas RLS iniciales.

---

## 1. Crear Proyecto en Supabase

1. Ir a [supabase.com](https://supabase.com)
2. Crear una cuenta o iniciar sesión
3. Hacer clic en "New Project"
4. Completar:
   - **Organization**: Seleccionar o crear
   - **Project name**: `sicom-qr-ascensores`
   - **Database password**: Generar uno seguro (guardarlo)
   - **Region**: Seleccionar la más cercana (ej: `South America (São Paulo)`)
5. Esperar a que se cree el proyecto

---

## 2. Obtener Credenciales

Una vez creado el proyecto:

1. Ir a **Settings** → **API**
2. Copiar:
   - **Project URL**: `https://xxxxx.supabase.co`
   - **Project API Keys** → **anon public**: `eyJhbGci...`

**⚠️ NUNCA copiar la `service_role` key para usar en frontend.**

---

## 3. Configurar Variables de Entorno

Crear el archivo `.env.local` en la raíz del proyecto:

```bash
# Copiar desde .env.example
cp .env.example .env.local
```

Completar con las credenciales reales:

```env
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...tu-anon-key
VITE_APP_URL=http://localhost:5173
VITE_PUBLIC_URL=http://localhost:5173/s/ascensor
```

---

## 4. Ejecutar SQL Inicial

### Opción A: Desde Supabase Dashboard

1. Ir a **SQL Editor** en el dashboard de Supabase
2. Copiar todo el contenido de `supabase/migrations/001_initial_schema.sql`
3. Hacer clic en "Run"

### Opción B: Desde Supabase CLI (opcional)

```bash
# Instalar Supabase CLI
npm install -g supabase

# Login
supabase login

# Link al proyecto
supabase link --project-ref tu-project-ref

# Ejecutar migración
supabase db push
```

---

## 5. Crear Usuarios Iniciales

### Opción A: Desde Supabase Dashboard (Recomendado)

1. Ir a **Authentication** → **Users**
2. Hacer clic en "Add user"
3. Completar:
   - **Email**: `lucas@sicompatagonia.com`
   - **Password**: (generar una segura, compartirla por canal seguro)
   - **Email Confirm**: Marcar como confirmado
4. Repetir para `adriana@sicompatagonia.com`

### Opción B: Desde SQL Editor

```sql
-- Crear usuario admin
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  confirmation_token,
  recovery_token,
  email_change_token_current,
  email_change_token_new,
  recovery_sent_at,
  last_sign_in_at,
  raw_app_meta_data,
  raw_user_meta_data,
  is_super_admin,
  confirmed_at
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  uuid_generate_v4(),
  'authenticated',
  'authenticated',
  'lucas@sicompatagonia.com',
  crypt('CAMBIAR_ESTA_CONTRASEÑA', gen_salt('bf')),
  NOW(),
  NOW(),
  NOW(),
  '',
  '',
  '',
  '',
  NOW(),
  NOW(),
  '{"provider": "email", "providers": ["email"]}',
  '{"full_name": "Lucas", "role": "admin"}',
  false,
  NOW()
);

-- Crear usuario supervisor
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  confirmation_token,
  recovery_token,
  email_change_token_current,
  email_change_token_new,
  recovery_sent_at,
  last_sign_in_at,
  raw_app_meta_data,
  raw_user_meta_data,
  is_super_admin,
  confirmed_at
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  uuid_generate_v4(),
  'authenticated',
  'authenticated',
  'adriana@sicompatagonia.com',
  crypt('CAMBIAR_ESTA_CONTRASEÑA', gen_salt('bf')),
  NOW(),
  NOW(),
  NOW(),
  '',
  '',
  '',
  '',
  NOW(),
  NOW(),
  '{"provider": "email", "providers": ["email"]}',
  '{"full_name": "Adriana", "role": "supervisor"}',
  false,
  NOW()
);
```

**⚠️ IMPORTANTE**: Cambiar las contraseñas por valores seguros.

---

## 6. Asignar Roles

Los roles se asignan automáticamente al crear el usuario mediante el trigger `handle_new_user`.

Si necesitas cambiar el rol de un usuario:

```sql
-- Ver perfiles
SELECT * FROM profiles;

-- Cambiar rol
UPDATE profiles SET role = 'admin' WHERE email = 'lucas@sicompatagonia.com';
UPDATE profiles SET role = 'supervisor' WHERE email = 'adriana@sicompatagonia.com';
```

---

## 7. Probar Login

1. Ejecutar el proyecto:
   ```bash
   npm run dev
   ```

2. Abrir `http://localhost:5173`

3. Ingresar con las credenciales creadas

4. Verificar que:
   - Se redirige al dashboard correspondiente al rol
   - El nombre y rol se muestran en el Header
   - El Sidebar muestra las opciones correctas
   - Cerrar sesión funciona correctamente

---

## 8. Rutas por Rol

| Rol | Ruta Dashboard |
|-----|----------------|
| admin | `/admin` |
| technician | `/tecnico` |
| supervisor | `/supervisor` |
| responsible | `/responsable` |

---

## 9. Estructura de Archivos Creados/Modificados

### Nuevos
- `src/config/supabase.ts` - Cliente Supabase configurado
- `src/lib/auth.ts` - Funciones de autenticación
- `src/hooks/useAuth.ts` - Hook de autenticación
- `src/components/auth/ProtectedRoute.tsx` - Protección de rutas
- `supabase/migrations/001_initial_schema.sql` - Esquema SQL completo
- `docs/ETAPA_2_SUPABASE.md` - Esta documentación

### Modificados
- `src/pages/auth/LoginPage.tsx` - Login real con Supabase
- `src/components/layout/Sidebar.tsx` - Botón logout funcional
- `src/components/layout/Header.tsx` - Usuario real
- `src/components/layout/DashboardLayout.tsx` - Usa useAuth
- `src/router/AppRouter.tsx` - Rutas protegidas
- `.env.example` - Variables actualizadas

---

## 10. Políticas RLS Implementadas

| Tabla | admin | technician | supervisor | responsible |
|-------|-------|------------|------------|-------------|
| profiles | CRUD propio + ver todos | Ver propio | Ver propio | Ver propio |
| clients | CRUD | Ver | Ver | Ver |
| buildings | CRUD | Ver | Ver | Ver |
| elevators | CRUD | Ver todos | Ver todos | Ver asignados |
| service_records | CRUD | Crear/ver propios | Ver/actualizar | Ver de ascensores asignados |
| monthly_reports | Ver | Ver | CRUD | Ver de ascensores asignados |
| audit_logs | Ver | - | - | - |

---

## 11. Troubleshooting

### Error: "No se encontró el perfil del usuario"
- Verificar que el trigger `handle_new_user` se ejecutó al crear el usuario
- Verificar que existe el perfil en la tabla `profiles`

### Error: "Variable de entorno no configurada"
- Verificar que existe el archivo `.env.local`
- Verificar que las variables `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` están correctas

### Login funciona pero no redirige
- Verificar que el perfil tiene un `role` válido
- Verificar que el rol coincide con la ruta intentada

---

## 12. Pendientes para Etapa 3

- CRUD completo de clientes
- CRUD completo de edificios
- CRUD completo de ascensores
- Formularios de edición
- Tablas con búsqueda y filtros
