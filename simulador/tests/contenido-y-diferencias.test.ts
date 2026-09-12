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

import { describe, expect, it } from 'vitest';
import {
  arbolDe,
  bytesDe,
  comparacionesEntre,
  lineasDe,
  normalizar,
  textoDeTrabajo,
  textoEnCabeza,
  textoPreparado,
} from '../src/core/contenido';
import {
  compararLineas,
  formatearEstadisticasDe,
  formatearParche,
  fusionarTresVias,
} from '../src/core/diferencias';
import { idActual } from '../src/core/estado';
import { ejecutar } from '../src/core/motor';
import { escenarioPorId } from '../src/escenarios';
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
