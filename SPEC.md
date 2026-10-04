# SPEC.md — OBBBA Tips & Overtime Deduction Calculator + W-2 Box 12 Decoder

**Stack:** Astro + TypeScript (lógica de cálculo aislada en módulo puro, sin dependencias de framework, testeable con Vitest/Jest)
**Vigencia fiscal cubierta:** Años tributarios 2025–2028 (la deducción caduca el 31/12/2028 salvo extensión del Congreso)
**Año de referencia por defecto:** 2026
**Fuente legal:** One Big Beautiful Bill Act (OBBBA), H.R.1, Pub. L. 119-21 (4 jul 2025) — IRC §224 (tips) y §225 (overtime, numeración referencial) — Schedule 1-A, Form 1040 Instructions — IRS Notice 2025-69 — Treasury lista de ocupaciones (publicada antes del 2 oct 2025)

⚠️ **Disclaimer obligatorio en el producto:** Esta herramienta ofrece estimaciones educativas, no asesoría fiscal. Los resultados no constituyen una declaración de impuestos. El usuario debe verificar con un profesional CPA/EA o con las instrucciones oficiales del IRS (Schedule 1-A).

---

## 1. Códigos del W-2 — Casilla 12 (Box 12)

Los tres códigos son **nuevos a partir del W-2 del año fiscal 2025** (el que el trabajador recibe en enero de 2026) y aparecen en la **Casilla 12** del Formulario W-2, no en la Casilla 14 (la Casilla 14 es de uso libre del empleador y algunos payrolls la usan de forma no estandarizada antes de que el IRS confirmara el uso de la Casilla 12 — el producto debe aclarar esto explícitamente porque es una fuente real de confusión en foros).

| Código | Nombre oficial | Qué reporta | Implicación para el contribuyente |
|---|---|---|---|
| **TA** | *Employer contributions to Trump Accounts* | Aportaciones del empleador a una cuenta de inversión tipo "Trump Account" a nombre del hijo del empleado (hasta $2,500/año, no imponibles para el empleado). | **No afecta** al cálculo de esta herramienta. Es informativo: confirma que el empleador contribuyó a la cuenta del menor. No se relaciona con propinas ni horas extra. Se incluye en el decodificador solo para evitar que el usuario lo confunda con TP/TT. |
| **TP** | *Total amount of tips subject to the "no tax on tips" deduction* | El importe total de propinas cualificadas (voluntarias, en efectivo o tarjeta, en una ocupación con cultura de propinas reconocida antes del 31/12/2024) que el empleador ya identificó como elegible para la deducción del §224. | Es el **input principal** para la sección "Tips" de la calculadora. Ojo: es el monto reportado por el empleador, **no** garantiza automáticamente la deducción completa — sigue sujeto al tope de $25,000 y al *phase-out* por MAGI que el contribuyente calcula en su declaración (Schedule 1-A), el empleador no aplica el phase-out. |
| **TT** | *Total amount of qualified overtime compensation* | El importe de la **prima** de horas extra (la mitad extra de "tiempo y medio", no el pago total de las horas extra) que el empleador identificó como cualificado bajo la FLSA §7. | Es el **input principal** para la sección "Overtime" de la calculadora. Error común (a documentar en el producto): confundir esto con el pago total de horas extra — solo la prima (el "extra" sobre la tarifa regular) es deducible. |

**Nota de producto:** si el usuario no tiene aún su W-2 (p. ej. está proyectando/planificando a mitad de año), la herramienta debe permitir introducir manualmente las propinas/horas extra totales del año en curso en vez de depender del código TP/TT.

---

## 2. Parámetros fiscales 2026 — Topes, umbrales de MAGI y fórmula de *phase-out*

### 2.1 Tabla de parámetros (año fiscal 2026)

| Parámetro | Tips (§224) | Overtime |
|---|---|---|
| Deducción máxima — Soltero / Cabeza de familia | $25,000 | $12,500 |
| Deducción máxima — Casado declaración conjunta (MFJ) | $25,000 *(el tope no se duplica por estatuto)* | $25,000 |
| Casado declaración separada (MFS) | **No elegible** (debe declarar conjunto) | **No elegible** (debe declarar conjunto) |
| Umbral MAGI donde empieza el phase-out — Soltero/HoH | $150,000 | $150,000 |
| Umbral MAGI donde empieza el phase-out — MFJ | $300,000 | $300,000 |
| Tasa de reducción | $100 de deducción perdida por cada $1,000 de MAGI por encima del umbral (10%) | Igual: $100 por cada $1,000 (10%) |
| MAGI donde la deducción llega a $0 — Soltero/HoH | $400,000 *($150,000 + $25,000/0.10)* | $275,000 *($150,000 + $12,500/0.10)* |
| MAGI donde la deducción llega a $0 — MFJ | $550,000 *($300,000 + $25,000/0.10)* | $550,000 *($300,000 + $25,000/0.10)* |
| Requiere SSN válido | Sí | Sí |
| Disponible con deducción estándar o itemizada | Ambas (es "above-the-line", Schedule 1-A → Form 1040; línea 13b en 2025, 13a en el borrador 2026) | Ambas |
| FICA (Seguro Social + Medicare) | **No se ve afectado** — se sigue pagando sobre el 100% de las propinas/horas extra | **No se ve afectado** |
| Restricción de ocupación | Solo ocupaciones en la lista del Tesoro (~68 ocupaciones publicadas, cultura de propinas reconocida antes del 31/12/2024). Excluye trabajadores por cuenta propia en un *Specified Service Trade or Business* (SSTB) bajo IRC §199A. | Solo empleados no exentos bajo FLSA §7 (con derecho legal a horas extra). Empleados exentos asalariados no califican. |

### 2.2 Fórmula matemática exacta

Para cada categoría (tips u overtime) de forma independiente:

```
paso 1 — Deducción base (antes de phase-out):
  deduccion_base = min(monto_cualificado_reportado, tope_por_estatus)

paso 2 — Exceso de MAGI sobre el umbral:
  exceso_magi = max(0, MAGI - umbral_por_estatus)

paso 3 — Reducción por phase-out:
  reduccion = floor(exceso_magi / 1000) * 100
  // el IRS redondea el exceso a la baja en tramos de $1,000 antes de aplicar
  // la reducción de $100; replicar este redondeo es importante para
  // que el resultado coincida centavo a centavo con el peor de los casos
  // que Hacienda validaría en el worksheet del Schedule 1-A.

paso 4 — Deducción final:
  deduccion_final = max(0, deduccion_base - reduccion)
```

`MAGI` en este contexto = AGI (Adjusted Gross Income) + ciertas adiciones extranjeras/territoriales que no aplican a la gran mayoría de usuarios domésticos. **Decisión de producto:** para v1, tratar `MAGI ≈ AGI` y mostrar un aviso de que en casos con ingresos extranjeros el MAGI puede diferir del AGI.

**Ahorro fiscal estimado** (métrica secundaria, no es la deducción en sí):
```
ahorro_estimado = deduccion_final * tasa_marginal_estimada
```
La tasa marginal se infiere de una tabla simplificada de tramos federales 2026 según `filing_status` e `ingreso_imponible_total` (fuera del alcance de este documento — ver `TAX_BRACKETS_2026` como tabla de datos separada, no como parte del cálculo del phase-out).

---

## 3. Inputs y Outputs del frontend

### 3.1 Inputs (formulario)

| Campo | Tipo | Obligatorio | Validación | Notas UX |
|---|---|---|---|---|
| `filingStatus` | enum: `single` \| `hoh` \| `mfj` | Sí | — | `mfs` se muestra como opción pero deshabilita el cálculo con mensaje: "Debes declarar conjuntamente (MFJ) para reclamar esta deducción." |
| `magi` | number (USD) | Sí | ≥ 0 | Tooltip: "Tu AGI de la línea 11 del Form 1040, más ajustes extranjeros si aplican." Input con opción "no sé mi MAGI todavía → usar mi ingreso bruto estimado". |
| `hasQualifyingTips` | boolean | Sí | — | Toggle que muestra/oculta el bloque de tips |
| `tipsAmount` | number (USD) | Condicional (si `hasQualifyingTips`) | ≥ 0 | Corresponde al código **TP** del W-2, o entrada manual si el usuario no tiene W-2 aún |
| `tipsOccupationConfirmed` | boolean (checkbox) | Condicional | — | "Confirmo que mi ocupación está en la lista de ocupaciones del Tesoro que reciben propinas habitualmente" — enlaza a la lista oficial |
| `isSelfEmployedSSTB` | boolean | Condicional | — | Si `true` y trabajador independiente → tips deduction = $0, con explicación de exclusión SSTB |
| `hasQualifyingOvertime` | boolean | Sí | — | Toggle que muestra/oculta el bloque de overtime |
| `overtimePremiumAmount` | number (USD) | Condicional (si `hasQualifyingOvertime`) | ≥ 0 | Corresponde al código **TT** del W-2. Label explícito: "Solo la PRIMA (la mitad extra de tiempo-y-medio), no el pago total de horas extra" |
| `isFLSANonExempt` | boolean (checkbox) | Condicional | — | "Confirmo que soy empleado no exento bajo la FLSA (tengo derecho legal a horas extra)" |
| `taxYear` | enum: `2025` \| `2026` \| `2027` \| `2028` | Sí (default `2026`) | — | Los parámetros de la tabla 2.1 están indexados por año en el código fuente (`PARAMS_BY_YEAR`), previendo ajustes por inflación en años futuros aún no publicados por el IRS |

### 3.2 Outputs (resultado)

| Campo | Descripción |
|---|---|
| `tipsDeductionBeforePhaseout` | `min(tipsAmount, 25000)` |
| `tipsPhaseoutReduction` | Reducción aplicada por MAGI |
| `tipsDeductionFinal` | Deducción final de propinas |
| `overtimeDeductionBeforePhaseout` | `min(overtimePremiumAmount, tope_segun_filingStatus)` |
| `overtimePhaseoutReduction` | Reducción aplicada por MAGI |
| `overtimeDeductionFinal` | Deducción final de horas extra |
| `totalCombinedDeduction` | `tipsDeductionFinal + overtimeDeductionFinal` |
| `estimatedFederalTaxSavings` | `totalCombinedDeduction * marginalRateEstimate` (con disclaimer de que es estimado) |
| `ficaStillOwedNotice` | Texto fijo recordando que FICA se paga igual sobre el 100% del monto |
| `isFullyPhasedOut` | boolean — true si MAGI ≥ punto de $0 para esa categoría |
| `distanceToNextPhaseoutStep` | USD que faltan para que la deducción baje otros $100 (útil como "cuánto MAGI adicional te cuesta X en deducción") |
| `w2CodeExplanations` | Objeto estático con las definiciones de TA/TP/TT de la sección 1 (para renderizar el "decodificador" aunque el usuario no haya introducido cifras) |

---

## 4. Casos de prueba (unit tests)

Formato sugerido: `describe/it` de Vitest, importando una función pura `calculateObbbaDeduction(input: ObbbaInput): ObbbaResult`.

### 4.1 Tips — casos

| # | Caso | filingStatus | magi | tipsAmount | Esperado: `tipsDeductionBeforePhaseout` | Esperado: `tipsPhaseoutReduction` | Esperado: `tipsDeductionFinal` |
|---|---|---|---|---|---|---|---|
| T1 | Por debajo del umbral, por debajo del tope | single | $45,000 | $8,000 | $8,000 | $0 | **$8,000** |
| T2 | Por debajo del umbral, por encima del tope (se recorta a $25,000) | single | $60,000 | $30,000 | $25,000 | $0 | **$25,000** |
| T3 | Justo en el umbral (sin phase-out aún) | single | $150,000 | $25,000 | $25,000 | $0 | **$25,000** |
| T4 | Dentro del phase-out, single | single | $175,000 | $25,000 | $25,000 | $2,500 *(exceso $25,000 → 25 tramos × $100)* | **$22,500** |
| T5 | Redondeo hacia abajo del tramo de $1,000 | single | $150,999 | $25,000 | $25,000 | $0 *(exceso $999 → floor(999/1000)=0 tramos)* | **$25,000** |
| T6 | MFJ dentro del phase-out | mfj | $325,000 | $25,000 | $25,000 | $2,500 *(exceso $25,000 sobre umbral $300,000)* | **$22,500** |
| T7 | Completamente eliminado (single) | single | $400,000 | $25,000 | $25,000 | $25,000 | **$0**, `isFullyPhasedOut = true` |
| T8 | Completamente eliminado (MFJ) | mfj | $560,000 | $25,000 | $25,000 | $25,000 | **$0**, `isFullyPhasedOut = true` |
| T9 | MFS → no elegible | mfs | $80,000 | $10,000 | — | — | **$0**, con mensaje de no elegibilidad, sin ejecutar el cálculo de phase-out |
| T10 | Autónomo en SSTB | single | $60,000 | $15,000, `isSelfEmployedSSTB=true` | — | — | **$0**, con mensaje de exclusión SSTB |
| T11 | MAGI exactamente en el punto cero | single | $400,000 | $9,000 | $9,000 | $9,000 *(exceso $250,000 → reducción $25,000, tope al monto base)* | **$0** |

### 4.2 Overtime — casos

| # | Caso | filingStatus | magi | overtimePremiumAmount | Esperado: `overtimeDeductionBeforePhaseout` | Esperado: `overtimePhaseoutReduction` | Esperado: `overtimeDeductionFinal` |
|---|---|---|---|---|---|---|---|
| O1 | Soltero, dentro de tope y sin phase-out | single | $70,000 | $6,000 | $6,000 | $0 | **$6,000** |
| O2 | Soltero, por encima del tope de $12,500 | single | $80,000 | $18,000 | $12,500 | $0 | **$12,500** |
| O3 | Soltero, dentro del phase-out | single | $200,000 | $12,500 | $12,500 | $5,000 *(exceso $50,000 → 50 tramos × $100)* | **$7,500** |
| O4 | Soltero, completamente eliminado | single | $275,000 | $12,500 | $12,500 | $12,500 | **$0**, `isFullyPhasedOut = true` |
| O5 | MFJ, tope de $25,000, dentro del phase-out | mfj | $400,000 | $25,000 | $25,000 | $10,000 *(exceso $100,000 sobre $300,000)* | **$15,000** |
| O6 | Empleado exento FLSA (no marca `isFLSANonExempt`) | single | $60,000 | $5,000 | — | — | **$0**, con mensaje "los empleados exentos bajo FLSA no califican" |

### 4.3 Casos combinados (integración)

| # | Caso | filingStatus | magi | tipsAmount | overtimePremiumAmount | `totalCombinedDeduction` esperado |
|---|---|---|---|---|---|---|
| C1 | Camarero con propinas y horas extra, ingresos medios | single | $52,000 | $14,000 | $3,200 | **$17,200** *(ambos sin phase-out)* |
| C2 | Trabajador con MAGI en zona de phase-out para ambos | single | $180,000 | $20,000 | $10,000 | Tips: exceso $30,000 → reducción $3,000 → $17,000 <br> Overtime: exceso $30,000 → reducción $3,000 → $7,500 (tope $12,500 aplicado antes, con $10,000 base, reducción $3,000 → $7,000) <br> **Total: $24,000** *(recalcular con la función real; este caso sirve para verificar que ambos phase-outs son independientes pero comparten el mismo `exceso_magi` cuando el umbral es idéntico)* |
| C3 | Pareja MFJ con solo overtime, sin tips | mfj | $310,000 | $0 (`hasQualifyingTips=false`) | $22,000 | Tips: **$0** (no aplica) <br> Overtime: exceso $10,000 → reducción $1,000 → **$21,000** <br> **Total: $21,000** |

### 4.4 Casos límite (edge cases) obligatorios

- `tipsAmount = 0` con `hasQualifyingTips = true` → deducción $0, sin error.
- `magi` negativo → debe rechazarse en validación de input, no llegar a la función de cálculo.
- Cambio de `taxYear` a un año fuera de 2025–2028 → la función debe lanzar/retornar un estado de error explícito ("Esta deducción no existe para el año seleccionado"), nunca calcular con parámetros por defecto silenciosamente.
- `filingStatus = mfj` con `magi` justo en $299,999 vs $300,001 → verificar el salto correcto de "sin phase-out" a "phase-out mínimo" (prueba de frontera estricta, no solo de rango medio).

---

## 5. Estructura de código sugerida

```
/src
  /lib
    obbba-params.ts        // PARAMS_BY_YEAR: tabla de topes/umbrales por año (sección 2.1)
    obbba-calculator.ts    // calculateObbbaDeduction() — función pura, sin efectos secundarios
    w2-codes.ts            // Diccionario estático TA/TP/TT (sección 1)
    marginal-rate.ts       // Tabla simplificada de tramos federales para estimar ahorro
  /components
    ObbbaForm.astro/tsx
    ResultsPanel.astro/tsx
    W2Decoder.astro/tsx
  /tests
    obbba-calculator.test.ts   // Todos los casos de la sección 4
```

La función `calculateObbbaDeduction` debe ser **pura** (mismo input → mismo output, sin acceso a `Date.now()`, `fetch`, ni estado global) para que los 20 casos de prueba anteriores sean 100% deterministas y reproducibles en CI.
