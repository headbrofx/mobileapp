'use strict';

// Simple, documented rule-of-thumb ranges for flagging a reading as
// worth a second look. These are NOT a diagnosis — just a first-pass
// signal for the client and for Afya AI's guardrails later (Phase 8).
// Only BP, glucose, heart rate, temperature and oxygen get a verdict;
// weight/height/BMI need a trend, not a single-reading threshold.
function evaluateMeasurement(m) {
  switch (m.type) {
    case 'BLOOD_PRESSURE': {
      const { systolic, diastolic } = m;
      if (systolic >= 180 || diastolic >= 120) return { status: 'CRITICAL', label: 'Hypertensive crisis range — seek care immediately' };
      if (systolic >= 140 || diastolic >= 90) return { status: 'HIGH', label: 'High blood pressure (stage 2 range)' };
      if (systolic >= 130 || diastolic >= 80) return { status: 'ELEVATED', label: 'High blood pressure (stage 1 range)' };
      if (systolic < 90 || diastolic < 60) return { status: 'LOW', label: 'Low blood pressure' };
      return { status: 'NORMAL', label: 'Normal' };
    }
    case 'BLOOD_GLUCOSE': {
      const v = m.value;
      if (v >= 250) return { status: 'CRITICAL', label: 'Very high blood glucose' };
      if (v >= 126) return { status: 'HIGH', label: 'High blood glucose' };
      if (v >= 100) return { status: 'ELEVATED', label: 'Elevated blood glucose (prediabetic range)' };
      if (v < 70) return { status: 'LOW', label: 'Low blood glucose' };
      return { status: 'NORMAL', label: 'Normal' };
    }
    case 'HEART_RATE': {
      const v = m.value;
      if (v > 120 || v < 40) return { status: 'CRITICAL', label: 'Heart rate far outside normal range' };
      if (v > 100) return { status: 'HIGH', label: 'Elevated heart rate' };
      if (v < 60) return { status: 'LOW', label: 'Low heart rate' };
      return { status: 'NORMAL', label: 'Normal' };
    }
    case 'TEMPERATURE': {
      const v = m.value;
      if (v >= 39) return { status: 'CRITICAL', label: 'High fever' };
      if (v >= 37.5) return { status: 'HIGH', label: 'Fever' };
      if (v < 35) return { status: 'LOW', label: 'Hypothermia range' };
      return { status: 'NORMAL', label: 'Normal' };
    }
    case 'OXYGEN_SATURATION': {
      const v = m.value;
      if (v < 90) return { status: 'CRITICAL', label: 'Severely low oxygen saturation' };
      if (v < 95) return { status: 'LOW', label: 'Low oxygen saturation' };
      return { status: 'NORMAL', label: 'Normal' };
    }
    default:
      return null;
  }
}

module.exports = { evaluateMeasurement };
