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

## Que hay en este repositorio

```
curso-git-gitlab-sii/
├── docs/
│   ├── specs/          los encargos, un archivo por etapa del proyecto
│   └── arquitectura.md versiones, empaquetado y decisiones de diseno
├── simulador/          el simulador
│   ├── src/core/       el motor: confirmaciones, ramas, punteros, ordenes
│   ├── src/escenarios/ los estados iniciales de cada sesion
│   ├── src/ui/         la capa visual
│   └── tests/          las pruebas del motor
├── semillas/           repositorios semilla de los laboratorios (pendiente)
├── labs/               enunciados de los ejercicios (pendiente)
└── material/           presentaciones y guias (pendiente)
```

Lo que hay hoy corresponde al SPEC 001: el repositorio, el motor del simulador
y sus pruebas. La interfaz visual completa llega con el SPEC 002, de modo que
lo que se ve al abrir el simulador hoy es una pantalla de comprobacion, no la
pantalla que vera el participante.

## Que hace falta para trabajar aqui

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

### Donde queda el archivo resultante

```
simulador/dist/index.html
```

Es **un unico archivo**, de alrededor de 235 KB, con el codigo y los estilos
adentro. Para usarlo basta hacer **doble clic** sobre el: se abre en el
navegador y funciona sin conexion a internet y sin levantar ningun servidor.
Se puede copiar a un pendrive, mandarlo por correo o dejarlo en una carpeta
compartida, y sigue funcionando igual.

La construccion se detiene con un error si el archivo llegara a quedar
apuntando a algun recurso externo, de modo que si `npm run build` termina bien,
el archivo es autocontenido.

## Como probar

```bash
cd simulador
npm test
```

Ejecuta las pruebas del motor y mide la cobertura. La orden falla si la
cobertura de lineas del motor baja del 90 por ciento, que es el minimo que fija
el SPEC 001.

Estado actual: 148 pruebas, 98 por ciento de cobertura de lineas.

Otras ordenes utiles:

```bash
npm run test:observar   # repite las pruebas cada vez que se guarda un archivo
npm run tipos           # revisa los tipos sin construir
npm run dev             # levanta el simulador con recarga en caliente
```

`npm run dev` es solo para desarrollar. Lo que se entrega a la sala de clases
es siempre el archivo de `dist`.

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
