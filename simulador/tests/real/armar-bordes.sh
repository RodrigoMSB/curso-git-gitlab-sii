#!/bin/bash
# Repositorios con los casos que las pruebas del arquitecto no cubrian
# (SPEC 020, punto 1.5). Uno por caso, en la carpeta que se pasa.
set -e
R="$1"; mkdir -p "$R"
export GIT_AUTHOR_NAME="Participante" GIT_AUTHOR_EMAIL="p@sii.cl" GIT_COMMITTER_NAME="Participante" GIT_COMMITTER_EMAIL="p@sii.cl"
en() { git -C "$R/$1" "${@:2}"; }
iniciar() { git init -q -b main "$R/$1"; }

# Mensaje en ISO-8859-1, con la cabecera `encoding` que Git le pone.
iniciar latin; en latin config i18n.commitEncoding ISO-8859-1; echo a > "$R/latin/a"; en latin add a
printf 'se agrega \xf1and\xfa\n\ncuerpo en latin1 \xe1\xe9\xed\n' > "$R/latin.msg"; en latin commit -q -F "$R/latin.msg"

# Referencias simbolicas en ciclo, y HEAD apuntando a una de ellas.
iniciar ciclo; echo a > "$R/ciclo/a"; en ciclo add a; en ciclo commit -qm uno
printf 'ref: refs/heads/y\n' > "$R/ciclo/.git/refs/heads/x"; printf 'ref: refs/heads/x\n' > "$R/ciclo/.git/refs/heads/y"

# Un candado que Git deja mientras actualiza una referencia.
iniciar candado; echo a > "$R/candado/a"; en candado add a; en candado commit -qm uno
cp "$R/candado/.git/refs/heads/main" "$R/candado/.git/refs/heads/main.lock"

# Indice de paquete con desplazamientos de 64 bits para todo lo que pase del byte 16.
iniciar grande64; for i in 1 2 3; do echo $i > "$R/grande64/f$i"; en grande64 add .; en grande64 commit -qm c$i; done
en grande64 repack -qad; P=$(ls "$R"/grande64/.git/objects/pack/*.pack); rm -f "$R"/grande64/.git/objects/pack/*.idx "$R"/grande64/.git/objects/pack/*.rev
en grande64 index-pack --index-version=2,16 "$P" >/dev/null

# Cadena larga de deltas, y deltas por referencia en lugar de por posicion.
# Cada version cambia una sola linea de un archivo de dos mil: se parece sobre
# todo a su vecina, y Git arma cadenas de decenas de eslabones. Con versiones
# que solo crecian, como antes, las cadenas no pasaban de dos.
iniciar cadena; awk 'BEGIN { for (i = 1; i <= 2000; i++) print "linea " i " " (i * 7919 % 104729) }' > "$R/cadena/f"
for i in $(seq 1 150); do
  awk -v n="$i" 'NR == (n * 1237 % 2000) + 1 { print "cambio " n; next } { print }' "$R/cadena/f" > "$R/cadena/f.tmp" && mv "$R/cadena/f.tmp" "$R/cadena/f"
  en cadena add f; en cadena commit -qm "c$i"
done
en cadena repack -qadf --depth=250 --window=250
iniciar refdelta; for i in $(seq 1 40); do seq 1 $i > "$R/refdelta/f"; en refdelta add f; en refdelta commit -qm "c$i"; done
en refdelta -c pack.useDeltaBaseOffset=false repack -qadf

# Objetos grandes: uno al azar, que sale en bloques sin comprimir, y uno de texto.
iniciar grandes; head -c 3000000 /dev/urandom > "$R/grandes/azar.bin"; seq 1 400000 > "$R/grandes/texto.txt"
en grandes add .; en grandes commit -qm grandes; en grandes repack -qad

# Clon superficial: los padres de la primera confirmacion no estan.
git clone -q --depth 2 "file://$R/cadena" "$R/superficial"

# Todo lo demas que se dibuja: etiqueta ligera, anotada, etiqueta de etiqueta,
# rama remota, guardado temporal y una confirmacion que solo recuerda el registro.
iniciar completo; echo a > "$R/completo/a"; en completo add a; en completo commit -qm uno
echo b >> "$R/completo/a"; en completo commit -qam dos
en completo tag ligera; en completo tag -a -m "version uno" v1 HEAD~1; en completo tag -a -m "sobre v1" v1-firmada v1
echo c >> "$R/completo/a"; en completo commit -qam tres; en completo reset -q --hard HEAD~1
git clone -q "file://$R/completo" "$R/clonado"; git -C "$R/clonado" switch -q -c nueva
echo d >> "$R/clonado/a"; git -C "$R/clonado" stash -q; echo e >> "$R/clonado/a"; git -C "$R/clonado" stash -q

# Cadena de referencias simbolicas: s1 apunta a main, s2 a s1, y asi hasta s7.
# Git sigue cuatro saltos y da por rota la que necesita cinco.
iniciar saltos; echo a > "$R/saltos/a"; en saltos add a; en saltos commit -qm uno
for n in 1 2 3 4 5 6 7; do previa=main; [ $n -gt 1 ] && previa=s$((n-1)); printf 'ref: refs/heads/%s\n' $previa > "$R/saltos/.git/refs/heads/s$n"; done

# Cada codigo del estado corto que el taller puede producir, y las exclusiones
# con la sintaxis que el motor no cubre.
iniciar estados; cd "$R/estados"
mkdir -p docs build/salida sub/profundo solo-ignorados vacia
for f in a b c d e f g "con espacio ñ.txt" docs/x build/seguido sub/profundo/y; do echo "$f" > "$f"; done
printf 'build/\n*.log\n!importante.log\nsolo-ignorados/\n' > .gitignore; printf '*.tmp\n!profundo/*.tmp\n' > sub/.gitignore
git add -A; git add -f build/seguido; git commit -qm base
echo mas >> a; git add a; echo aun >> a                                  # MM
echo nuevo > nuevo; git add nuevo; echo cambio >> nuevo                   # AM
echo borrar > efimero; git add efimero; rm efimero                        # AD
echo mod >> b                                                             # _M
rm c                                                                      # _D
git rm -q d                                                               # D_
git mv e e-renombrado                                                     # R_
git mv f docs/f; echo cambio >> docs/f                                    # RM
echo intento > anunciado; git add -N anunciado                            # _A
echo s > suelto; mkdir -p otra/honda; echo s > otra/honda/z               # ?? y carpeta agrupada
echo x > build/salida/generado; echo x > build/otro                       # dentro de carpeta excluida
echo x > registro.log; echo x > importante.log                            # negacion
echo x > solo-ignorados/basura; echo x > sub/a.tmp; echo x > sub/profundo/b.tmp
echo x > extra.excluido; echo '*.excluido' >> .git/info/exclude
echo g > g; touch -t 202001010000 g                                       # contenido igual, fecha distinta
cd - >/dev/null

# Conflictos: los dos modificaron, los dos agregaron, uno borro lo que el otro cambio.
iniciar conflicto; cd "$R/conflicto"
echo base > ambos; echo base > borrado-aca; echo base > borrado-alla; git add -A; git commit -qm base
git switch -qc otra; echo otra > ambos; echo otra > nuevo-ambos; git rm -q borrado-alla; echo otra > borrado-aca; git add -A; git commit -qm otra
git switch -q main; echo main > ambos; echo main > nuevo-ambos; git rm -q borrado-aca; echo main > borrado-alla; git add -A; git commit -qm main
git merge -q otra >/dev/null 2>&1 || true
cd - >/dev/null

# Finales de linea: un clon con autocrlf en true, limpio, y uno de sus archivos tocado.
iniciar finales; cd "$R/finales"
printf 'uno\ndos\n' > texto.txt; printf 'bin\0ario\r\n' > datos.bin; printf 'ya\r\ncrlf\r\n' > guardado-crlf.txt
git -c core.autocrlf=false add -A; git commit -qm base
cd - >/dev/null
git clone -q -c core.autocrlf=true "file://$R/finales" "$R/finales-crlf"
git clone -q -c core.autocrlf=true "file://$R/finales" "$R/finales-tocado"
printf 'uno\r\ndos\r\n' > "$R/finales-tocado/texto.txt.nuevo"; mv "$R/finales-tocado/texto.txt.nuevo" "$R/finales-tocado/texto.txt"

# Formas que la pagina no sabe dibujar y tiene que decirlo (punto 2.9), y el
# indice en version 4, que si sabe.
iniciar indice4; echo a > "$R/indice4/a"; mkdir -p "$R/indice4/carpeta/honda"; echo b > "$R/indice4/carpeta/honda/b"; echo c > "$R/indice4/carpeta/honda/c"
en indice4 add -A; en indice4 commit -qm uno; en indice4 update-index --index-version 4; echo cambio >> "$R/indice4/carpeta/honda/c"
iniciar indice3; echo a > "$R/indice3/a"; echo b > "$R/indice3/b"; en indice3 add -A; en indice3 commit -qm uno; echo n > "$R/indice3/n"; en indice3 add -N n
iniciar partido; echo a > "$R/partido/a"; en partido add a; en partido commit -qm uno; en partido update-index --split-index
iniciar disperso; mkdir -p "$R/disperso/dentro" "$R/disperso/fuera"; echo a > "$R/disperso/dentro/a"; echo b > "$R/disperso/fuera/b"
en disperso add -A; en disperso commit -qm uno; en disperso sparse-checkout set --cone --sparse-index dentro
git init -q -b main --object-format=sha256 "$R/sha256"; echo a > "$R/sha256/a"; en sha256 add a; en sha256 commit -qm uno
git init -q -b main --ref-format=reftable "$R/reftable"; echo a > "$R/reftable/a"; en reftable add a; en reftable commit -qm uno
en completo worktree add -q "$R/enlazado" -b enlazada
