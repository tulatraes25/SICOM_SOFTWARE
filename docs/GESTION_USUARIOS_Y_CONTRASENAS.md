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
