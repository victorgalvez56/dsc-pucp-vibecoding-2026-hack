-- =============================================================================
-- 10 · SEED DEMO — Datos de muestra para demostración
-- Insertar en Supabase SQL Editor para poblar el mapa sin esperar el ETL.
-- Cuando el ETL esté listo: TRUNCATE obras, sanciones, avance_obra,
--   presupuesto, servicios_basicos, planilla CASCADE; y reinsertar con datos reales.
-- =============================================================================

-- ─── 1. Sanciones (necesarias para activar red flags) ────────────────────────
INSERT INTO sanciones (ruc, nombre, tipo, descripcion, fecha_inicio, fecha_fin, vigente, fuente) VALUES
  ('20100070970', 'CONSTRUCTORA ALTAMIRA SAC',       'sancion',                  'Incumplimiento contractual reiterado',          '2022-03-01', NULL,         TRUE,  'OECE'),
  ('20100070970', 'CONSTRUCTORA ALTAMIRA SAC',       'inhabilitacion_judicial',  'Inhabilitación por colusión en licitación',     '2023-06-15', NULL,         TRUE,  'OECE'),
  ('20131312955', 'CONSORCIO VIAL NORTE EIRL',       'sancion',                  'Penalidad por retraso en entrega de obra',      '2021-09-10', '2023-09-10', FALSE, 'OECE'),
  ('20456789012', 'INMOBILIARIA LOS ANDES SAC',      'penalidad',                'Penalidad por defectos en construcción',        '2023-01-20', NULL,         TRUE,  'OECE'),
  ('20512345678', 'TECH CONSTRUCCIONES PERU SAC',    'sancion',                  'Sanción por presentar documentos falsos',       '2024-02-01', NULL,         TRUE,  'OECE')
ON CONFLICT DO NOTHING;

-- ─── 2. Avance de obras (señales de paralización y retrasos) ─────────────────
INSERT INTO avance_obra (codigo, nombre, entidad, contratista, contratista_ruc, avance_fisico_pct, estado, n_modificaciones_plazo, fecha_inicio, fecha_fin_programada, fecha_fin_real, monto_aprobacion, lat, lng) VALUES
  ('INF-001', 'Mejoramiento carretera Cusco-Quillabamba',       'GORE CUSCO',     'CONSTRUCTORA ALTAMIRA SAC',    '20100070970', 23.5,  'Paralizada',    4, '2021-03-01', '2022-12-31', NULL,         15800000, -13.5319, -71.9675),
  ('INF-002', 'Construcción hospital nivel II Puno',             'GORE PUNO',      'CONSORCIO VIAL NORTE EIRL',   '20131312955', 61.0,  'En ejecución',  3, '2022-06-01', '2023-12-31', NULL,         28400000, -15.8402, -70.0219),
  ('INF-003', 'Ampliación sistema de agua potable Ayacucho',    'MPAYACUCHO',     'INMOBILIARIA LOS ANDES SAC',  '20456789012', 88.0,  'En ejecución',  1, '2023-01-15', '2024-01-15', NULL,          4200000, -13.1588, -74.2236),
  ('INF-004', 'Rehabilitación pistas y veredas Lima Norte',     'MDC LIMA',       'TECH CONSTRUCCIONES PERU SAC','20512345678', 0.0,   'Paralizada',    5, '2022-09-01', '2023-06-30', NULL,          9750000, -11.9675, -77.0856),
  ('INF-005', 'Construcción colegio emblemático Trujillo',      'GRE LA LIBERTAD','CONSORCIO SUR ANDINO SAC',    '20601234567', 95.0,  'En ejecución',  0, '2023-03-01', '2024-03-01', NULL,          6300000,  -8.1091, -79.0215),
  ('INF-006', 'Mejoramiento plaza principal Huancayo',          'MPH JUNIN',      'OBRAS CIVILES JUNIN EIRL',    '20712345678', 100.0, 'Concluida',     0, '2022-01-01', '2022-12-31', '2023-01-15',  1850000, -12.0651, -75.2049),
  ('INF-007', 'Construcción puente vehicular Loreto',           'GORE LORETO',    'CONSTRUCTORA AMAZONICA SAC',  '20823456789', 15.0,  'Paralizada',    6, '2021-07-01', '2023-07-01', NULL,         22100000,  -3.7480, -73.2516),
  ('INF-008', 'Electrificación rural Cajamarca',               'GORE CAJAMARCA', 'ELECTROANDES PERU SAC',       '20934567890', 72.0,  'En ejecución',  2, '2023-04-01', '2024-10-01', NULL,          7600000,  -7.1638, -78.5001)
ON CONFLICT (codigo) DO NOTHING;

-- ─── 3. Obras (contratación pública) ─────────────────────────────────────────
INSERT INTO obras (id_contrato, source_year, entidad, entidad_ruc, region, objeto, metodo_adjudicacion, contratista, ruc_contratista, monto_adjudicado, monto_contrato, moneda, fecha_adjudicacion, codigo_obra, lat, lng) VALUES
  -- CUSCO — contratista sancionado + inhabilitación judicial + paralizada + sobrecosto + 4 ampliaciones
  ('CONT-2021-CUSCO-001', 2021, 'Gobierno Regional Cusco',         '20212862271', 'CUSCO',
   'Mejoramiento carretera Cusco-Quillabamba tramo I',
   'Licitación Pública', 'CONSTRUCTORA ALTAMIRA SAC', '20100070970',
   12500000, 15800000, 'PEN', '2021-02-15', 'INF-001', -13.5319, -71.9675),

  -- PUNO — contratista con sanción vigente + obra vencida + 3 ampliaciones
  ('CONT-2022-PUNO-001', 2022, 'Gobierno Regional Puno',           '20445654481', 'PUNO',
   'Construcción hospital nivel II ciudad de Puno',
   'Concurso Público', 'CONSORCIO VIAL NORTE EIRL', '20131312955',
   24000000, 28400000, 'PEN', '2022-05-20', 'INF-002', -15.8402, -70.0219),

  -- AYACUCHO — penalidad + adjudicación directa
  ('CONT-2023-AYA-001', 2023, 'Municipalidad Provincial Huamanga', '20407277144', 'AYACUCHO',
   'Ampliación y mejoramiento sistema agua potable Ayacucho',
   'Adjudicación Directa', 'INMOBILIARIA LOS ANDES SAC', '20456789012',
   4000000, 4200000, 'PEN', '2023-01-10', 'INF-003', -13.1588, -74.2236),

  -- LIMA — sancionado + paralizada + 5 ampliaciones + adjudicación directa
  ('CONT-2022-LIMA-001', 2022, 'Municipalidad Distrital Comas',    '20131369477', 'LIMA',
   'Rehabilitación de pistas y veredas Lima Norte sector 4',
   'Adjudicación Directa', 'TECH CONSTRUCCIONES PERU SAC', '20512345678',
   8500000, 9750000, 'PEN', '2022-08-30', 'INF-004', -11.9675, -77.0856),

  -- LA LIBERTAD — obra en buen estado (score bajo)
  ('CONT-2023-LALI-001', 2023, 'GRE La Libertad',                  '20481536908', 'LA LIBERTAD',
   'Construcción colegio emblemático Trujillo sector norte',
   'Licitación Pública', 'CONSORCIO SUR ANDINO SAC', '20601234567',
   6200000, 6300000, 'PEN', '2023-02-20', 'INF-005', -8.1091, -79.0215),

  -- JUNIN — obra concluida sin flags
  ('CONT-2022-JUN-001', 2022, 'Municipalidad Provincial Huancayo', '20281533175', 'JUNIN',
   'Mejoramiento de plaza principal y área circundante Huancayo',
   'Adjudicación Simplificada', 'OBRAS CIVILES JUNIN EIRL', '20712345678',
   1800000, 1850000, 'PEN', '2021-12-10', 'INF-006', -12.0651, -75.2049),

  -- LORETO — paralizada + 6 ampliaciones + adjudicación directa
  ('CONT-2021-LOR-001', 2021, 'Gobierno Regional Loreto',          '20274660440', 'LORETO',
   'Construcción puente vehicular sobre río Itaya ciudad Iquitos',
   'Adjudicación Directa', 'CONSTRUCTORA AMAZONICA SAC', '20823456789',
   18000000, 22100000, 'PEN', '2021-06-15', 'INF-007', -3.7480, -73.2516),

  -- CAJAMARCA — vencida + 2 ampliaciones
  ('CONT-2023-CAJ-001', 2023, 'Gobierno Regional Cajamarca',       '20453271737', 'CAJAMARCA',
   'Electrificación rural 32 centros poblados Cajamarca',
   'Concurso Público', 'ELECTROANDES PERU SAC', '20934567890',
   7400000, 7600000, 'PEN', '2023-03-25', 'INF-008', -7.1638, -78.5001),

  -- AREQUIPA — contratista recurrente (sin otras flags)
  ('CONT-2023-ARE-001', 2023, 'Municipalidad Provincial Arequipa', '20454316752', 'AREQUIPA',
   'Mejoramiento de parques metropolitanos Arequipa',
   'Licitación Pública', 'GRUPO CONSTRUCTOR AREQUIPA SAC', '20111222333',
   3200000, 3250000, 'PEN', '2023-04-10', NULL, -16.3989, -71.5369),

  ('CONT-2023-ARE-002', 2023, 'Municipalidad Provincial Arequipa', '20454316752', 'AREQUIPA',
   'Construcción mercado municipal La Pampa',
   'Licitación Pública', 'GRUPO CONSTRUCTOR AREQUIPA SAC', '20111222333',
   4100000, 4150000, 'PEN', '2023-05-20', NULL, -16.4090, -71.5372),

  ('CONT-2022-ARE-003', 2022, 'GORE Arequipa',                     '20453774445', 'AREQUIPA',
   'Rehabilitación vía expresa metropolitana tramo sur',
   'Licitación Pública', 'GRUPO CONSTRUCTOR AREQUIPA SAC', '20111222333',
   9800000, 9900000, 'PEN', '2022-11-05', NULL, -16.4205, -71.5140),

  -- ANCASH — sobrecosto
  ('CONT-2022-ANC-001', 2022, 'Municipalidad Provincial Huaraz',   '20601011028', 'ANCASH',
   'Construcción sistema de drenaje pluvial Huaraz',
   'Licitación Pública', 'CONSTRUCTORA WARI EIRL', '20167890123',
   5500000, 6800000, 'PEN', '2022-07-14', NULL, -9.5278, -77.5278),

  -- PIURA — adjudicación directa + sobrecosto
  ('CONT-2023-PIU-001', 2023, 'Municipalidad Distrital Castilla',  '20484421021', 'PIURA',
   'Mejoramiento canales de riego sector norte Piura',
   'Adjudicación Directa', 'HIDRAULICA PIURA SAC', '20278901234',
   2800000, 3400000, 'PEN', '2023-06-01', NULL, -5.1945, -80.6328),

  -- MOQUEGUA — sin flags
  ('CONT-2023-MOQ-001', 2023, 'Municipalidad Provincial Mariscal Nieto', '20279404560', 'MOQUEGUA',
   'Construcción polideportivo municipal Moquegua',
   'Licitación Pública', 'CONSTRUCTORA SUR PERU SAC', '20389012345',
   3900000, 4000000, 'PEN', '2023-08-15', NULL, -17.1942, -70.9312),

  -- TACNA
  ('CONT-2023-TAC-001', 2023, 'Municipalidad Provincial Tacna',    '20279404678', 'TACNA',
   'Mejoramiento acceso vial zona franca Tacna',
   'Adjudicación Simplificada', 'VIAS Y OBRAS TACNA EIRL', '20490123456',
   2100000, 2150000, 'PEN', '2023-09-01', NULL, -18.0146, -70.2536)

ON CONFLICT (id_contrato) DO NOTHING;

-- ─── 4. Presupuesto por región (MEF 2025 — valores aproximados reales) ────────
INSERT INTO presupuesto (ano, nivel_gobierno, sector, entidad, region, funcion, pim, devengado, pct_ejecucion) VALUES
  (2025, 'GR', 'SALUD',       'GORE AMAZONAS',    'AMAZONAS',     'SALUD',        180500000,  142300000, 78.8),
  (2025, 'GR', 'EDUCACION',   'GORE AMAZONAS',    'AMAZONAS',     'EDUCACION',    210300000,  168700000, 80.2),
  (2025, 'GR', 'TRANSPORTE',  'GORE ANCASH',      'ANCASH',       'TRANSPORTE',   890400000,  423100000, 47.5),
  (2025, 'GR', 'SALUD',       'GORE ANCASH',      'ANCASH',       'SALUD',        620100000,  487200000, 78.6),
  (2025, 'GR', 'TRANSPORTE',  'GORE APURIMAC',    'APURIMAC',     'TRANSPORTE',   340200000,   89400000, 26.3),
  (2025, 'GR', 'SALUD',       'GORE APURIMAC',    'APURIMAC',     'SALUD',        290100000,  198400000, 68.4),
  (2025, 'GR', 'TRANSPORTE',  'GORE AREQUIPA',    'AREQUIPA',     'TRANSPORTE',  1240000000,  820000000, 66.1),
  (2025, 'GR', 'SALUD',       'GORE AREQUIPA',    'AREQUIPA',     'SALUD',        980000000,  791000000, 80.7),
  (2025, 'GR', 'TRANSPORTE',  'GORE AYACUCHO',    'AYACUCHO',     'TRANSPORTE',   520000000,  182000000, 35.0),
  (2025, 'GR', 'SALUD',       'GORE AYACUCHO',    'AYACUCHO',     'SALUD',        380000000,  261000000, 68.7),
  (2025, 'GR', 'TRANSPORTE',  'GORE CAJAMARCA',   'CAJAMARCA',    'TRANSPORTE',   780000000,  312000000, 40.0),
  (2025, 'GR', 'SALUD',       'GORE CAJAMARCA',   'CAJAMARCA',    'SALUD',        620000000,  415000000, 66.9),
  (2025, 'GN', 'TRANSPORTE',  'MUNICIPALIDAD CALLAO', 'CALLAO',   'TRANSPORTE',   430000000,  361000000, 83.9),
  (2025, 'GR', 'TRANSPORTE',  'GORE CUSCO',       'CUSCO',        'TRANSPORTE',  1100000000,  374000000, 34.0),
  (2025, 'GR', 'SALUD',       'GORE CUSCO',       'CUSCO',        'SALUD',        780000000,  530000000, 67.9),
  (2025, 'GR', 'TRANSPORTE',  'GORE HUANCAVELICA','HUANCAVELICA', 'TRANSPORTE',   290000000,   75000000, 25.9),
  (2025, 'GR', 'SALUD',       'GORE HUANCAVELICA','HUANCAVELICA', 'SALUD',        240000000,  157000000, 65.4),
  (2025, 'GR', 'TRANSPORTE',  'GORE HUANUCO',     'HUANUCO',      'TRANSPORTE',   420000000,  176000000, 41.9),
  (2025, 'GR', 'SALUD',       'GORE HUANUCO',     'HUANUCO',      'SALUD',        360000000,  245000000, 68.1),
  (2025, 'GR', 'TRANSPORTE',  'GORE ICA',         'ICA',          'TRANSPORTE',   580000000,  432000000, 74.5),
  (2025, 'GR', 'SALUD',       'GORE ICA',         'ICA',          'SALUD',        470000000,  381000000, 81.1),
  (2025, 'GR', 'TRANSPORTE',  'GORE JUNIN',       'JUNIN',        'TRANSPORTE',   690000000,  352000000, 51.0),
  (2025, 'GR', 'SALUD',       'GORE JUNIN',       'JUNIN',        'SALUD',        540000000,  389000000, 72.0),
  (2025, 'GR', 'TRANSPORTE',  'GORE LA LIBERTAD', 'LA LIBERTAD',  'TRANSPORTE',   920000000,  552000000, 60.0),
  (2025, 'GR', 'SALUD',       'GORE LA LIBERTAD', 'LA LIBERTAD',  'SALUD',        720000000,  547000000, 75.9),
  (2025, 'GR', 'TRANSPORTE',  'GORE LAMBAYEQUE',  'LAMBAYEQUE',   'TRANSPORTE',   610000000,  409000000, 67.0),
  (2025, 'GN', 'TRANSPORTE',  'MML',              'LIMA',         'TRANSPORTE',  8200000000, 5330000000, 65.0),
  (2025, 'GN', 'SALUD',       'MINSA LIMA',       'LIMA',         'SALUD',       6100000000, 4758000000, 78.0),
  (2025, 'GR', 'TRANSPORTE',  'GORE LORETO',      'LORETO',       'TRANSPORTE',   540000000,  119000000, 22.0),
  (2025, 'GR', 'SALUD',       'GORE LORETO',      'LORETO',       'SALUD',        410000000,  258000000, 62.9),
  (2025, 'GR', 'TRANSPORTE',  'GORE MADRE DE DIOS','MADRE DE DIOS','TRANSPORTE',  180000000,  108000000, 60.0),
  (2025, 'GR', 'TRANSPORTE',  'GORE MOQUEGUA',    'MOQUEGUA',     'TRANSPORTE',   310000000,  245000000, 79.0),
  (2025, 'GR', 'TRANSPORTE',  'GORE PASCO',       'PASCO',        'TRANSPORTE',   240000000,   74000000, 30.9),
  (2025, 'GR', 'TRANSPORTE',  'GORE PIURA',       'PIURA',        'TRANSPORTE',  1050000000,  567000000, 54.0),
  (2025, 'GR', 'SALUD',       'GORE PIURA',       'PIURA',        'SALUD',        810000000,  591000000, 72.9),
  (2025, 'GR', 'TRANSPORTE',  'GORE PUNO',        'PUNO',         'TRANSPORTE',   750000000,  248000000, 33.1),
  (2025, 'GR', 'SALUD',       'GORE PUNO',        'PUNO',         'SALUD',        590000000,  384000000, 65.1),
  (2025, 'GR', 'TRANSPORTE',  'GORE SAN MARTIN',  'SAN MARTIN',   'TRANSPORTE',   430000000,  270000000, 62.8),
  (2025, 'GR', 'TRANSPORTE',  'GORE TACNA',       'TACNA',        'TRANSPORTE',   290000000,  246000000, 84.8),
  (2025, 'GR', 'TRANSPORTE',  'GORE TUMBES',      'TUMBES',       'TRANSPORTE',   180000000,  131000000, 72.8),
  (2025, 'GR', 'TRANSPORTE',  'GORE UCAYALI',     'UCAYALI',      'TRANSPORTE',   370000000,  155000000, 41.9)
ON CONFLICT DO NOTHING;

-- ─── 5. Servicios básicos por región (muestra representativa) ────────────────
INSERT INTO servicios_basicos (tipo, nombre, region, provincia, distrito, estado, nivel, n_alumnos, lat, lng, fuente) VALUES
  -- CUSCO
  ('escuela',     'IE 50500 Urubamba',                'CUSCO',       'Urubamba',   'Urubamba',    'activo', 'primaria',    320, -13.3042, -72.1145, 'minedu'),
  ('posta_salud', 'PS Ccorca',                        'CUSCO',       'Cusco',      'Ccorca',      'activo', NULL,         NULL, -13.6089, -72.0823, 'minsa'),
  ('hospital',    'Hospital Regional Cusco',          'CUSCO',       'Cusco',      'Cusco',       'activo', NULL,         NULL, -13.5200, -71.9720, 'minsa'),
  -- PUNO
  ('escuela',     'IE 70025 Gran Unidad Puno',        'PUNO',        'Puno',       'Puno',        'activo', 'secundaria', 890, -15.8402, -70.0219, 'minedu'),
  ('posta_salud', 'PS Acora',                         'PUNO',        'Puno',       'Acora',       'activo', NULL,         NULL, -16.0203, -69.9862, 'minsa'),
  ('hospital',    'Hospital Manuel Núñez Butrón Puno','PUNO',        'Puno',       'Puno',        'activo', NULL,         NULL, -15.8412, -70.0198, 'minsa'),
  -- LORETO
  ('escuela',     'IE 601050 Iquitos',                'LORETO',      'Maynas',     'Iquitos',     'activo', 'primaria',    410, -3.7480, -73.2516, 'minedu'),
  ('posta_salud', 'PS Belén',                         'LORETO',      'Maynas',     'Belén',       'activo', NULL,         NULL,  -3.7620, -73.2580, 'minsa'),
  -- HUANCAVELICA
  ('escuela',     'IE Nuestra Señora de Lourdes',     'HUANCAVELICA','Huancavelica','Huancavelica','activo','primaria',    180, -12.7870, -74.9761, 'minedu'),
  ('posta_salud', 'PS Manta',                         'HUANCAVELICA','Huancavelica','Manta',       'activo', NULL,         NULL, -12.5420, -74.8230, 'minsa'),
  -- APURIMAC
  ('escuela',     'IE 54001 Abancay',                 'APURIMAC',    'Abancay',    'Abancay',     'activo', 'secundaria', 560, -13.6374, -72.8814, 'minedu'),
  ('posta_salud', 'PS Lambrama',                      'APURIMAC',    'Abancay',    'Lambrama',    'activo', NULL,         NULL, -13.7102, -72.7234, 'minsa'),
  -- LIMA
  ('escuela',     'IE Gran Bretaña Lima',             'LIMA',        'Lima',       'Miraflores',  'activo', 'secundaria',1200, -12.1176, -77.0282, 'minedu'),
  ('hospital',    'Hospital Nacional Dos de Mayo',    'LIMA',        'Lima',       'Cercado',     'activo', NULL,         NULL, -12.0530, -77.0210, 'minsa'),
  ('posta_salud', 'PS Villa el Salvador',             'LIMA',        'Lima',       'Villa el Salvador','activo',NULL,    NULL, -12.2140, -76.9398, 'minsa'),
  -- CAJAMARCA
  ('escuela',     'IE San Ramón Cajamarca',           'CAJAMARCA',   'Cajamarca',  'Cajamarca',   'activo', 'secundaria', 740, -7.1638, -78.5001, 'minedu'),
  ('posta_salud', 'PS Namora',                        'CAJAMARCA',   'Cajamarca',  'Namora',      'activo', NULL,         NULL,  -7.2140, -78.3890, 'minsa'),
  -- PIURA
  ('escuela',     'IE San Miguel Piura',              'PIURA',       'Piura',      'Piura',       'activo', 'secundaria', 980, -5.1945, -80.6328, 'minedu'),
  ('hospital',    'Hospital Santa Rosa Piura',        'PIURA',       'Piura',      'Piura',       'activo', NULL,         NULL, -5.1890, -80.6270, 'minsa'),
  -- ANCASH
  ('escuela',     'IE Inmaculada Concepción Huaraz',  'ANCASH',      'Huaraz',     'Huaraz',      'activo', 'secundaria', 650, -9.5278, -77.5278, 'minedu'),
  ('posta_salud', 'PS Jangas',                        'ANCASH',      'Huaraz',     'Jangas',      'activo', NULL,         NULL, -9.4890, -77.5650, 'minsa')
ON CONFLICT DO NOTHING;

-- ─── 6. Planilla pública por región ──────────────────────────────────────────
INSERT INTO planilla (ano, mes, entidad, sector, nivel_gobierno, region, regimen, n_trabajadores, monto_total, promedio_sueldo) VALUES
  (2025, 6, 'GORE AMAZONAS',     'INTERIOR', 'GR', 'AMAZONAS',     'D.Leg 276', 4200,   18900000, 4500),
  (2025, 6, 'GORE ANCASH',       'INTERIOR', 'GR', 'ANCASH',       'D.Leg 276', 12800,  67200000, 5250),
  (2025, 6, 'GORE APURIMAC',     'INTERIOR', 'GR', 'APURIMAC',     'CAS',        6100,   25620000, 4200),
  (2025, 6, 'GORE AREQUIPA',     'INTERIOR', 'GR', 'AREQUIPA',     'D.Leg 276', 28400, 170400000, 6000),
  (2025, 6, 'GORE AYACUCHO',     'INTERIOR', 'GR', 'AYACUCHO',     'D.Leg 276',  9800,   44100000, 4500),
  (2025, 6, 'GORE CAJAMARCA',    'INTERIOR', 'GR', 'CAJAMARCA',    'D.Leg 276', 18600,   88350000, 4750),
  (2025, 6, 'MUNI CALLAO',       'INTERIOR', 'GL', 'CALLAO',       'D.Leg 728', 11200,   67200000, 6000),
  (2025, 6, 'GORE CUSCO',        'INTERIOR', 'GR', 'CUSCO',        'D.Leg 276', 22400,  112000000, 5000),
  (2025, 6, 'GORE HUANCAVELICA', 'INTERIOR', 'GR', 'HUANCAVELICA', 'CAS',        5400,   21060000, 3900),
  (2025, 6, 'GORE HUANUCO',      'INTERIOR', 'GR', 'HUANUCO',      'D.Leg 276',  8900,   37380000, 4200),
  (2025, 6, 'GORE ICA',          'INTERIOR', 'GR', 'ICA',          'D.Leg 276', 14600,   80300000, 5500),
  (2025, 6, 'GORE JUNIN',        'INTERIOR', 'GR', 'JUNIN',        'D.Leg 276', 17200,   86000000, 5000),
  (2025, 6, 'GORE LA LIBERTAD',  'INTERIOR', 'GR', 'LA LIBERTAD',  'D.Leg 276', 24800,  136400000, 5500),
  (2025, 6, 'GORE LAMBAYEQUE',   'INTERIOR', 'GR', 'LAMBAYEQUE',   'D.Leg 276', 16400,   82000000, 5000),
  (2025, 6, 'MML',               'INTERIOR', 'GL', 'LIMA',         'D.Leg 728', 98000,  686000000, 7000),
  (2025, 6, 'GORE LORETO',       'INTERIOR', 'GR', 'LORETO',       'D.Leg 276', 13200,   59400000, 4500),
  (2025, 6, 'GORE MADRE DE DIOS','INTERIOR', 'GR', 'MADRE DE DIOS','CAS',        3100,   15500000, 5000),
  (2025, 6, 'GORE MOQUEGUA',     'INTERIOR', 'GR', 'MOQUEGUA',     'D.Leg 276',  5800,   34800000, 6000),
  (2025, 6, 'GORE PASCO',        'INTERIOR', 'GR', 'PASCO',        'CAS',        4600,   18860000, 4100),
  (2025, 6, 'GORE PIURA',        'INTERIOR', 'GR', 'PIURA',        'D.Leg 276', 26200,  143100000, 5465),
  (2025, 6, 'GORE PUNO',         'INTERIOR', 'GR', 'PUNO',         'D.Leg 276', 19800,   89100000, 4500),
  (2025, 6, 'GORE SAN MARTIN',   'INTERIOR', 'GR', 'SAN MARTIN',   'D.Leg 276',  9400,   42300000, 4500),
  (2025, 6, 'GORE TACNA',        'INTERIOR', 'GR', 'TACNA',        'D.Leg 276',  7200,   43200000, 6000),
  (2025, 6, 'GORE TUMBES',       'INTERIOR', 'GR', 'TUMBES',       'D.Leg 276',  4800,   24000000, 5000),
  (2025, 6, 'GORE UCAYALI',      'INTERIOR', 'GR', 'UCAYALI',      'D.Leg 276',  7600,   34200000, 4500)
ON CONFLICT DO NOTHING;

-- ─── 7. Calcular scores y refrescar vistas Gold ───────────────────────────────
SELECT compute_red_flag_scores();
REFRESH MATERIALIZED VIEW obras_riesgo;
REFRESH MATERIALIZED VIEW performance_regional;

-- ─── 8. Verificar resultados ──────────────────────────────────────────────────
SELECT region, red_flag_score, red_flag_reasons
FROM obras
ORDER BY red_flag_score DESC;

SELECT region, pct_ejecucion, n_servicios, n_empleados, n_obras_riesgo
FROM performance_regional
ORDER BY pct_ejecucion ASC;
