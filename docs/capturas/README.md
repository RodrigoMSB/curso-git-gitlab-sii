# Capturas de la pantalla

Tomadas del archivo unico construido (`simulador/dist/index.html`), abierto en
Chrome y conducido como lo haria un participante: escribiendo en la consola y
cambiando de escenario con el selector de la barra. Ventana de 1600 por 1000
pixeles, al doble de resolucion.

Se regeneran con el guion que las produce, sin pasos a mano:

```bash
cd simulador
npm run build
npm run capturas
```

El guion vive en `simulador/herramientas/capturas.mjs`, no usa ninguna
biblioteca y comprueba contra el documento que cada estado capturado es el que
se pidio. Con `node herramientas/capturas.mjs --ver` abre la ventana, que sirve
cuando una captura no sale como se esperaba.

Son el respaldo visual de los criterios de aceptacion del SPEC 002 que hablan
de lo que se ve, y no de lo que el modelo calcula.

| Archivo | Escenario | Que muestra |
|---|---|---|
| `01-e1-inicio.png` | E1 | Estado de partida de la sesion 1. Sin confirmaciones, los seis archivos sin seguimiento en rojo en el directorio de trabajo, el grafo diciendo que la primera confirmacion aparecera ahi. |
| `02-e2-inicio.png` | E2 | Historia lineal de cuatro confirmaciones sobre `main`, con `HEAD` colgando de la rama y el archivo modificado en el directorio de trabajo. Se ve la reserva de crecimiento del grafo: el dibujo crece hacia adentro del panel y las areas no se mueven. |
| `03-e3-inicio.png` | E3 | La rama `tailandesa` separada del tronco, `main` con `HEAD` colgando debajo, y las dos ramas en colores distintos. |
| `04-e3-rama-nueva-y-confirmacion.png` | E3 | Criterio CA2. Despues de `git switch -c postres`, modificar `platos.md`, prepararlo y confirmar: la etiqueta `postres` nueva, `HEAD` colgando de ella y la confirmacion recien creada arriba. |
| `05-e4-previsualizacion-fusion.png` | E4 | Criterio CA3. `git merge tailandesa` escrita y sin ejecutar: la union que la fusion produciria, dibujada en trazo discontinuo y sin relleno, sus dos aristas tambien discontinuas, y el aviso de la consola en ambar. |
| `06-e3-despues-del-rebase.png` | E3 | Criterio CA4. Tras `git rebase main`, las dos confirmaciones originales quedan en gris atenuado y siguen dibujadas, rotuladas `sin referencia`, mientras las copias nuevas aparecen arriba con identificadores distintos. |

