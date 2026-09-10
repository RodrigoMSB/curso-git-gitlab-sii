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
| `01-lab-01-inicio.png` | lab-01 | Estado de partida del laboratorio 01. Sin repositorio todavia, los seis archivos del recetario sin seguimiento en rojo en el directorio de trabajo, y el grafo diciendo que la primera confirmacion aparecera ahi. |
| `02-lab-02-inicio.png` | lab-02 | Historia lineal de cinco confirmaciones sobre `main`, firmadas por tres personas distintas, con `HEAD` colgando de la rama. En el directorio de trabajo, el cambio que sobra sin preparar y el archivo preparado por error. Se ve la reserva de crecimiento del grafo: el dibujo crece hacia adentro del panel y las areas no se mueven. |
| `03-lab-05-inicio.png` | lab-05 | Las ramas `tailandesa`, `azteca` y `andina` separadas del tronco, `main` con `HEAD` colgando debajo, y cada rama en su color. `tailandesa` cuelga de la punta de `main`; las otras dos nacen antes. |
| `04-lab-05-rama-nueva-y-confirmacion.png` | lab-05 | Criterio CA2 del SPEC 002. Despues de `git switch -c postres`, modificar `platos.md`, prepararlo y confirmar: la etiqueta `postres` nueva, `HEAD` colgando de ella y la confirmacion recien creada arriba. |
| `05-lab-05-previsualizacion-fusion.png` | lab-05 | Criterio CA3 del SPEC 002. `git merge andina` escrita y sin ejecutar: la union que la fusion produciria, dibujada en trazo discontinuo y sin relleno, sus dos aristas tambien discontinuas, y el aviso de la consola en ambar. |
| `06-lab-07-despues-del-rebase.png` | lab-07 | Criterio CA4 del SPEC 002. Tras `git rebase main`, las cuatro confirmaciones originales de la rama de trabajo quedan en gris atenuado y siguen dibujadas, rotuladas `sin referencia`, mientras las copias nuevas aparecen arriba con identificadores distintos. |
