package taller;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Le pregunta a Git como esta el repositorio de la carpeta de la consola
 * (punto 3.6).
 *
 * Todas las lecturas van en un solo bash, separadas por un marcador, para que
 * cada lectura lance un bash y no uno por pregunta. Se pasa
 * {@code --no-optional-locks} para que leer no reescriba el indice: si lo
 * reescribiera, la huella cambiaria con cada lectura y se leeria de nuevo sin
 * que nadie hubiera tocado nada.
 */
public final class LectorEstado {

    private static final char MARCA = '\u0001';

    private final BuscadorGit.Instalacion git;
    private final Sistema sistema;
    private final Path guion;

    public LectorEstado(Sistema sistema, BuscadorGit.Instalacion git, Path carpetaPropia) throws IOException {
        this.sistema = sistema;
        this.git = git;
        Files.createDirectories(carpetaPropia);
        this.guion = carpetaPropia.resolve("estado.sh");
        Files.writeString(guion, GUION, StandardCharsets.UTF_8);
    }

    /** Lee el estado de la carpeta. Devuelve un mapa listo para JSON. */
    public Map<String, Object> leer(Path carpeta) throws IOException {
        Map<String, String> entorno = new HashMap<>(Ejecutor.entornoComun(sistema, git));
        entorno.put("TALLER_GIT", Rutas.conBarras(git.git()));
        entorno.put("TALLER_CARPETA", Rutas.conBarras(carpeta));
        entorno.put("GIT_OPTIONAL_LOCKS", "0");
        // Sin --login: aqui no hace falta el PATH de Git Bash, porque git se
        // llama por su ruta, y el inicio de sesion cuesta un cuarto de segundo.
        Procesos.Salida s = Procesos.correr(
                List.of(git.bash().toString(), guion.toString()), carpeta.toFile(), entorno, 60_000);
        return interpretar(s.salida());
    }

    /** Las secciones de la salida del guion, por nombre. */
    static Map<String, String> secciones(String salida) {
        Map<String, String> mapa = new LinkedHashMap<>();
        String[] partes = salida.split(String.valueOf(MARCA), -1);
        for (int i = 1; i + 1 < partes.length; i += 2) {
            mapa.put(partes[i], partes[i + 1]);
        }
        if (partes.length % 2 == 0 && partes.length >= 2) mapa.put(partes[partes.length - 1], "");
        return mapa;
    }

    static Map<String, Object> interpretar(String salida) {
        Map<String, String> s = secciones(salida);
        Map<String, Object> estado = new LinkedHashMap<>();
        if (!s.containsKey("raiz")) {
            estado.put("repositorio", false);
            estado.put("motivo", s.containsKey("desnudo") ? "desnudo" : "fuera");
            return estado;
        }
        String[] raiz = s.get("raiz").split("\n", -1);
        estado.put("repositorio", true);
        estado.put("raiz", raiz[0].trim());
        estado.put("gitdir", raiz.length > 1 ? raiz[1].trim() : "");
        estado.put("dentroDeGit", s.containsKey("dentro-de-git"));

        // La rama y la confirmacion actual vienen en los encabezados de git status --branch.
        String rama = null;
        String head = "";
        for (String parte : s.getOrDefault("estado", "").split("\0")) {
            if (parte.startsWith("# branch.head ")) {
                String nombre = parte.substring("# branch.head ".length()).trim();
                rama = nombre.equals("(detached)") ? null : nombre;
            } else if (parte.startsWith("# branch.oid ")) {
                String oid = parte.substring("# branch.oid ".length()).trim();
                head = oid.equals("(initial)") ? "" : oid;
            }
        }
        estado.put("rama", rama);
        estado.put("head", head.isEmpty() ? null : head);

        List<Map<String, Object>> ramas = new ArrayList<>();
        List<Map<String, Object>> remotas = new ArrayList<>();
        List<Map<String, Object>> etiquetas = new ArrayList<>();
        List<String> puntas = new ArrayList<>();
        for (String linea : lineas(s.get("refs"))) {
            String[] c = linea.split("\t", -1);
            if (c.length < 5) continue;
            String nombre = c[0];
            String objeto = c[1];
            String tipo = c[2];
            String pelado = c[3];
            String tipoPelado = c[4];
            if (nombre.startsWith("refs/heads/")) {
                ramas.add(referencia(nombre.substring(11), objeto));
                puntas.add(objeto);
            } else if (nombre.startsWith("refs/remotes/")) {
                String corto = nombre.substring(13);
                if (corto.endsWith("/HEAD")) continue;
                remotas.add(referencia(corto, objeto));
                puntas.add(objeto);
            } else if (nombre.startsWith("refs/tags/")) {
                boolean anotada = tipo.equals("tag");
                String id = anotada ? pelado : objeto;
                String tipoFinal = anotada ? tipoPelado : tipo;
                if (!tipoFinal.equals("commit")) continue;
                Map<String, Object> e = referencia(nombre.substring(10), id);
                e.put("anotada", anotada);
                etiquetas.add(e);
                puntas.add(id);
            }
        }
        if (head.length() > 0) puntas.add(head);

        List<Map<String, Object>> guardados = new ArrayList<>();
        int indice = 0;
        for (String linea : lineas(s.get("guardados"))) {
            String[] c = linea.split("\t", -1);
            if (c.length < 3) continue;
            String base = c[1].split(" ")[0];
            Map<String, Object> g = new LinkedHashMap<>();
            g.put("indice", indice++);
            g.put("id", c[0]);
            g.put("base", base);
            g.put("mensaje", c[2]);
            guardados.add(g);
            puntas.add(base);
        }

        List<Map<String, Object>> confirmaciones = new ArrayList<>();
        Map<String, List<String>> padresDe = new HashMap<>();
        for (String registro : s.getOrDefault("log", "").split("\u001e", -1)) {
            String r = registro.strip();
            if (r.isEmpty()) continue;
            String[] c = r.split("\u001f", -1);
            if (c.length < 7) continue;
            List<String> padres = c[2].isBlank() ? List.of() : List.of(c[2].trim().split(" "));
            Map<String, Object> conf = new LinkedHashMap<>();
            conf.put("id", c[0]);
            conf.put("corto", c[1]);
            conf.put("padres", padres);
            conf.put("autor", c[3]);
            conf.put("correo", c[4]);
            conf.put("epoca", parseLong(c[5]));
            conf.put("asunto", c[6]);
            confirmaciones.add(conf);
            padresDe.put(c[0], padres);
        }
        Set<String> vivas = alcanzables(puntas, padresDe);
        for (Map<String, Object> conf : confirmaciones) {
            conf.put("huerfana", !vivas.contains((String) conf.get("id")));
        }

        String operacion = null;
        for (String linea : lineas(s.get("operacion"))) {
            operacion = switch (linea.trim()) {
                case "MERGE_HEAD" -> "fusion";
                case "CHERRY_PICK_HEAD" -> "cherry-pick";
                case "REVERT_HEAD" -> "revert";
                case "REBASE" -> "rebase";
                default -> operacion;
            };
            if ("rebase".equals(operacion)) break;
        }

        Porcelana.Areas areas = Porcelana.leer(s.getOrDefault("estado", ""));
        Map<String, Object> a = new LinkedHashMap<>();
        a.put("preparado", entradas(areas.preparado()));
        a.put("modificado", entradas(areas.modificado()));
        a.put("sinSeguimiento", areas.sinSeguimiento());
        a.put("conflicto", areas.conflicto());

        estado.put("confirmaciones", confirmaciones);
        estado.put("ramas", ramas);
        estado.put("remotas", remotas);
        estado.put("etiquetas", etiquetas);
        estado.put("guardados", guardados);
        estado.put("operacion", operacion);
        estado.put("areas", a);
        estado.put("cambios", areas.cambios());
        return estado;
    }

    private static List<Map<String, Object>> entradas(List<Porcelana.Entrada> lista) {
        List<Map<String, Object>> r = new ArrayList<>();
        for (Porcelana.Entrada e : lista) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("ruta", e.ruta());
            m.put("tipo", String.valueOf(e.tipo()));
            if (e.origen() != null) m.put("origen", e.origen());
            r.add(m);
        }
        return r;
    }

    /** Las confirmaciones que alguna punta alcanza subiendo por los padres. El resto son huerfanas. */
    static Set<String> alcanzables(List<String> puntas, Map<String, List<String>> padresDe) {
        Set<String> vistos = new HashSet<>();
        Deque<String> pendientes = new ArrayDeque<>(puntas);
        while (!pendientes.isEmpty()) {
            String id = pendientes.pop();
            if (!vistos.add(id)) continue;
            pendientes.addAll(padresDe.getOrDefault(id, List.of()));
        }
        return vistos;
    }

    private static Map<String, Object> referencia(String nombre, String id) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("nombre", nombre);
        m.put("id", id);
        return m;
    }

    private static List<String> lineas(String texto) {
        if (texto == null) return List.of();
        List<String> r = new ArrayList<>();
        // Sin recortar tabuladores: una referencia que no es etiqueta termina
        // en dos columnas vacias, y recortarlas corre las columnas.
        for (String l : texto.split("\n")) {
            String sinRetorno = l.endsWith("\r") ? l.substring(0, l.length() - 1) : l;
            if (!sinRetorno.isBlank()) r.add(sinRetorno);
        }
        return r;
    }

    private static long parseLong(String t) {
        try {
            return Long.parseLong(t.trim());
        } catch (NumberFormatException e) {
            return 0;
        }
    }

    /**
     * El guion de lectura. Cada seccion empieza con un marcador y su nombre.
     *
     * Las huerfanas salen del registro de HEAD: las confirmaciones que alguna
     * vez fueron HEAD entran al {@code git log} como puntas, junto con las
     * ramas, las remotas y las etiquetas. Antes se filtran con
     * {@code cat-file}, porque un registro viejo puede nombrar objetos que ya
     * no existen y {@code git log} fallaria entero por uno solo.
     */
    static final String GUION = """
            # Lectura del estado del taller. El programa lo reescribe al arrancar.
            m() { printf '\\001%s\\001' "$1"; }
            g() { "$TALLER_GIT" --no-optional-locks -c core.quotepath=false "$@"; }
            builtin cd -- "$TALLER_CARPETA" 2>/dev/null || { m sin-carpeta; exit 0; }
            { IFS= read -r gitdir; IFS= read -r top; } <<EOF
            $(g rev-parse --absolute-git-dir --show-toplevel 2>/dev/null)
            EOF
            [ -n "$gitdir" ] || { m fuera; exit 0; }
            if [ -z "$top" ]; then
              # Sin arbol de trabajo: parado dentro de .git, o un repositorio desnudo.
              [ "${gitdir##*/}" = .git ] || { m desnudo; exit 0; }
              m dentro-de-git
              top=${gitdir%/.git}
            fi
            m raiz; printf '%s\\n%s\\n' "$top" "$gitdir"
            builtin cd -- "$top" || exit 0
            m refs; g for-each-ref --format='%(refname)%09%(objectname)%09%(objecttype)%09%(*objectname)%09%(*objecttype)' refs/heads refs/remotes refs/tags
            puntas=()
            guardados=
            if [ -e "$gitdir/refs/stash" ] || [ -e "$gitdir/logs/refs/stash" ]; then
              guardados=$(g stash list --format='%H%x09%P%x09%gs' 2>/dev/null)
            fi
            m guardados; printf '%s\\n' "$guardados"
            while IFS=$'\\t' read -r stash padres resto; do
              [ -n "$padres" ] && puntas+=("${padres%% *}")
            done <<EOF
            $guardados
            EOF
            if [ -s "$gitdir/logs/HEAD" ]; then
              while read -r id tipo; do
                [ "$tipo" = commit ] && puntas+=("$id")
              done <<EOF
            $(g reflog show --format=%H HEAD -- 2>/dev/null | g cat-file --batch-check='%(objectname) %(objecttype)' 2>/dev/null)
            EOF
            fi
            m log; g log --ignore-missing --topo-order --abbrev=7 --format='%H%x1f%h%x1f%P%x1f%an%x1f%ae%x1f%ct%x1f%s%x1e' --branches --remotes --tags HEAD "${puntas[@]}" -- 2>/dev/null
            m operacion
            for f in MERGE_HEAD CHERRY_PICK_HEAD REVERT_HEAD; do [ -e "$gitdir/$f" ] && echo "$f"; done
            { [ -d "$gitdir/rebase-merge" ] || [ -d "$gitdir/rebase-apply" ]; } && echo REBASE
            m estado; g status --porcelain=v2 -z --branch --untracked-files=all 2>/dev/null
            m fin
            """;
}
