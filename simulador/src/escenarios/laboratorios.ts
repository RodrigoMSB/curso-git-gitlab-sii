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

import type { Archivo } from '../core/tipos';
import type { EscenarioDeclarado } from './tipos';

/** Donde vive el repositorio del participante, que es una carpeta por laboratorio. */
const directorioDe = (laboratorio: number): string =>
  `/taller-git-trabajo/lab-${String(laboratorio).padStart(2, '0')}/recetario`;

/** Instante de 2024 en la zona de Chile continental, en segundos desde la epoca. */
const cuando = (mes: number, dia: number, hora: number, minuto: number): number =>
  Date.UTC(2024, mes - 1, dia, hora + 3, minuto) / 1000;

const JUANA = { autor: 'Juana Perez', correo: 'juana.perez@recetario.cl' } as const;
const MARCO = { autor: 'Marco Diaz', correo: 'marco.diaz@recetario.cl' } as const;
const SOFIA = { autor: 'Sofia Rojas', correo: 'sofia.rojas@recetario.cl' } as const;

const CONFIGURACION_PUESTA = {
  'user.name': 'Participante del taller',
  'user.email': 'participante@sii.cl',
} as const;

/** Archivos limpios, que es el caso corriente. */
const limpios = (...nombres: readonly string[]): readonly Archivo[] =>
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
  archivos: [
    { nombre: 'README.md', estado: 'sin-seguimiento' },
    { nombre: 'platos.md', estado: 'sin-seguimiento' },
    { nombre: 'ingredientes.md', estado: 'sin-seguimiento' },
    { nombre: 'cocineros.md', estado: 'sin-seguimiento' },
    { nombre: 'recetas/pastel-de-choclo.md', estado: 'sin-seguimiento' },
    { nombre: 'recetas/empanadas.md', estado: 'sin-seguimiento' },
  ],
  remotos: [],
  sinReflejar: [
    'En el disco el participante crea los archivos uno a uno; aqui estan todos desde el principio.',
  ],
};

// ---------------------------------------------------------------------------
// Laboratorio 02 · Leer la historia y volver atras
// ---------------------------------------------------------------------------

/** Corresponde a `labs/lab-02/preparar.sh`, confirmacion por confirmacion. */
export const LAB02: EscenarioDeclarado = {
  id: 'lab-02',
  laboratorio: 2,
  sesion: 2,
  titulo: 'Leer la historia y volver atras',
  proposito:
    'Filtrar el historial por autor, por fecha y por contenido, y despues corregir el mensaje, descartar un cambio y sacar un archivo del area de preparacion.',
  directorio: directorioDe(2),
  configuracion: CONFIGURACION_PUESTA,
  confirmaciones: [
    {
      clave: 'c1',
      mensaje: 'se inicia el recetario',
      archivos: ['README.md'],
      padres: [],
      carril: 0,
      ...JUANA,
      epoca: cuando(1, 15, 9, 20),
    },
    {
      clave: 'c2',
      mensaje: 'se agregan los platos chilenos',
      archivos: ['platos.md'],
      padres: ['c1'],
      carril: 0,
      ...MARCO,
      epoca: cuando(2, 27, 11, 45),
    },
    {
      clave: 'c3',
      mensaje: 'se agregan los ingredientes base',
      archivos: ['ingredientes.md'],
      padres: ['c2'],
      carril: 0,
      ...JUANA,
      epoca: cuando(4, 9, 15, 10),
    },
    {
      clave: 'c4',
      mensaje: 'se suma la lista de cocineros',
      archivos: ['cocineros.md'],
      padres: ['c3'],
      carril: 0,
      ...SOFIA,
      epoca: cuando(7, 18, 10, 5),
    },
    {
      clave: 'c5',
      mensaje: 'se docuemnta la reseta del pastel de choclo',
      archivos: ['recetas/pastel-de-choclo.md'],
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
    { nombre: 'ingredientes.md', estado: 'modificado' },
    // Preparado por error, que el participante saca con `git restore --staged`.
    { nombre: 'cocineros.md', estado: 'preparado' },
    { nombre: 'recetas/pastel-de-choclo.md', estado: 'limpio' },
  ],
  remotos: [],
};

// ---------------------------------------------------------------------------
// Laboratorio 03 · Abrir la caja
// ---------------------------------------------------------------------------

/** Corresponde a `labs/lab-03/preparar.sh`. Historia corta y limpia. */
export const LAB03: EscenarioDeclarado = {
  id: 'lab-03',
  laboratorio: 3,
  sesion: 2,
  titulo: 'Abrir la caja',
  proposito:
    'Mirar por dentro la carpeta .git: donde vive una rama, que hay en una confirmacion y como se encadenan los objetos.',
  directorio: directorioDe(3),
  configuracion: CONFIGURACION_PUESTA,
  confirmaciones: [
    {
      clave: 'c1',
      mensaje: 'se inicia el recetario',
      archivos: ['README.md'],
      padres: [],
      carril: 0,
      ...JUANA,
      epoca: cuando(3, 5, 9, 30),
    },
    {
      clave: 'c2',
      mensaje: 'se agregan los platos chilenos',
      archivos: ['platos.md'],
      padres: ['c1'],
      carril: 0,
      ...MARCO,
      epoca: cuando(5, 21, 14, 15),
    },
    {
      clave: 'c3',
      mensaje: 'se agregan los ingredientes y los cocineros',
      archivos: ['ingredientes.md', 'cocineros.md'],
      padres: ['c2'],
      carril: 0,
      ...JUANA,
      epoca: cuando(8, 13, 11, 0),
    },
    {
      clave: 'c4',
      mensaje: 'se documentan las dos primeras recetas',
      archivos: ['recetas/pastel-de-choclo.md', 'recetas/empanadas.md'],
      padres: ['c3'],
      carril: 0,
      ...MARCO,
      epoca: cuando(11, 6, 16, 20),
    },
  ],
  ramas: [{ nombre: 'main', en: 'c4', carril: 0 }],
  etiquetas: [],
  posicion: 'main',
  archivos: limpios(
    'README.md',
    'platos.md',
    'ingredientes.md',
    'cocineros.md',
    'recetas/pastel-de-choclo.md',
    'recetas/empanadas.md',
  ),
  remotos: [],
};

// ---------------------------------------------------------------------------
// Laboratorio 04 · Ordenar el recetario
// ---------------------------------------------------------------------------

/**
 * Los tres archivos que no deberian estar versionados entran a la historia
 * confirmada, no solo al directorio de trabajo. Esa es la diferencia entre
 * ignorar un archivo y sacarlo del seguimiento, que es el punto del ejercicio.
 * No hay archivo de exclusiones: lo escribe el participante.
 */
export const LAB04: EscenarioDeclarado = {
  id: 'lab-04',
  laboratorio: 4,
  sesion: 3,
  titulo: 'Ordenar el recetario',
  proposito:
    'Escribir el archivo de exclusiones y sacar del seguimiento lo que nunca debio entrar, sin perderlo del disco.',
  directorio: directorioDe(4),
  configuracion: CONFIGURACION_PUESTA,
  confirmaciones: [
    {
      clave: 'c1',
      mensaje: 'Agrega el README y la lista de platos',
      archivos: ['README.md', 'platos.md'],
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
      padres: ['c1'],
      carril: 0,
      ...MARCO,
      epoca: cuando(2, 19, 11, 15),
    },
    {
      clave: 'c3',
      mensaje: 'Guarda notas de la reunion de cocina',
      archivos: ['notas.tmp', 'respaldo.bak'],
      padres: ['c2'],
      carril: 0,
      ...SOFIA,
      epoca: cuando(3, 11, 16, 5),
    },
    {
      clave: 'c4',
      mensaje: 'Agrega el acceso al sistema del casino',
      archivos: ['credenciales.txt'],
      padres: ['c3'],
      carril: 0,
      ...SOFIA,
      epoca: cuando(4, 2, 10, 30),
    },
    {
      clave: 'c5',
      mensaje: 'Completa la lista de ingredientes',
      archivos: ['ingredientes.md'],
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
// Laboratorio 05 · Tres cocinas en paralelo
// ---------------------------------------------------------------------------

/**
 * Seis confirmaciones en `main` con puntos de separacion claros: cada una toca
 * un archivo distinto, de modo que las tres ramas que el participante crea
 * puedan nacer de sitios distintos y las diferencias se lean sin ambiguedad.
 */
export const LAB05: EscenarioDeclarado = {
  id: 'lab-05',
  laboratorio: 5,
  sesion: 3,
  titulo: 'Tres cocinas en paralelo',
  proposito: 'Crear ramas, moverse entre ellas y ver que el grafo se abre y se cierra.',
  directorio: directorioDe(5),
  configuracion: CONFIGURACION_PUESTA,
  confirmaciones: [
    {
      clave: 'c1',
      mensaje: 'Agrega el README del recetario',
      archivos: ['README.md'],
      padres: [],
      carril: 0,
      ...JUANA,
      epoca: cuando(1, 9, 9, 15),
    },
    {
      clave: 'c2',
      mensaje: 'Agrega la lista de platos',
      archivos: ['platos.md'],
      padres: ['c1'],
      carril: 0,
      ...MARCO,
      epoca: cuando(1, 23, 10, 40),
    },
    {
      clave: 'c3',
      mensaje: 'Agrega los ingredientes base',
      archivos: ['ingredientes.md'],
      padres: ['c2'],
      carril: 0,
      ...JUANA,
      epoca: cuando(2, 13, 14, 25),
    },
    {
      clave: 'c4',
      mensaje: 'Agrega la receta del pastel de choclo',
      archivos: ['recetas/pastel-de-choclo.md'],
      padres: ['c3'],
      carril: 0,
      ...MARCO,
      epoca: cuando(3, 5, 11, 50),
    },
    {
      clave: 'c5',
      mensaje: 'Agrega la receta de la cazuela',
      archivos: ['recetas/cazuela.md'],
      padres: ['c4'],
      carril: 0,
      ...SOFIA,
      epoca: cuando(3, 26, 16, 10),
    },
    {
      clave: 'c6',
      mensaje: 'Agrega la tabla de cocineros',
      archivos: ['cocineros.md'],
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
// Laboratorio 06 · Fusionar y resolver
// ---------------------------------------------------------------------------

/**
 * Dos ramas con destinos distintos a proposito.
 *
 *   mexicana  nace de la punta de main, que no avanzo despues, de modo que su
 *             fusion es un avance rapido y no crea confirmacion de union.
 *   peruana   nace una confirmacion antes y toca la misma linea de platos.md
 *             que toco main despues, de modo que su fusion choca.
 */
export const LAB06: EscenarioDeclarado = {
  id: 'lab-06',
  laboratorio: 6,
  sesion: 4,
  titulo: 'Fusionar y resolver',
  proposito:
    'Reconocer cual de los tres casos de fusion se tiene delante antes de escribir la orden, y saber que hacer cuando choca.',
  directorio: directorioDe(6),
  configuracion: CONFIGURACION_PUESTA,
  confirmaciones: [
    {
      clave: 'c1',
      mensaje: 'Agrega el README del recetario',
      archivos: ['README.md'],
      padres: [],
      carril: 0,
      ...JUANA,
      epoca: cuando(5, 7, 9, 20),
    },
    {
      clave: 'c2',
      mensaje: 'Agrega la lista de platos',
      archivos: ['platos.md'],
      padres: ['c1'],
      carril: 0,
      ...MARCO,
      epoca: cuando(5, 21, 11, 35),
    },
    {
      clave: 'c3',
      mensaje: 'Agrega los ingredientes base',
      archivos: ['ingredientes.md'],
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
      padres: ['c3'],
      carril: 2,
      ...SOFIA,
      epoca: cuando(7, 16, 9, 50),
    },
    // andina nace en el mismo punto y cambia la misma linea de platos.md que
    // cambio main: su fusion choca.
    {
      clave: 'n1',
      mensaje: 'Reemplaza la cazuela por el lomo saltado',
      archivos: ['platos.md', 'recetas/lomo-saltado.md'],
      padres: ['c3'],
      carril: 3,
      ...MARCO,
      epoca: cuando(7, 23, 16, 30),
    },
  ],
  ramas: [
    { nombre: 'main', en: 'c4', carril: 0 },
    { nombre: 'tailandesa', en: 't1', carril: 1 },
    { nombre: 'azteca', en: 'a1', carril: 2 },
    { nombre: 'andina', en: 'n1', carril: 3 },
  ],
  etiquetas: [],
  posicion: 'main',
  archivos: limpios('README.md', 'platos.md', 'ingredientes.md'),
  remotos: [],
};

// ---------------------------------------------------------------------------
// Laboratorio 07 · Retroceder, revertir y etiquetar
// ---------------------------------------------------------------------------

/**
 * Siete confirmaciones. La cuarta introduce un error evidente en la tabla de
 * ingredientes y quedan tres confirmaciones encima. El enunciado la trata como
 * ya publicada, que es lo que hace preferible revertir antes que retroceder.
 */
export const LAB07: EscenarioDeclarado = {
  id: 'lab-07',
  laboratorio: 7,
  sesion: 5,
  titulo: 'Retroceder, revertir y etiquetar',
  proposito:
    'Revertir una confirmacion ya publicada sin reescribir lo que vino despues, y marcar una version con una etiqueta.',
  directorio: directorioDe(7),
  configuracion: CONFIGURACION_PUESTA,
  confirmaciones: [
    {
      clave: 'c1',
      mensaje: 'Agrega el README del recetario',
      archivos: ['README.md'],
      padres: [],
      carril: 0,
      ...JUANA,
      epoca: cuando(1, 16, 9, 10),
    },
    {
      clave: 'c2',
      mensaje: 'Agrega la lista de platos',
      archivos: ['platos.md'],
      padres: ['c1'],
      carril: 0,
      ...MARCO,
      epoca: cuando(2, 6, 11, 20),
    },
    {
      clave: 'c3',
      mensaje: 'Agrega los ingredientes base',
      archivos: ['ingredientes.md'],
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
      padres: ['c3'],
      carril: 0,
      ...SOFIA,
      epoca: cuando(3, 19, 10, 5),
    },
    {
      clave: 'c5',
      mensaje: 'Agrega la receta del pastel de choclo',
      archivos: ['recetas/pastel-de-choclo.md'],
      padres: ['c4'],
      carril: 0,
      ...MARCO,
      epoca: cuando(4, 9, 15, 30),
    },
    {
      clave: 'c6',
      mensaje: 'Agrega la receta de la cazuela',
      archivos: ['recetas/cazuela.md'],
      padres: ['c5'],
      carril: 0,
      ...MARCO,
      epoca: cuando(4, 30, 9, 40),
    },
    {
      clave: 'c7',
      mensaje: 'Agrega la tabla de cocineros',
      archivos: ['cocineros.md'],
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
// Laboratorio 08 · Interrumpir y limpiar la historia
// ---------------------------------------------------------------------------

/**
 * La rama `tailandesa` lleva cuatro confirmaciones con mensajes que no dicen
 * nada, y `main` avanzo dos por su cuenta. El participante arranca parado en la
 * rama de trabajo, con un archivo sin seguimiento encima.
 */
export const LAB08: EscenarioDeclarado = {
  id: 'lab-08',
  laboratorio: 8,
  sesion: 5,
  titulo: 'Interrumpir y limpiar la historia',
  proposito:
    'Guardar el trabajo a medias, reordenar la rama sobre main y dejar una historia que se pueda leer.',
  directorio: directorioDe(8),
  configuracion: CONFIGURACION_PUESTA,
  confirmaciones: [
    {
      clave: 'c1',
      mensaje: 'Agrega el README del recetario',
      archivos: ['README.md'],
      padres: [],
      carril: 0,
      ...JUANA,
      epoca: cuando(6, 4, 9, 25),
    },
    {
      clave: 'c2',
      mensaje: 'Agrega platos e ingredientes',
      archivos: ['platos.md', 'ingredientes.md'],
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
      padres: ['c2'],
      carril: 0,
      ...MARCO,
      epoca: cuando(7, 9, 15, 20),
    },
    {
      clave: 'c4',
      mensaje: 'Agrega la tabla de cocineros',
      archivos: ['cocineros.md'],
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
      padres: ['c2'],
      carril: 1,
      epoca: cuando(6, 25, 17, 5),
    },
    {
      clave: 't2',
      mensaje: 'cambios',
      archivos: ['recetas/pad-thai.md'],
      padres: ['t1'],
      carril: 1,
      epoca: cuando(6, 26, 9, 30),
    },
    {
      clave: 't3',
      mensaje: 'mas cambios',
      archivos: ['platos.md'],
      padres: ['t2'],
      carril: 1,
      epoca: cuando(6, 27, 14, 50),
    },
    {
      clave: 't4',
      mensaje: 'arreglos',
      archivos: ['recetas/curry-verde.md'],
      padres: ['t3'],
      carril: 1,
      epoca: cuando(7, 2, 16, 40),
    },
  ],
  ramas: [
    { nombre: 'main', en: 'c4', carril: 0 },
    { nombre: 'tailandesa', en: 't4', carril: 1 },
  ],
  etiquetas: [],
  posicion: 'tailandesa',
  archivos: [
    ...limpios(
      'README.md',
      'platos.md',
      'ingredientes.md',
      'recetas/pad-thai.md',
      'recetas/curry-verde.md',
    ),
    // Lo que el participante tenia a medias cuando lo interrumpieron.
    { nombre: 'recetas/curry-massaman.md', estado: 'sin-seguimiento' },
  ],
  remotos: [],
};

// ---------------------------------------------------------------------------
// Laboratorio 09 · no lleva escenario
// ---------------------------------------------------------------------------
//
// Se saco del simulador a proposito. Lo que ese laboratorio enseña son dos
// remotos, un submodulo y un gancho, y el motor no implementa ninguna de las
// tres cosas: no tiene ramas de seguimiento remoto, ni ordenes de red, ni
// submodulos, ni ejecuta ganchos. Un escenario suyo mostraria la historia
// local y nada de lo que el laboratorio viene a enseñar.
//
// Es de terminal pura, como el 08 en su parte avanzada. El detalle esta en la
// seccion 24 de docs/arquitectura.md.

// ---------------------------------------------------------------------------
// Laboratorio 10 · Conectar y publicar
// ---------------------------------------------------------------------------

/** Ocho confirmaciones, archivo de exclusiones ya escrito y una version etiquetada. */
export const LAB10: EscenarioDeclarado = {
  id: 'lab-10',
  laboratorio: 10,
  sesion: 6,
  titulo: 'Conectar y publicar',
  proposito:
    'Conectar el repositorio local con GitLab y publicar la historia completa, con su etiqueta de version.',
  directorio: directorioDe(10),
  configuracion: CONFIGURACION_PUESTA,
  confirmaciones: [
    {
      clave: 'c1',
      mensaje: 'Agrega el README del recetario',
      archivos: ['README.md'],
      padres: [],
      carril: 0,
      ...JUANA,
      epoca: cuando(1, 8, 9, 5),
    },
    {
      clave: 'c2',
      mensaje: 'Agrega la lista de platos',
      archivos: ['platos.md'],
      padres: ['c1'],
      carril: 0,
      ...MARCO,
      epoca: cuando(1, 22, 10, 50),
    },
    {
      clave: 'c3',
      mensaje: 'Agrega los ingredientes base',
      archivos: ['ingredientes.md'],
      padres: ['c2'],
      carril: 0,
      ...JUANA,
      epoca: cuando(2, 12, 14, 10),
    },
    {
      clave: 'c4',
      mensaje: 'Agrega las dos primeras recetas',
      archivos: ['recetas/pastel-de-choclo.md', 'recetas/empanadas.md'],
      padres: ['c3'],
      carril: 0,
      ...MARCO,
      epoca: cuando(3, 4, 11, 35),
    },
    {
      clave: 'c5',
      mensaje: 'Agrega la cazuela y el charquican',
      archivos: ['recetas/cazuela.md', 'recetas/charquican.md'],
      padres: ['c4'],
      carril: 0,
      ...SOFIA,
      epoca: cuando(3, 25, 16, 0),
    },
    {
      clave: 'c6',
      mensaje: 'Completa el listado con entradas y postres',
      archivos: ['recetas/sopaipillas.md', 'platos.md', 'ingredientes.md'],
      padres: ['c5'],
      carril: 0,
      ...SOFIA,
      epoca: cuando(4, 15, 9, 45),
    },
    {
      clave: 'c7',
      mensaje: 'Actualiza la tabla de cocineros',
      archivos: ['cocineros.md'],
      padres: ['c6'],
      carril: 0,
      ...JUANA,
      epoca: cuando(5, 6, 15, 25),
    },
    {
      clave: 'c8',
      mensaje: 'Agrega el archivo de exclusiones',
      archivos: ['.gitignore'],
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
  LAB08,
  LAB10,
];
