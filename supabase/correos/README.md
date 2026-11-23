# Correos de CifraDios

Plantillas en español para Supabase → **Authentication → Emails → Templates** (proyecto `cifrados-tdd`). Copia el contenido de cada archivo en **Message body** (pestaña Source) y usa estos asuntos:

| Plantilla en Supabase | Archivo | Asunto |
|---|---|---|
| Invite user | `invitacion.html` | Te invitaron a CifraDios · Tiempo de Dios |
| Reset password | `recuperar.html` | Cambia tu contraseña · CifraDios |
| Confirm signup | `confirmar.html` | Confirma tu correo · CifraDios |

`{{ .ConfirmationURL }}` es la liga que genera Supabase: no la cambies. La app reconoce la invitación y la recuperación por esa liga y abre la pantalla para crear contraseña.

El logo (corcheas de CifraDios, 96 px para que se vea nítido a 48) se carga desde `https://cifrados.tiempodedios.mx/correo-logo.png`. Gmail, Apple Mail y Outlook la muestran; si algún buzón bloquea imágenes externas, queda el texto «CifraDios» (alt).

Los avisos de ministerios (alguien pidió entrar, solicitud aceptada o rechazada) no son plantillas de Supabase: los manda la función `usuarios` con el SMTP de Hostinger.
