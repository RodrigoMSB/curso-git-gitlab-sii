# La interfaz entre la página y los motores

La página del modo taller es `SIMULADOR.html`, la misma para los dos motores. Cada motor, el de Java en `java/` y el de Python en `python/`, tiene que responder exactamente lo que está escrito aquí. La prueba `simulador/taller-java/interfaz.test.ts` manda las mismas peticiones a los dos y compara las respuestas.

## El arranque

- El motor escucha solo en `127.0.0.1`, en un puerto que elige el sistema.
- Cada arranque genera una clave de 32 caracteres hexadecimales, 128 bits al azar.
- La dirección es `http://127.0.0.1:<puerto>/?clave=<clave>`. El motor la escribe en su ventana en una línea que empieza con `Dirección: `, y además en el archivo que nombre la variable `TALLER_ARCHIVO_DIRECCION`, si está.
- Con `TALLER_SIN_NAVEGADOR=1` no abre el navegador. El arrancador lo pide así y lo abre él.
- El taller es la carpeta que contiene al clon, `taller-git`. La consola parte ahí, no sube de ahí, y el motor guarda sus archivos en `taller-git/.taller`.

## La guardia

Toda petición pasa por las mismas reglas antes de llegar a su ruta. Si falla una, la respuesta es 403 sin cuerpo.

- El encabezado `Host` es exactamente `127.0.0.1:<puerto>`. Ni `localhost`, ni otro nombre, ni sin puerto.
- Si viene un encabezado `Origin`, es exactamente `http://127.0.0.1:<puerto>`.
- El camino es exactamente uno de los de abajo. Cualquier otro recibe 403.
- La clave de la página viaja en la dirección, `?clave=`. La de la API, en el encabezado `X-Taller-Clave`. Una no sirve en el lugar de la otra.
- Ninguna respuesta lleva encabezados CORS.
- Todas llevan `Cache-Control: no-store`, `X-Content-Type-Options: nosniff` y `Referrer-Policy: no-referrer`.
- Un método que no corresponde recibe 405, con `Allow`.

## Las rutas

### `GET /?clave=<clave>`

200 con el `SIMULADOR.html` del clon, `text/html; charset=utf-8`.

### `GET /api/estado?desde=<version>`

Si la versión del estado sigue siendo `<version>`, 204 sin cuerpo. Si en ese momento hay una lectura de Git en curso, o la huella ya cambió y la lectura está por empezar, el motor espera a que termine, hasta un segundo, antes de responder.

Si cambió, 200 con `application/json; charset=utf-8`.

```
{
  "version": 3,
  "sesion": {
    "sistema": "windows" | "mac" | "otro",
    "usuario": "ana",
    "equipo": "SII-123",
    "limite": "taller-git",
    "carpeta": "C:/Users/ana/taller-git/lab-02/recetario",
    "relativa": "lab-02/recetario",
    "avisos": ["..."],
    "tiempoMaximo": 600000,
    "motor": "java" | "python"
  },
  "estado": <estado>
}
```

`carpeta` va con barras normales. `relativa` es la carpeta respecto del taller, vacía en la raíz. `avisos` son los de carpeta sincronizada. `tiempoMaximo` va en milisegundos.

Fuera de un repositorio, `<estado>` es `{"repositorio": false, "motivo": "fuera" | "desnudo"}`. Dentro de uno:

```
{
  "repositorio": true,
  "raiz": "C:/Users/ana/taller-git/lab-02/recetario",
  "gitdir": "C:/Users/ana/taller-git/lab-02/recetario/.git",
  "dentroDeGit": false,
  "rama": "main" | null,
  "head": "<40 hex>" | null,
  "confirmaciones": [
    { "id": "<40 hex>", "corto": "<7 o mas hex>", "padres": ["<40 hex>"],
      "autor": "Juana Perez", "correo": "juana@recetario.cl", "epoca": 1705321200,
      "asunto": "se inicia el recetario", "huerfana": false }
  ],
  "ramas": [{ "nombre": "main", "id": "<40 hex>" }],
  "remotas": [{ "nombre": "origin/main", "id": "<40 hex>" }],
  "etiquetas": [{ "nombre": "v1.0", "id": "<40 hex de la confirmacion>", "anotada": true }],
  "guardados": [{ "indice": 0, "id": "<40 hex>", "base": "<40 hex>", "mensaje": "WIP on main: ..." }],
  "operacion": "fusion" | "rebase" | "cherry-pick" | "revert" | null,
  "areas": {
    "preparado": [{ "ruta": "platos.md", "tipo": "M" }, { "ruta": "nuevo.md", "tipo": "R", "origen": "viejo.md" }],
    "modificado": [{ "ruta": "platos.md", "tipo": "M" }],
    "sinSeguimiento": ["recetas/nueva.md"],
    "conflicto": ["cocineros.md"]
  },
  "cambios": 4,
  "arbol": ["README.md", "recetas/pastel-de-choclo.md"]
}
```

- `confirmaciones` va de la más reciente a la más antigua, en orden topológico. Trae las alcanzables desde las ramas, las remotas, las etiquetas, HEAD y las bases de los guardados, y además las del registro de HEAD que nada alcanza, con `huerfana: true`.
- `rama` es null con la posición desconectada. `head` es null antes de la primera confirmación.
- Las remotas no traen `origin/HEAD`. Las etiquetas que no apuntan a una confirmación no van.
- `rama` y `head` salen de `git status --branch`.
- Las áreas salen de `git status --porcelain=v2 -z --untracked-files=all`. Un archivo preparado y vuelto a tocar va en las dos.
- `cambios` cuenta las rutas distintas con algo pendiente.
- `arbol` son los archivos de HEAD, como los lista `git ls-tree -r --name-only`.
- Leer no escribe. Todas las lecturas usan `--no-optional-locks`.

### `POST /api/orden`

Cuerpo `{"orden": "git status"}`, en UTF-8, de hasta 64 KB. Llega con `Content-Length`, como lo manda el navegador, o por partes (`Transfer-Encoding: chunked`); los dos motores leen las dos formas. Más de 64 KB es 400, como una orden que falta.

- Sin orden, o con una orden vacía, 400 con `{"error": "falta la orden"}`.
- Si otra orden está corriendo, 409 con `{"ocupado": true, "enCurso": "<la otra orden>", "avisos": ["Todavía corre la orden anterior. Espera a que termine."]}`.
- Si no, 200 cuando la orden terminó y el estado nuevo ya se leyó.

```
{ "codigo": 0, "salida": "...", "error": "...", "agotado": false, "avisos": ["..."], "version": 4 }
```

`salida` y `error` van tal cual los imprimió la orden, por separado. Un error de bash va firmado `bash: line N:`, como con `bash -c`, sin nombrar archivos del motor. `agotado` es true si la orden pasó el límite de tiempo y se detuvo con todo lo que abrió, y entonces `codigo` es -1. `avisos` son líneas del motor, no de Git, cada una de estas, en este orden.

1. La carpeta final quedó fuera del taller: `La consola no sale de <taller>. La orden corrió, pero la consola se queda donde estaba.`
2. El límite de tiempo: `La orden pasó el límite de <N minutos> y se detuvo, junto con todo lo que había lanzado.`
3. El editor, si la orden falló y su error nombra al editor: la ayuda para dejar `code` disponible, una para Windows y otra para Mac.
4. Una orden que pide teclado, como `git add -p`: `Esta orden pide respuestas por teclado y la consola del taller no se las puede dar. Hazla en Git Bash.`

### `GET /api/diagnostico`

200 con `{"procesos": <cuantos lanzo el motor desde que arranco>, "version": <version del estado>}`. La prueba del reposo lo lee: en un minuto sin nadie escribiendo, `procesos` no cambia.

## Cómo corre una orden

Las dos cosas que la hacen igual en los dos motores.

- **El envoltorio.** Bash lee de su entrada estándar una sola línea, que es la misma en los dos motores, y la orden viaja en la variable `TALLER_ORDEN`. En Windows, `bash.exe --login -s` con `CHERE_INVOKING=1`; en Mac, `/bin/bash -s`. El envoltorio define un `cd` que no sale del taller, pone la raíz del taller en el `PATH`, cierra la entrada y ejecuta la orden con `eval`. Al salir escribe la carpeta en que quedó bash, y si la orden dejó una carpeta en el archivo que nombra `TALLER_CD_DESPUES`, va a esa antes. Así `preparar 02` deja la consola en `lab-02/recetario`.
- **El entorno.** `GIT_PAGER=cat`, `PAGER=cat`, `TERM=dumb`, `GIT_TERMINAL_PROMPT=0`. El límite de tiempo es de diez minutos, o los segundos de `TALLER_TIEMPO_MAXIMO`.

## Cuándo se lee el estado

Después de cada orden, y cuando cambia la huella. La huella es una suma de fechas y tamaños de los archivos que cambian en `.git` y de todos los del directorio de trabajo, calculada cada medio segundo sin lanzar ningún proceso. Por la huella no se lee más de una vez por segundo. En reposo, ningún proceso.
