# Taller de Git y GitLab para el SII

Instrumental de apoyo del taller de 32 horas sobre Git y GitLab dictado en
modalidad remota a funcionarios del Servicio de Impuestos Internos.

La pieza central es un **simulador visual de Git**: el participante escribe
ordenes en una consola simulada y ve como reacciona el grafo de confirmaciones.
Acompana las primeras cuatro sesiones del taller. De ahi en adelante las
tecnicas avanzadas se practican en la consola real.

El simulador es una **simulacion, no una implementacion de Git**. No hay
archivos reales ni contenido versionado: hay nodos, punteros y estados de
archivo declarados. Es a proposito, porque lo que el taller necesita mostrar es
el grafo.

---

## Si vas a participar en el taller, empieza aca

**No hay que instalar nada.** Clonas este repositorio y ya tienes todo.

### Abrir el simulador

En la carpeta que acabas de clonar hay un archivo llamado **`SIMULADOR.html`**.

**Haz doble clic sobre el.** Se abre en tu navegador y funciona sin conexion a
internet y sin levantar ningun servidor.

Eso es todo. No hay que instalar, ni construir, ni descargar nada mas. El
archivo lleva el simulador completo adentro, asi que tambien puedes copiarlo a
un pendrive o mandarlo por correo y sigue funcionando igual.

### Hacer los laboratorios

Los enunciados estan en [`labs/`](labs/README.md), una carpeta por laboratorio.
Cada uno trae el enunciado que vas a leer y un verificador que te dice si te
quedo bien. Algunos traen ademas un script que arma el punto de partida.

Tu trabajo **no va dentro de esta carpeta**, va en una carpeta hermana que se
llama `taller-git-trabajo`. Cada enunciado te dice como llegar ahi.

### Que necesitas tener instalado

Solo **Git**, que es lo que el taller enseña. En Windows viene con Git Bash, que
es la consola que vas a usar.

Nada mas: ni Node, ni servidor, ni permisos de administrador, ni acceso a la red
despues de clonar.

---

## Que hay en este repositorio

```
curso-git-gitlab-sii/
├── SIMULADOR.html      el simulador, listo para doble clic
├── docs/
│   ├── specs/          los encargos, un archivo por etapa del proyecto
│   └── arquitectura.md versiones, empaquetado y decisiones de diseno
├── labs/               los laboratorios, uno por carpeta
├── simulador/          el codigo fuente del simulador
│   ├── src/core/       el motor: confirmaciones, ramas, punteros, ordenes
│   ├── src/escenarios/ los estados iniciales de cada sesion
│   ├── src/grafico/    el calculo de posiciones del grafo
│   ├── src/vista/      el modelo de vista entre el motor y la pantalla
│   ├── src/ui/         los componentes de la pantalla
│   ├── dist/           el simulador construido, versionado a proposito
│   └── tests/          las pruebas
├── semillas/           repositorios semilla, sin uso en el esquema actual
└── material/           presentaciones y guias (pendiente)
```

`SIMULADOR.html` es una copia exacta de `simulador/dist/index.html`. Esta en la
raiz para que el participante no tenga que buscarlo, y Git guarda las dos rutas
como un mismo objeto, asi que la copia no pesa nada.

`semillas/` quedo sin uso: los laboratorios arman su propio punto de partida.
Se conserva porque su contenido puede servir mas adelante.

---

# Para desarrollar el instrumental

Todo lo que sigue es para quien **modifica** el simulador o los laboratorios.
El participante no necesita nada de esto.

## Que hace falta

Solo **Node.js 22.12 o superior** (sirve tambien Node 20.19 o superior). Nada
mas: ni base de datos, ni servidor, ni permisos de administrador.

Para saber que version de Node hay instalada:

```bash
node --version
```

## Como construir el simulador

Desde la raiz del repositorio:

```bash
cd simulador
npm install
npm run build
```

`npm install` se ejecuta una sola vez, la primera. Descarga las dependencias
desde la red; es la unica parte del proceso que la necesita.

### Despues de tocar el simulador hay que reconstruir

El artefacto construido va versionado, asi que **cualquier cambio en el codigo
del simulador obliga a rehacerlo y confirmarlo**:

```bash
cd simulador
npm run build
```

Esa orden hace tres cosas: construye `dist/index.html`, copia el resultado a
`SIMULADOR.html` en la raiz y anota las huellas en `dist/manifiesto.txt`.

Si se te olvida, la suite falla y te dice que correr. Tambien puedes
comprobarlo suelto:

```bash
npm run comprobar
```

### Donde queda el archivo resultante

```
simulador/dist/index.html    el artefacto, versionado en el repositorio
SIMULADOR.html               copia exacta en la raiz, por donde entra el participante
```

Es **un unico archivo**, de alrededor de 260 KB, con el codigo y los estilos
adentro. Para usarlo basta hacer **doble clic** sobre el: se abre en el
navegador y funciona sin conexion a internet y sin levantar ningun servidor.
Se puede copiar a un pendrive, mandarlo por correo o dejarlo en una carpeta
compartida, y sigue funcionando igual.

Los dos van confirmados en el repositorio, contra la costumbre de no versionar
lo que se construye. Es a proposito y la razon esta en la seccion 22 de
[`docs/arquitectura.md`](docs/arquitectura.md): el participante clona y abre, y
no hay ninguna maquina del SII donde haya que instalar Node para eso.

La construccion se detiene con un error si el archivo llegara a quedar
apuntando a algun recurso externo, de modo que si `npm run build` termina bien,
el archivo es autocontenido.

## Como probar

```bash
cd simulador
npm test
```

Ejecuta las pruebas y mide la cobertura del motor, de los escenarios, del
calculo de posiciones y del modelo de vista. La orden falla si la cobertura de
lineas baja del 90 por ciento, que es el minimo que fija el SPEC 001.

Estado actual: 415 pruebas, 98 por ciento de cobertura de lineas. Las de las
semillas y las de los laboratorios ejecutan Git de verdad y se llevan la mayor
parte del minuto que tarda la suite.

Otras ordenes utiles:

```bash
npm run comprobar       # dice si el simulador construido quedo viejo
npm run test:observar   # repite las pruebas cada vez que se guarda un archivo
npm run tipos           # revisa los tipos sin construir
npm run lint            # pasa el linter sobre el codigo y las pruebas
npm run capturas        # rehace las capturas de docs/capturas desde el navegador
npm run dev             # levanta el simulador con recarga en caliente
```

`npm run dev` es solo para desarrollar. Lo que se entrega a la sala de clases
es siempre el archivo de `dist`.

## Que se ve en pantalla

Hay capturas de la pantalla real en [`docs/capturas`](docs/capturas), sobre los
escenarios E1, E3 y E4, incluyendo la previsualizacion de una fusion y el
resultado de un rebase. Se rehacen con `npm run capturas` despues de construir,
de modo que se pueden actualizar cada vez que la vista cambie.

La pantalla tiene cinco zonas:

1. **Barra de estado**, arriba: repositorio, rama actual, cambios sin
   confirmar, selector de escenario y los interruptores.
2. **Consola**, a la izquierda: se escribe la orden y se ve la respuesta, con
   el aspecto y los colores de Git Bash.
3. **Grafo**, a la derecha: las confirmaciones mas recientes arriba y las ramas
   desplegandose hacia la derecha.
4. **Areas**, abajo: directorio de trabajo, area de preparacion, repositorio
   local y repositorio remoto. Debajo aparecen, solo cuando corresponde, la pila
   de guardado temporal, las diferencias y los objetos internos.
5. **Linea de tiempo**, al pie: un segmento por orden ejecutada. Se puede
   retroceder y toda la pantalla vuelve a como estaba en ese momento.

### Como se usa

| Tecla o gesto | Que hace |
|---|---|
| Flechas arriba y abajo | Recorre las ordenes ya escritas |
| Tabulacion | Completa la orden. Con el campo vacio, saca el foco de la consola |
| Entrar | Ejecuta la orden |
| Escape | Descarta lo escrito y la previsualizacion |
| Clic sobre una confirmacion | Abre sus objetos internos |
| Flechas izquierda y derecha sobre la linea de tiempo | Retrocede y avanza |

Toda la interfaz se maneja con el teclado.

**Previsualizacion.** Con el interruptor encendido, mientras se escribe una
orden que crearia confirmaciones, el grafo las dibuja en trazo discontinuo
antes de ejecutarlas. Entrar ejecuta, Escape descarta.

**Modo relator.** Aumenta el tamano de todo de forma proporcional y esconde los
paneles secundarios, para proyectar por videoconferencia.

Las confirmaciones que quedan sin ninguna rama ni etiqueta apuntandolas no
desaparecen: siguen dibujadas en gris. Es lo que permite mostrar que un
`git reset --hard` o un `git rebase` no destruyen nada, y que `git reflog` las
recupera.

## Los cuatro escenarios

El caso es un recetario de comida chilena. Cada sesion parte de un estado
distinto:

| Escenario | Sesion | Con que se encuentra el participante |
|---|---|---|
| E1 | 1 | Repositorio recien creado, archivos presentes y sin seguimiento |
| E2 | 2 | Cuatro confirmaciones en `main`, un archivo modificado y un mensaje mal escrito |
| E3 | 3 | Rama `tailandesa` separada del tronco, mas archivos temporales sin excluir |
| E4 | 4 | Las mismas ramas, pero divergiendo sobre un mismo archivo: la fusion choca |

## Como esta hecho por dentro

El motor esta separado de la interfaz a proposito: es codigo puro, sin React y
sin acceso al navegador, lo que permite probarlo de forma automatizada y
cambiar la capa visual sin tocar la logica. El detalle esta en
[`docs/arquitectura.md`](docs/arquitectura.md), junto con las versiones
elegidas y las decisiones de diseno.

Los encargos de cada etapa quedan sin modificar en
[`docs/specs`](docs/specs), para que el historial del repositorio muestre
contra que se implemento cada cambio.
