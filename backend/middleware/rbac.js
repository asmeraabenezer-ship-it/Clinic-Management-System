/* ============================================================
   RBAC.JS - Role-Based Access Control (Minimum Necessary Access)
   Applied at the API layer. Cannot be bypassed by URL/ID manipulation.
   ============================================================ */

const ROLE_PERMISSIONS = {
  admin:        { patients:['read_basic','read_contact','read_medical','write'], medical_records:['read','write'], lab_tests:['read','write'], prescriptions:['read','write'], invoices:['read','write'], payments:['read','write'], visits:['read','write'], reports:['read'], users:['read','write'] },
  doctor:       { patients:['read_basic','read_contact','read_medical'], medical_records:['read','write'], lab_tests:['read','write'], prescriptions:['read','write'], invoices:[], payments:[], visits:['read','write'], reports:[], users:[] },
  receptionist: { patients:['read_basic','read_contact','write'], medical_records:[], lab_tests:[], prescriptions:[], invoices:['read','write'], payments:['read','write'], visits:['read','write'], reports:[], users:[] },
  nurse:        { patients:['read_basic','read_contact','read_medical'], medical_records:['read','write'], lab_tests:['read'], prescriptions:[], invoices:[], payments:[], visits:['read'], reports:[], users:[] },
  laboratorist: { patients:['read_basic'], medical_records:[], lab_tests:['read','write'], prescriptions:[], invoices:[], payments:[], visits:['read','write'], reports:[], users:[] },
  pharmacist:   { patients:['read_basic'], medical_records:[], lab_tests:[], prescriptions:['read','write'], invoices:[], payments:[], visits:['read','write'], reports:[], users:[] },
  cashier:      { patients:['read_basic','read_contact'], medical_records:[], lab_tests:[], prescriptions:[], invoices:['read','write'], payments:['read','write'], visits:['read','write'], reports:[], users:[] }
};

function hasPermission(role, resource, permission) {
  const rp = ROLE_PERMISSIONS[role];
  if (!rp) return false;
  const p = rp[resource];
  return !!(p && p.includes(permission));
}

function requirePermission(resource, permission) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });
    if (!hasPermission(req.user.role, resource, permission)) {
      return res.status(403).json({ error: 'Access denied', detail: 'Role ' + req.user.role + ' cannot ' + permission + ' ' + resource });
    }
    next();
  };
}

function filterPatientData(patient, role) {
  if (!patient) return null;
  const basic = { id:patient.id, patient_number:patient.patient_number, first_name:patient.first_name, last_name:patient.last_name, gender:patient.gender, date_of_birth:patient.date_of_birth, blood_group:patient.blood_group||patient.blood_type, is_active:patient.is_active };
  const contact = { phone:patient.phone, email:patient.email, address:patient.address, emergency_contact:patient.emergency_contact, emergency_phone:patient.emergency_phone, nationality:patient.nationality, marital_status:patient.marital_status };
  const medical = { allergies:patient.allergies, chronic_conditions:patient.chronic_conditions, current_medications:patient.current_medications, surgical_history:patient.surgical_history, family_history:patient.family_history, notes:patient.notes, medical_notes:patient.medical_notes };
  const meta   = { created_at:patient.created_at, updated_at:patient.updated_at, created_by:patient.created_by };
  if (role==='admin')                    return Object.assign({},basic,contact,medical,meta);
  if (role==='doctor'||role==='nurse')   return Object.assign({},basic,contact,medical);
  if (role==='receptionist'||role==='cashier') return Object.assign({},basic,contact);
  return basic;
}

function filterPatientList(patients, role) {
  if (!Array.isArray(patients)) return [];
  return patients.map(function(p){ return filterPatientData(p,role); });
}

function filterMedicalRecord(record, role) {
  if (!record) return null;
  if (role==='doctor'||role==='admin'||role==='nurse') return record;
  return null;
}

function filterLabTest(labTest, role) {
  if (!labTest) return null;
  if (role==='doctor'||role==='admin'||role==='nurse'||role==='laboratorist') return labTest;
  return null;
}

function filterPrescription(rx, role) {
  if (!rx) return null;
  if (role==='doctor'||role==='admin') return rx;
  if (role==='pharmacist') {
    return {
      id:rx.id, prescription_number:rx.prescription_number, status:rx.status, created_at:rx.created_at, instructions:rx.instructions,
      patients:rx.patients?{id:rx.patients.id,patient_number:rx.patients.patient_number,first_name:rx.patients.first_name,last_name:rx.patients.last_name,gender:rx.patients.gender}:null,
      doctors:rx.doctors?{specialization:rx.doctors.specialization,profiles:{full_name:rx.doctors.profiles?rx.doctors.profiles.full_name:null}}:null,
      prescription_items:rx.prescription_items||[]
    };
  }
  return null;
}

function filterInvoice(invoice, role) {
  if (!invoice) return null;
  if (role==='admin'||role==='cashier'||role==='receptionist') return invoice;
  return null;
}

function filterVisit(visit, role) {
  if (!visit) return null;
  if (role==='admin'||role==='doctor') return visit;
  if (role==='receptionist') {
    return { id:visit.id, visit_number:visit.visit_number, status:visit.status, queue_number:visit.queue_number, reason_for_visit:visit.reason_for_visit, created_at:visit.created_at, consultation_fee:visit.consultation_fee, total_fee:visit.total_fee, payment_status:visit.payment_status, invoice_number:visit.invoice_number,
      patients:visit.patients?filterPatientData(visit.patients,'receptionist'):null,
      doctors:visit.doctors?{id:visit.doctors.id,specialization:visit.doctors.specialization,profiles:{full_name:visit.doctors.profiles?visit.doctors.profiles.full_name:null}}:null };
  }
  if (role==='laboratorist') {
    return { id:visit.id, visit_number:visit.visit_number, status:visit.status, lab_notes:visit.lab_notes, lab_results:visit.lab_results, lab_test_ids:visit.lab_test_ids, initial_assessment:visit.initial_assessment, requires_lab:visit.requires_lab, created_at:visit.created_at,
      patients:visit.patients?filterPatientData(visit.patients,'laboratorist'):null };
  }
  if (role==='pharmacist') {
    return { id:visit.id, visit_number:visit.visit_number, status:visit.status, final_diagnosis:visit.final_diagnosis, treatment_plan:visit.treatment_plan, requires_pharmacy:visit.requires_pharmacy, prescription_id:visit.prescription_id, prescription_data:visit.prescription_data, pharmacy_fee:visit.pharmacy_fee, created_at:visit.created_at,
      patients:visit.patients?filterPatientData(visit.patients,'pharmacist'):null };
  }
  if (role==='cashier') {
    return { id:visit.id, visit_number:visit.visit_number, status:visit.status, consultation_fee:visit.consultation_fee, lab_fee:visit.lab_fee, pharmacy_fee:visit.pharmacy_fee, total_fee:visit.total_fee, payment_status:visit.payment_status, payment_method:visit.payment_method, invoice_id:visit.invoice_id, invoice_number:visit.invoice_number, created_at:visit.created_at,
      patients:visit.patients?filterPatientData(visit.patients,'cashier'):null,
      doctors:visit.doctors?{profiles:{full_name:visit.doctors.profiles?visit.doctors.profiles.full_name:null}}:null };
  }
  if (role==='nurse') {
    return { id:visit.id, visit_number:visit.visit_number, status:visit.status, reason_for_visit:visit.reason_for_visit, symptoms:visit.symptoms, created_at:visit.created_at,
      patients:visit.patients?filterPatientData(visit.patients,'nurse'):null };
  }
  return { id:visit.id, visit_number:visit.visit_number, status:visit.status };
}

module.exports = { ROLE_PERMISSIONS, hasPermission, requirePermission, filterPatientData, filterPatientList, filterMedicalRecord, filterLabTest, filterPrescription, filterInvoice, filterVisit };
