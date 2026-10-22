const { body, param, query, validationResult } = require('express-validator');

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Validation failed', details: errors.array() });
  }
  next();
};

const patientValidation = [
  body('first_name').trim().notEmpty().withMessage('First name is required'),
  body('last_name').trim().notEmpty().withMessage('Last name is required'),
  body('date_of_birth').isDate().withMessage('Valid date of birth is required'),
  body('gender').isIn(['male', 'female', 'other']).withMessage('Valid gender is required'),
  body('phone').trim().notEmpty().withMessage('Phone is required'),
  handleValidationErrors
];

const appointmentValidation = [
  body('patient_id').isUUID().withMessage('Valid patient ID is required'),
  body('doctor_id').isUUID().withMessage('Valid doctor ID is required'),
  body('appointment_date').isDate().withMessage('Valid appointment date is required'),
  body('appointment_time').matches(/^\d{2}:\d{2}$/).withMessage('Valid appointment time required (HH:MM)'),
  handleValidationErrors
];

const medicineValidation = [
  body('name').trim().notEmpty().withMessage('Medicine name is required'),
  body('category').trim().notEmpty().withMessage('Category is required'),
  body('dosage_form').isIn(['tablet', 'capsule', 'syrup', 'injection', 'cream', 'ointment', 'drops', 'inhaler', 'patch', 'suppository', 'other']).withMessage('Valid dosage form is required'),
  body('unit_price').isFloat({ min: 0 }).withMessage('Valid unit price is required'),
  body('stock_quantity').isInt({ min: 0 }).withMessage('Valid stock quantity is required'),
  handleValidationErrors
];

module.exports = { handleValidationErrors, patientValidation, appointmentValidation, medicineValidation };
