#!/bin/bash
# Arma repositorios de prueba con el Git de esta máquina.
set -e
B="$(pwd)/pruebas"
rm -rf "$B"; mkdir -p "$B"; cd "$B"
export GIT_AUTHOR_NAME="Participante" GIT_AUTHOR_EMAIL="p@sii.cl" GIT_COMMITTER_NAME="Participante" GIT_COMMITTER_EMAIL="p@sii.cl"
fecha() { export GIT_AUTHOR_DATE="@$1 -0300" GIT_COMMITTER_DATE="@$1 -0300"; }

git init -q -b main lineal && cd lineal
for i in $(seq 1 30); do fecha $((1700000000+i*60)); echo "línea $i ñandú" >> platos.md; git add .; git commit -q -m "se agrega el plato $i con ñ y tildes áéí" -m "cuerpo del mensaje $i"; done
cd ..

git init -q -b main ramas && cd ramas
fecha 1700000000; echo base > a.md; git add .; git commit -q -m "base"
n=0
for r in tailandesa azteca criolla andina; do
  n=$((n+1))
  git switch -q -c $r main; fecha $((1700000000+n*1000)); echo $r >> $r.md; git add .; git commit -q -m "receta $r"
  fecha $((1700100000+n*1000)); echo "$r 2" >> $r.md; git add .; git commit -q -m "receta $r ajustada"
done
git switch -q main
fecha 1700200000; echo "main sigue" >> a.md; git add .; git commit -q -m "main avanza"
fecha 1700300000; git merge -q --no-ff tailandesa -m "se une tailandesa"
fecha 1700300100; git merge -q --no-ff azteca -m "se une azteca"
fecha 1700300200; git merge -q criolla -m "se une criolla"
git switch -q -c trabajo/sub; fecha 1700400000; echo sub > s.md; git add .; git commit -q -m "rama con barra"
git switch -q main
cd ..

cp -r ramas empaquetado && (cd empaquetado && git gc -q)
cp -r lineal deltas && (cd deltas && git repack -q -adf --window=250 --depth=50 && git pack-refs --all && git prune)
(cd ramas && git bundle create ../r.bundle --all 2>/dev/null)
git clone -q r.bundle desde-bundle
(cd desde-bundle && git switch -q -c local && fecha 1700500000 && echo x > x.md && git add . && git commit -q -m "confirmación suelta sobre paquete")
cp -r ramas desconectada && (cd desconectada && git checkout -q HEAD~2)

git init -q -b main empates && cd empates
fecha 1700000000; echo a > a; git add .; git commit -q -m uno
git switch -q -c b; fecha 1700000100; echo b > b; git add .; git commit -q -m dos-b
git switch -q main; fecha 1700000100; echo c > c; git add .; git commit -q -m dos-main
fecha 1700000100; git merge -q --no-ff b -m union-empate
cd ..
ls
