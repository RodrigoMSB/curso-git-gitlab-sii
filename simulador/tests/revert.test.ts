/**
 * `git revert` que deshace todo (SPEC 019).
 *
 * Cada caso reproduce una corrida de Git 2.54 hecha para la ocasion, sobre un
 * repositorio con la misma forma: `a.md` con cinco lineas y `b.md` con una. Lo
 * que se compara es lo que el participante ve: la salida, orden por orden y
 * linea por linea, y el texto de cada archivo. Los identificadores son los del
 * simulador en el lugar donde Git pone los suyos.
 */

import { describe, expect, it } from 'vitest';
import { ejecutar } from '../src/core/motor';
import { archivoPorNombre, confirmacionPorId, idActual } from '../src/core/estado';
import { textoEnConfirmacion } from '../src/core/contenido';
import type { EstadoRepositorio } from '../src/core/tipos';
import { correr, repoVacio, texto } from './ayudas';

/** El repositorio de partida: `a.md` con cinco lineas, `b.md` con una, confirmados. */
function partida(): EstadoRepositorio {
  return correr(
    repoVacio(),
    'echo "uno" > a.md',
    'echo "dos" >> a.md',
    'echo "tres" >> a.md',
    'echo "cuatro" >> a.md',
    'echo "cinco" >> a.md',
    'echo "x" > b.md',
    'git add a.md b.md',
    'git commit -m "base"',
  );
}

/** Reescribe `a.md` entero, linea por linea, como se puede en el simulador. */
function escribirA(lineas: readonly string[]): readonly string[] {
  return lineas.map((linea, indice) => `echo "${linea}" ${indice === 0 ? '>' : '>>'} a.md`);
}

/** El texto de un archivo en el directorio de trabajo, o `null` si no esta. */
function enDisco(estado: EstadoRepositorio, nombre: string): string | null {
  const archivo = archivoPorNombre(estado, nombre);
  if (archivo === undefined) return null;
  return archivo.contenido ?? textoEnConfirmacion(estado, idActual(estado), nombre);
}

/** La confirmacion nueva y su identificador, para armar el texto esperado. */
function nueva(estado: EstadoRepositorio): { id: string; fecha: string } {
  const id = idActual(estado) ?? '';
  return { id, fecha: confirmacionPorId(estado, id)?.fecha ?? '' };
}

describe('1.2 · lo que la confirmacion borro, vuelve', () => {
  it('con su contenido de antes, y con la salida de Git', () => {
    const borrado = correr(partida(), 'git rm b.md', 'git commit -m "quita b"');
    const resultado = ejecutar(borrado, 'git revert --no-edit HEAD');
    const { id, fecha } = nueva(resultado.estado);
    // Antes: el archivo no volvia y el resumen decia ` 0 files changed`.
    expect(texto(resultado)).toBe(
      [
        `[main ${id}] Revert "quita b"`,
        ` Date: ${fecha}`,
        ' 1 file changed, 1 insertion(+)',
        ' create mode 100644 b.md',
      ].join('\n'),
    );
    expect(enDisco(resultado.estado, 'b.md')).toBe('x\n');
    expect(textoEnConfirmacion(resultado.estado, id, 'b.md')).toBe('x\n');
  });
});

describe('1.3 · lo que la confirmacion agrego, se va', () => {
  it('y la salida lo dice con delete mode', () => {
    const agregado = correr(partida(), 'echo "nuevo" > c.md', 'git add c.md', 'git commit -m "agrega c"');
    const resultado = ejecutar(agregado, 'git revert --no-edit HEAD');
    const { id, fecha } = nueva(resultado.estado);
    expect(texto(resultado)).toBe(
      [
        `[main ${id}] Revert "agrega c"`,
        ` Date: ${fecha}`,
        ' 1 file changed, 1 deletion(-)',
        ' delete mode 100644 c.md',
      ].join('\n'),
    );
    expect(enDisco(resultado.estado, 'c.md')).toBeNull();
    expect(textoEnConfirmacion(resultado.estado, id, 'c.md')).toBeNull();
  });
});

describe('1.4 · lo que la confirmacion modifico, se deshace linea por linea', () => {
  it('conservando los cambios que vinieron despues', () => {
    // Antes: el archivo volvia entero a su version previa y se llevaba el
    // `CINCO` de la confirmacion posterior.
    const estado = correr(
      partida(),
      ...escribirA(['uno', 'DOS', 'tres', 'cuatro', 'cinco']),
      'git commit -a -m "cambia dos"',
      ...escribirA(['uno', 'DOS', 'tres', 'cuatro', 'CINCO']),
      'git commit -a -m "cambia cinco"',
    );
    const resultado = ejecutar(estado, 'git revert --no-edit HEAD~1');
    const { id, fecha } = nueva(resultado.estado);
    expect(texto(resultado)).toBe(
      [
        'Auto-merging a.md',
        `[main ${id}] Revert "cambia dos"`,
        ` Date: ${fecha}`,
        ' 1 file changed, 1 insertion(+), 1 deletion(-)',
      ].join('\n'),
    );
    expect(enDisco(resultado.estado, 'a.md')).toBe('uno\ndos\ntres\ncuatro\nCINCO\n');
  });
});

describe('1.5 · revertir una reversion devuelve lo original', () => {
  it('el archivo borrado vuelve a irse, con el mensaje Reapply', () => {
    const estado = correr(
      partida(),
      'git rm b.md',
      'git commit -m "quita b"',
      'git revert --no-edit HEAD',
    );
    expect(enDisco(estado, 'b.md')).toBe('x\n');
    const resultado = ejecutar(estado, 'git revert --no-edit HEAD');
    const { id, fecha } = nueva(resultado.estado);
    expect(texto(resultado)).toBe(
      [
        `[main ${id}] Reapply "quita b"`,
        ` Date: ${fecha}`,
        ' 1 file changed, 1 deletion(-)',
        ' delete mode 100644 b.md',
      ].join('\n'),
    );
    expect(enDisco(resultado.estado, 'b.md')).toBeNull();
  });

  it('el archivo agregado vuelve, con su contenido', () => {
    const estado = correr(
      partida(),
      'echo "nuevo" > c.md',
      'git add c.md',
      'git commit -m "agrega c"',
      'git revert --no-edit HEAD',
    );
    const resultado = ejecutar(estado, 'git revert --no-edit HEAD');
    expect(texto(resultado)).toContain(' create mode 100644 c.md');
    expect(enDisco(resultado.estado, 'c.md')).toBe('nuevo\n');
  });
});

/** Las lineas de ayuda que Git agrega a toda reversion que choca. */
const AYUDA_CONFLICTO = [
  'hint: After resolving the conflicts, mark them with',
  'hint: "git add/rm <pathspec>", then run',
  'hint: "git revert --continue".',
  'hint: You can instead skip this commit with "git revert --skip".',
  'hint: To abort and get back to the state before "git revert",',
  'hint: run "git revert --abort".',
  'hint: Disable this message with "git config set advice.mergeConflict false"',
];

describe('1.4 · cuando deshacer choca con un cambio posterior', () => {
  /** `cambia tres` y despues `retoca tres` sobre la misma linea. */
  const chocando = (): { estado: EstadoRepositorio; objetivo: string } => {
    const estado = correr(
      partida(),
      ...escribirA(['uno', 'dos', 'TRES', 'cuatro', 'cinco']),
      'git commit -a -m "cambia tres"',
      ...escribirA(['uno', 'dos', 'TRES!', 'cuatro', 'cinco']),
      'git commit -a -m "retoca tres"',
    );
    const objetivo = confirmacionPorId(estado, idActual(estado) ?? '')?.padres[0] ?? '';
    return { estado, objetivo };
  };

  it('choca con el texto de Git y deja los marcadores', () => {
    const { estado, objetivo } = chocando();
    const resultado = ejecutar(estado, 'git revert --no-edit HEAD~1');
    expect(texto(resultado)).toBe(
      [
        'Auto-merging a.md',
        'CONFLICT (content): Merge conflict in a.md',
        `error: could not revert ${objetivo}... cambia tres`,
        ...AYUDA_CONFLICTO,
      ].join('\n'),
    );
    expect(enDisco(resultado.estado, 'a.md')).toBe(
      `uno\ndos\n<<<<<<< HEAD\nTRES!\n=======\ntres\n>>>>>>> parent of ${objetivo} (cambia tres)\ncuatro\ncinco\n`,
    );
    expect(archivoPorNombre(resultado.estado, 'a.md')?.estado).toBe('en-conflicto');
    // La posicion no se mueve: no hay confirmacion hasta que se resuelva.
    expect(idActual(resultado.estado)).toBe(idActual(estado));
  });

  it('--abort deja todo como estaba', () => {
    const { estado } = chocando();
    const chocado = ejecutar(estado, 'git revert --no-edit HEAD~1').estado;
    const abortado = ejecutar(chocado, 'git revert --abort');
    expect(texto(abortado)).toBe('');
    expect(enDisco(abortado.estado, 'a.md')).toBe('uno\ndos\nTRES!\ncuatro\ncinco\n');
    expect(archivoPorNombre(abortado.estado, 'a.md')?.estado).toBe('limpio');
    expect(texto(ejecutar(abortado.estado, 'git revert --continue'))).toBe(
      'error: no cherry-pick or revert in progress\nfatal: revert failed',
    );
  });

  it('--continue se niega con archivos sin resolver, y confirma una vez resueltos', () => {
    const { estado } = chocando();
    const chocado = ejecutar(estado, 'git revert --no-edit HEAD~1').estado;
    expect(texto(ejecutar(chocado, 'git revert --continue'))).toBe(
      [
        'U\ta.md',
        'error: Committing is not possible because you have unmerged files.',
        "hint: Fix them up in the work tree, and then use 'git add/rm <file>'",
        'hint: as appropriate to mark resolution and make a commit.',
        'fatal: Exiting because of an unresolved conflict.',
      ].join('\n'),
    );
    expect(texto(ejecutar(chocado, 'git revert --no-edit HEAD'))).toBe(
      [
        'error: Reverting is not possible because you have unmerged files.',
        "hint: Fix them up in the work tree, and then use 'git add/rm <file>'",
        'hint: as appropriate to mark resolution and make a commit.',
        'fatal: revert failed',
      ].join('\n'),
    );
    const resuelto = correr(chocado, ...escribirA(['uno', 'dos', 'tres', 'cuatro', 'cinco']), 'git add a.md');
    const continuado = ejecutar(resuelto, 'git revert --continue');
    const id = idActual(continuado.estado) ?? '';
    // Git no imprime la fecha al continuar.
    expect(texto(continuado)).toBe(
      [`[main ${id}] Revert "cambia tres"`, ' 1 file changed, 1 insertion(+), 1 deletion(-)'].join('\n'),
    );
    expect(textoEnConfirmacion(continuado.estado, id, 'a.md')).toBe('uno\ndos\ntres\ncuatro\ncinco\n');
    expect(texto(ejecutar(continuado.estado, 'git revert --abort'))).toContain('no cherry-pick or revert in progress');
  });

  it('git commit tambien cierra la reversion', () => {
    const { estado } = chocando();
    const chocado = ejecutar(estado, 'git revert --no-edit HEAD~1').estado;
    const resuelto = correr(chocado, ...escribirA(['uno', 'dos', 'tres', 'cuatro', 'cinco']), 'git add a.md');
    const confirmado = ejecutar(resuelto, 'git commit -m "resuelvo"');
    const id = idActual(confirmado.estado) ?? '';
    expect(texto(confirmado)).toBe(
      [`[main ${id}] resuelvo`, ' 1 file changed, 1 insertion(+), 1 deletion(-)'].join('\n'),
    );
    expect(texto(ejecutar(confirmado.estado, 'git revert --continue'))).toContain(
      'no cherry-pick or revert in progress',
    );
  });

  it('si lo agregado se modifico despues, choca por modificado y borrado', () => {
    const estado = correr(
      partida(),
      'echo "nuevo" > d.md',
      'git add d.md',
      'git commit -m "agrega d"',
      'echo "mas" >> d.md',
      'git commit -a -m "amplia d"',
    );
    const objetivo = confirmacionPorId(estado, idActual(estado) ?? '')?.padres[0] ?? '';
    const resultado = ejecutar(estado, 'git revert --no-edit HEAD~1');
    expect(texto(resultado)).toBe(
      [
        `CONFLICT (modify/delete): d.md deleted in parent of ${objetivo} (agrega d) and modified in HEAD.  Version HEAD of d.md left in tree.`,
        `error: could not revert ${objetivo}... agrega d`,
        ...AYUDA_CONFLICTO,
      ].join('\n'),
    );
    expect(enDisco(resultado.estado, 'd.md')).toBe('nuevo\nmas\n');
    expect(archivoPorNombre(resultado.estado, 'd.md')?.estado).toBe('en-conflicto');
  });

  it('si lo modificado se borro despues, choca al reves', () => {
    const estado = correr(
      partida(),
      ...escribirA(['uno', 'DOS', 'tres', 'cuatro', 'cinco']),
      'git commit -a -m "cambia dos"',
      'git rm a.md',
      'git commit -m "quita a"',
    );
    const objetivo = confirmacionPorId(estado, idActual(estado) ?? '')?.padres[0] ?? '';
    const resultado = ejecutar(estado, 'git revert --no-edit HEAD~1');
    expect(texto(resultado)).toBe(
      [
        `CONFLICT (modify/delete): a.md deleted in HEAD and modified in parent of ${objetivo} (cambia dos).  Version parent of ${objetivo} (cambia dos) of a.md left in tree.`,
        `error: could not revert ${objetivo}... cambia dos`,
        ...AYUDA_CONFLICTO,
      ].join('\n'),
    );
    expect(enDisco(resultado.estado, 'a.md')).toBe('uno\ndos\ntres\ncuatro\ncinco\n');
  });

  it('si lo borrado volvio distinto, choca por agregado en los dos lados', () => {
    const estado = correr(
      partida(),
      'git rm b.md',
      'git commit -m "quita b"',
      'echo "otro" > b.md',
      'git add b.md',
      'git commit -m "vuelve b distinto"',
    );
    const objetivo = confirmacionPorId(estado, idActual(estado) ?? '')?.padres[0] ?? '';
    const resultado = ejecutar(estado, 'git revert --no-edit HEAD~1');
    expect(texto(resultado)).toBe(
      [
        'Auto-merging b.md',
        'CONFLICT (add/add): Merge conflict in b.md',
        `error: could not revert ${objetivo}... quita b`,
        ...AYUDA_CONFLICTO,
      ].join('\n'),
    );
    expect(enDisco(resultado.estado, 'b.md')).toBe(
      `<<<<<<< HEAD\notro\n=======\nx\n>>>>>>> parent of ${objetivo} (quita b)\n`,
    );
  });
});

describe('lo que Git no deja revertir', () => {
  it('con cambios sin confirmar en un archivo que la reversion toca', () => {
    const estado = correr(
      partida(),
      ...escribirA(['uno', 'DOS', 'tres', 'cuatro', 'cinco']),
      'git commit -a -m "cambia dos"',
      'echo "extra" >> a.md',
    );
    const resultado = ejecutar(estado, 'git revert --no-edit HEAD');
    expect(texto(resultado)).toBe(
      [
        'error: Your local changes to the following files would be overwritten by merge:',
        '\ta.md',
        'Please commit your changes or stash them before you merge.',
        'Aborting',
        'fatal: revert failed',
      ].join('\n'),
    );
    expect(resultado.estado).toBe(estado);
  });

  it('con cambios preparados', () => {
    const estado = correr(
      partida(),
      ...escribirA(['uno', 'DOS', 'tres', 'cuatro', 'cinco']),
      'git commit -a -m "cambia dos"',
      'echo "y" >> b.md',
      'git add b.md',
    );
    const resultado = ejecutar(estado, 'git revert --no-edit HEAD');
    expect(texto(resultado)).toBe(
      [
        'error: your local changes would be overwritten by revert.',
        'hint: commit your changes or stash them to proceed.',
        'fatal: revert failed',
      ].join('\n'),
    );
    expect(resultado.estado).toBe(estado);
  });
});
