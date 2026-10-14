# Validación de la prueba 0.1

## Contra soluciones cerradas (automático, `node --test`)

| Comprobación | Resultado |
|---|---|
| Diagrama del hormigón = archivo .mat que escribe el Prontuario | coincide punto a punto |
| Mu de V30x50, HA-25, B500S, At = 10 cm² frente a la fórmula del bloque parábola-rectángulo | diferencia < 0,1 % |
| x_lim = εcu/(εcu+εy)·d y Mlim | exactos |
| Compresión centrada: Nu = fcd·Ac + 400 MPa·As (pivote C) | exacto |
| Dimensionar y después comprobar devuelve Md | error < 0,05 kN·m |
| Importar el proyecto PRUEBA y calcular con sus .mat | igual que con los materiales generados |

## Contra EHE.exe (pendiente: hay que meter estos casos en el programa original)

Todos con recubrimientos mecánicos r = 5 cm (V30x50) y 4 cm (V25x40), elemento *viga*, N = 0.
Datos y resultados de la web con normativa EHE-98:

| Caso | Sección | Materiales | Entrada | Web: At / Ac (cm²) | Web: x (cm) | Web: Mu (kN·m) | EHE.exe |
|---|---|---|---|---|---|---|---|
| 1 | 30×50 | HA-25, B500S | Dimensionar Md = 50 | 4,20 / 0 (cuantía mínima) | 6,85 | 77,6 | |
| 2 | 30×50 | HA-25, B500S | Dimensionar Md = 250 | 15,63 / 0 | 19,78 | 250,0 | |
| 3 | 30×50 | HA-25, B500S | Dimensionar Md = 400 | 26,59 / 4,65 | 27,76 | 400,0 | |
| 4 | 25×40 | HA-30, B400S | Dimensionar Md = 100 | 8,92 / 0 | 9,10 | 100,0 | |
| 5 | 25×40 | HA-30, B400S | Dimensionar Md = 200 | 21,25 / 0 | 21,51 | 200,0 | |
| 6 | 30×50 | HA-25, B500S | Comprobar At = 10, Ac = 2 | — | 10,89 | 175,9 | |
| 7 | 30×50 | HA-25, B500S | Comprobar At = 10, Ac = 0 | — | 12,65 | 172,8 | |
| 8 | 25×40 | HA-30, B400S | Comprobar At = 6, Ac = 0 | — | 6,86 | 69,6 | |

Momento límite de la 30×50 (sin armadura de compresión): 319,2 kN·m.

Con la EN 1992-1-1:2023 y ktc = 0,85 (valor por defecto), hasta C40/50 el fcd coincide con el de la
EHE-98 y el caso 7 da lo mismo: Mu = 172,8 kN·m. Con ktc = 1,00 da Mu = 176,2 kN·m y x = 10,75 cm.

Tests de la opción EN 1992-1-1:2023 (automáticos): fcd con ηcc y ktc, fctm por encima de C50/60,
εud = εuk/γS por clase de ductilidad, armadura mínima MR,min(fyk) = Mcr (12.1) contra cálculo a mano,
mínima de pilares (tabla 12.3) y wk según 9.2.3 contra cálculo a mano (x = 0,1986 m, σs = 165,9 MPa).
