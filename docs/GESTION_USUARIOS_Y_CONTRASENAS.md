# Gestión de Usuarios y Recuperación de Contraseña — v1.1.0

## Edge Function

`admin-users` — desplegar manualmente en Supabase.

## Funcionalidades

| Acción | Descripción |
|--------|-------------|
| `list_users` | Lista todos los usuarios con perfil |
| `get_user` | Detalle de un usuario |
| `create_user` | Crea usuario en Auth + perfil |
| `update_user` | Actualiza nombre, rol, estado |
| `reset_password` | Restablece contraseña (admin) |
| `send_recovery` | Envía correo de recuperación |

## Rutas

| Ruta | Descripción |
|------|-------------|
| `/admin/usuarios` | Listado de usuarios |
| `/admin/usuarios/nuevo` | Crear usuario |
| `/admin/usuarios/:id` | Detalle/editar usuario |
| `/recuperar-contrasena` | Solicitar recuperación |
| `/actualizar-contrasena` | Establecer nueva contraseña |

## Seguridad

- Solo admin gestiona usuarios
- Último admin no puede desactivarse
- Contraseña nunca se almacena en logs
- Service role solo en Edge Function

## SQL manual

```sql
-- No hay migración nueva
-- Solo desplegar Edge Function:
-- supabase/functions/admin-users/index.ts
```

## Configuración pendiente en Supabase

Authentication → URL Configuration:
- Site URL: `https://sistema.sicompatagonia.com`
- Redirect URLs: `https://sistema.sicompatagonia.com/actualizar-contrasena`

## Alta de administradores y cuentas adicionales

Un usuario con perfil `admin` y `active = true` puede crear otros administradores,
supervisores y técnicos desde **Usuarios → Nuevo usuario**. El selector de rol
incluye **Administrador**. No se exige un administrador especial ni un email
concreto para esta operación.

Una persona puede tener cuentas separadas con el mismo nombre y diferentes
emails. Cada cuenta mantiene su rol independiente. Un email ya registrado no se
reutiliza ni se sobrescribe al intentar un alta.

### Diagnóstico del alta (noviembre de 2026)

- La función devuelve mensajes específicos para email ya registrado, contraseña
  rechazada por las reglas de Auth, email inválido y exceso de intentos.
- El cliente explica cuándo debe iniciarse sesión nuevamente (HTTP 401) y cuándo
  se necesita un perfil de administrador activo (HTTP 403).
- Los logs de error guardan códigos del proveedor y el ID del administrador. No
  registran contraseñas, emails, cuerpos de solicitudes ni mensajes internos del
  proveedor.
- Si falla el guardado del perfil, se elimina la cuenta de Auth recién creada;
  un error en esa compensación queda registrado para revisión.
- El listado recorre las páginas de Auth y consulta los perfiles en lotes de
  100. Un perfil faltante o inválido se informa como inconsistencia; no se le
  atribuye automáticamente un rol ni un estado activo.

Las reglas de contraseñas dependen de la configuración del proyecto de Supabase:
[Password security](https://supabase.com/docs/guides/auth/password-security).
Los errores se clasifican por los
[códigos oficiales de Auth](https://supabase.com/docs/guides/auth/debugging/error-codes).

### Verificación y despliegue

Pruebas del handler real de `admin-users`:

```sh
npx vitest run src/test/adminUsersHandler.test.ts src/services/adminUsers.service.test.ts src/pages/admin/UserCreatePage.test.tsx
```

Cubren creación de un administrador por otro administrador activo, dos cuentas
con el mismo nombre y emails diferentes, rechazo de usuarios sin permisos,
validación de sesión, errores seguros, compensación del alta y listado paginado.

Este cambio no requiere una migración de base de datos. El frontend y la función
se despliegan por separado. Para el backend:

```sh
npx supabase functions deploy admin-users --project-ref PROJECT_REF --use-api
```

Conservar la verificación JWT. Después de desplegar, verificar el perfil real
`role`/`active` de la cuenta que informó el problema y los logs de su intento.
Las pruebas con clientes simulados no permiten atribuir la causa de un fallo
ocurrido en producción ni confirman que una cuenta específica tenga el rol
correcto. No crear cuentas ficticias en producción para completar esta revisión.
