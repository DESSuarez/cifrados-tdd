# Correos de Cifrados

Plantillas en español para Supabase → **Authentication → Emails → Templates** (proyecto `cifrados-tdd`). Copia el contenido de cada archivo en **Message body** (pestaña Source) y usa estos asuntos:

| Plantilla en Supabase | Archivo | Asunto |
|---|---|---|
| Invite user | `invitacion.html` | Te invitaron a Cifrados · Tiempo de Dios |
| Reset password | `recuperar.html` | Cambia tu contraseña · Cifrados |
| Confirm signup | `confirmar.html` | Confirma tu correo · Cifrados |

`{{ .ConfirmationURL }}` es la liga que genera Supabase: no la cambies. La app reconoce la invitación y la recuperación por esa liga y abre la pantalla para crear contraseña.

El logo se carga desde `https://cifrados.tiempodedios.mx/apple-touch-icon.png`.

Los avisos de ministerios (alguien pidió entrar, solicitud aceptada o rechazada) no son plantillas de Supabase: los manda la función `usuarios` con el SMTP de Hostinger.
