/**
 * Un escenario por laboratorio (SPEC 007).
 *
 * Cada declaracion describe el estado inicial de un laboratorio: la misma
 * historia, las mismas ramas y el mismo estado del directorio de trabajo que
 * el participante tiene delante en su terminal. Antes el simulador traia
 * cuatro escenarios por sesion que no correspondian a ningun laboratorio, y el
 * participante veia dos repositorios distintos a la vez.
 *
 * Todos comparten el recetario COMIDA CHILENA para que no haya que aprender un
 * dominio nuevo en cada sesion.
 *
 * Los identificadores de confirmacion NO coinciden con los del disco, y no
 * tienen por que: el simulador genera los suyos. Lo que coincide es la forma, y
 * de eso se encarga la prueba de `tests/escenarios-contra-disco.test.ts`.
 */

import type { ArchivoDeclarado, EscenarioDeclarado } from './tipos';

/** Donde vive el repositorio del participante, que es una carpeta por laboratorio. */
const directorioDe = (laboratorio: number): string =>
  `/taller-git/lab-${String(laboratorio).padStart(2, '0')}/recetario`;

/** Instante de 2024 en la zona de Chile continental, en segundos desde la epoca. */
const cuando = (mes: number, dia: number, hora: number, minuto: number): number =>
  Date.UTC(2024, mes - 1, dia, hora + 3, minuto) / 1000;

const JUANA = { autor: 'Juana Perez', correo: 'juana.perez@recetario.cl' } as const;
const MARCO = { autor: 'Marco Diaz', correo: 'marco.diaz@recetario.cl' } as const;
const SOFIA = { autor: 'Sofia Rojas', correo: 'sofia.rojas@recetario.cl' } as const;

/**
 * Lo que el participante deja configurado al terminar el laboratorio 01: su
 * identidad y los dos alias. Del 02 en adelante los tiene puestos, asi que los
 * escenarios arrancan con ellos y `git lg` funciona desde la primera orden.
 */
/**
 * Los dos alias que el laboratorio 01 hace configurar, en su punto 1.3, y que
 * por ser globales acompañan al participante durante todo el taller. Se
 * declaran aqui una sola vez: los usan los escenarios, el arnes de las pruebas
 * de punta a punta y el extractor de ordenes del enunciado.
 */
export const ALIAS_DEL_TALLER = {
  // SPEC 031, 3.8: s como status --short, y lg con autor, fecha relativa y colores.
  s: 'status --short',
  lg: "log --graph --all --format='%C(yellow)%h%C(reset) %C(green)(%ar)%C(reset) %s %C(bold blue)<%an>%C(reset)%C(auto)%d%C(reset)'",
} as const satisfies Readonly<Record<string, string>>;

const CONFIGURACION_PUESTA = {
  'user.name': 'Participante del taller',
  'user.email': 'participante@sii.cl',
  'alias.s': ALIAS_DEL_TALLER.s,
  'alias.lg': ALIAS_DEL_TALLER.lg,
} as const;

// ---------------------------------------------------------------------------
// El contenido de los archivos (SPEC 012)
// ---------------------------------------------------------------------------
//
// **Esta es la unica fuente del texto de los archivos del recetario.** El
// `preparar.sh` de cada laboratorio escribe estos mismos bytes en el disco del
// participante, y `tests/escenarios-contra-disco.test.ts` compara los dos lados
// caracter por caracter: si alguien cambia uno y no el otro, la suite se
// detiene. La razon de haber elegido este reparto esta en la seccion 46 de
// docs/arquitectura.md.
//
// Los textos que varios laboratorios comparten se declaran una sola vez. No es
// ahorro de espacio: son el mismo archivo del mismo recetario, y dos copias que
// se pudieran separar serian dos recetarios distintos.

/** La presentacion del recetario, igual en los ocho escenarios. */
const README_RECETARIO = `# Recetario COMIDA CHILENA

Recopilacion de platos, ingredientes y cocineros.
Proyecto del taller de Git y GitLab.
`;

/** La lista de platos en su forma simple, sin secciones. */
const PLATOS_CURANTO = `# Platos

- pastel de choclo
- empanadas de pino
- cazuela
- curanto
`;

/** Los cuatro ingredientes de partida. */
const INGREDIENTES_BASE = `# Ingredientes

- choclo
- carne de vacuno
- cebolla
- aji de color
`;

/** Los dos primeros cocineros. */
const COCINEROS_DOS = `# Cocineros

- Juana Perez, especialidad pastel de choclo
- Marco Diaz, especialidad empanadas
`;

/** Los tres cocineros, con Sofia ya sumada. */
const COCINEROS_TRES = `# Cocineros

- Juana Perez, especialidad pastel de choclo
- Marco Diaz, especialidad empanadas
- Sofia Rojas, especialidad cazuela
`;

const PASTEL_DE_CHOCLO = `# Pastel de choclo

Preparacion del pino, molienda del choclo, horneado en greda.
`;

const EMPANADAS = `# Empanadas de pino

Masa, pino frio, huevo duro, aceituna, doblado y horno.
`;

const CAZUELA = `# Cazuela

Presa de vacuno, zapallo, papa y choclo en caldo largo.
`;

const LECHE_ASADA = `# Leche asada

Leche, huevos y azucar al horno, con caramelo en el molde.
`;

const MOTE_CON_HUESILLO = `# Mote con huesillo

Huesillos cocidos con canela y azucar rubia, mote de trigo aparte.
`;

const PAD_THAI = `# Pad thai

Fideos de arroz, tamarindo, mani y salsa de pescado.
`;

/**
 * Archivos limpios, que es el caso corriente.
 *
 * No llevan contenido declarado a proposito: el texto de un archivo limpio es
 * el de la confirmacion en la que esta, y declararlo aparte seria abrir la
 * puerta a que los dos digan cosas distintas.
 */
const limpios = (...nombres: readonly string[]): readonly ArchivoDeclarado[] =>
  nombres.map((nombre) => ({ nombre, estado: 'limpio' as const }));

// ---------------------------------------------------------------------------
// Laboratorio 01 · El recetario nace
// ---------------------------------------------------------------------------

/**
 * Unico escenario que no arranca con repositorio, porque crearlo es el
 * ejercicio. El participante puede correr `git init` en el simulador y ver que
 * pasa, igual que en su terminal.
 *
 * Los archivos del recetario aparecen sin seguimiento para que haya algo que
 * preparar y confirmar. En el disco el participante los va creando uno a uno a
 * medida que avanza; aqui estan todos desde el principio, que es la unica
 * libertad que se toma este escenario y esta anotada en `sinReflejar`.
 */
export const LAB01: EscenarioDeclarado = {
  id: 'lab-01',
  laboratorio: 1,
  sesion: 1,
  titulo: 'El recetario nace',
  proposito:
    'Configurar la identidad, iniciar el repositorio, preparar archivos y hacer las primeras confirmaciones.',
  directorio: directorioDe(1),
  configuracion: {},
  iniciado: false,
  confirmaciones: [],
  ramas: [],
  etiquetas: [],
  posicion: 'main',
  // Los textos son los que el enunciado le hace escribir en su Parte 3, uno
  // por uno. Aqui estan todos desde el principio, que es la licencia anotada
  // en `sinReflejar`, pero el contenido es el mismo que va a tener en su disco.
  archivos: [
    { nombre: 'README.md', estado: 'sin-seguimiento', contenido: README_RECETARIO },
    { nombre: 'platos.md', estado: 'sin-seguimiento', contenido: PLATOS_CURANTO },
    { nombre: 'ingredientes.md', estado: 'sin-seguimiento', contenido: INGREDIENTES_BASE },
    { nombre: 'cocineros.md', estado: 'sin-seguimiento', contenido: COCINEROS_DOS },
    {
      nombre: 'recetas/pastel-de-choclo.md',
      estado: 'sin-seguimiento',
      contenido: PASTEL_DE_CHOCLO,
    },
    { nombre: 'recetas/empanadas.md', estado: 'sin-seguimiento', contenido: EMPANADAS },
  ],
  remotos: [],
  sinReflejar: [
    'En el disco el participante crea los archivos uno a uno; aqui estan todos desde el principio.',
  ],
};

// ---------------------------------------------------------------------------
// Laboratorio 02 · Leer la historia y abrir la caja
// ---------------------------------------------------------------------------

/** Corresponde a `labs/lab-02/preparar.sh`, confirmacion por confirmacion. */
/** La lista de platos del laboratorio 02: es donde vive la palabra «curanto». */
const PLATOS_LAB02 = PLATOS_CURANTO;

/** Los ingredientes con la albahaca que el cambio descartado se lleva. */
const INGREDIENTES_LAB02 = `# Ingredientes

- choclo
- carne de vacuno
- cebolla
- aji de color
- albahaca
`;

/**
 * El cambio que no sirve, sin preparar: se borro una linea buena y se dejaron
 * dos de basura, de modo que descartarlo tenga sentido a la vista.
 */
const INGREDIENTES_SUCIOS = `# Ingredientes

- choclo
- carne de vacuno
- cebolla
- albahaca
asdf probando
TODO borrar esto antes de confirmar
`;

export const LAB02: EscenarioDeclarado = {
  id: 'lab-02',
  laboratorio: 2,
  sesion: 2,
  titulo: 'Leer la historia y abrir la caja',
  proposito:
    'Filtrar el historial por autor y por archivo, corregir el mensaje, descartar un cambio, sacar un archivo del area de preparacion, y abrir la carpeta oculta para ver que una rama es un archivo de texto.',
  directorio: directorioDe(2),
  configuracion: CONFIGURACION_PUESTA,
  confirmaciones: [
    {
      clave: 'c1',
      mensaje: 'se inicia el recetario',
      archivos: ['README.md'],
      contenido: { 'README.md': README_RECETARIO },
      padres: [],
      carril: 0,
      ...JUANA,
      epoca: cuando(1, 15, 9, 20),
    },
    {
      clave: 'c2',
      mensaje: 'se agregan los platos chilenos',
      archivos: ['platos.md'],
      contenido: { 'platos.md': PLATOS_LAB02 },
      padres: ['c1'],
      carril: 0,
      ...MARCO,
      epoca: cuando(2, 27, 11, 45),
    },
    {
      clave: 'c3',
      mensaje: 'se agregan los ingredientes base',
      archivos: ['ingredientes.md'],
      contenido: { 'ingredientes.md': INGREDIENTES_LAB02 },
      padres: ['c2'],
      carril: 0,
      ...JUANA,
      epoca: cuando(4, 9, 15, 10),
    },
    {
      clave: 'c4',
      mensaje: 'se suma la lista de cocineros',
      archivos: ['cocineros.md'],
      contenido: { 'cocineros.md': COCINEROS_DOS },
      padres: ['c3'],
      carril: 0,
      ...SOFIA,
      epoca: cuando(7, 18, 10, 5),
    },
    {
      clave: 'c5',
      mensaje: 'se docuemnta la reseta del pastel de choclo',
      archivos: ['recetas/pastel-de-choclo.md'],
      contenido: { 'recetas/pastel-de-choclo.md': PASTEL_DE_CHOCLO },
      padres: ['c4'],
      carril: 0,
      ...MARCO,
      epoca: cuando(9, 30, 16, 40),
    },
  ],
  ramas: [{ nombre: 'main', en: 'c5', carril: 0 }],
  etiquetas: [],
  posicion: 'main',
  archivos: [
    { nombre: 'README.md', estado: 'limpio' },
    { nombre: 'platos.md', estado: 'limpio' },
    // El cambio que sobra, que el participante descarta con `git restore`.
    { nombre: 'ingredientes.md', estado: 'modificado', contenido: INGREDIENTES_SUCIOS },
    // Preparado por error, que el participante saca con `git restore --staged`.
    { nombre: 'cocineros.md', estado: 'preparado', contenido: COCINEROS_TRES },
    { nombre: 'recetas/pastel-de-choclo.md', estado: 'limpio' },
  ],
  remotos: [],
};

// ---------------------------------------------------------------------------
// Laboratorio 03 · Ordenar el recetario
// ---------------------------------------------------------------------------

/**
 * Los tres archivos que no deberian estar versionados entran a la historia
 * confirmada, no solo al directorio de trabajo. Esa es la diferencia entre
 * ignorar un archivo y sacarlo del seguimiento, que es el punto del ejercicio.
 * No hay archivo de exclusiones: lo escribe el participante.
 */
/** La lista de platos del laboratorio 03, con los dos postres que se separan. */
const PLATOS_LAB03 = `# Platos

- pastel de choclo
- empanadas de pino
- leche asada
- mote con huesillo
`;

const NOTAS_TMP = `Reunion de cocina del martes.
Pendiente: definir el menu de septiembre.
`;

const RESPALDO_BAK = `Respaldo automatico del listado de platos.
`;

/** La credencial, que es el punto del laboratorio 03. */
const CREDENCIALES = `usuario: casino_recetario
clave: 4lm3ndr4s-2024
servidor: casino.interno.cl
`;

const INGREDIENTES_LAB03 = `# Ingredientes

- choclo
- carne de vacuno
- cebolla
- aji de color
- leche
- huesillos
`;

export const LAB03: EscenarioDeclarado = {
  id: 'lab-03',
  laboratorio: 3,
  sesion: 3,
  titulo: 'Ordenar el recetario',
  proposito:
    'Escribir el archivo de exclusiones y sacar del seguimiento lo que nunca debio entrar, sin perderlo del disco.',
  directorio: directorioDe(3),
  configuracion: CONFIGURACION_PUESTA,
  confirmaciones: [
    {
      clave: 'c1',
      mensaje: 'Agrega el README y la lista de platos',
      archivos: ['README.md', 'platos.md'],
      contenido: {
        'README.md': README_RECETARIO,
        'platos.md': PLATOS_LAB03,
      },
      padres: [],
      carril: 0,
      ...JUANA,
      epoca: cuando(2, 5, 9, 40),
    },
    {
      clave: 'c2',
      mensaje: 'Agrega las cuatro primeras recetas',
      // Dos de fondo y dos de postre: el enunciado las separa en dos carpetas.
      archivos: [
        'recetas/pastel-de-choclo.md',
        'recetas/empanadas.md',
        'recetas/leche-asada.md',
        'recetas/mote-con-huesillo.md',
      ],
      contenido: {
        'recetas/pastel-de-choclo.md': PASTEL_DE_CHOCLO,
        'recetas/empanadas.md': EMPANADAS,
        'recetas/leche-asada.md': LECHE_ASADA,
        'recetas/mote-con-huesillo.md': MOTE_CON_HUESILLO,
      },
      padres: ['c1'],
      carril: 0,
      ...MARCO,
      epoca: cuando(2, 19, 11, 15),
    },
    {
      clave: 'c3',
      mensaje: 'Guarda notas de la reunion de cocina',
      archivos: ['notas.tmp', 'respaldo.bak'],
      contenido: {
        'notas.tmp': NOTAS_TMP,
        'respaldo.bak': RESPALDO_BAK,
      },
      padres: ['c2'],
      carril: 0,
      ...SOFIA,
      epoca: cuando(3, 11, 16, 5),
    },
    {
      clave: 'c4',
      mensaje: 'Agrega el acceso al sistema del casino',
      archivos: ['credenciales.txt'],
      contenido: { 'credenciales.txt': CREDENCIALES },
      padres: ['c3'],
      carril: 0,
      ...SOFIA,
      epoca: cuando(4, 2, 10, 30),
    },
    {
      clave: 'c5',
      mensaje: 'Completa la lista de ingredientes',
      archivos: ['ingredientes.md'],
      contenido: { 'ingredientes.md': INGREDIENTES_LAB03 },
      padres: ['c4'],
      carril: 0,
      ...JUANA,
      epoca: cuando(4, 23, 15, 50),
    },
  ],
  ramas: [{ nombre: 'main', en: 'c5', carril: 0 }],
  etiquetas: [],
  posicion: 'main',
  archivos: limpios(
    'README.md',
    'platos.md',
    'ingredientes.md',
    'recetas/pastel-de-choclo.md',
    'recetas/empanadas.md',
    'recetas/leche-asada.md',
    'recetas/mote-con-huesillo.md',
    // Los tres que sobran, confirmados a proposito.
    'notas.tmp',
    'respaldo.bak',
    'credenciales.txt',
  ),
  remotos: [],
};

// ---------------------------------------------------------------------------
// Laboratorio 04 · Tres cocinas en paralelo
// ---------------------------------------------------------------------------

/**
 * Seis confirmaciones en `main` con puntos de separacion claros: cada una toca
 * un archivo distinto, de modo que las tres ramas que el participante crea
 * puedan nacer de sitios distintos y las diferencias se lean sin ambiguedad.
 */
export const LAB04: EscenarioDeclarado = {
  id: 'lab-04',
  laboratorio: 4,
  sesion: 3,
  titulo: 'Tres cocinas en paralelo',
  proposito: 'Crear ramas, moverse entre ellas y ver que el grafo se abre y se cierra.',
  directorio: directorioDe(4),
  configuracion: CONFIGURACION_PUESTA,
  confirmaciones: [
    {
      clave: 'c1',
      mensaje: 'Agrega el README del recetario',
      archivos: ['README.md'],
      contenido: { 'README.md': README_RECETARIO },
      padres: [],
      carril: 0,
      ...JUANA,
      epoca: cuando(1, 9, 9, 15),
    },
    {
      clave: 'c2',
      mensaje: 'Agrega la lista de platos',
      archivos: ['platos.md'],
      contenido: { 'platos.md': PLATOS_CURANTO },
      padres: ['c1'],
      carril: 0,
      ...MARCO,
      epoca: cuando(1, 23, 10, 40),
    },
    {
      clave: 'c3',
      mensaje: 'Agrega los ingredientes base',
      archivos: ['ingredientes.md'],
      contenido: { 'ingredientes.md': INGREDIENTES_BASE },
      padres: ['c2'],
      carril: 0,
      ...JUANA,
      epoca: cuando(2, 13, 14, 25),
    },
    {
      clave: 'c4',
      mensaje: 'Agrega la receta del pastel de choclo',
      archivos: ['recetas/pastel-de-choclo.md'],
      contenido: { 'recetas/pastel-de-choclo.md': PASTEL_DE_CHOCLO },
      padres: ['c3'],
      carril: 0,
      ...MARCO,
      epoca: cuando(3, 5, 11, 50),
    },
    {
      clave: 'c5',
      mensaje: 'Agrega la receta de la cazuela',
      archivos: ['recetas/cazuela.md'],
      contenido: { 'recetas/cazuela.md': CAZUELA },
      padres: ['c4'],
      carril: 0,
      ...SOFIA,
      epoca: cuando(3, 26, 16, 10),
    },
    {
      clave: 'c6',
      mensaje: 'Agrega la tabla de cocineros',
      archivos: ['cocineros.md'],
      contenido: { 'cocineros.md': COCINEROS_TRES },
      padres: ['c5'],
      carril: 0,
      ...JUANA,
      epoca: cuando(4, 16, 9, 55),
    },
  ],
  ramas: [{ nombre: 'main', en: 'c6', carril: 0 }],
  etiquetas: [],
  posicion: 'main',
  archivos: limpios(
    'README.md',
    'platos.md',
    'ingredientes.md',
    'cocineros.md',
    'recetas/pastel-de-choclo.md',
    'recetas/cazuela.md',
  ),
  remotos: [],
};

// ---------------------------------------------------------------------------
// Laboratorio 05 · Fusionar y resolver
// ---------------------------------------------------------------------------

/**
 * Cuatro ramas con destinos distintos a proposito, una por cada caso de fusion.
 *
 *   tailandesa  nace de la punta de main, que no avanzo despues, de modo que
 *               su fusion es un avance rapido y no crea confirmacion de union.
 *   azteca      nace antes y toca otros archivos: la fusion une sin chocar.
 *   criolla     nace antes y **toca el mismo archivo que main**, en otra
 *               seccion: la fusion une sin chocar igual. Es el caso que
 *               desarma la creencia de que tocar el mismo archivo es conflicto
 *               seguro, y el unico que el simulador no podia mostrar hasta que
 *               la deteccion paso a ser por linea (seccion 54).
 *   andina      toca la misma linea de platos.md que toco main despues, de
 *               modo que su fusion choca.
 *
 * `criolla` y `andina` son deliberadamente parecidas: las dos nacen del mismo
 * punto, las dos cambian `platos.md` y las dos agregan una receta. La unica
 * diferencia es que linea de `platos.md` tocan, y de eso depende todo.
 */
/** La lista de platos por secciones, tal como la deja la segunda confirmacion. */
const PLATOS_SECCIONES = `# Platos

## Fondos

- pastel de choclo
- cazuela
- curanto

## Entradas

- empanadas de pino
`;

/** Lo que main precisa sobre la cazuela: es la linea que despues choca. */
const PLATOS_CHUCHOCA = PLATOS_SECCIONES.replace('- cazuela', '- cazuela con chuchoca');

/** Lo que la rama andina pone en esa misma linea. */
const PLATOS_LOMO = PLATOS_SECCIONES.replace('- cazuela', '- lomo saltado');

/**
 * Lo que la rama criolla le suma, **al final y en la otra seccion**.
 *
 * Es el cuarto caso de fusion del laboratorio 05, y el que desarma la creencia
 * de que tocar el mismo archivo es conflicto seguro: `criolla` y `andina` tocan
 * las dos `platos.md` y las dos agregan una receta, y la unica diferencia es
 * **que linea** cambian. La de criolla queda a cuatro lineas de la que cambio
 * main, con `## Entradas` y la empanada entre medio, asi que la fusion de tres
 * vias las resuelve sola. Comprobado contra Git.
 */
const PLATOS_SOPAIPILLAS = `${PLATOS_SECCIONES}- sopaipillas\n`;

const SOPAIPILLAS_LAB05 = `# Sopaipillas

Masa de zapallo y harina, fritas, con pebre o chancaca.
`;

const GUACAMOLE = `# Guacamole

Palta, cebolla morada, cilantro y limon de pica.
`;

const LOMO_SALTADO = `# Lomo saltado

Lomo en tiras, cebolla, tomate y papas fritas, al wok.
`;

export const LAB05: EscenarioDeclarado = {
  id: 'lab-05',
  laboratorio: 5,
  sesion: 4,
  titulo: 'Fusionar y resolver',
  proposito:
    'Reconocer cual de los cuatro casos de fusion se tiene delante antes de escribir la orden, y saber que hacer cuando choca.',
  directorio: directorioDe(5),
  configuracion: CONFIGURACION_PUESTA,
  confirmaciones: [
    {
      clave: 'c1',
      mensaje: 'Agrega el README del recetario',
      archivos: ['README.md'],
      contenido: { 'README.md': README_RECETARIO },
      padres: [],
      carril: 0,
      ...JUANA,
      epoca: cuando(5, 7, 9, 20),
    },
    {
      clave: 'c2',
      mensaje: 'Agrega la lista de platos',
      archivos: ['platos.md'],
      contenido: { 'platos.md': PLATOS_SECCIONES },
      padres: ['c1'],
      carril: 0,
      ...MARCO,
      epoca: cuando(5, 21, 11, 35),
    },
    {
      clave: 'c3',
      mensaje: 'Agrega los ingredientes base',
      archivos: ['ingredientes.md'],
      contenido: { 'ingredientes.md': INGREDIENTES_BASE },
      padres: ['c2'],
      carril: 0,
      ...JUANA,
      epoca: cuando(6, 11, 15, 45),
    },
    // La punta de main, que toca la linea de la cazuela en platos.md.
    {
      clave: 'c4',
      mensaje: 'Precisa que la cazuela lleva chuchoca',
      archivos: ['platos.md'],
      contenido: { 'platos.md': PLATOS_CHUCHOCA },
      padres: ['c3'],
      carril: 0,
      ...SOFIA,
      epoca: cuando(7, 2, 10, 25),
    },
    // tailandesa cuelga de la punta de main y main no volvio a moverse: su
    // fusion es un avance rapido y no crea confirmacion de union.
    {
      clave: 't1',
      mensaje: 'Agrega la receta del pad thai',
      archivos: ['recetas/pad-thai.md'],
      contenido: { 'recetas/pad-thai.md': PAD_THAI },
      padres: ['c4'],
      carril: 1,
      ...MARCO,
      epoca: cuando(7, 9, 12, 5),
    },
    // azteca nace antes de la punta y toca archivos que main no toco: su
    // fusion crea una confirmacion de union y no choca.
    {
      clave: 'a1',
      mensaje: 'Agrega la receta del guacamole',
      archivos: ['recetas/guacamole.md'],
      contenido: { 'recetas/guacamole.md': GUACAMOLE },
      padres: ['c3'],
      carril: 2,
      ...SOFIA,
      epoca: cuando(7, 16, 9, 50),
    },
    // criolla nace en el mismo punto que andina y toca el mismo archivo, pero
    // en la otra seccion: su fusion es automatica y no choca. Es el caso que
    // desarma la creencia de que tocar el mismo archivo es conflicto seguro.
    {
      clave: 'r1',
      mensaje: 'Suma las sopaipillas a las entradas',
      archivos: ['platos.md', 'recetas/sopaipillas.md'],
      contenido: {
        'platos.md': PLATOS_SOPAIPILLAS,
        'recetas/sopaipillas.md': SOPAIPILLAS_LAB05,
      },
      padres: ['c3'],
      carril: 3,
      ...JUANA,
      epoca: cuando(7, 18, 14, 20),
    },
    // andina nace en el mismo punto y cambia la misma linea de platos.md que
    // cambio main: su fusion choca.
    {
      clave: 'n1',
      mensaje: 'Reemplaza la cazuela por el lomo saltado',
      archivos: ['platos.md', 'recetas/lomo-saltado.md'],
      contenido: {
        'platos.md': PLATOS_LOMO,
        'recetas/lomo-saltado.md': LOMO_SALTADO,
      },
      padres: ['c3'],
      carril: 4,
      ...MARCO,
      epoca: cuando(7, 23, 16, 30),
    },
  ],
  ramas: [
    { nombre: 'main', en: 'c4', carril: 0 },
    { nombre: 'tailandesa', en: 't1', carril: 1 },
    { nombre: 'azteca', en: 'a1', carril: 2 },
    { nombre: 'criolla', en: 'r1', carril: 3 },
    { nombre: 'andina', en: 'n1', carril: 4 },
  ],
  etiquetas: [],
  posicion: 'main',
  archivos: limpios('README.md', 'platos.md', 'ingredientes.md'),
  remotos: [],
};

// ---------------------------------------------------------------------------
// Laboratorio 06 · Retroceder, revertir y etiquetar
// ---------------------------------------------------------------------------

/**
 * Siete confirmaciones. La cuarta introduce un error evidente en la tabla de
 * ingredientes y quedan tres confirmaciones encima. El enunciado la trata como
 * ya publicada, que es lo que hace preferible revertir antes que retroceder.
 */
/** El error que el participante revierte: un ingrediente que no existe. */
const INGREDIENTES_CON_SAL = `# Ingredientes

- choclo
- carne de vacuno
- cebolla
- aji de color
- sal marina en polvo
`;

export const LAB06: EscenarioDeclarado = {
  id: 'lab-06',
  laboratorio: 6,
  sesion: 4,
  titulo: 'Retroceder, revertir y etiquetar',
  proposito:
    'Revertir una confirmacion ya publicada sin reescribir lo que vino despues, y marcar una version con una etiqueta.',
  directorio: directorioDe(6),
  configuracion: CONFIGURACION_PUESTA,
  confirmaciones: [
    {
      clave: 'c1',
      mensaje: 'Agrega el README del recetario',
      archivos: ['README.md'],
      contenido: { 'README.md': README_RECETARIO },
      padres: [],
      carril: 0,
      ...JUANA,
      epoca: cuando(1, 16, 9, 10),
    },
    {
      clave: 'c2',
      mensaje: 'Agrega la lista de platos',
      archivos: ['platos.md'],
      contenido: { 'platos.md': PLATOS_CURANTO },
      padres: ['c1'],
      carril: 0,
      ...MARCO,
      epoca: cuando(2, 6, 11, 20),
    },
    {
      clave: 'c3',
      mensaje: 'Agrega los ingredientes base',
      archivos: ['ingredientes.md'],
      contenido: { 'ingredientes.md': INGREDIENTES_BASE },
      padres: ['c2'],
      carril: 0,
      ...JUANA,
      epoca: cuando(2, 27, 14, 45),
    },
    // El error que el participante va a revertir. El enunciado lo encuentra
    // buscando «sal marina en polvo» por contenido, asi que el mensaje no lo
    // delata a proposito.
    {
      clave: 'c4',
      mensaje: 'Suma un ingrediente a la lista base',
      archivos: ['ingredientes.md'],
      contenido: { 'ingredientes.md': INGREDIENTES_CON_SAL },
      padres: ['c3'],
      carril: 0,
      ...SOFIA,
      epoca: cuando(3, 19, 10, 5),
    },
    {
      clave: 'c5',
      mensaje: 'Agrega la receta del pastel de choclo',
      archivos: ['recetas/pastel-de-choclo.md'],
      contenido: { 'recetas/pastel-de-choclo.md': PASTEL_DE_CHOCLO },
      padres: ['c4'],
      carril: 0,
      ...MARCO,
      epoca: cuando(4, 9, 15, 30),
    },
    {
      clave: 'c6',
      mensaje: 'Agrega la receta de la cazuela',
      archivos: ['recetas/cazuela.md'],
      contenido: { 'recetas/cazuela.md': CAZUELA },
      padres: ['c5'],
      carril: 0,
      ...MARCO,
      epoca: cuando(4, 30, 9, 40),
    },
    {
      clave: 'c7',
      mensaje: 'Agrega la tabla de cocineros',
      archivos: ['cocineros.md'],
      contenido: { 'cocineros.md': COCINEROS_TRES },
      padres: ['c6'],
      carril: 0,
      ...JUANA,
      epoca: cuando(5, 21, 16, 15),
    },
  ],
  ramas: [{ nombre: 'main', en: 'c7', carril: 0 }],
  etiquetas: [],
  posicion: 'main',
  archivos: limpios(
    'README.md',
    'platos.md',
    'ingredientes.md',
    'cocineros.md',
    'recetas/pastel-de-choclo.md',
    'recetas/cazuela.md',
  ),
  remotos: [],
};

// ---------------------------------------------------------------------------
// Laboratorio 07 · Interrumpir y limpiar la historia
// ---------------------------------------------------------------------------

/**
 * La rama `trabajo` lleva cuatro confirmaciones con mensajes que no dicen nada,
 * y `main` avanzo dos por su cuenta. El participante arranca parado en ella,
 * con una receta ya versionada y reescrita a medias encima.
 *
 * **Se llama `trabajo` porque asi la nombra el enunciado.** La descripcion de
 * la semilla del SPEC 003 la llamaba `tailandesa` y la declaracion la habia
 * seguido; el enunciado, que es el contrato, nunca dijo eso.
 */
const INGREDIENTES_LAB07 = INGREDIENTES_BASE;

/** La lista de platos antes de que la rama de trabajo la toque. */
const PLATOS_LAB07 = PLATOS_CURANTO;

/** Lo que la rama tailandesa le agrega a la lista. */
const PLATOS_TAILANDESES = `# Platos

- pastel de choclo
- empanadas de pino
- cazuela
- curanto
- pad thai
`;

/** El pad thai a medio escribir, tal como lo dejo la primera confirmacion. */
const PAD_THAI_BORRADOR = `# Pad thai

Fideos de arroz y salsa de pescado.
`;

const CURRY_VERDE = `# Curry verde

Pasta verde, leche de coco, albahaca tailandesa y berenjena.
`;

/**
 * El curry massaman **confirmado**, tal como quedo en la rama de trabajo.
 *
 * El laboratorio 07 arranca con esta receta a medio reescribir encima, y eso
 * pide que el archivo este en seguimiento: `git stash` sin `-u` no toca lo que
 * nunca entro, y con la receta sin seguimiento la Parte 1 entera se quedaba sin
 * materia. Comprobado contra Git.
 */
const CURRY_MASSAMAN = `# Curry massaman

Pasta massaman, leche de coco, papa y mani tostado.
`;

/** Lo que el participante tenia a medio escribir cuando lo interrumpieron. */
const CURRY_MASSAMAN_A_MEDIAS = `# Curry massaman

Pasta massaman, leche de coco, papa y mani tostado.
Tiempo de preparacion:
Se sofrie la pasta, se agrega la leche de coco y
`;

export const LAB07: EscenarioDeclarado = {
  id: 'lab-07',
  laboratorio: 7,
  sesion: 5,
  titulo: 'Interrumpir y limpiar la historia',
  proposito:
    'Guardar el trabajo a medias, reordenar la rama sobre main y dejar una historia que se pueda leer.',
  directorio: directorioDe(7),
  configuracion: CONFIGURACION_PUESTA,
  confirmaciones: [
    {
      clave: 'c1',
      mensaje: 'Agrega el README del recetario',
      archivos: ['README.md'],
      contenido: { 'README.md': README_RECETARIO },
      padres: [],
      carril: 0,
      ...JUANA,
      epoca: cuando(6, 4, 9, 25),
    },
    {
      clave: 'c2',
      mensaje: 'Agrega platos e ingredientes',
      archivos: ['platos.md', 'ingredientes.md'],
      contenido: {
        'platos.md': PLATOS_LAB07,
        'ingredientes.md': INGREDIENTES_LAB07,
      },
      padres: ['c1'],
      carril: 0,
      ...MARCO,
      epoca: cuando(6, 18, 11, 10),
    },
    // Lo que main avanzo mientras la rama de trabajo iba por su lado.
    {
      clave: 'c3',
      mensaje: 'Agrega la receta del pastel de choclo',
      archivos: ['recetas/pastel-de-choclo.md'],
      contenido: { 'recetas/pastel-de-choclo.md': PASTEL_DE_CHOCLO },
      padres: ['c2'],
      carril: 0,
      ...MARCO,
      epoca: cuando(7, 9, 15, 20),
    },
    {
      clave: 'c4',
      mensaje: 'Agrega la tabla de cocineros',
      archivos: ['cocineros.md'],
      contenido: { 'cocineros.md': COCINEROS_TRES },
      padres: ['c3'],
      carril: 0,
      ...JUANA,
      epoca: cuando(7, 30, 10, 45),
    },
    // La rama de trabajo, con los mensajes que hay que arreglar.
    {
      clave: 't1',
      mensaje: 'wip',
      archivos: ['recetas/pad-thai.md'],
      contenido: { 'recetas/pad-thai.md': PAD_THAI_BORRADOR },
      padres: ['c2'],
      carril: 1,
      epoca: cuando(6, 25, 17, 5),
    },
    {
      clave: 't2',
      mensaje: 'cambios',
      archivos: ['recetas/pad-thai.md'],
      contenido: { 'recetas/pad-thai.md': PAD_THAI },
      padres: ['t1'],
      carril: 1,
      epoca: cuando(6, 26, 9, 30),
    },
    {
      clave: 't3',
      mensaje: 'mas cambios',
      archivos: ['platos.md'],
      contenido: { 'platos.md': PLATOS_TAILANDESES },
      padres: ['t2'],
      carril: 1,
      epoca: cuando(6, 27, 14, 50),
    },
    {
      clave: 't4',
      mensaje: 'arreglos',
      archivos: ['recetas/curry-verde.md', 'recetas/curry-massaman.md'],
      contenido: {
        'recetas/curry-verde.md': CURRY_VERDE,
        'recetas/curry-massaman.md': CURRY_MASSAMAN,
      },
      padres: ['t3'],
      carril: 1,
      epoca: cuando(7, 2, 16, 40),
    },
  ],
  ramas: [
    { nombre: 'main', en: 'c4', carril: 0 },
    { nombre: 'trabajo', en: 't4', carril: 1 },
  ],
  etiquetas: [],
  posicion: 'trabajo',
  archivos: [
    ...limpios(
      'README.md',
      'platos.md',
      'ingredientes.md',
      'recetas/pad-thai.md',
      'recetas/curry-verde.md',
    ),
    // Lo que el participante tenia a medias cuando lo interrumpieron: la receta
    // **ya versionada** y reescrita a medias encima. Tiene que estar en
    // seguimiento para que `git stash` se la lleve (punto 1.3 del enunciado).
    {
      nombre: 'recetas/curry-massaman.md',
      estado: 'modificado',
      contenido: CURRY_MASSAMAN_A_MEDIAS,
    },
  ],
  remotos: [],
};

// ---------------------------------------------------------------------------
// Laboratorio 08 · no lleva escenario
// ---------------------------------------------------------------------------
//
// Se saco del simulador a proposito. Lo que ese laboratorio enseña son dos
// remotos y un gancho, y el motor no implementa ninguna de las dos cosas: no
// tiene ramas de seguimiento remoto, ni ordenes de red, ni ejecuta ganchos. Un escenario suyo mostraria la historia
// local y nada de lo que el laboratorio viene a enseñar.
//
// Es de terminal pura, como el 08 en su parte avanzada. El detalle esta en la
// seccion 24 de docs/arquitectura.md.

// ---------------------------------------------------------------------------
// Laboratorio 09 · Conectar y publicar
// ---------------------------------------------------------------------------

/** Ocho confirmaciones, archivo de exclusiones ya escrito y una version etiquetada. */
const CHARQUICAN = `# Charquican

Zapallo, papa, choclo y charqui deshilachado, con huevo frito encima.
`;

const SOPAIPILLAS = `# Sopaipillas

Masa de zapallo y harina, fritas, con pebre o chancaca.
`;

/** Los platos ya completos, con entradas y postres. */
const PLATOS_COMPLETOS = `# Platos

## Fondos

- pastel de choclo
- cazuela
- charquican

## Entradas

- empanadas de pino
- sopaipillas
`;

const INGREDIENTES_COMPLETOS = `# Ingredientes

- choclo
- carne de vacuno
- cebolla
- aji de color
- zapallo
- harina
`;

/** El archivo de exclusiones que el laboratorio 09 trae ya confirmado. */
const EXCLUSIONES_LAB09 = `*.tmp
*.bak
credenciales.txt
`;

export const LAB09: EscenarioDeclarado = {
  id: 'lab-09',
  laboratorio: 9,
  sesion: 6,
  titulo: 'Conectar y publicar',
  proposito:
    'Conectar el repositorio local con GitLab y publicar la historia completa, con su etiqueta de version.',
  directorio: directorioDe(9),
  configuracion: CONFIGURACION_PUESTA,
  confirmaciones: [
    {
      clave: 'c1',
      mensaje: 'Agrega el README del recetario',
      archivos: ['README.md'],
      contenido: { 'README.md': README_RECETARIO },
      padres: [],
      carril: 0,
      ...JUANA,
      epoca: cuando(1, 8, 9, 5),
    },
    {
      clave: 'c2',
      mensaje: 'Agrega la lista de platos',
      archivos: ['platos.md'],
      contenido: { 'platos.md': PLATOS_CURANTO },
      padres: ['c1'],
      carril: 0,
      ...MARCO,
      epoca: cuando(1, 22, 10, 50),
    },
    {
      clave: 'c3',
      mensaje: 'Agrega los ingredientes base',
      archivos: ['ingredientes.md'],
      contenido: { 'ingredientes.md': INGREDIENTES_BASE },
      padres: ['c2'],
      carril: 0,
      ...JUANA,
      epoca: cuando(2, 12, 14, 10),
    },
    {
      clave: 'c4',
      mensaje: 'Agrega las dos primeras recetas',
      archivos: ['recetas/pastel-de-choclo.md', 'recetas/empanadas.md'],
      contenido: {
        'recetas/pastel-de-choclo.md': PASTEL_DE_CHOCLO,
        'recetas/empanadas.md': EMPANADAS,
      },
      padres: ['c3'],
      carril: 0,
      ...MARCO,
      epoca: cuando(3, 4, 11, 35),
    },
    {
      clave: 'c5',
      mensaje: 'Agrega la cazuela y el charquican',
      archivos: ['recetas/cazuela.md', 'recetas/charquican.md'],
      contenido: {
        'recetas/cazuela.md': CAZUELA,
        'recetas/charquican.md': CHARQUICAN,
      },
      padres: ['c4'],
      carril: 0,
      ...SOFIA,
      epoca: cuando(3, 25, 16, 0),
    },
    {
      clave: 'c6',
      mensaje: 'Completa el listado con entradas y postres',
      archivos: ['recetas/sopaipillas.md', 'platos.md', 'ingredientes.md'],
      contenido: {
        'recetas/sopaipillas.md': SOPAIPILLAS,
        'platos.md': PLATOS_COMPLETOS,
        'ingredientes.md': INGREDIENTES_COMPLETOS,
      },
      padres: ['c5'],
      carril: 0,
      ...SOFIA,
      epoca: cuando(4, 15, 9, 45),
    },
    {
      clave: 'c7',
      mensaje: 'Actualiza la tabla de cocineros',
      archivos: ['cocineros.md'],
      contenido: { 'cocineros.md': COCINEROS_TRES },
      padres: ['c6'],
      carril: 0,
      ...JUANA,
      epoca: cuando(5, 6, 15, 25),
    },
    {
      clave: 'c8',
      mensaje: 'Agrega el archivo de exclusiones',
      archivos: ['.gitignore'],
      contenido: { '.gitignore': EXCLUSIONES_LAB09 },
      padres: ['c7'],
      carril: 0,
      ...MARCO,
      epoca: cuando(5, 27, 10, 15),
    },
  ],
  ramas: [{ nombre: 'main', en: 'c8', carril: 0 }],
  etiquetas: [
    { nombre: 'v1.0', en: 'c8', tipo: 'anotada', mensaje: 'Primera version completa del recetario' },
  ],
  posicion: 'main',
  archivos: limpios(
    '.gitignore',
    'README.md',
    'platos.md',
    'ingredientes.md',
    'cocineros.md',
    'recetas/pastel-de-choclo.md',
    'recetas/empanadas.md',
    'recetas/cazuela.md',
    'recetas/charquican.md',
    'recetas/sopaipillas.md',
  ),
  remotos: [],
};

/** Los escenarios en el orden del taller. */
export const ESCENARIOS: readonly EscenarioDeclarado[] = [
  LAB01,
  LAB02,
  LAB03,
  LAB04,
  LAB05,
  LAB06,
  LAB07,
  LAB09,
];
