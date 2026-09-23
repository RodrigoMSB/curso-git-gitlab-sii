/**
 * La previsualizacion sobre el repositorio real contra lo que Git hace
 * (SPEC 020, CA4).
 *
 * Por cada orden del guion: se lee el repositorio, el motor previsualiza la
 * orden sobre ese estado, se ejecuta la orden en Git y se vuelve a leer. Se
 * comparan las confirmaciones nuevas, las ramas, las etiquetas y la posicion,
 * que es lo que la pantalla anticipa en trazo discontinuo, y por separado lo
 * que el motor dice de las areas contra `git status`.
 *
 * Las confirmaciones nuevas no tienen el mismo identificador en los dos lados,
 * porque el de Git depende de la fecha y del autor. Se comparan por mensaje;
 * todo lo que ya existia se compara por identificador.
 */

import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { ordenPara } from '../../cypress/soporte/ordenes';
import { previsualizar } from '../../src/core';
import { formatearEstadoCorto } from '../../src/core/formato';
import type { EstadoRepositorio } from '../../src/core/tipos';
import { ALIAS_DEL_TALLER } from '../../src/escenarios';
import { LectorReal } from '../../src/real/lector';
import { adaptadorDeDisco } from './disco';
import { CLON, correr, guion, LABORATORIOS, preparar } from './laboratorio';
import { porcelana } from './repos';

const GLOBAL = {
  'user.name': 'Participante del taller',
  'user.email': 'participante@sii.cl',
  'alias.s': ALIAS_DEL_TALLER.s,
  'alias.lg': ALIAS_DEL_TALLER.lg,
};

/**
 * Las diferencias conocidas, todas del motor y no del lector ni del puente,
 * cada una con su motivo en el informe. Una que no este aqui hace fallar la
 * prueba: o es un defecto nuevo, o hay que entenderla y anotarla.
 */
const CONOCIDAS: Readonly<Record<string, string>> = {
  '07:71:grafo': 'el motor no se niega a cambiar de rama cuando el cambio pisaria trabajo sin confirmar',
  '03:105:areas': 'el motor no detecta el renombrado cuando se prepara con git add . despues de un mv',
  '08:161:areas': 'el motor trata lo escrito en .git/hooks como una carpeta .git/ no seguida',
  '06:39:error': 'cat de un archivo que la orden anterior escribio fuera del repositorio, cosa que el motor declara no hacer',
  '07:287:error': 'cat de un archivo escrito fuera del repositorio, como el anterior',
  '07:318:error': 'cat de un archivo escrito fuera del repositorio, como el anterior',
  '07:420:error': 'cat de un archivo escrito fuera del repositorio, como el anterior',
  '08:54:error': 'el motor responde que git fetch no existe: no modela remotos, y deberia declararlo en vez de negarlo',
  '08:76:error': 'git fetch, como el anterior',
  '08:118:error': 'git fetch, como el anterior',
  '08:86:error': 'upstream/main es una rama remota, que el motor no modela',
  '08:92:error': 'upstream/main, como el anterior',
  '08:103:error': 'upstream/main, como el anterior',
};

const montados: string[] = [];
const filas: string[] = [];
const diferencias: string[] = [];

async function estadoReal(dir: string): Promise<EstadoRepositorio> {
  const lector = new LectorReal(adaptadorDeDisco(dir), { autocrlfPorDefecto: 'false' });
  const lectura = await lector.leer();
  if (lectura.tipo !== 'leido') throw new Error(lectura.motivo);
  return (await lector.estadoDelMotor(lectura.repositorio, { directorio: dir, configuracionGlobal: GLOBAL })).estado;
}

/** Lo que la pantalla anticipa, con las confirmaciones nuevas nombradas por su mensaje. */
function forma(estado: EstadoRepositorio, previas: ReadonlySet<string>): Record<string, string> {
  const mensaje = new Map(estado.confirmaciones.map((c) => [c.id, c.mensaje]));
  const nombre = (id: string): string => (previas.has(id) ? id : `nueva «${mensaje.get(id) ?? '?'}»`);
  return {
    nuevas: estado.confirmaciones
      .filter((c) => !previas.has(c.id))
      .map((c) => c.mensaje)
      .sort()
      .join(' | '),
    ramas: estado.ramas
      .map((r) => `${r.nombre}=${nombre(r.id)}`)
      .sort()
      .join(' '),
    etiquetas: estado.etiquetas
      .map((e) => `${e.nombre}=${nombre(e.id)}`)
      .sort()
      .join(' '),
    posicion: estado.puntero.tipo === 'rama' ? `rama ${estado.puntero.rama}` : `separada en ${nombre(estado.puntero.id)}`,
  };
}

afterAll(() => {
  for (const raiz of montados.splice(0)) rmSync(raiz, { recursive: true, force: true });
  const destino = join(CLON, 'docs', 'poc-repositorio-real');
  mkdirSync(destino, { recursive: true });
  writeFileSync(
    join(destino, 'recorrido-previsualizacion.md'),
    [
      '# La previsualizacion sobre el repositorio real, contra Git',
      '',
      'Generado por `simulador/tests/real/previsualizacion.test.ts` (SPEC 020, CA4).',
      'Por cada orden del guion, el motor previsualiza sobre el estado leido del',
      'repositorio; despues la orden se ejecuta en Git y se compara.',
      '',
      '- **grafo**: confirmaciones nuevas, ramas, etiquetas y posicion, que es lo',
      '  que la pantalla dibuja en trazo discontinuo.',
      '- **areas**: lo que el motor dice que quedaria en `git status`. La pantalla',
      '  no lo anticipa; se mide para saber cuanto sabe el motor del estado real.',
      '- **no la sabe**: el motor responde que no la implementa, o da error donde',
      '  Git no.',
      '',
      '| laboratorio | ordenes | grafo igual | grafo distinto | areas iguales | areas distintas | no la sabe |',
      '|---|---|---|---|---|---|---|',
      ...filas.sort(),
      '',
      '## Diferencias conocidas',
      '',
      ...Object.entries(CONOCIDAS).map(([clave, motivo]) => `- ${clave}: ${motivo}.`),
      '',
      '## Todas las diferencias',
      '',
      ...(diferencias.length === 0 ? ['Ninguna.'] : diferencias),
      '',
    ].join('\n'),
  );
});

describe.each(LABORATORIOS)('laboratorio %s', (numero) => {
  it('la previsualizacion de cada orden del guion contra lo que Git hace', async () => {
    const { ordenes } = guion(numero);
    const lab = preparar(numero);
    montados.push(lab.raiz);
    const salidas = new Map<string, string>();
    const nuevas: string[] = [];
    const cuenta = { grafoIgual: 0, grafoDistinto: 0, areasIguales: 0, areasDistintas: 0, noLaSabe: 0 };

    for (const orden of ordenes) {
      const eleccion = orden.eleccion;
      const identificador = eleccion === undefined ? null : eleccion.elegir(salidas.get(eleccion.de) ?? '');
      const texto = ordenPara(orden, identificador);

      const antes = await estadoReal(lab.recetario);
      const previas = new Set(antes.confirmaciones.map((c) => c.id));
      const vista = previsualizar(antes, texto);
      const { salida, fallo: fallaGit } = correr(lab, texto);
      salidas.set(orden.texto, salida);
      const despues = await estadoReal(lab.recetario);

      const limite = vista.salida.some((l) => l.tipo === 'limite');
      if (limite || (vista.error && !fallaGit)) {
        cuenta.noLaSabe += 1;
        // Declararla es una respuesta valida del simulador; fallar donde Git funciona, no.
        if (!limite) nuevas.push(`${numero}:${orden.linea}:error`);
        const motivo = vista.salida.map((l) => l.texto).join(' / ').slice(0, 160);
        diferencias.push(`- ${numero}, linea ${orden.linea} \`${texto}\`: el motor no la sabe — ${motivo}`);
        continue;
      }

      const previsto = forma(vista.estadoResultante, previas);
      const real = forma(despues, previas);
      const distintos = Object.keys(real).filter((k) => previsto[k] !== real[k]);
      if (distintos.length === 0) cuenta.grafoIgual += 1;
      else {
        cuenta.grafoDistinto += 1;
        nuevas.push(`${numero}:${orden.linea}:grafo`);
        diferencias.push(
          `- ${numero}, linea ${orden.linea} \`${texto}\`: grafo — ${distintos
            .map((k) => `${k}: previsto «${previsto[k]}», Git «${real[k]}»`)
            .join('; ')}`,
        );
      }

      const areasPrevistas = [...formatearEstadoCorto(vista.estadoResultante)].sort();
      const areasGit = porcelana(lab.recetario, lab.configGlobal);
      if (JSON.stringify(areasPrevistas) === JSON.stringify(areasGit)) cuenta.areasIguales += 1;
      else {
        cuenta.areasDistintas += 1;
        nuevas.push(`${numero}:${orden.linea}:areas`);
        diferencias.push(
          `- ${numero}, linea ${orden.linea} \`${texto}\`: areas — previsto ${JSON.stringify(areasPrevistas)}, Git ${JSON.stringify(areasGit)}`,
        );
      }
    }

    filas.push(
      `| ${numero} | ${ordenes.length} | ${cuenta.grafoIgual} | ${cuenta.grafoDistinto} | ${cuenta.areasIguales} | ${cuenta.areasDistintas} | ${cuenta.noLaSabe} |`,
    );
    expect(cuenta.grafoIgual + cuenta.grafoDistinto + cuenta.noLaSabe).toBe(ordenes.length);
    expect([...new Set(nuevas)].filter((clave) => CONOCIDAS[clave] === undefined)).toEqual([]);
  }, 300_000);
});
