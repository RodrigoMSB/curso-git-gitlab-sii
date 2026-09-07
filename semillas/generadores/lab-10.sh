#!/usr/bin/env bash
# Semilla del laboratorio 10: publicar el proyecto en la plataforma.
#
# El recetario terminado, con su historia completa y el directorio de trabajo
# limpio. Sin remoto configurado: el laboratorio empieza justamente creando el
# proyecto en la plataforma y conectandolo.

LAB=10
. "$(cd "$(dirname "$0")/.." && pwd)/lib/preambulo.sh"

semilla_iniciar "$TRABAJO"

contenido_readme | semilla_escribir README.md
semilla_confirmar 'Agrega el README del recetario'

semilla_dia_siguiente
semilla_mas_tarde 3600
contenido_platos base | semilla_escribir platos.md
semilla_confirmar 'Agrega la lista de platos'

semilla_dia_siguiente
semilla_mas_tarde 5400
contenido_ingredientes base | semilla_escribir ingredientes.md
semilla_confirmar 'Agrega los ingredientes base'

semilla_dia_siguiente 2
semilla_mas_tarde 1800
receta_pastel_de_choclo | semilla_escribir recetas/pastel-de-choclo.md
receta_empanadas | semilla_escribir recetas/empanadas.md
semilla_confirmar 'Agrega las dos primeras recetas'

semilla_dia_siguiente
semilla_mas_tarde 7200
receta_cazuela | semilla_escribir recetas/cazuela.md
receta_charquican | semilla_escribir recetas/charquican.md
semilla_confirmar 'Agrega la cazuela y el charquican'

semilla_dia_siguiente 3
semilla_mas_tarde 3600
receta_sopaipillas | semilla_escribir recetas/sopaipillas.md
contenido_platos completo | semilla_escribir platos.md
contenido_ingredientes completo | semilla_escribir ingredientes.md
semilla_confirmar 'Completa el listado con entradas y postres'

semilla_dia_siguiente
semilla_mas_tarde 9000
contenido_cocineros completo | semilla_escribir cocineros.md
semilla_confirmar 'Actualiza la tabla de cocineros'

semilla_dia_siguiente 2
semilla_mas_tarde 5400
semilla_escribir .gitignore <<'FIN'
*.tmp
*.bak
credenciales.txt
FIN
semilla_confirmar 'Agrega el archivo de exclusiones'

semilla_etiquetar_anotado v1.0 'Recetario listo para publicar'

semilla_empaquetar "$PAQUETE"
semilla_avisar "paquete en $PAQUETE"
