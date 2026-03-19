const { supabaseRequest } = require('../lib/supabase');

function mapAlumno(alumno) {
  if (!alumno) {
    return null;
  }

  return {
    run: alumno.rut || '',
    dv: alumno.dv || '',
    carrera: alumno.carrera_ingreso || '',
    anio_ingreso: alumno.cohorte || '',
    sede: alumno.sede || '',
    nombre: [alumno.nombres, alumno.apellido_paterno, alumno.apellido_materno].filter(Boolean).join(' '),
  };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método no permitido.' });
  }

  try {
    const run = String(req.query.run || '').replace(/\D/g, '').trim();

    if (!run || run.length < 3) {
      return res.status(200).json({ alumno: null, coincidencias: [] });
    }

    const data = await supabaseRequest({
      path: 'students_matrix',
      query: {
        select: 'rut,dv,cohorte,carrera_ingreso,sede,nombres,apellido_paterno,apellido_materno',
        rut: `like.${run}%`,
        order: 'rut.asc',
        limit: '6',
      },
    });

    const coincidencias = Array.isArray(data) ? data.map(mapAlumno).filter(Boolean) : [];
    const alumno = coincidencias.find((item) => item.run === run) || null;

    return res.status(200).json({ alumno, coincidencias });
  } catch (error) {
    return res.status(error.status || 500).json({
      error: 'No se pudo consultar students_matrix en este momento.',
      detail: error.message,
      supabase: error.details || null,
    });
  }
};
