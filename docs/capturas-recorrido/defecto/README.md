# El grafo no se movía · SPEC 011

Estas cuatro capturas documentan el defecto que abrió el SPEC 011 y su arreglo.
Son las únicas del recorrido que van versionadas; las otras doscientas ochenta y
tantas se rehacen con `npm run e2e` y quedan fuera del seguimiento.

Las cuatro se tomaron sobre `SIMULADOR.html` abierto desde el sistema de
archivos, con doble clic, que es como lo abre el participante.

## Antes

**`01-antes-el-grafo-nunca-se-mueve.png`** · El simulador abierto con doble clic
y las primeras cinco órdenes del laboratorio 02 escritas en su consola. Cada una
responde `fatal: not a git repository`, y el panel del grafo dice «Todavía no
hay confirmaciones». Nodos dibujados: **cero**.

**`02-antes-ni-siquiera-con-una-confirmacion.png`** · La misma sesión después de
`git commit --amend`, que es la primera orden del laboratorio que debería mover
el grafo. Sigue sin dibujarse nada. Nodos dibujados: **cero**.

La causa no está en el dibujo. Abierto con doble clic el simulador arranca
siempre en el escenario del laboratorio 01, donde todavía no hay repositorio, y
**ningún enunciado decía que había que llevarlo al escenario del laboratorio que
se está haciendo**. El recorrido entero ocurría sobre un repositorio que no
existe.

## Después

**`03-despues-el-escenario-del-laboratorio.png`** · Las mismas cinco órdenes,
con el simulador abierto como el enunciado ahora manda, en `?lab=02`. Las
órdenes funcionan y el grafo dibuja las cinco confirmaciones del escenario.

**`04-despues-el-grafo-se-mueve.png`** · Después de `git commit --amend`. La
confirmación nueva aparece arriba, `main` y `HEAD` se mudan a ella, y la
confirmación que quedó sin referencia se dibuja en gris con su rótulo. Nodos
dibujados: **seis**.

## Qué impide que vuelva

El arnés de punta a punta **ya no escribe la dirección a mano**. La saca del
enunciado, igual que saca las órdenes: si un enunciado no dice en qué escenario
se abre el simulador, el recorrido de ese laboratorio falla. Está en
`simulador/cypress/soporte/ordenes.ts`, y la comprobación en
`simulador/cypress/e2e/laboratorios.cy.ts`.
