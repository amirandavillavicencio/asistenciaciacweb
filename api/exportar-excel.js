<<<<<<< codex/fix-supabase-integration-and-implement-ciac-registro
const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');
const { supabaseRequest } = require('../lib/supabase');

const execFileAsync = promisify(execFile);
const CHILE_TIMEZONE = 'America/Santiago';
const EXPORT_HEADERS = [
  'Día',
  'Hora Entrada',
  'Hora Salida',
  'RUN (sin puntos ni digito verificador)',
  'Dígito V',
  'Carrera',
  'Sede',
  'Año Ingreso',
  'Actividad',
  'Temática',
  'Observaciones',
];
=======
const XLSX = require('xlsx');
const { supabaseRequest } = require('../lib/supabase');

const CHILE_TIMEZONE = 'America/Santiago';
>>>>>>> main

function getChileDate(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: CHILE_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

<<<<<<< codex/fix-supabase-integration-and-implement-ciac-registro
function escapeXml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function formatTime(value) {
  if (!value) {
    return '';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return new Intl.DateTimeFormat('es-CL', {
    timeZone: CHILE_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).format(date);
}

function buildSheetXml(rows) {
  const headerRow = `<row r="1">${EXPORT_HEADERS.map((header, index) => `<c r="${String.fromCharCode(65 + index)}1" t="inlineStr"><is><t>${escapeXml(header)}</t></is></c>`).join('')}</row>`;

  const dataRows = rows.map((row, rowIndex) => {
    const excelRow = rowIndex + 2;
    return `<row r="${excelRow}">${row.map((value, columnIndex) => `<c r="${String.fromCharCode(65 + columnIndex)}${excelRow}" t="inlineStr"><is><t>${escapeXml(value)}</t></is></c>`).join('')}</row>`;
  }).join('');

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>${headerRow}${dataRows}</sheetData>
</worksheet>`;
}

async function buildWorkbookBuffer(rows) {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ciac-xlsx-'));
  const xlDir = path.join(tempDir, 'xl');
  const relsDir = path.join(tempDir, '_rels');
  const xlRelsDir = path.join(xlDir, '_rels');
  const worksheetsDir = path.join(xlDir, 'worksheets');

  await fs.mkdir(relsDir, { recursive: true });
  await fs.mkdir(xlRelsDir, { recursive: true });
  await fs.mkdir(worksheetsDir, { recursive: true });

  await fs.writeFile(path.join(tempDir, '[Content_Types].xml'), `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>`);

  await fs.mkdir(path.join(tempDir, 'docProps'), { recursive: true });
  await fs.writeFile(path.join(tempDir, 'docProps', 'app.xml'), `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <Application>CIAC Registro</Application>
</Properties>`);
  await fs.writeFile(path.join(tempDir, 'docProps', 'core.xml'), `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>CIAC Registro</dc:title>
  <dc:creator>OpenAI Codex</dc:creator>
</cp:coreProperties>`);
  await fs.writeFile(path.join(relsDir, '.rels'), `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`);
  await fs.writeFile(path.join(xlDir, 'workbook.xml'), `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="Registros" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>`);
  await fs.writeFile(path.join(xlRelsDir, 'workbook.xml.rels'), `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
</Relationships>`);
  await fs.writeFile(path.join(worksheetsDir, 'sheet1.xml'), buildSheetXml(rows));

  const outputPath = path.join(tempDir, 'ciac-registros.xlsx');
  await execFileAsync('zip', ['-qr', outputPath, '.', '-x', '*.xlsx'], { cwd: tempDir });
  const buffer = await fs.readFile(outputPath);
  await fs.rm(tempDir, { recursive: true, force: true });
  return buffer;
}

=======
>>>>>>> main
module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método no permitido.' });
  }

  try {
<<<<<<< codex/fix-supabase-integration-and-implement-ciac-registro
    const dia = getChileDate();
    const data = await supabaseRequest({
      path: 'attendance_records',
      query: {
        select: 'dia,hora_entrada,hora_salida,run,dv,carrera,sede,anio_ingreso,actividad,tematica,observaciones',
        dia: `eq.${dia}`,
=======
    const today = getChileDate();
    const records = await supabaseRequest({
      path: 'attendance_records',
      query: {
        select: 'dia,hora_entrada,hora_salida,run,dv,carrera,sede,anio_ingreso,actividad,tematica,observaciones',
        dia: `eq.${today}`,
>>>>>>> main
        order: 'hora_entrada.asc',
      },
    });

<<<<<<< codex/fix-supabase-integration-and-implement-ciac-registro
    const rows = (Array.isArray(data) ? data : []).map((item) => ([
      item.dia || '',
      formatTime(item.hora_entrada),
      formatTime(item.hora_salida),
      item.run || '',
      item.dv || '',
      item.carrera || '',
      item.sede || '',
      item.anio_ingreso || '',
      item.actividad || '',
      item.tematica || '',
      item.observaciones || '',
    ]));

    const buffer = await buildWorkbookBuffer(rows);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="ciac-registros-${dia}.xlsx"`);
    return res.status(200).send(buffer);
  } catch (error) {
    return res.status(error.status || 500).json({
      error: 'No se pudo exportar el Excel desde attendance_records.',
      detail: error.message,
      supabase: error.details || null,
    });
=======
    const rows = (records || []).map((item) => ({
      'Día': item.dia || '',
      'Hora Entrada': item.hora_entrada || '',
      'Hora Salida': item.hora_salida || '',
      'RUN (sin puntos ni digito verificador)': item.run || '',
      'Dígito V': item.dv || '',
      Carrera: item.carrera || '',
      Sede: item.sede || '',
      'Año Ingreso': item.anio_ingreso || '',
      Actividad: item.actividad || '',
      'Temática': item.tematica || '',
      Observaciones: item.observaciones || '',
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows, {
      header: [
        'Día',
        'Hora Entrada',
        'Hora Salida',
        'RUN (sin puntos ni digito verificador)',
        'Dígito V',
        'Carrera',
        'Sede',
        'Año Ingreso',
        'Actividad',
        'Temática',
        'Observaciones',
      ],
      skipHeader: false,
    });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Registros');
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="ciac-registros-${today}.xlsx"`);
    return res.status(200).send(buffer);
  } catch (error) {
    return res.status(500).json({ error: 'No se pudo exportar el archivo Excel.', detail: error.message });
>>>>>>> main
  }
};
