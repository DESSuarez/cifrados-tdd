# Cifrados · Red local (sin internet)

Para tocar donde no hay internet: el set, las secciones, los tonos y «Dirigir / Seguir» se actualizan al instante para todo el ministerio conectado a la misma red.

## Qué se necesita
- **Una compu** (la de quien dirige; Mac o Windows) con [Node.js](https://nodejs.org) 18 o más nuevo. No hay que instalar nada más.
- **Una red** a la que se conecten todos: un router o módem aunque no tenga internet (un router de viaje funciona perfecto), o el Wi-Fi del lugar.
- Esta carpeta del proyecto en esa compu (GitHub → `cifrados-tdd` → Code → Download ZIP, o `git clone`).

## Antes del evento (con internet)
1. Abre la terminal en la carpeta del proyecto y corre:
   ```bash
   node red/servidor.js
   ```
   Te muestra la dirección (p. ej. `http://192.168.1.20:8787`) y un **PIN** de 4 números.
2. En esa misma compu abre **cifrados.tiempodedios.mx**, toca el indicador de conexión (abajo a la izquierda) → **Conexión** → **⬆ Enviar mi copia a la red**. Así el servidor tiene la librería, los sets y los tonos. *(Usa Chrome; Safari bloquea que una página https hable con la compu.)*

3. Toca **📣 Avisar a todos**: eliges el ministerio, escribes el nombre del Wi-Fi (macOS no deja leerlo solo) y una nota. A cada integrante le aparece una ventana con el Wi-Fi, la dirección y el PIN para copiar y abrir. El aviso se quita solo (3 a 24 horas) o con «Terminar» en Conexión.

**Atajo:** si en tu `~/.zshrc` está `alias cifrados-red='cd ~/Documents/cifrados-tdd && node red/servidor.js'`, basta con escribir `cifrados-red`. El comando también está en **Mi perfil → 📡 Red local** con botón de copiar.

## En el evento (sin internet)
1. Todos se conectan a la misma red.
2. Abren en el navegador la dirección que muestra el servidor (`http://192.168.x.x:8787`), escriben el **PIN** y eligen su nombre.
3. Listo: lo que cambie quien dirige (orden del set, tono, bloques de la estructura, notas) llega a todos al momento. En la canción, **📡 Dirigir** hace que a quienes tienen **Seguir** se les abra la canción y la sección que marque.
4. Si el servidor se apaga, cada dispositivo sigue funcionando con su copia y manda sus cambios cuando vuelva.

## Después del evento (con internet)
En la compu del servidor abre cifrados.tiempodedios.mx → **Conexión** → **⬇ Traer cambios de la red a la nube**. Los cambios de la red se suben a la nube para todos.

## Opciones
```bash
node red/servidor.js --pin=2468 --puerto=8787
```
Los datos de la red se guardan en `red/datos-red.json` (no se sube a GitHub). Para empezar de cero, cierra el servidor y borra ese archivo.

## Límites
- Las pistas de audio y las fuentes tipográficas necesitan internet la primera vez; sin internet la app usa letra de sistema.
- En la red no hay contraseñas: cualquiera con el PIN entra y elige su nombre. Cambia el PIN en cada evento (`--pin=`).
- Los perfiles creados en la red con «No estoy en la lista» no se suben a la nube (no tienen cuenta).
