# Guía de mantenimiento de NetWageTax

Esta guía explica cómo trabajar en la web, publicarla y mantener al día las cifras fiscales sin ayuda.
Está pensada para alguien que está aprendiendo: cada paso dice qué archivo tocar, qué constante
cambiar y cómo comprobar que todo sigue bien.

Documentos relacionados:

- `docs/PENDING-UPDATES.md`: la lista viva de tareas de datos pendientes (en inglés). El calendario de
  la sección 4 la resume.
- `docs/DESIGN.md`: reglas de diseño (colores, tablas, tipografía).
- `SPEC.md`: especificación original de la calculadora de propinas y horas extra.
- `README.md`: descripción general del proyecto.

> **Regla de oro:** cualquier cifra fiscal que cambies tiene que venir de una fuente oficial (IRS,
> SSA, el departamento de hacienda del estado o el texto de la ley). Guarda el enlace en el código,
> junto al dato, como hacen los que ya están.

---

## 1. Trabajar en local

### 1.1 Lo que necesitas instalado

- **Node.js 22.12 o superior** (lo exige `package.json` en `engines`). Compruébalo con `node -v`.
- **Git** para Windows. Incluye **Git Bash**, la terminal en la que funcionan todos los comandos de
  esta guía. En VS Code: menú de la terminal → *Select Default Profile* → *Git Bash*.
- Un navegador (Chrome) para revisar las páginas.

### 1.2 Arrancar el proyecto

La primera vez, o cuando cambie `package.json`:

```sh
npm install
```

Para trabajar con recarga automática:

```sh
npm run dev
```

Abre <http://localhost:4321>. Cada vez que guardes un archivo, la página se actualiza. Para pararlo,
pulsa `Ctrl+C` en la terminal.

También puedes dejarlo en segundo plano (así lo indica `CLAUDE.md`):

```sh
npx astro dev --background   # arranca en segundo plano
npx astro dev status         # ¿está en marcha?
npx astro dev logs           # ver lo que ha escrito (añade --follow para seguirlo en directo)
npx astro dev stop           # pararlo
```

### 1.3 Las tres comprobaciones antes de publicar

Ejecútalas siempre, en este orden, antes de publicar:

```sh
npm test          # tests de la lógica de cálculo (Vitest)
npm run build     # genera la web estática en dist/
npx astro check   # revisa los tipos de TypeScript en todo el proyecto
```

Lo que tienes que ver:

| Comando | Resultado correcto |
| :-- | :-- |
| `npm test` | `Test Files  N passed` y `Tests  N passed`, sin ningún `failed` |
| `npm run build` | termina con `Complete!` |
| `npx astro check` | `0 errors` (los *hints* no importan) |

Para ver la versión final tal como se publicará:

```sh
npm run preview   # sirve dist/ en http://localhost:4321
```

### 1.4 Errores habituales y qué significan

| Mensaje (o síntoma) | Qué significa | Qué hacer |
| :-- | :-- | :-- |
| `npm WARN EBADENGINE Unsupported engine` o Astro no arranca | Tu versión de Node es anterior a 22.12 | Instala la versión LTS de Node desde nodejs.org y vuelve a ejecutar `npm install` |
| `npm install` falla al descargar `xlsx` | La librería de Excel se descarga de `cdn.sheetjs.com`, no de npm, y no hay conexión con ese servidor | Comprueba la conexión y repite `npm install` |
| `AssertionError: expected 1320 to be 1310` (u otros números) en `npm test` | Un cálculo ya no da lo que el test espera. El test indica el archivo y la línea | Si has cambiado una cifra fiscal a propósito, comprueba el resultado nuevo a mano con la fuente oficial y luego actualiza el número del test. Si no has cambiado nada fiscal, el error está en tu cambio: deshazlo |
| `error ts(2322): Type 'X' is not assignable to type 'Y'` en `astro check` | Error de tipos: pasas un dato de un tipo que no corresponde (por ejemplo, texto donde se espera un número) | Abre el archivo y la línea que indica y corrige el valor |
| `error ts(2304): Cannot find name 'X'` o `Could not resolve "./x"` | Falta un `import`, o el nombre o la ruta del archivo están mal escritos | Revisa la ortografía y la ruta del `import` |
| `Expected "}" but found ...` al hacer el build | Error de sintaxis: falta o sobra una llave, un paréntesis o una coma | Ve a la línea indicada. Suele estar justo antes de ella |
| `Port 4321 is in use, trying another one...` y la web sale en `localhost:4322` | Ya hay otro servidor en marcha (quizá en segundo plano) y Astro ha elegido otro puerto | Usa la dirección que indica la terminal, o para el otro servidor con `npx astro dev stop` |
| En el navegador: `_jsxDEV is not a function` y las calculadoras no responden | La caché de Vite del modo desarrollo se ha mezclado con la de producción | Para el servidor, borra la carpeta `node_modules/.vite-dev` y vuelve a arrancar |
| `warning: in the working copy of '...', LF will be replaced by CRLF` | Aviso de Git en Windows sobre los saltos de línea | No hace falta hacer nada |
| Un enlace interno da 308 o no funciona | La web usa barra final en todas las URL (`/state-taxes/texas/`) | Escribe siempre los enlaces internos terminados en `/` |

---

## 2. Cómo publicar

La web está en Vercel, enlazada al repositorio `github.com/jesus-dev39/NetWageTax`. **Cada `push` a
la rama `main` publica la web en netwagetax.com en unos 30 segundos.** No hay ningún otro paso: lo
que esté en `main` es lo que ve el mundo.

Por eso nunca se trabaja directamente en `main`: cada cambio se hace en una rama propia y se fusiona
cuando está comprobado.

### 2.1 Paso a paso

```sh
# 1. Parte de main actualizado
git checkout main
git pull

# 2. Crea una rama para el cambio (nombre corto y descriptivo)
git checkout -b update/2027-federal-figures

# 3. Haz los cambios y comprueba (sección 1.3)
npm test
npm run build
npx astro check

# 4. Guarda el cambio en la rama
git add -A
git status                      # revisa la lista: solo deben aparecer los archivos que querías tocar
git commit -m "data: 2027 federal brackets and standard deduction"

# 5. Fusiona en main, sin avance rápido para que quede un commit de merge
git checkout main
git merge --no-ff update/2027-federal-figures

# 6. Repite las comprobaciones ya en main
npm test
npm run build
npx astro check

# 7. Publica
git push origin main
```

Si `git merge` informa de un **conflicto**, Git marca en el archivo las dos versiones con
`<<<<<<<`, `=======` y `>>>>>>>`. Deja la versión correcta, borra las marcas, y ejecuta `git add` y
`git commit`.

### 2.2 Comprobar que el despliegue ya está en producción

Espera unos 30 segundos y busca en producción algo que hayas cambiado. Por ejemplo, el título de una
página:

```sh
curl -s https://netwagetax.com/state-taxes/texas/ | grep -o '<title>[^<]*'
```

Si todavía sale el texto antiguo, espera y repite. Justo después del despliegue, algunos servidores
de Vercel pueden servir la versión anterior durante unos segundos: antes de pensar que algo ha
fallado, vuelve a comprobarlo.

También puedes ver el estado del despliegue en vercel.com → proyecto → **Deployments**. El último
debe estar en *Ready*.

### 2.3 Comprobaciones en producción

**a) Páginas principales y archivos clave.** Todas deben dar `200`, salvo la página inexistente, que
debe dar `404`:

```sh
for p in / /tools/paycheck-calculator/ /tools/obbba-tax-calculator/ /tools/senior-deduction-calculator/ /tools/car-loan-interest-deduction-calculator/ /state-taxes/ /state-taxes/texas/ /ads.txt /robots.txt /sitemap-index.xml /no-existe/; do
  echo "$(curl -s -o /dev/null -w '%{http_code}' "https://netwagetax.com$p") $p"
done
```

**b) Todas las URL del sitemap.** El comando solo muestra las que **no** dan 200, así que lo correcto
es que solo aparezca `fin`:

```sh
curl -s https://netwagetax.com/sitemap-0.xml | grep -o '<loc>[^<]*' | sed 's/<loc>//' | while read u; do
  echo "$(curl -s -o /dev/null -w '%{http_code}' "$u") $u"
done | grep -v '^200'; echo fin
```

**c) La redirección antigua `/states`.** Debe acabar en `200 https://netwagetax.com/state-taxes/`:

```sh
curl -sL -o /dev/null -w '%{http_code} %{url_effective}\n' https://netwagetax.com/states
```

(Pasa por dos redirecciones 308: `/states` → `/states/` → `/state-taxes/`. Es lo normal.)

**d) `ads.txt` sin cambios.** Debe mostrar exactamente esta línea:

```sh
curl -s https://netwagetax.com/ads.txt
# google.com, pub-2086612186107816, DIRECT, f08c47fec0942fa0
```

### 2.4 Los cuatro casos de referencia

Son cálculos conocidos que deben dar siempre la misma cifra mientras no cambien las reglas fiscales
de 2026. Si alguno da otra cosa después de publicar, algo se ha roto (o has cambiado cifras fiscales
y tienes que verificar el resultado nuevo a mano). Los tests (`npm test`) ya cubren los tres
últimos, pero conviene verlos también en la web real.

**1. Portada: $2,092.60.** La estimación de la portada viene rellenada con un salario de $65,000,
pago cada dos semanas (*biweekly*), *Single* y sin estado. Debe mostrar **Take-home per paycheck
$2,092.60**. Como la cifra viene en el HTML, se comprueba con un comando:

```sh
curl -s https://netwagetax.com/ | grep -o '\$2,092\.60' | head -1
# $2,092.60
```

**2. Propinas con Georgia: $960.** Abre
<https://netwagetax.com/tools/obbba-tax-calculator/?state=GA> (el estado ya viene seleccionado):

- *Modified adjusted gross income (MAGI)*: `52000`
- *Qualified tips (W-2 Box 12, code TP)*: `8000`
- Marca la casilla de la ocupación (*My occupation is on the Treasury Department’s list…*)
- Marca *I have a valid SSN*

Resultado: **Federal income tax saved $960**.

**3. Mayores de 65: $1,320.** Abre <https://netwagetax.com/tools/senior-deduction-calculator/>:

- *Filing status*: **Married filing jointly**
- *Were you born before January 2, 1962?*: **Yes** (viene marcado)
- *Was your spouse born before January 2, 1962?*: **Yes**
- *Modified adjusted gross income (MAGI)*: `200000`

Resultado: **Federal income tax saved $1,320**.

**4. Intereses del coche: $720.** Abre
<https://netwagetax.com/tools/car-loan-interest-deduction-calculator/>:

- *Filing status*: **Single** (viene marcado)
- *Car loan interest paid in 2026*: `8000`
- *Modified adjusted gross income (MAGI)*: `125000`

Resultado: **Federal income tax saved $720** (deducción de $3,000 tras la reducción por ingresos).

Comprueba también que se puede imprimir o descargar el resultado de al menos una calculadora y que la
consola del navegador (F12 → *Console*) no muestra errores en rojo.

---

## 3. Actualización anual

Cada año hay que poner al día las cifras. Hazlo todo en una rama (sección 2.1) y publica solo cuando
`npm test`, `npm run build` y `npx astro check` estén en verde.

> **Antes de empezar:** los nombres de varias constantes llevan el año (`TAX_BRACKETS_2026`,
> `STANDARD_DEDUCTION_2026`, `SOCIAL_SECURITY_WAGE_BASE_2026`...). Al pasar a 2027, cambia los
> valores **y** renombra la constante con *Rename Symbol* de VS Code (clic derecho en el nombre →
> *Rename Symbol*, o `F2`). Así se actualizan a la vez todos los archivos que la usan. No la
> renombres buscando y reemplazando texto a mano.

### 3.1 Cifras federales: tramos y deducción estándar

**Dónde encontrarlas.** Cada otoño (normalmente entre octubre y noviembre), el IRS publica los ajustes
por inflación del año siguiente en una *Revenue Procedure* (las de 2026 están en la **Rev. Proc.
2025-32**). Búscala en irs.gov como "IRS releases tax inflation adjustments for tax year 2027". El
comunicado enlaza al PDF de la Rev. Proc.

**Archivo:** `src/lib/marginal-rate.ts`

| Constante | Qué contiene | Dónde está en la Rev. Proc. |
| :-- | :-- | :-- |
| `TAX_BRACKETS_2026` | Tramos por estado civil: `single`, `hoh` (head of household), `mfj` (married filing jointly), `mfs` (married filing separately) | Tablas de tipos (*Tax Rate Tables*), sección 3.01 en 2026 |
| `STANDARD_DEDUCTION_2026` | Deducción estándar por estado civil | *Standard Deduction*, sección 3.14 en 2026 |
| `ADDITIONAL_STANDARD_DEDUCTION_AGED_2026` | Deducción adicional por tener 65 años o más: `unmarried` y `married` | *Additional standard deduction for aged or blind*, sección 3.14(3) en 2026 |

Cómo leer los tramos: cada lista de `buildBrackets([...])` contiene los **límites superiores** de
los tramos del 10%, 12%, 22%, 24%, 32% y 35%, en ese orden. El 37% no tiene límite. En la tabla del
IRS son las cifras de la columna *"but not over"*. Ejemplo de 2026 para *single*:

```ts
single: buildBrackets([12_400, 50_400, 105_700, 201_775, 256_225, 640_600]),
```

Los tipos (10%, 12%... 37%) están en `rates`, en el mismo archivo. Solo cambian si cambia la ley.

Actualiza también el comentario de cabecera del archivo con el número de la Rev. Proc. nueva.

### 3.2 Base de la Social Security

**Dónde encontrarla.** La Social Security Administration (SSA) anuncia la base salarial máxima
(*contribution and benefit base*) del año siguiente en octubre, junto con el ajuste de las
pensiones (*COLA*). La página oficial es <https://www.ssa.gov/oact/cola/cbb.html>. Para 2026 es
$184,500.

**Archivo:** `src/lib/fica.ts` → constante `SOCIAL_SECURITY_WAGE_BASE_2026`.

Lo demás de ese archivo lo fija la ley y no cambia con la inflación: `SOCIAL_SECURITY_RATE` (6.2%),
`MEDICARE_RATE` (1.45%), `ADDITIONAL_MEDICARE_RATE` (0.9%) y `ADDITIONAL_MEDICARE_THRESHOLD`
($200,000 / $250,000 / $125,000).

### 3.3 Topes de la OBBBA (propinas, horas extra, mayores, coche)

**Archivo:** `src/lib/obbba-params.ts`. Todas las cifras son las de la ley (OBBBA, H.R. 1,
Pub. L. 119-21), **no se ajustan por inflación** y valen para 2025–2028. Solo hay que cambiarlas si
el Congreso modifica la ley o el IRS publica otra interpretación.

| Deducción | Constante | Valores actuales |
| :-- | :-- | :-- |
| Propinas | `OBBBA_2026_PARAMS.tips` | tope $25,000 (también en declaración conjunta); reducción a partir de $150,000 de MAGI ($300,000 conjunta) |
| Horas extra | `OBBBA_2026_PARAMS.overtime` | tope $12,500 ($25,000 conjunta); mismos umbrales |
| Reducción de propinas y horas extra | `PHASEOUT_STEP_SIZE_USD`, `PHASEOUT_REDUCTION_PER_STEP_USD` | $100 menos por cada $1,000 completos por encima del umbral |
| Mayores de 65 | `SENIOR_PARAMS` | $6,000 por persona; −6% del MAGI por encima de $75,000 ($150,000 conjunta) |
| Intereses del coche | `CAR_LOAN_PARAMS` | tope $10,000 por declaración; −$200 por cada $1,000 **o fracción** por encima de $100,000 ($200,000 conjunta) |

Cada parámetro tiene una tabla por año (`PARAMS_BY_YEAR`, `SENIOR_PARAMS_BY_YEAR`,
`CAR_LOAN_PARAMS_BY_YEAR`) con entradas de 2025 a 2028. Si un año cambia una cifra, crea un objeto
nuevo para ese año en lugar de modificar el que comparten todos.

Las deducciones terminan en 2028. Si el Congreso no las prorroga, a partir de 2029 habrá que retirar
o adaptar las calculadoras.

Pendiente: cuando el IRS publique el **Schedule 1-A definitivo de 2026** y sus instrucciones, revisa
las calculadoras de mayores y de coche y retira el aviso de borrador: la constante
`SCHEDULE_1A_DRAFT_NOTICE` de `src/lib/site.ts` y la palabra "draft" de las líneas `basis` de
`src/lib/schedule-1a-summary.ts` (detalles en `docs/PENDING-UPDATES.md`).

### 3.4 Datos de cada estado

**Archivo principal:** `src/lib/state-tax-data.ts`. Cada estado es **una línea** dentro de `ROWS`,
creada con una de estas tres funciones según su tipo de impuesto:

```ts
NO_TAX(código, nombre, nota)                                                   // sin impuesto sobre salarios
FLAT(código, nombre, tipo, exentoAprox, nota, notaLocal?)                      // tipo único
GRAD(código, nombre, tipoMedio, exentoAprox, [tipoMín, tipoMáx], nota, notaLocal?)  // tramos progresivos
```

Ejemplo real:

```ts
FLAT('GA', 'Georgia', 0.0499, 12_000, 'Flat 4.99% tax from January 1, 2026, under HB 463 (2026). ...'),
```

Qué significa cada campo (los tipos se escriben en tanto por uno: 4.99% = `0.0499`):

| Campo | Significado |
| :-- | :-- |
| `estimateRate` | Tipo que aplica la estimación. En `FLAT` es el tipo legal. En `GRAD` es un **tipo medio** calibrado para un contribuyente *single* con $65,000 de salario (`GRADUATED_REFERENCE_WAGE`) |
| `exemptAmount` | Parte del sueldo que no tributa: deducción estándar + exención personal (+ tramo al 0%) de un *single* |
| `bracketRange` | Solo `GRAD`: tipo más bajo y más alto, por ejemplo `[0.01, 0.133]` |
| `note` | Explicación que aparece en la página del estado |
| `localTaxNote` | Impuestos locales (ciudades, condados), si los hay |

La estimación es `(salario − exemptAmount) × estimateRate`. Por eso, en los estados `GRAD`, cuando
cambian los tramos hay que **recalcular** `estimateRate`: aplica los tramos nuevos a
$65,000 − `exemptAmount`, divide el impuesto resultante entre esa misma base y redondea a cuatro
decimales.

En el mismo archivo hay otras tablas por estado:

| Tabla | Para qué sirve |
| :-- | :-- |
| `SOURCE_URLS` | Web oficial del departamento de hacienda de cada estado |
| `LOCAL_TAX_LABELS` | Texto corto para "Local income taxes" cuando hay impuestos locales |
| `RATE_SOURCES` | Documento oficial del tipo actual (ley o publicación del estado) |
| `BRACKETS` | Tabla completa de tramos para *single*, cuando está verificada |
| `NEIGHBORS` | Estados vecinos (no cambia) |

**Añadir o actualizar los tramos de un estado.** Añade (o modifica) su entrada en `BRACKETS`:

```ts
CA: {
  year: 2026,                                   // año fiscal de la tabla
  source: 'https://www.ftb.ca.gov/forms/...pdf', // documento oficial de donde salen los tramos
  brackets: [
    { over: 0, rate: 0.01 },                     // "rate" se aplica a la renta por encima de "over"
    { over: 11_079, rate: 0.02 },
    // ...
  ],
  note: 'Texto opcional bajo la tabla (recargos, recapture...).',
},
```

La página del estado muestra la tabla sola en cuanto la añades. Si `year` es anterior al año de la
web, aparece automáticamente una nota que explica que las cifras del año nuevo todavía no están
publicadas. La tabla solo se muestra: la estimación sigue usando `estimateRate`.

**Añadir la fuente del tipo.** Añade una entrada en `RATE_SOURCES`:

```ts
GA: { url: 'https://...', label: 'HB 463 (2026), as passed (PDF)' },
```

**Tratamiento estatal de propinas y horas extra.** Está en `src/lib/state-tips-overtime.ts`, en
`TIPS_OVERTIME_RULES`. Cada estado tiene:

- `treatment`: una de `'no-wage-tax'`, `'follows'`, `'tips-only'`, `'own'`, `'does-not-follow'` o
  `'unconfirmed'`.
- `detail`: una o dos frases que explican lo que hace el estado.
- `sources`: los documentos oficiales (`label`, `url` y `date` opcional). Son obligatorios salvo en
  `'unconfirmed'`.
- `checked`: la fecha en que lo comprobaste, en formato `'2027-01-15'`.
- `inferred`, `own` y `calculatorNote`: solo en los casos que ya los usan.

Esos datos aparecen en la guía `/guides/which-states-tax-tips-and-overtime/`, en las páginas de los
estados y en la calculadora de propinas. Después de cambiarlos, repite el caso de referencia 2
(Georgia) de la sección 2.4.

### 3.5 Fechas de revisión

Después de cada revisión, actualiza las fechas. La web las muestra a los usuarios.

| Constante | Archivo | Qué es |
| :-- | :-- | :-- |
| `STATE_TAX_LAST_UPDATED` | `src/lib/state-tax-data.ts` | Fecha de la última revisión a mano de las reglas (federales, FICA y estatales), en formato `'2027-01-15'`. Se muestra en la franja superior de todas las páginas, en `/methodology/` y en cada estado como "Last reviewed" |
| `STATE_TAX_DATA_AS_OF` | `src/lib/state-tax-data.ts` | Texto con el año de los datos, por ejemplo `'2027 tax year (laws enacted through January 2027)'` |
| `checked` de cada estado | `src/lib/state-tips-overtime.ts` | Fecha de comprobación de propinas y horas extra. Las fechas que comparten varios estados están en constantes al principio del archivo (`C1004`, `C1008`). Crea una nueva, por ejemplo `const C0115 = '2027-01-15';`, y úsala en las filas que revises |
| `SITE_TAX_YEAR` | `src/lib/site.ts` | Año fiscal que muestra la web (2026). Cámbialo solo cuando hayas actualizado todas las cifras del año nuevo |
| `LEGAL_EFFECTIVE_DATE` | `src/lib/site.ts` | Fecha de entrada en vigor de la privacidad, los términos y el aviso legal. Cámbiala solo si modificas esos textos |

**Cambiar de año (2026 → 2027).** Además de `SITE_TAX_YEAR`, el año aparece escrito en muchos textos
(títulos, descripciones, preguntas frecuentes). Para encontrarlos todos:

```sh
grep -rn "2026" src --include=*.ts --include=*.tsx --include=*.astro | grep -v "test.ts"
```

Salen unos 270 resultados (en octubre de 2026), así que hazlo con calma, archivo por archivo. Revisa
cada resultado: algunos deben pasar a 2027 (títulos de las páginas, `TAX_YEAR` en
`src/components/CarLoanInterestApp.tsx`...) y otros deben quedarse como están (fechas de leyes,
"HB 463 (2026)", fuentes). Después, revisa a mano la portada, las cuatro calculadoras, `/methodology/`
y algunas páginas de estados.

---

## 4. Calendario anual

Resumen de `docs/PENDING-UPDATES.md`. Las tareas marcadas **(solo 2026–2027)** son puntuales; las
demás se repiten cada año. Marca cada tarea en `docs/PENDING-UPDATES.md` cuando la termines.

| Mes | Qué revisar |
| :-- | :-- |
| **Todos los meses** | Search Console (errores de indexación y páginas que pierden posiciones). Comprobaciones de producción de la sección 2.3. AdSense: que no haya avisos de política ni de `ads.txt` |
| **Enero** | **Revisión completa de los estados** (hacia el 15): tipos, `exemptAmount`, `estimateRate`, `bracketRange`, notas, impuestos locales, tablas de tramos y `sourceUrl` de los 50 estados + DC. **Guía de propinas y horas extra:** revisa la categoría, el detalle, la fuente y la fecha de cada estado, sobre todo los marcados como *inferred* (AR, CT, IL, KS, LA, OH, OK, UT, WI, WV). Actualiza `STATE_TAX_DATA_AS_OF`, `STATE_TAX_LAST_UPDATED` y las fechas `checked`. Decide si cambias `SITE_TAX_YEAR` al año nuevo. **(solo 2026–2027)** Vermont: tramos y deducción estándar de 2026 (`BRACKETS.VT`). Carolina del Sur: tramo de 2027 indexado (`BRACKETS.SC`). Georgia: confirma el tipo de 2027 (4.865% o 4.99%) y la deducción estándar de $15,000 |
| **Febrero** | Formularios estatales definitivos del año anterior: confirma las cifras que se basaban en borradores. **(solo 2026–2027)** Schedule 1-A definitivo de 2026 y sus instrucciones: revisa las calculadoras de mayores y de coche y retira `SCHEDULE_1A_DRAFT_NOTICE` |
| **Marzo–abril** | Temporada de declaraciones: es cuando más visitas hay; vigila que todo funcione. Algunos estados publican sus tipos del año (Michigan publicó el de 2026 el 15 de abril) |
| **Mayo–junio** | Terminan las sesiones legislativas de muchos estados: busca leyes nuevas que cambien tipos o la deducción de propinas y horas extra (en 2026, Arizona firmó HB 4168 el 13 de junio) |
| **Julio** | Leyes que entran en vigor a mitad de año. Actualiza el texto de `STATE_TAX_DATA_AS_OF` ("laws enacted through mid-…") |
| **Agosto** | Algunos estados revisan sus tablas de retención (Maine publicó las suyas en agosto de 2026): comprueba las deducciones que salían de ellas |
| **Septiembre** | Repaso tranquilo de `docs/PENDING-UPDATES.md`: cierra lo pendiente antes de la temporada de otoño |
| **Octubre** | **SSA:** base de la Social Security del año siguiente (sección 3.2). Revisión de los estados progresivos (`GRAD`) contra fuentes oficiales, añadiendo un `rateSource` a cada uno |
| **Noviembre** | **IRS:** Rev. Proc. con los tramos y la deducción estándar del año siguiente (sección 3.1, normalmente a mediados de mes). Prepara la actualización en una rama, pero no cambies `SITE_TAX_YEAR` todavía. **(solo 2026)** Oregón: resultado del referéndum sobre SB 1507 (deducción del coche en el impuesto estatal) |
| **Diciembre** | Instrucciones de los formularios estatales del año nuevo. **(solo 2026–2027)** Nueva York: cambia `bracketsSource` a las instrucciones del IT-201. DC: instrucciones del D-40 de 2026, para saber si sigue la deducción de propinas y horas extra (`TIPS_OVERTIME_RULES.DC`). California: tramos de 2026 en `BRACKETS.CA` cuando los publique la FTB. Alabama: aclarar si el tope de $1,000 de horas extra es por persona en declaración conjunta |

---

## 5. Revertir un despliegue que ha salido mal

Si después de publicar algo no funciona (una calculadora da un resultado raro, una página falla...),
primero **devuelve la web a la versión anterior** y luego arregla el problema con calma.

### 5.1 Vuelta atrás inmediata en Vercel (unos segundos)

1. Entra en vercel.com → el proyecto → pestaña **Deployments**.
2. Busca el despliegue de *Production* anterior al que falla (en estado *Ready*).
3. Abre su menú **⋯** y elige **Instant Rollback** (en algunas versiones del panel, **Promote to
   Production**). Confirma.
4. Comprueba la web con las secciones 2.3 y 2.4.

Dos cosas importantes:

- Después de un *rollback*, Vercel **deja de publicar automáticamente** los siguientes `push` a
  `main`, para que la versión mala no vuelva sola. Cuando tengas el arreglo publicado en `main`,
  vuelve a **Deployments** y promociónalo a producción (**Promote**), o pulsa **Undo Rollback** si el
  panel lo ofrece. Si no, la web se queda en la versión antigua aunque hagas `push`.
- En el plan gratuito (*Hobby*), es posible que solo puedas volver al despliegue inmediatamente
  anterior.

Esto solo cambia lo que se sirve en netwagetax.com; el código de `main` sigue teniendo el error.

### 5.2 Deshacer el cambio en el código (la solución definitiva)

Busca el commit de *merge* que introdujo el problema:

```sh
git checkout main
git pull
git log --oneline -10
```

Deshazlo con un commit nuevo que invierte sus cambios (`-m 1` indica que se conserva el lado de
`main`):

```sh
git revert -m 1 <hash-del-merge>
npm test
npm run build
npx astro check
git push origin main
```

`git revert` no borra la historia: añade un commit que deshace el cambio, y es la forma segura de
hacerlo. **Nunca uses `git push --force` en `main`.**

Si en el paso 5.1 hiciste un *rollback*, recuerda promocionar después este despliegue nuevo.

---

## 6. Lo que no hay que tocar nunca

Estos elementos sostienen los ingresos (AdSense) y el posicionamiento (SEO). Un cambio pequeño puede
hacer que dejen de mostrarse anuncios o que Google deje de indexar páginas, y a veces tarda semanas
en recuperarse.

| Qué | Dónde | Por qué |
| :-- | :-- | :-- |
| **`ads.txt`** | `public/ads.txt` | Autoriza a Google a vender los anuncios de la web. Debe contener exactamente `google.com, pub-2086612186107816, DIRECT, f08c47fec0942fa0`. Si cambia o desaparece, AdSense deja de pagar |
| **Script y cuenta de AdSense** | `src/layouts/BaseLayout.astro` (el `<script>` de `adsbygoogle.js` y la etiqueta `google-adsense-account` en el `<head>`), con el ID en `ADSENSE_CLIENT` de `src/lib/site.ts` | Cargan los anuncios y vinculan la web con la cuenta. Tampoco toques `src/components/AdSlot.tsx`, salvo para añadir un `slotId` que te dé el panel de AdSense |
| **Verificación de Search Console** | `GOOGLE_SITE_VERIFICATION` en `src/lib/site.ts` | Si cambia, pierdes el acceso a Search Console |
| **Redirecciones** | `vercel.json` (`/states` → `/state-taxes/`, `"trailingSlash": true`), `redirects` en `astro.config.mjs` y el script del principio de `src/pages/state-taxes/index.astro` (envía `?state=texas` a `/state-taxes/texas/`) | Mantienen funcionando los enlaces antiguos y los que ya tiene Google |
| **Canonical y barra final** | `site` y `trailingSlash: 'always'` en `astro.config.mjs`, y la etiqueta `<link rel="canonical">` de `src/layouts/BaseLayout.astro` | Le dicen a Google cuál es la URL oficial de cada página. Si cambian, Google puede ver páginas duplicadas y bajarlas de posición |
| **Las URL** | Nombres de archivo en `src/pages/` y los *slugs* de los estados (salen del nombre en `state-tax-data.ts`) | Cambiar una URL hace perder la posición que tenía en Google. Si alguna vez es imprescindible, añade una redirección permanente en `vercel.json` |
| **`robots.txt`** | `public/robots.txt` | Permite a Google y al rastreador de AdSense leer la web y les indica dónde está el sitemap |

Si alguna vez crees que hay que cambiar algo de esta tabla (por ejemplo, porque AdSense o Search
Console lo piden), hazlo en una rama, cambia solo eso y comprueba en producción que AdSense y Search
Console siguen sin errores.
