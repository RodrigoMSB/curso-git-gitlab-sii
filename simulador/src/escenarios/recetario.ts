/**
 * Los cuatro escenarios del recetario COMIDA CHILENA, uno por cada una de las
 * primeras cuatro sesiones del taller.
 *
 * Todos comparten el mismo caso para que el participante no tenga que aprender
 * un dominio nuevo en cada sesion.
 */

import type { Archivo } from '../core/tipos';
import type { EscenarioDeclarado } from './tipos';

const DIRECTORIO = '/home/participante/recetario';

const CONFIGURACION_PUESTA = {
  'user.name': 'Participante del taller',
  'user.email': 'participante@sii.cl',
} as const;

/** Archivos del recetario que ya estan bajo seguimiento. */
const SEGUIDOS: readonly Archivo[] = [
  { nombre: 'README.md', estado: 'limpio' },
  { nombre: 'platos.md', estado: 'limpio' },
  { nombre: 'ingredientes.md', estado: 'limpio' },
  { nombre: 'cocineros.md', estado: 'limpio' },
  { nombre: 'recetas/pastel-de-choclo.md', estado: 'limpio' },
  { nombre: 'recetas/empanadas.md', estado: 'limpio' },
];

/** Basura que la sesion 3 usa para introducir el archivo de exclusiones. */
const ESTORBOS: readonly Archivo[] = [
  { nombre: 'notas.tmp', estado: 'sin-seguimiento' },
  { nombre: 'respaldo.bak', estado: 'sin-seguimiento' },
  { nombre: 'credenciales.txt', estado: 'sin-seguimiento' },
];

/** Tronco comun de las sesiones 2, 3 y 4: las tres primeras confirmaciones de `main`. */
const TRONCO = [
  {
    clave: 'c1',
    mensaje: 'Agrega el README del recetario',
    archivos: ['README.md'],
    padres: [],
    carril: 0,
  },
  {
    clave: 'c2',
    mensaje: 'Agrega la lista de platos',
    archivos: ['platos.md'],
    padres: ['c1'],
    carril: 0,
  },
  {
    clave: 'c3',
    mensaje: 'Agrega los ingredientes base',
    archivos: ['ingredientes.md'],
    padres: ['c2'],
    carril: 0,
  },
] as const;

/**
 * E1, sesion 1. Repositorio recien creado, sin confirmaciones y con los
 * archivos del recetario presentes pero sin seguimiento.
 *
 * Va sin configuracion de usuario a proposito: la primera cosa que el
 * participante hace en la sesion es identificarse con `git config`.
 */
export const E1: EscenarioDeclarado = {
  id: 'E1',
  sesion: 1,
  titulo: 'Recetario recién creado',
  proposito:
    'Configurar la identidad, mirar el estado, preparar archivos y hacer la primera confirmación.',
  directorio: DIRECTORIO,
  configuracion: {},
  confirmaciones: [],
  ramas: [],
  etiquetas: [],
  posicion: 'main',
  archivos: [
    ...SEGUIDOS.map((archivo) => ({ ...archivo, estado: 'sin-seguimiento' as const })),
  ],
  remotos: [],
};

/**
 * E2, sesion 2. Historia lineal de cuatro confirmaciones en `main`, un archivo
 * modificado y una confirmacion con el mensaje mal escrito, para practicar la
 * correccion con `git commit --amend`.
 */
export const E2: EscenarioDeclarado = {
  id: 'E2',
  sesion: 2,
  titulo: 'Historia lineal con un mensaje mal escrito',
  proposito:
    'Leer el historial, comparar cambios, corregir el último mensaje y deshacer con reset y revert.',
  directorio: DIRECTORIO,
  configuracion: CONFIGURACION_PUESTA,
  confirmaciones: [
    ...TRONCO,
    {
      clave: 'c4',
      // Mal escrito a proposito. Es el material del ejercicio de --amend.
      mensaje: 'Agrega la lsita de cocinerps',
      archivos: ['cocineros.md'],
      padres: ['c3'],
      carril: 0,
    },
  ],
  ramas: [{ nombre: 'main', en: 'c4', carril: 0 }],
  etiquetas: [],
  posicion: 'main',
  archivos: SEGUIDOS.map((archivo) =>
    archivo.nombre === 'platos.md' ? { ...archivo, estado: 'modificado' as const } : archivo,
  ),
  remotos: [],
};

/**
 * E3, sesion 3. Cuatro confirmaciones en `main` y una rama `tailandesa` con
 * dos confirmaciones que se separa en la tercera.
 *
 * Las dos ramas tocan archivos distintos: fusionarlas no produce conflicto,
 * que es lo que la sesion 3 necesita mostrar antes de llegar al conflicto de
 * la sesion 4.
 */
export const E3: EscenarioDeclarado = {
  id: 'E3',
  sesion: 3,
  titulo: 'Rama tailandesa separada del tronco',
  proposito:
    'Crear y cambiar ramas, fusionar sin conflicto, etiquetar, guardar en el stash y excluir archivos.',
  directorio: DIRECTORIO,
  configuracion: CONFIGURACION_PUESTA,
  confirmaciones: [
    ...TRONCO,
    {
      clave: 'c4',
      mensaje: 'Agrega la lista de cocineros',
      archivos: ['cocineros.md'],
      padres: ['c3'],
      carril: 0,
    },
    {
      clave: 't1',
      mensaje: 'Agrega la receta del pad thai',
      archivos: ['recetas/pad-thai.md'],
      padres: ['c3'],
      carril: 1,
    },
    {
      clave: 't2',
      mensaje: 'Agrega los ingredientes tailandeses',
      archivos: ['ingredientes-tailandeses.md'],
      padres: ['t1'],
      carril: 1,
    },
  ],
  ramas: [
    { nombre: 'main', en: 'c4', carril: 0 },
    { nombre: 'tailandesa', en: 't2', carril: 1 },
  ],
  etiquetas: [],
  posicion: 'main',
  archivos: [...SEGUIDOS, ...ESTORBOS],
  remotos: [],
};

/**
 * E4, sesion 4. Igual que E3, pero las dos ramas divergen sobre `platos.md`,
 * de modo que fusionarlas produce conflicto.
 */
export const E4: EscenarioDeclarado = {
  id: 'E4',
  sesion: 4,
  titulo: 'Ramas divergentes sobre el mismo archivo',
  proposito:
    'Provocar un conflicto de fusión, resolverlo, abortarlo y rehacer la historia con rebase.',
  directorio: DIRECTORIO,
  configuracion: CONFIGURACION_PUESTA,
  confirmaciones: [
    ...TRONCO,
    {
      clave: 'c4',
      // Toca platos.md, igual que la rama tailandesa: de ahi sale el conflicto.
      mensaje: 'Suma el charquicán a la lista de platos',
      archivos: ['platos.md'],
      padres: ['c3'],
      carril: 0,
    },
    {
      clave: 't1',
      mensaje: 'Agrega la receta del pad thai',
      archivos: ['recetas/pad-thai.md'],
      padres: ['c3'],
      carril: 1,
    },
    {
      clave: 't2',
      mensaje: 'Suma el pad thai a la lista de platos',
      archivos: ['platos.md'],
      padres: ['t1'],
      carril: 1,
    },
  ],
  ramas: [
    { nombre: 'main', en: 'c4', carril: 0 },
    { nombre: 'tailandesa', en: 't2', carril: 1 },
  ],
  etiquetas: [],
  posicion: 'main',
  archivos: [...SEGUIDOS, ...ESTORBOS],
  remotos: [],
};

export const ESCENARIOS: readonly EscenarioDeclarado[] = [E1, E2, E3, E4];
