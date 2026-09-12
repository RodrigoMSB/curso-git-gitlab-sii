/**
 * El modelo de contenido y lo que sale de el (SPEC 012).
 *
 * Son las tres piezas que el spec agrega al motor: el texto de los archivos en
 * sus tres versiones, la comparacion de diferencias y la fusion de tres vias
 * que escribe los marcadores de conflicto.
 *
 * Las salidas que se fijan aqui **se compararon contra Git de verdad** sobre
 * los escenarios del guion, orden por orden, que es lo que el punto 4.3 del
 * spec exige. Lo que esta escrito en los `expect` es lo que Git imprime.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  arbolDe,
  bytesDe,
  comparacionesEntre,
  lineasDe,
  normalizar,
  textoDeTrabajo,
  textoEnCabeza,
  textoEnConfirmacion,
  textoPreparado,
} from '../src/core/contenido';
import {
  compararLineas,
  formatearEstadisticasDe,
  formatearParche,
  fusionarTresVias,
} from '../src/core/diferencias';
import { archivoPorNombre, idActual, ramaPorNombre } from '../src/core/estado';
import { baseComun } from '../src/core/grafo';
import { ejecutar } from '../src/core/motor';
import { ESCENARIOS, escenarioPorId } from '../src/escenarios';
import { correr, correrHasta, repoConRamas, repoLimpio, repoLineal, texto } from './ayudas';

describe('el texto se normaliza al entrar', () => {
  it('los finales de linea de Windows pasan a ser los de siempre', () => {
    expect(normalizar('uno\r\ndos\r\n')).toBe('uno\ndos\n');
    expect(normalizar('uno\rdos\r')).toBe('uno\ndos\n');
  });

  it('se agrega el salto final cuando falta, y el vacio se queda vacio', () => {
    expect(normalizar('sin salto')).toBe('sin salto\n');
    expect(normalizar('')).toBe('');
  });

  it('las lineas no incluyen la vacia que deja el salto final', () => {
    expect(lineasDe('uno\ndos\n')).toEqual(['uno', 'dos']);
    expect(lineasDe('')).toEqual([]);
  });

  it('se cuentan los bytes y no los caracteres', () => {
    // La eñe ocupa dos bytes en UTF-8, que es como los cuenta `wc -c`.
    expect(bytesDe('abc\n')).toBe(4);
    expect(bytesDe('ñ\n')).toBe(3);
  });
});

describe('las tres versiones de un archivo', () => {
  it('un archivo limpio tiene en el directorio lo mismo que en la confirmacion', () => {
    const estado = repoLineal();

    expect(textoDeTrabajo(estado, 'platos.md')).toBe(textoEnCabeza(estado, 'platos.md'));
    // Y no guarda copia: el `null` es lo que impide que se quede vieja.
    expect(estado.archivos.find((uno) => uno.nombre === 'platos.md')?.contenido).toBeNull();
  });

  it('un archivo modificado difiere del de la confirmacion y no del indice', () => {
    const estado = repoLineal();

    expect(textoDeTrabajo(estado, 'ingredientes.md')).toContain('asdf probando');
    expect(textoEnCabeza(estado, 'ingredientes.md')).not.toContain('asdf probando');
    // Sin preparar, el indice sigue teniendo lo de la confirmacion.
    expect(textoPreparado(estado, 'ingredientes.md')).toBe(
      textoEnCabeza(estado, 'ingredientes.md'),
    );
  });

  it('un archivo preparado tiene en el indice lo del directorio', () => {
    const estado = repoLineal();

    expect(textoPreparado(estado, 'cocineros.md')).toBe(textoDeTrabajo(estado, 'cocineros.md'));
    expect(textoPreparado(estado, 'cocineros.md')).not.toBe(
      textoEnCabeza(estado, 'cocineros.md'),
    );
  });

  it('el arbol de una confirmacion es la foto completa, no solo lo que toco', () => {
    const estado = repoLineal();
    const cabeza = idActual(estado);
    const arbol = arbolDe(estado, cabeza);

    // La ultima confirmacion registro solo la receta, y el arbol trae los cinco.
    expect(Object.keys(arbol).sort()).toEqual([
      'README.md',
      'cocineros.md',
      'ingredientes.md',
      'platos.md',
      'recetas/pastel-de-choclo.md',
    ]);
  });

  it('cambiar de rama trae el texto de la rama de destino', () => {
    const enMain = repoConRamas();
    const enAndina = correr(enMain, 'git switch andina');

    expect(textoDeTrabajo(enMain, 'platos.md')).toContain('cazuela con chuchoca');
    expect(textoDeTrabajo(enAndina, 'platos.md')).toContain('lomo saltado');
  });

  it('confirmar guarda en el arbol lo que estaba preparado', () => {
    const estado = correr(
      repoConRamas(),
      'echo "- charquican" >> platos.md',
      'git add platos.md',
      'git commit -m "Suma el charquican"',
    );

    expect(textoEnCabeza(estado, 'platos.md')).toContain('- charquican');
    expect(textoDeTrabajo(estado, 'platos.md')).toContain('- charquican');
  });

  it('descartar un cambio devuelve el texto de la confirmacion', () => {
    const estado = correr(repoLineal(), 'git restore ingredientes.md');

    expect(textoDeTrabajo(estado, 'ingredientes.md')).not.toContain('asdf probando');
    expect(textoDeTrabajo(estado, 'ingredientes.md')).toBe(
      textoEnCabeza(estado, 'ingredientes.md'),
    );
  });
});

describe('el texto sigue a las ordenes que mueven la posicion', () => {
  it('el guardado temporal se lleva el texto y lo devuelve', () => {
    const conCambio = correr(repoConRamas(), 'echo "- charquican" >> platos.md');
    const guardado = correr(conCambio, 'git stash push -m "a medias"');

    // Guardado: el directorio queda como la confirmacion, sin el cambio.
    expect(textoDeTrabajo(guardado, 'platos.md')).not.toContain('- charquican');
    expect(textoDeTrabajo(guardado, 'platos.md')).toBe(textoEnCabeza(guardado, 'platos.md'));

    // Devuelto: vuelve el mismo trabajo, y no un archivo marcado como
    // modificado sin ninguna modificacion dentro.
    const devuelto = correr(guardado, 'git stash pop');
    expect(textoDeTrabajo(devuelto, 'platos.md')).toContain('- charquican');
    expect(texto(correrHasta(devuelto, 'git diff'))).toContain('+- charquican');
  });

  it('git reset --mixed deja el directorio como estaba, que es lo que Git hace', () => {
    // Se confirma un cambio y se deshace la confirmacion sin tocar el disco.
    const confirmado = correr(
      repoConRamas(),
      'echo "- charquican" >> platos.md',
      'git add platos.md',
      'git commit -m "Suma el charquican"',
    );
    const estado = correr(confirmado, 'git reset --mixed HEAD~1');

    // El texto sigue en el disco y la confirmacion ya no lo tiene: eso es
    // exactamente un cambio sin preparar, y `git diff` tiene que mostrarlo.
    expect(textoDeTrabajo(estado, 'platos.md')).toContain('- charquican');
    expect(textoEnCabeza(estado, 'platos.md')).not.toContain('- charquican');
    expect(texto(correrHasta(estado, 'git diff'))).toContain('+- charquican');
  });

  it('git reset --soft deja ese mismo cambio preparado', () => {
    const confirmado = correr(
      repoConRamas(),
      'echo "- charquican" >> platos.md',
      'git add platos.md',
      'git commit -m "Suma el charquican"',
    );
    const estado = correr(confirmado, 'git reset --soft HEAD~1');

    expect(texto(correrHasta(estado, 'git diff --staged'))).toContain('+- charquican');
    expect(texto(correrHasta(estado, 'git diff'))).toBe('');
  });

  it('git reset --hard si reemplaza el directorio de trabajo', () => {
    const confirmado = correr(
      repoConRamas(),
      'echo "- charquican" >> platos.md',
      'git add platos.md',
      'git commit -m "Suma el charquican"',
    );
    const estado = correr(confirmado, 'git reset --hard HEAD~1');

    expect(textoDeTrabajo(estado, 'platos.md')).not.toContain('- charquican');
    expect(texto(correrHasta(estado, 'git status'))).toContain('working tree clean');
  });

  it('el rebase copia el texto de cada confirmacion sobre la base nueva', () => {
    const estado = correr(escenarioPorId('lab-07'), 'git rebase main');
    const cabeza = idActual(estado);

    // Las cuatro confirmaciones de la rama se rehicieron sobre main, y cada
    // copia lleva el texto que su original habia dejado.
    expect(arbolDe(estado, cabeza)['recetas/pad-thai.md']).toContain('tamarindo');
    expect(arbolDe(estado, cabeza)['recetas/curry-verde.md']).toContain('leche de coco');
    // Y lo que main tenia por su cuenta sigue ahi: la copia se apoyo sobre su
    // arbol y no sobre el de la rama vieja.
    expect(arbolDe(estado, cabeza)['recetas/pastel-de-choclo.md']).toContain('greda');
    expect(arbolDe(estado, cabeza)['cocineros.md']).toContain('- Sofia Rojas');
  });
});

describe('la comparacion de lineas', () => {
  it('marca lo agregado y lo quitado, con sus numeros de linea', () => {
    const comparadas = compararLineas(['a', 'b', 'c'], ['a', 'x', 'c']);

    expect(comparadas.map((linea) => `${linea.marca}:${linea.texto}`)).toEqual([
      'igual:a',
      'quitada:b',
      'agregada:x',
      'igual:c',
    ]);
    expect(comparadas[1]?.antes).toBe(2);
    expect(comparadas[1]?.despues).toBeNull();
    expect(comparadas[2]?.antes).toBeNull();
    expect(comparadas[2]?.despues).toBe(2);
  });

  it('dos textos iguales no producen parche, como en Git', () => {
    expect(formatearParche({ ruta: 'x.md', antes: 'a\n', despues: 'a\n' })).toEqual([]);
  });

  it('la cabecera del trozo lleva los numeros que lleva la de Git', () => {
    // Comprobado contra `git diff` sobre el escenario del laboratorio 02.
    const parche = formatearParche({
      ruta: 'ingredientes.md',
      antes: '# Ingredientes\n\n- choclo\n- carne de vacuno\n- cebolla\n- aji de color\n- albahaca\n',
      despues:
        '# Ingredientes\n\n- choclo\n- carne de vacuno\n- cebolla\n- albahaca\nasdf probando\nTODO borrar esto antes de confirmar\n',
    });

    expect(parche[0]).toBe('diff --git a/ingredientes.md b/ingredientes.md');
    expect(parche.find((fila) => fila.startsWith('@@'))).toBe('@@ -3,5 +3,6 @@');
    expect(parche.filter((fila) => fila.startsWith('-') && !fila.startsWith('---'))).toEqual([
      '-- aji de color',
    ]);
    expect(parche.filter((fila) => fila.startsWith('+') && !fila.startsWith('+++'))).toEqual([
      '+asdf probando',
      '+TODO borrar esto antes de confirmar',
    ]);
  });

  it('un archivo nuevo se numera desde cero y lleva su modo', () => {
    const parche = formatearParche({ ruta: 'nuevo.md', antes: null, despues: 'uno\ndos\n' });

    expect(parche).toContain('new file mode 100644');
    expect(parche).toContain('--- /dev/null');
    expect(parche.find((fila) => fila.startsWith('@@'))).toBe('@@ -0,0 +1,2 @@');
  });

  it('un archivo borrado entero lo dice y numera al reves', () => {
    const parche = formatearParche({ ruta: 'viejo.md', antes: 'uno\n', despues: null });

    expect(parche).toContain('deleted file mode 100644');
    expect(parche).toContain('+++ /dev/null');
    expect(parche.find((fila) => fila.startsWith('@@'))).toBe('@@ -1 +0,0 @@');
  });

  it('dos cambios lejanos salen en dos trozos, con tres lineas de contexto', () => {
    const lineas = Array.from({ length: 20 }, (_, indice) => `linea ${indice + 1}`);
    const cambiadas = [...lineas];
    cambiadas[1] = 'cambio de arriba';
    cambiadas[17] = 'cambio de abajo';

    const parche = formatearParche({
      ruta: 'largo.md',
      antes: `${lineas.join('\n')}\n`,
      despues: `${cambiadas.join('\n')}\n`,
    });

    expect(parche.filter((fila) => fila.startsWith('@@'))).toHaveLength(2);
  });

  it('el resumen de --stat cuenta las lineas de verdad', () => {
    // Comprobado contra `git show --stat` sobre el escenario del laboratorio 05.
    const resumen = formatearEstadisticasDe([
      { ruta: 'platos.md', antes: 'a\nb\nc\n', despues: 'a\nx\nc\n' },
    ]);

    expect(resumen).toEqual([' platos.md | 2 +-', ' 1 file changed, 1 insertion(+), 1 deletion(-)']);
  });
});

describe('git diff con el contenido de verdad', () => {
  it('sin opciones compara el directorio con el area de preparacion', () => {
    const salida = texto(correrHasta(repoLineal(), 'git diff'));

    expect(salida).toContain('diff --git a/ingredientes.md b/ingredientes.md');
    expect(salida).toContain('+asdf probando');
    // Lo preparado no sale aqui: esa es la otra pregunta.
    expect(salida).not.toContain('cocineros.md');
  });

  it('con --staged compara el area de preparacion con la confirmacion', () => {
    const salida = texto(correrHasta(repoLineal(), 'git diff --staged'));

    expect(salida).toContain('diff --git a/cocineros.md b/cocineros.md');
    expect(salida).toContain('+- Sofia Rojas, especialidad cazuela');
    expect(salida).not.toContain('ingredientes.md');
  });

  it('sin cambios no imprime nada', () => {
    expect(texto(correrHasta(repoConRamas(), 'git diff'))).toBe('');
  });

  it('git status ordena las bajas por ruta, como Git', () => {
    // Comprobado contra Git sobre el escenario del laboratorio 03: los tres
    // archivos retirados salen ordenados, y no en el orden en que se retiraron.
    const estado = correr(
      repoLimpio(),
      'git rm --cached notas.tmp',
      'git rm --cached respaldo.bak',
      'git rm credenciales.txt',
    );

    const bajas = texto(correrHasta(estado, 'git status -s'))
      .split('\n')
      .filter((fila) => fila.startsWith('D '));

    expect(bajas).toEqual([
      'D  credenciales.txt',
      'D  notas.tmp',
      'D  respaldo.bak',
    ]);
  });

  it('una baja preparada sale como archivo borrado', () => {
    const salida = texto(
      correrHasta(repoLimpio(), 'git rm credenciales.txt', 'git diff --staged'),
    );

    expect(salida).toContain('deleted file mode 100644');
    expect(salida).toContain('-clave: 4lm3ndr4s-2024');
  });
});

describe('la fusion de tres vias y sus marcadores', () => {
  it('marca solo el tramo que choca, como Git', () => {
    const { texto: resultado, choco } = fusionarTresVias(
      'uno\ndos\ntres\n',
      'uno\nDOS\ntres\n',
      'uno\ndos2\ntres\n',
      'HEAD',
      'otra',
    );

    expect(choco).toBe(true);
    expect(resultado).toBe('uno\n<<<<<<< HEAD\nDOS\n=======\ndos2\n>>>>>>> otra\ntres\n');
  });

  it('si solo una rama toco el tramo, se toma el suyo sin marcadores', () => {
    const { texto: resultado, choco } = fusionarTresVias(
      'uno\ndos\n',
      'uno\ndos\n',
      'uno\nDOS\n',
      'HEAD',
      'otra',
    );

    expect(choco).toBe(false);
    expect(resultado).toBe('uno\nDOS\n');
  });

  it('si las dos escribieron lo mismo, no hay conflicto', () => {
    const { choco } = fusionarTresVias('a\n', 'b\n', 'b\n', 'HEAD', 'otra');
    expect(choco).toBe(false);
  });

  it('el conflicto del laboratorio 05 queda con el texto de las dos versiones', () => {
    // Es la salida de `cat platos.md` que el punto 3.3 del enunciado hace
    // mirar, y coincide con la de Git carácter por carácter.
    const estado = correr(repoConRamas(), 'git merge andina');
    const platos = textoDeTrabajo(estado, 'platos.md') ?? '';

    expect(platos).toContain('<<<<<<< HEAD');
    expect(platos).toContain('- cazuela con chuchoca');
    expect(platos).toContain('=======');
    expect(platos).toContain('- lomo saltado');
    expect(platos).toContain('>>>>>>> andina');
    // Lo que las dos ramas dejaron igual queda fuera de los marcadores.
    expect(platos.split('<<<<<<<')[0]).toContain('- pastel de choclo');
    expect(platos.split('>>>>>>>')[1]).toContain('- empanadas de pino');
  });

  it('abortar la fusion devuelve el archivo sin marcadores', () => {
    const estado = correr(repoConRamas(), 'git merge andina', 'git merge --abort');

    expect(textoDeTrabajo(estado, 'platos.md')).not.toContain('<<<<<<<');
    expect(textoDeTrabajo(estado, 'platos.md')).toBe(textoEnCabeza(estado, 'platos.md'));
  });

  it('resolver y confirmar guarda en el arbol el texto resuelto', () => {
    const estado = correr(
      repoConRamas(),
      'git merge andina',
      'echo "# Platos" > platos.md',
      'echo "- cazuela con chuchoca y lomo saltado" >> platos.md',
      'git add platos.md',
      'git commit -m "Fusiona la cocina andina"',
    );

    expect(textoEnCabeza(estado, 'platos.md')).toBe(
      '# Platos\n- cazuela con chuchoca y lomo saltado\n',
    );
    expect(textoEnCabeza(estado, 'platos.md')).not.toContain('<<<<<<<');
  });
});

describe('las ordenes que el contenido desbloqueo', () => {
  it('git log -S cuenta apariciones, no busca texto', () => {
    // Comprobado contra Git sobre el escenario del laboratorio 05. La cadena
    // «cazuela» entra en la confirmacion que agrega la lista, y **no** vuelve a
    // contarse en la que la precisa: ahi la linea pasa de «- cazuela» a
    // «- cazuela con chuchoca» y la cadena sigue apareciendo una vez. Es la
    // diferencia entre `-S`, que cuenta, y `-G`, que busca.
    const desdeMain = texto(ejecutar(repoConRamas(), 'git log -S "cazuela" --oneline'))
      .split('\n')
      .filter((fila) => fila !== '');

    expect(desdeMain).toHaveLength(1);
    expect(desdeMain[0]).toContain('Agrega la lista de platos');

    // Lo que si cambia la cuenta es la palabra que entra de verdad.
    const chuchoca = texto(ejecutar(repoConRamas(), 'git log -S "chuchoca" --oneline'))
      .split('\n')
      .filter((fila) => fila !== '');

    expect(chuchoca).toHaveLength(1);
    expect(chuchoca[0]).toContain('Precisa que la cazuela lleva chuchoca');
  });

  it('git log -S --all alcanza la rama que quita la cadena', () => {
    const filas = texto(ejecutar(repoConRamas(), 'git log -S "cazuela" --oneline --all'))
      .split('\n')
      .filter((fila) => fila !== '');

    expect(filas).toHaveLength(2);
    expect(filas.join('\n')).toContain('Reemplaza la cazuela por el lomo saltado');
  });

  it('git log -S con una cadena que no esta no devuelve nada', () => {
    expect(texto(ejecutar(repoConRamas(), 'git log -S "sushi" --oneline'))).toBe('');
  });

  it('git show trae su parche', () => {
    const salida = texto(ejecutar(repoConRamas(), 'git show HEAD'));

    expect(salida).toContain('Precisa que la cazuela lleva chuchoca');
    expect(salida).toContain('+- cazuela con chuchoca');
    expect(salida).toContain('-- cazuela');
  });

  it('la union se lleva el texto de la otra rama, no un archivo vacio', () => {
    const resultado = correrHasta(repoConRamas(), 'git merge azteca');
    const estado = resultado.estado;

    // El resumen que la propia fusion imprime cuenta las lineas que trajo.
    expect(texto(resultado)).toContain("Merge made by the 'ort' strategy.");
    expect(texto(resultado)).toContain('recetas/guacamole.md | 3 +++');
    expect(texto(resultado)).toContain('1 file changed, 3 insertions(+)');
    // Git imprime el modo del archivo nuevo al fusionar, y no en `--stat`.
    expect(texto(resultado)).toContain('create mode 100644 recetas/guacamole.md');

    // El archivo que trae azteca llega entero. Antes llegaba vacio: no estaba
    // ni en nuestro directorio ni en nuestra confirmacion, y el area de
    // preparacion no tenia de donde sacarlo.
    expect(textoEnCabeza(estado, 'recetas/guacamole.md')).toContain('Palta, cebolla morada');
    // Y lo nuestro sigue como estaba.
    expect(textoEnCabeza(estado, 'platos.md')).toContain('cazuela con chuchoca');
  });

  it('git show sobre una union no lleva parche, y con --stat si resume', () => {
    // Las dos formas comprobadas contra Git sobre el escenario del
    // laboratorio 05, que es donde el enunciado las escribe.
    const estado = correr(repoConRamas(), 'git merge azteca');

    const sinOpciones = texto(ejecutar(estado, 'git show HEAD'));
    expect(sinOpciones).toContain('Merge: ');
    expect(sinOpciones).not.toContain('@@');
    expect(sinOpciones).not.toContain('file changed');

    // Es el paso 2.3 del laboratorio 05: lo que hay que mirar es la linea de
    // los dos padres, y debajo lo que la union trajo.
    const conResumen = texto(ejecutar(estado, 'git show --stat HEAD'));
    expect(conResumen).toContain('Merge: ');
    expect(conResumen).toContain('recetas/guacamole.md | 3 +++');
    expect(conResumen).toContain('1 file changed, 3 insertions(+)');
    // Y aqui no: el modo lo imprime la fusion, no el resumen.
    expect(conResumen).not.toContain('create mode');
  });

  it('git show -s calla el parche y enumera los archivos', () => {
    const salida = texto(ejecutar(repoConRamas(), 'git show -s HEAD'));

    expect(salida).not.toContain('@@');
    expect(salida).toContain('    platos.md');
  });

  it('git show HEAD:ruta muestra el archivo de esa confirmacion', () => {
    const salida = texto(ejecutar(repoConRamas(), 'git show HEAD:platos.md'));

    expect(salida).toContain('- cazuela con chuchoca');
    expect(salida).not.toContain('diff --git');
  });

  it('git cat-file -p sobre una confirmacion muestra su cabecera', () => {
    const salida = texto(ejecutar(repoConRamas(), 'git cat-file -p HEAD'));

    expect(salida).toContain('tree ');
    expect(salida).toContain('parent ');
    expect(salida).toContain('author Sofia Rojas');
  });

  it('git cat-file -p sobre un archivo muestra su texto', () => {
    const salida = texto(ejecutar(repoConRamas(), 'git cat-file -p HEAD:platos.md'));

    expect(salida).toContain('- cazuela con chuchoca');
  });

  it('git cat-file -p sobre lo que no existe reclama como Git', () => {
    const resultado = ejecutar(repoConRamas(), 'git cat-file -p fantasma');

    expect(resultado.error).toBe(true);
    expect(texto(resultado)).toContain('Not a valid object name');
  });

  it('wc cuenta lineas, palabras y bytes del archivo', () => {
    expect(texto(ejecutar(repoLimpio(), 'wc -l credenciales.txt')).trim()).toBe(
      '3 credenciales.txt',
    );
    expect(texto(ejecutar(repoLimpio(), 'wc -c credenciales.txt')).trim()).toBe(
      '76 credenciales.txt',
    );
  });

  it('git diff --stat resume en vez de mostrar el parche', () => {
    const salida = texto(correrHasta(repoLineal(), 'git diff --stat'));

    expect(salida).not.toContain('@@');
    expect(salida).toContain('ingredientes.md |');
    expect(salida).toContain('1 file changed');
  });

  it('grep encuentra los marcadores de conflicto, que es para lo que el guion la usa', () => {
    const estado = correr(repoConRamas(), 'git merge andina');
    const salida = texto(
      correrHasta(estado, 'grep -n "<<<<<<<\\|=======\\|>>>>>>>" platos.md'),
    );

    // Las tres lineas de marcadores, numeradas, que es lo que el punto 3.5 del
    // laboratorio 05 hace comprobar antes de confirmar.
    expect(salida.split('\n')).toHaveLength(3);
    expect(salida).toContain('<<<<<<< HEAD');
    expect(salida).toContain('>>>>>>> andina');
  });

  it('grep no devuelve nada cuando el archivo esta limpio', () => {
    expect(texto(correrHasta(repoConRamas(), 'grep -rn "<<<<<<<" .'))).toBe('');
  });

  it('grep con -r recorre el proyecto y antepone la ruta', () => {
    const estado = correr(repoConRamas(), 'git merge andina');
    const salida = texto(correrHasta(estado, 'grep -rn "<<<<<<<" .'));

    expect(salida).toContain('./platos.md:');
  });

  it('wc sobre un archivo que no esta reclama como el interprete', () => {
    expect(texto(ejecutar(repoLimpio(), 'wc -c fantasma.md'))).toContain(
      'No such file or directory',
    );
  });

  it('el parche de una confirmacion y la comparacion entre arboles dicen lo mismo', () => {
    const estado = repoConRamas();
    const cabeza = idActual(estado);
    const cambios = comparacionesEntre(estado, 'no existe', cabeza);

    // Contra un arbol vacio, todo el arbol de la cabeza sale como nuevo.
    expect(cambios.map((uno) => uno.ruta)).toEqual([
      'README.md',
      'ingredientes.md',
      'platos.md',
    ]);
    expect(cambios.every((uno) => uno.antes === null)).toBe(true);
  });
});

/**
 * Las dos decisiones que el SPEC 010 dejo caducadas y el SPEC 012 encontro al
 * revisarlas: la zona en que se escribe la fecha y el orden del historial.
 *
 * Las dos estaban sin ninguna prueba que las fijara, que es exactamente por lo
 * que pudieron quedarse mal sin que nadie se enterara. Lo que estos `expect`
 * escriben es lo que imprime Git, comprobado sobre el repositorio que
 * `preparar.sh` deja en el disco.
 */
describe('la fecha se escribe en la zona que declara', () => {
  /** La punta de `main` en el laboratorio 05, que es la que Git imprime arriba. */
  const puntaDelCinco = (): string => {
    const estado = escenarioPorId('lab-05');
    const cabeza = idActual(estado);
    return estado.confirmaciones.find((una) => una.id === cabeza)?.fecha ?? '';
  };

  it('la hora es la de -0300, y no la de UTC', () => {
    // Git imprime esto para ese instante. El motor rotulaba -0300 y escribia
    // las 13:25, que son las de UTC: tres horas de diferencia con la terminal.
    expect(puntaDelCinco()).toBe('Tue Jul 2 10:25:00 2024 -0300');
  });

  it('el dia va sin rellenar, como lo escribe Git', () => {
    // «Jul 2», no «Jul  2»: Git no alinea el numero del dia.
    expect(puntaDelCinco()).not.toContain('  2 ');
  });

  it('la fecha corta tambien sale en la zona declarada', () => {
    const salida = texto(
      ejecutar(escenarioPorId('lab-02'), 'git log --format="%ad" --date=short'),
    );

    expect(salida.split('\n')).toEqual([
      '2024-09-30',
      '2024-07-18',
      '2024-04-09',
      '2024-02-27',
      '2024-01-15',
    ]);
  });

  it('no depende de la zona horaria de la maquina', () => {
    // El motor es codigo puro (restriccion R3): la fecha se calcula corriendo
    // el instante y leyendolo en UTC, no preguntandole la zona al sistema.
    const fuente = readFileSync(
      fileURLToPath(new URL('../src/core/identificadores.ts', import.meta.url)),
      'utf8',
    );

    expect(fuente).not.toContain('getHours');
    expect(fuente).not.toContain('toLocaleString');
    expect(fuente).not.toContain('getTimezoneOffset');
  });
});

describe('el historial se ordena por fecha, como git log', () => {
  /** Los mensajes de `git log --oneline`, sin el identificador ni la decoracion. */
  const mensajesDe = (salida: string): readonly string[] =>
    salida
      .split('\n')
      .map((fila) => fila.replace(/^\S+ /, '').replace(/^\([^)]*\) /, ''));

  it('en una sola rama no cambia nada', () => {
    const salida = texto(ejecutar(escenarioPorId('lab-02'), 'git log --oneline'));

    expect(mensajesDe(salida)).toEqual([
      'se docuemnta la reseta del pastel de choclo',
      'se suma la lista de cocineros',
      'se agregan los ingredientes base',
      'se agregan los platos chilenos',
      'se inicia el recetario',
    ]);
  });

  it('con --all intercala las ramas que se cruzan en el tiempo', () => {
    // El laboratorio 07 declara primero las cuatro confirmaciones de main y
    // despues las cuatro de la rama de trabajo, que ocurrieron entre medio.
    // Git las intercala por fecha; el orden de creacion las mostraba en dos
    // bloques. Comprobado contra Git sobre un repositorio de esa misma forma.
    const salida = texto(ejecutar(escenarioPorId('lab-07'), 'git log --oneline --all'));

    expect(mensajesDe(salida)).toEqual([
      'Agrega la tabla de cocineros',
      'Agrega la receta del pastel de choclo',
      'arreglos',
      'mas cambios',
      'cambios',
      'wip',
      'Agrega platos e ingredientes',
      'Agrega el README del recetario',
    ]);
  });

  it('el orden por fecha no rompe la relacion entre padres e hijos del guion', () => {
    // En los ocho escenarios ninguna confirmacion es anterior a su padre, de
    // modo que el orden por fecha tambien respeta el grafo. Si algun escenario
    // declarara una fecha al reves, esta prueba lo dice.
    for (const declaracion of ESCENARIOS) {
      const estado = escenarioPorId(declaracion.id);
      for (const confirmacion of estado.confirmaciones) {
        for (const idPadre of confirmacion.padres) {
          const padre = estado.confirmaciones.find((una) => una.id === idPadre);
          expect(
            confirmacion.epoca >= (padre?.epoca ?? 0),
            `${declaracion.id}: «${confirmacion.mensaje}» es anterior a su padre`,
          ).toBe(true);
        }
      }
    }
  });
});

/**
 * La deteccion de conflictos por linea (punto 5.6 del SPEC 012, hecho despues).
 *
 * El punto 5.4 pidio no tocar la deteccion mientras se introducia el modelo de
 * contenido, para no juntar dos riesgos. Hecho eso, la deteccion pasa a
 * preguntarle a la fusion de tres vias si los dos cambios se pisan de verdad,
 * en vez de mirar si las dos ramas tocaron el mismo archivo.
 *
 * Todo lo que estos `expect` fijan se comprobo contra Git de verdad, sobre
 * repositorios construidos con la misma forma.
 */
describe('la fusion detecta el conflicto por linea', () => {
  /** Reescribe `platos.md` sumando un fondo, que es un cambio lejos del final. */
  const SUMA_UN_FONDO = [
    'echo "# Platos" > platos.md',
    'echo "" >> platos.md',
    'echo "## Fondos" >> platos.md',
    'echo "" >> platos.md',
    'echo "- pastel de choclo" >> platos.md',
    'echo "- cazuela con chuchoca" >> platos.md',
    'echo "- curanto" >> platos.md',
    'echo "- charquican" >> platos.md',
    'echo "" >> platos.md',
    'echo "## Entradas" >> platos.md',
    'echo "" >> platos.md',
    'echo "- empanadas de pino" >> platos.md',
  ];

  it('dos ramas que tocan el mismo archivo en lineas distintas se fusionan solas', () => {
    const partida = correr(
      repoConRamas(),
      'git switch -c postres',
      'echo "- sopaipillas" >> platos.md',
      'git add platos.md',
      'git commit -m "Agrega las sopaipillas"',
      'git switch main',
      ...SUMA_UN_FONDO,
      'git add platos.md',
      'git commit -m "Suma el charquican a los fondos"',
    );

    const resultado = correrHasta(partida, 'git merge postres');

    // Git no declara conflicto aqui, y el simulador lo declaraba: es el único
    // punto en que le enseñaba algo falso al participante.
    expect(resultado.estado.fusion).toBeNull();
    expect(texto(resultado)).toContain('Auto-merging platos.md');
    expect(texto(resultado)).toContain("Merge made by the 'ort' strategy.");
    expect(texto(resultado)).not.toContain('CONFLICT');

    // Y el archivo queda con los dos cambios, sin marcadores.
    const platos = textoDeTrabajo(resultado.estado, 'platos.md') ?? '';
    expect(platos).toContain('- charquican');
    expect(platos).toContain('- sopaipillas');
    expect(platos).not.toContain('<<<<<<<');

    // El arbol de la union guarda lo mismo que el directorio.
    expect(textoEnCabeza(resultado.estado, 'platos.md')).toBe(platos);
  });

  it('dos ramas que tocan la misma linea siguen chocando', () => {
    // Es el caso del laboratorio 05 con `andina`, que no cambia.
    const resultado = correrHasta(repoConRamas(), 'git merge andina');

    expect(resultado.estado.fusion?.conflictos).toEqual(['platos.md']);
    expect(texto(resultado)).toContain('CONFLICT (content): Merge conflict in platos.md');
    expect(textoDeTrabajo(resultado.estado, 'platos.md')).toContain('<<<<<<< HEAD');
  });

  it('con un archivo de cada clase, Git los nombra por ruta y pega el reclamo al que choco', () => {
    const partida = correr(
      repoConRamas(),
      'git switch -c mixta',
      'echo "- sal marina" >> ingredientes.md',
      'echo "- sopaipillas" >> platos.md',
      'git add .',
      'git commit -m "Suma sal marina y sopaipillas"',
      'git switch main',
      'echo "- oregano" >> ingredientes.md',
      ...SUMA_UN_FONDO,
      'git add .',
      'git commit -m "Suma oregano y charquican"',
    );

    const resultado = correrHasta(partida, 'git merge mixta');

    // Comprobado contra Git: una linea por archivo, en orden de ruta, y el
    // reclamo justo debajo del que choco.
    expect(texto(resultado).split('\n')).toEqual([
      'Auto-merging ingredientes.md',
      'CONFLICT (content): Merge conflict in ingredientes.md',
      'Auto-merging platos.md',
      'Automatic merge failed; fix conflicts and then commit the result.',
    ]);

    // El que choco queda sin fusionar; el que no, preparado.
    expect(resultado.estado.fusion?.conflictos).toEqual(['ingredientes.md']);
    expect(archivoPorNombre(resultado.estado, 'ingredientes.md')?.estado).toBe('en-conflicto');
    expect(archivoPorNombre(resultado.estado, 'platos.md')?.estado).toBe('preparado');
    expect(textoDeTrabajo(resultado.estado, 'platos.md')).not.toContain('<<<<<<<');
  });

  it('abortar sigue devolviendo el directorio a como estaba', () => {
    const partida = repoConRamas();
    const despues = correr(partida, 'git merge andina', 'git merge --abort');

    expect(despues).toEqual(partida);
  });
});

describe('echo escribe la linea en blanco', () => {
  it('con la cadena vacia agrega una linea, no nada', () => {
    // `echo "" >> archivo` escribe un salto, en bash y ahora en el simulador.
    // Los archivos del recetario separan sus secciones con una linea vacia.
    const estado = correr(
      repoConRamas(),
      'echo "uno" > nuevo.md',
      'echo "" >> nuevo.md',
      'echo "dos" >> nuevo.md',
    );

    expect(textoDeTrabajo(estado, 'nuevo.md')).toBe('uno\n\ndos\n');
  });
});

/**
 * Los cuatro casos de fusion del laboratorio 05.
 *
 * El escenario existe para mostrarlos, y cada rama esta puesta ahi para uno.
 * Si alguien mueve una fecha, un archivo o una linea y alguna rama deja de
 * hacer lo suyo, el laboratorio pierde su ejercicio y nadie se enteraria: por
 * eso los cuatro estan fijados aqui, en el orden en que el enunciado los
 * recorre. Todo lo que se afirma se comprobo contra Git sobre el repositorio
 * que `preparar.sh` deja en el disco.
 */
describe('el laboratorio 05 muestra los cuatro casos de fusion', () => {
  it('las cuatro ramas estan, y main es donde arranca el participante', () => {
    const estado = repoConRamas();

    expect(texto(ejecutar(estado, 'git branch')).split('\n')).toEqual([
      '  andina',
      '  azteca',
      '  criolla',
      '* main',
      '  tailandesa',
    ]);
  });

  it('1 · tailandesa avanza el puntero y no crea nada', () => {
    const antes = repoConRamas();
    const resultado = correrHasta(antes, 'git merge tailandesa');

    expect(texto(resultado)).toContain('Fast-forward');
    expect(resultado.estado.confirmaciones).toHaveLength(antes.confirmaciones.length);
  });

  it('2 · azteca crea una union, tocando otro archivo', () => {
    const resultado = correrHasta(repoConRamas(), 'git merge azteca');

    expect(texto(resultado)).toContain("Merge made by the 'ort' strategy.");
    // No hubo que fusionar ningun archivo: nadie mas lo habia tocado.
    expect(texto(resultado)).not.toContain('Auto-merging');
    expect(resultado.estado.fusion).toBeNull();
  });

  it('3 · criolla toca el MISMO archivo que main y se fusiona sola', () => {
    // Es el caso que desarma la creencia de que tocar el mismo archivo es
    // conflicto seguro, y el unico que el escenario no tenia.
    const partida = repoConRamas();
    const cabeza = idActual(partida);
    const base = baseComun(partida, cabeza ?? '', ramaPorNombre(partida, 'criolla')?.id ?? '');

    // Las dos mitades de la premisa: main cambio platos.md desde la base...
    expect(textoEnConfirmacion(partida, base, 'platos.md')).not.toBe(
      textoEnConfirmacion(partida, cabeza, 'platos.md'),
    );
    // ...y criolla tambien.
    expect(textoEnConfirmacion(partida, base, 'platos.md')).not.toBe(
      textoEnConfirmacion(partida, ramaPorNombre(partida, 'criolla')?.id ?? '', 'platos.md'),
    );

    const resultado = correrHasta(partida, 'git merge criolla');

    expect(texto(resultado)).toContain('Auto-merging platos.md');
    expect(texto(resultado)).toContain("Merge made by the 'ort' strategy.");
    expect(texto(resultado)).not.toContain('CONFLICT');
    expect(resultado.estado.fusion).toBeNull();

    // Y el archivo queda con los dos cambios y sin marcadores.
    const platos = textoDeTrabajo(resultado.estado, 'platos.md') ?? '';
    expect(platos).toContain('- cazuela con chuchoca');
    expect(platos).toContain('- sopaipillas');
    expect(platos).not.toContain('<<<<<<<');
  });

  it('4 · andina toca la MISMA LINEA que main y choca', () => {
    const resultado = correrHasta(repoConRamas(), 'git merge andina');

    expect(texto(resultado)).toContain('CONFLICT (content): Merge conflict in platos.md');
    expect(resultado.estado.fusion?.conflictos).toEqual(['platos.md']);
  });

  it('criolla y andina solo se diferencian en que linea de platos.md tocan', () => {
    // El paralelo es deliberado: las dos nacen del mismo punto, las dos
    // cambian platos.md y las dos agregan una receta. Es lo que hace que la
    // prediccion del enunciado sea un ejercicio y no una adivinanza.
    const estado = repoConRamas();
    const criolla = estado.confirmaciones.find(
      (una) => una.id === ramaPorNombre(estado, 'criolla')?.id,
    );
    const andina = estado.confirmaciones.find(
      (una) => una.id === ramaPorNombre(estado, 'andina')?.id,
    );

    expect(criolla?.padres).toEqual(andina?.padres);
    expect(criolla?.archivos).toEqual(['platos.md', 'recetas/sopaipillas.md']);
    expect(andina?.archivos).toEqual(['platos.md', 'recetas/lomo-saltado.md']);
  });

  it('las cuatro fusiones seguidas dejan tres uniones y el archivo completo', () => {
    // El recorrido entero del enunciado, con la resolucion del conflicto al
    // final. Es lo que el verificador exige en su estado final.
    const estado = correr(
      repoConRamas(),
      'git merge tailandesa',
      'git branch -d tailandesa',
      'git merge azteca',
      'git branch -d azteca',
      'git merge criolla',
      'git branch -d criolla',
      'git merge andina',
      // Se resuelve dejando los dos platos, que es lo que el enunciado pide.
      'echo "# Platos" > platos.md',
      'echo "" >> platos.md',
      'echo "## Fondos" >> platos.md',
      'echo "" >> platos.md',
      'echo "- pastel de choclo" >> platos.md',
      'echo "- cazuela con chuchoca" >> platos.md',
      'echo "- lomo saltado" >> platos.md',
      'echo "- curanto" >> platos.md',
      'echo "" >> platos.md',
      'echo "## Entradas" >> platos.md',
      'echo "" >> platos.md',
      'echo "- empanadas de pino" >> platos.md',
      'echo "- sopaipillas" >> platos.md',
      'git add platos.md',
      'git commit -m "Merge branch \'andina\'"',
      'git branch -d andina',
    );

    expect(estado.ramas.map((rama) => rama.nombre)).toEqual(['main']);
    expect(estado.confirmaciones.filter((una) => una.padres.length > 1)).toHaveLength(3);
    expect(textoDeTrabajo(estado, 'platos.md')).not.toContain('<<<<<<<');
    expect(texto(correrHasta(estado, 'git status'))).toContain('working tree clean');

    // Las cuatro recetas de las cuatro ramas estan en el proyecto.
    const seguidos = texto(correrHasta(estado, 'git ls-files'));
    for (const receta of ['pad-thai', 'guacamole', 'sopaipillas', 'lomo-saltado']) {
      expect(seguidos).toContain(`recetas/${receta}.md`);
    }
  });
});

/**
 * `git diff` entre dos puntos de la historia.
 *
 * Estaba en el paso 3.1 del enunciado del laboratorio 05 desde que ese
 * laboratorio existe, y el simulador **la aceptaba y no imprimia nada**: la
 * cuarta respuesta que el contrato del SPEC 010 no admite, en el mismo paso
 * donde el participante tiene que entender por que dos ramas van a chocar.
 * Salio al escribir el cuarto caso de fusion.
 */
describe('git diff entre revisiones', () => {
  it('compara dos referencias, y con -- se limita a una ruta', () => {
    const salida = texto(correrHasta(repoConRamas(), 'git diff main andina -- platos.md'));

    expect(salida).toContain('diff --git a/platos.md b/platos.md');
    expect(salida).toContain('-- cazuela con chuchoca');
    expect(salida).toContain('+- lomo saltado');
    // La ruta limita: la receta que andina agrega no sale.
    expect(salida).not.toContain('lomo-saltado.md');
  });

  it('sin ruta trae todo lo que cambio entre las dos', () => {
    const salida = texto(correrHasta(repoConRamas(), 'git diff main andina'));

    expect(salida).toContain('diff --git a/platos.md b/platos.md');
    expect(salida).toContain('diff --git a/recetas/lomo-saltado.md b/recetas/lomo-saltado.md');
    expect(salida).toContain('new file mode 100644');
  });

  it('una sola referencia compara contra el directorio de trabajo', () => {
    const estado = correr(repoConRamas(), 'echo "- charquican" >> platos.md');
    const salida = texto(correrHasta(estado, 'git diff main'));

    expect(salida).toContain('+- charquican');
  });

  it('una referencia que no existe reclama como Git, en vez de callarse', () => {
    const resultado = correrHasta(repoConRamas(), 'git diff fantasma main');

    expect(resultado.error).toBe(true);
    expect(texto(resultado)).toContain("ambiguous argument 'fantasma'");
  });

  it('el diff de criolla y el de andina se diferencian en que linea tocan', () => {
    // Es lo que el participante compara en el paso 3.1 para predecir.
    const conCriolla = texto(correrHasta(repoConRamas(), 'git diff main criolla -- platos.md'));
    const conAndina = texto(correrHasta(repoConRamas(), 'git diff main andina -- platos.md'));

    expect(conCriolla).toContain('+- sopaipillas');
    expect(conAndina).toContain('+- lomo saltado');
    expect(conAndina).not.toContain('sopaipillas');
  });
});
