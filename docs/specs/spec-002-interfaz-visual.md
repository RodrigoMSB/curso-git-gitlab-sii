# SPEC 002 · Interfaz visual del simulador

Proyecto Taller Git y GitLab para el SII.
Arquitecto Claude · Product owner Rodrigo Silva Bravo · Desarrollo Claude Code.

Depende del SPEC 001, ya entregado. Cubre la pantalla que vera el participante. No modifica el motor salvo en lo indicado en la seccion 9.

---

## 1. Que se esta construyendo

Una pantalla donde el participante escribe una orden de Git en una consola simulada y observa el efecto sobre el grafo de confirmaciones, sobre las areas de trabajo y sobre las estructuras internas, todo en el mismo golpe de vista.

La pantalla se usa en dos situaciones distintas y ambas condicionan el diseno. El relator la proyecta por videoconferencia mientras explica, y el participante la abre en su propio equipo mientras practica. Lo primero exige legibilidad bajo compresion de video, lo segundo exige que funcione sin ayuda.

## 2. Restricciones heredadas

Se mantienen las cuatro restricciones del SPEC 001. Se agregan dos.

**R5. Ninguna fuente tipografica externa.** Se usan las familias del sistema. Una fuente descargada rompe R2 y ademas retrasa el primer dibujado.

**R6. La interfaz no contiene logica de Git.** Lee el estado que expone el motor y despacha ordenes. Cualquier calculo sobre confirmaciones, ramas o punteros que aparezca en un componente es motivo de rechazo. Si algo falta, se agrega al motor, no a la vista.

## 3. Disposicion de la pantalla

Cinco zonas. De arriba hacia abajo y de izquierda a derecha.

```
┌────────────────────────────────────────────────────────────┐
│ A · barra de estado                                        │
├───────────────────────────┬────────────────────────────────┤
│ B · consola               │ C · grafo                      │
│                           │                                │
├───────────────────────────┴────────────────────────────────┤
│ D · areas y estructuras                                    │
├────────────────────────────────────────────────────────────┤
│ E · linea de tiempo                                        │
└────────────────────────────────────────────────────────────┘
```

**A. Barra de estado.** Nombre del repositorio, rama actual, cantidad de cambios sin confirmar, selector de escenario, y los interruptores de previsualizacion, modo relator y reinicio. Debe indicar que la aplicacion trabaja localmente y sin red, porque cuando algo falle en clase eso permite descartar de inmediato que el problema sea la conectividad.

**B. Consola.** Ocupa el lado izquierdo. Se detalla en la seccion 4.

**C. Grafo.** Ocupa el lado derecho y es mas ancho que la consola cuando el escenario tiene ramas. Se detalla en la seccion 5.

**D. Areas y estructuras.** Franja horizontal con cuatro columnas fijas para directorio de trabajo, area de preparacion, repositorio local y repositorio remoto. Debajo, y solo cuando corresponde, tres paneles que aparecen segun el estado. Pila de guardado temporal cuando hay entradas. Diferencias cuando la ultima orden fue una comparacion. Objetos internos cuando el participante inspecciona una confirmacion.

**E. Linea de tiempo.** Un segmento por orden ejecutada, con retroceso y avance. Se detalla en la seccion 6.

Los paneles del punto D que no aplican no se muestran, no se muestran vacios. La pantalla debe respirar en los escenarios simples de la sesion 1 y llenarse recien cuando el contenido lo justifica.

## 4. Consola

**4.1** Debe parecerse a Git Bash sobre Windows, que es el entorno donde los participantes trabajaran. Fondo oscuro, dos lineas de indicador, la primera con usuario y maquina en verde, ruta en amarillo y rama entre parentesis en cian, la segunda con el signo de moneda y la orden. Fuente monoespaciada del sistema.

**4.2** Historial de ordenes navegable con las flechas arriba y abajo. Es lo primero que un participante intenta y su ausencia se nota de inmediato.

**4.3** El cursor de texto recibe el foco al cargar la pagina y lo recupera al hacer clic en cualquier parte de la consola.

**4.4** La tecla de tabulacion completa la orden cuando hay una unica coincidencia entre las ordenes conocidas y los nombres de rama existentes. Si hay varias, las lista sin completar.

**4.5** Las salidas conservan los colores que usa Git real. Rojo para lo modificado sin preparar, verde para lo preparado, amarillo para las advertencias.

**4.6** La zona de salida se desplaza sola hacia el final al agregar contenido, salvo que el participante haya subido manualmente, en cuyo caso se respeta su posicion.

**4.7** La orden `clear` vacia la salida sin alterar el estado del repositorio ni la linea de tiempo.

## 5. Grafo

**5.1 Orientacion.** Las confirmaciones mas recientes van arriba y las ramas se despliegan hacia la derecha. Esta orientacion coincide con la que el relator dibuja a mano y con la que entrega el registro de Git. No invertirla.

**5.2 Calculo de posiciones.** El calculo de coordenadas es logica pura y vive en un modulo propio, fuera de los componentes, con sus propias pruebas. Recibe la lista de confirmaciones y devuelve posiciones. No usa React ni mide el documento.

**5.3 Sin bibliotecas de grafos.** El dibujo se hace en SVG escrito a mano. La biblioteca habitual para esto esta archivada y su propio autor desaconseja usarla.

**5.4 Punteros.** Cada rama se dibuja como una etiqueta rectangular junto a la confirmacion que apunta. La rama actual se distingue de las demas. El puntero de posicion se dibuja como una etiqueta separada, en color distinto, colgando de la rama a la que sigue. Cuando esta desconectado, cuelga directamente de la confirmacion.

Esto ultimo es el punto pedagogico central del grafo. Al cambiar de rama, lo unico que se mueve en pantalla debe ser esa etiqueta.

**5.5 Etiquetas de version.** Se dibujan al otro lado de la confirmacion, con forma y color distintos de los nombres de rama, para que no se confundan.

**5.6 Confirmaciones huerfanas.** Las confirmaciones que quedaron sin ninguna referencia apuntandolas se dibujan en gris atenuado y permanecen en pantalla. No se ocultan ni se eliminan. Es lo que hace comprensible el registro de referencias y lo que sostiene los laboratorios 07 y 08 del taller.

**5.7 Movimiento.** Las transiciones responden a la accion del participante y muestran que cambio. Un puntero que se desplaza se anima, una confirmacion nueva aparece con una entrada breve. No hay movimiento que no responda a una accion. Se respeta la preferencia del sistema de movimiento reducido.

**5.8 Limite de tamano.** Sobre cuarenta confirmaciones se muestran las mas recientes y se indica cuantas quedaron fuera. El escenario de clase nunca llega a ese numero, pero el limite evita que la pantalla se degrade si alguien experimenta.

## 6. Previsualizacion

**6.1** Con la previsualizacion activa, mientras el participante escribe una orden que modificaria el grafo, el resultado se dibuja en trazo discontinuo y sin relleno antes de ejecutarla.

**6.2** Se usa la funcion de previsualizacion que ya expone el motor. No se recalcula nada en la vista.

**6.3** La consola indica que la previsualizacion esta activa y que la tecla de entrada ejecuta y la tecla de escape descarta.

**6.4** El caso del rebase merece atencion particular. La previsualizacion debe mostrar al mismo tiempo las confirmaciones originales, que quedaran huerfanas, y las copias nuevas en trazo discontinuo. Nunca debe dar la impresion de que las confirmaciones se deslizan hacia otra base. Se copian, no se mueven, y la pantalla tiene que decir eso sin palabras.

## 7. Linea de tiempo

**7.1** Cada orden ejecutada agrega un segmento. Al retroceder, la pantalla completa vuelve al estado de ese momento, incluida la consola.

**7.2** Si el participante ejecuta una orden estando en un punto anterior, la historia se corta desde ahi, igual que ocurre en Git.

**7.3** Los segmentos son navegables con el raton y con el teclado, y muestran la orden correspondiente al posarse sobre ellos.

**7.4** La linea de tiempo no persiste entre recargas. No se usa almacenamiento del navegador en este spec.

## 8. Modo relator

Un interruptor que prepara la pantalla para ser proyectada por videoconferencia.

**8.1** Aumenta el tamano tipografico de forma proporcional en toda la interfaz.

**8.2** Oculta los paneles secundarios de la zona D y deja solo la consola, el grafo y las cuatro areas. En proyeccion comprimida los paneles pequenos no se leen y solo aportan ruido.

**8.3** Ningun texto de la interfaz queda por debajo de once pixeles en modo normal ni por debajo de catorce en modo relator.

## 9. Cambios al motor

Se autorizan los siguientes agregados, y solo estos.

**9.1** Una funcion que devuelva las confirmaciones huerfanas del estado actual, para que la vista pueda atenuarlas sin calcularlo.

**9.2** Una funcion que devuelva la cadena de objetos de una confirmacion, con la confirmacion, su arbol y sus elementos, para alimentar el panel de estructuras internas.

**9.3** La resolucion del identificador reservado de la fusion debe liberarse cuando se aborta la fusion. Confirmar si ya ocurre y corregirlo si no.

Cualquier otro cambio al motor se consulta antes de hacerlo.

## 10. Calidad visual

**10.1** El aspecto debe ser sobrio y legible antes que llamativo. Es una herramienta de trabajo que se mira durante veinte horas, no una demostracion.

**10.2** Superficies planas. Sin degradados, sin sombras difusas, sin efectos decorativos. La unica excepcion son los anillos de foco, que son funcionales.

**10.3** El color codifica significado y no adorna. Un color para la rama principal, otro para las ramas derivadas, otro para el puntero de posicion, atenuado para lo huerfano. No mas de eso.

**10.4** Todo elemento interactivo es alcanzable con el teclado y tiene foco visible.

**10.5** La pantalla funciona a partir de mil doscientos ochenta pixeles de ancho. Por debajo de ese ancho las zonas se apilan en vertical en lugar de comprimirse.

## 11. Criterios de aceptacion

**CA1.** La construccion sigue produciendo un unico archivo que se abre con doble clic y funciona sin red. La verificacion automatica del SPEC 001 sigue vigente.

**CA2.** Sobre el escenario tres, la secuencia de crear una rama, cambiar a ella, modificar un archivo, prepararlo y confirmar produce en pantalla, en ese orden, una etiqueta nueva sin que nada mas se mueva, el desplazamiento del puntero de posicion, un archivo pasando de la primera a la segunda columna, y una confirmacion nueva con el puntero encima.

**CA3.** Al escribir una orden de fusion sobre el escenario cuatro sin ejecutarla, aparece en el grafo una confirmacion en trazo discontinuo. Al borrar la orden, desaparece. Al ejecutarla, se solidifica conservando el mismo identificador.

**CA4.** Al ejecutar un rebase, las confirmaciones originales permanecen visibles en gris atenuado y las nuevas aparecen con identificadores distintos. Existe una prueba que verifica que las originales siguen siendo dibujadas.

**CA5.** Al ejecutar un retroceso destructivo, la confirmacion abandonada permanece en pantalla atenuada, y la orden de registro de referencias la lista.

**CA6.** El modulo de calculo de posiciones tiene pruebas propias que cubren historia lineal, dos ramas divergentes, fusion y tres ramas simultaneas.

**CA7.** Ningun componente de la vista importa logica de dominio ni calcula relaciones entre confirmaciones. Verificable por inspeccion de las importaciones.

**CA8.** La navegacion completa de la interfaz es posible con teclado.

**CA9.** El modo relator aumenta la tipografia y oculta los paneles secundarios sin romper la disposicion.

**CA10.** Con la preferencia de movimiento reducido activa, no hay animaciones.

## 12. Fuera del alcance

Los retos autoevaluados, la persistencia del progreso, cualquier conexion con una plataforma externa, los repositorios semilla en disco y todo lo relativo a GitLab.

## 13. Decisiones no especificadas

Como en el spec anterior, resolver y documentar en `docs/arquitectura.md`. Detenerse solo si la decision contradice alguna restriccion de la seccion 2.

Entregar ademas, junto con esta implementacion, la lista de las doce decisiones no especificadas del SPEC 001 y la confirmacion de que las diecinueve ordenes de la seccion 7 de ese spec quedaron implementadas con sus opciones.
