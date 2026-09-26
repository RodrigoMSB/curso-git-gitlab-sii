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
 * Se pasa {@code --no-optional-locks} para que leer no reescriba el indice: si
 * lo reescribiera, la huella cambiaria con cada lectura y se leeria de nuevo
 * sin que nadie hubiera tocado nada.
 */
public final class LectorEstado {

    private static final char MARCA = '\u0001';

    private final BuscadorGit.Instalacion git;
    private final Sistema sistema;

    public LectorEstado(Sistema sistema, BuscadorGit.Instalacion git, Path carpetaPropia) throws IOException {
        this.sistema = sistema;
        this.git = git;
        Files.createDirectories(carpetaPropia);
    }

    /** Lee el estado de la carpeta. Devuelve un mapa listo para JSON. */
    public Map<String, Object> leer(Path carpeta) throws IOException {
        return interpretar(secciones(carpeta));
    }

    /**
     * Le hace a Git las preguntas, una orden por pregunta, y junta las
     * respuestas por nombre.
     *
     * Se lanzan directo y no dentro de un bash. En Windows cada proceso cuesta,
     * y un bash con sus sustituciones de ordenes lanzaba mas procesos que las
     * preguntas mismas: bash, un fork por cada {@code $(...)} y un tubo. Asi
     * son entre cuatro y seis procesos de Git, y ninguno mas. El registro y el
     * guardado temporal solo se preguntan si sus archivos existen.
     */
    Map<String, String> secciones(Path carpeta) throws IOException {
        Map<String, String> s = new LinkedHashMap<>();
        if (!Files.isDirectory(carpeta)) {
            s.put("sin-carpeta", "");
            return s;
        }
        Map<String, String> entorno = new HashMap<>(Ejecutor.entornoComun(sistema, git));
        entorno.put("GIT_OPTIONAL_LOCKS", "0");

        Procesos.Salida rp = git(carpeta, entorno, null, "rev-parse", "--absolute-git-dir", "--show-toplevel");
        String[] lineas = rp.salida().split("\\R");
        String gitdir = lineas.length > 0 ? lineas[0].trim() : "";
        String top = lineas.length > 1 ? lineas[1].trim() : "";
        if (gitdir.isEmpty()) {
            s.put("fuera", "");
            return s;
        }
        if (top.isEmpty()) {
            // Sin arbol de trabajo: parado dentro de .git, o un repositorio desnudo.
            if (!gitdir.endsWith("/.git")) {
                s.put("desnudo", "");
                return s;
            }
            s.put("dentro-de-git", "");
            top = gitdir.substring(0, gitdir.length() - "/.git".length());
        }
        s.put("raiz", top + "\n" + gitdir + "\n");
        Path raiz = Path.of(top);
        Path dirGit = Path.of(gitdir);

        s.put("refs", git(raiz, entorno, null, "for-each-ref",
                "--format=%(refname)%09%(objectname)%09%(objecttype)%09%(*objectname)%09%(*objecttype)",
                "refs/heads", "refs/remotes", "refs/tags").salida());

        List<String> puntas = new ArrayList<>();
        String guardados = "";
        if (Files.exists(dirGit.resolve("refs/stash")) || Files.exists(dirGit.resolve("logs/refs/stash"))) {
            guardados = git(raiz, entorno, null, "stash", "list", "--format=%H%x09%P%x09%gs").salida();
            for (String linea : lineas(guardados)) {
                String[] c = linea.split("\t", -1);
                if (c.length > 1 && !c[1].isBlank()) puntas.add(c[1].trim().split(" ")[0]);
            }
        }
        s.put("guardados", guardados);

        List<String> registro = new ArrayList<>();
        if (Files.isRegularFile(dirGit.resolve("logs/HEAD")) && Files.size(dirGit.resolve("logs/HEAD")) > 0) {
            for (String id : lineas(git(raiz, entorno, null, "reflog", "show", "--format=%H", "HEAD", "--").salida())) {
                registro.add(id.trim());
            }
        }

        List<String> log = new ArrayList<>(List.of("log", "--ignore-missing", "--topo-order", "--abbrev=7",
                "--format=%H%x1f%h%x1f%P%x1f%an%x1f%ae%x1f%ct%x1f%s%x1e", "--branches", "--remotes", "--tags", "HEAD"));
        log.addAll(puntas);
        List<String> conRegistro = new ArrayList<>(log);
        conRegistro.addAll(new java.util.LinkedHashSet<>(registro));
        conRegistro.add("--");
        Procesos.Salida l = git(raiz, entorno, null, conRegistro.toArray(String[]::new));
        if (l.codigo() != 0 && !registro.isEmpty()) {
            // Un registro viejo puede nombrar objetos que ya no existen, y git
            // log falla entero por uno solo. Solo entonces se filtran.
            String consulta = String.join("\n", registro) + "\n";
            Procesos.Salida tipos = git(raiz, entorno, consulta, "cat-file", "--batch-check=%(objectname) %(objecttype)");
            List<String> filtrado = new ArrayList<>(log);
            for (String linea : lineas(tipos.salida())) {
                String[] c = linea.trim().split(" ");
                if (c.length == 2 && c[1].equals("commit")) filtrado.add(c[0]);
            }
            filtrado.add("--");
            l = git(raiz, entorno, null, filtrado.toArray(String[]::new));
        }
        s.put("log", l.salida());

        StringBuilder operacion = new StringBuilder();
        for (String f : List.of("MERGE_HEAD", "CHERRY_PICK_HEAD", "REVERT_HEAD")) {
            if (Files.exists(dirGit.resolve(f))) operacion.append(f).append('\n');
        }
        if (Files.isDirectory(dirGit.resolve("rebase-merge")) || Files.isDirectory(dirGit.resolve("rebase-apply"))) {
            operacion.append("REBASE\n");
        }
        s.put("operacion", operacion.toString());
        s.put("estado", git(raiz, entorno, null, "status", "--porcelain=v2", "-z", "--branch", "--untracked-files=all").salida());
        return s;
    }

    private Procesos.Salida git(Path carpeta, Map<String, String> entorno, String entrada, String... argumentos)
            throws IOException {
        List<String> orden = new ArrayList<>();
        orden.add(git.git().toString());
        orden.add("--no-optional-locks");
        orden.add("-c");
        orden.add("core.quotepath=false");
        orden.addAll(List.of(argumentos));
        return Procesos.correr(orden, carpeta.toFile(), entorno, 60_000, entrada);
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
        return interpretar(secciones(salida));
    }

    static Map<String, Object> interpretar(Map<String, String> s) {
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
}
