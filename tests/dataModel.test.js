'use strict';

// Phase 1 acceptance test: builds a full relational chain across every
// new table and reads it back through associations, proving the schema
// is sound end to end — not just that each migration ran.
//
// Chain: User (CLIENT) -> ClientProfile -> FamilyMember (patient) ->
//   HealthProfile, HealthMeasurement, Symptom, MenstrualCycle,
//   NutritionProfile, MealLog, WaterLog, FitnessProfile, WorkoutLog,
//   ActivityLog
// Plus: Service, Staff (User STAFF) -> Booking -> Visit
// Plus: ContentCategory -> Content, Notification, AIConversation -> AIMessage

const {
  sequelize,
  User,
  ClientProfile,
  FamilyMember,
  Staff,
  Service,
  HealthProfile,
  HealthMeasurement,
  Symptom,
  MenstrualCycle,
  NutritionProfile,
  MealLog,
  WaterLog,
  FitnessProfile,
  WorkoutLog,
  ActivityLog,
  Booking,
  Visit,
  ContentCategory,
  Content,
  Notification,
  AIConversation,
  AIMessage,
} = require('../src/models');

const uniqueSuffix = Date.now().toString().slice(-6);
const clientPhone = `0791${uniqueSuffix}`;
const staffPhone = `0792${uniqueSuffix}`;

let createdIds = {};

afterAll(async () => {
  // Clean up in FK-safe order (children first).
  if (createdIds.aiConversationId) await AIConversation.destroy({ where: { id: createdIds.aiConversationId } });
  if (createdIds.notificationId) await Notification.destroy({ where: { id: createdIds.notificationId } });
  if (createdIds.contentId) await Content.destroy({ where: { id: createdIds.contentId } });
  if (createdIds.contentCategoryId) await ContentCategory.destroy({ where: { id: createdIds.contentCategoryId } });
  if (createdIds.bookingId) await Booking.destroy({ where: { id: createdIds.bookingId } });
  if (createdIds.serviceId) await Service.destroy({ where: { id: createdIds.serviceId } });
  if (createdIds.familyMemberId) await FamilyMember.destroy({ where: { id: createdIds.familyMemberId } });
  if (createdIds.staffUserId) await User.destroy({ where: { id: createdIds.staffUserId } });
  if (createdIds.clientUserId) await User.destroy({ where: { id: createdIds.clientUserId } });
  await sequelize.close();
});

describe('Phase 1 data model — full relational chain', () => {
  it('builds and reads back Client -> Patient -> Health/Nutrition/Fitness records', async () => {
    const clientUser = await User.create({
      name: 'Data Model Test Client',
      phone: clientPhone,
      passwordHash: 'x',
      role: 'CLIENT',
      status: 'ACTIVE',
    });
    createdIds.clientUserId = clientUser.id;

    const clientProfile = await ClientProfile.create({
      userId: clientUser.id,
      address: 'Mikocheni, Dar es Salaam',
      emergencyContactName: 'Amina Juma',
      emergencyContactPhone: '0700000099',
    });

    const patient = await FamilyMember.create({
      clientProfileId: clientProfile.id,
      name: 'Data Model Test Client', // SELF
      relationship: 'SELF',
      isPrimaryAccountHolder: true,
      gender: 'FEMALE',
      dateOfBirth: '1990-05-12',
    });
    createdIds.familyMemberId = patient.id;

    await HealthProfile.create({
      familyMemberId: patient.id,
      conditions: ['Hypertension'],
      allergies: ['Penicillin'],
      medications: [{ name: 'Amlodipine', dosage: '5mg', frequency: 'daily' }],
    });

    await HealthMeasurement.create({
      familyMemberId: patient.id,
      type: 'BLOOD_PRESSURE',
      systolic: 128,
      diastolic: 82,
      unit: 'mmHg',
    });

    await Symptom.create({
      familyMemberId: patient.id,
      name: 'Headache',
      severity: 'MODERATE',
      durationValue: 2,
      durationUnit: 'DAYS',
      frequency: 'INTERMITTENT',
    });

    await MenstrualCycle.create({
      familyMemberId: patient.id,
      cycleStartDate: '2026-09-01',
      flow: 'MEDIUM',
      symptoms: ['cramps'],
    });

    await NutritionProfile.create({ familyMemberId: patient.id, goal: 'GENERAL_HEALTH' });
    await MealLog.create({
      familyMemberId: patient.id,
      mealType: 'BREAKFAST',
      items: [{ name: 'Ugali', quantity: '1 plate', calories: 350 }],
      totalCalories: 350,
    });
    await WaterLog.create({ familyMemberId: patient.id, amountMl: 500 });

    await FitnessProfile.create({ familyMemberId: patient.id, goal: 'GENERAL_FITNESS' });
    await WorkoutLog.create({
      familyMemberId: patient.id,
      exerciseType: 'Walking',
      durationMinutes: 30,
      intensity: 'LOW',
    });
    await ActivityLog.create({ familyMemberId: patient.id, date: '2026-09-14', steps: 4200 });

    const reloaded = await FamilyMember.findByPk(patient.id, {
      include: [
        'healthProfile',
        'healthMeasurements',
        'symptoms',
        'menstrualCycles',
        'nutritionProfile',
        'mealLogs',
        'waterLogs',
        'fitnessProfile',
        'workoutLogs',
        'activityLogs',
      ],
    });

    expect(reloaded.healthProfile.conditions).toContain('Hypertension');
    expect(reloaded.healthMeasurements).toHaveLength(1);
    expect(reloaded.symptoms).toHaveLength(1);
    expect(reloaded.menstrualCycles).toHaveLength(1);
    expect(reloaded.nutritionProfile.goal).toBe('GENERAL_HEALTH');
    expect(reloaded.mealLogs).toHaveLength(1);
    expect(reloaded.waterLogs).toHaveLength(1);
    expect(reloaded.fitnessProfile.goal).toBe('GENERAL_FITNESS');
    expect(reloaded.workoutLogs).toHaveLength(1);
    expect(reloaded.activityLogs[0].steps).toBe(4200);
  });

  it('builds and reads back a full Booking -> Visit chain with Staff and Service', async () => {
    const clientUser = await User.findOne({ where: { phone: clientPhone } });
    const clientProfile = await ClientProfile.findOne({ where: { userId: clientUser.id } });
    const patient = await FamilyMember.findOne({ where: { clientProfileId: clientProfile.id } });

    const staffUser = await User.create({
      name: 'Data Model Test Nurse',
      phone: staffPhone,
      passwordHash: 'x',
      role: 'STAFF',
      status: 'ACTIVE',
    });
    createdIds.staffUserId = staffUser.id;

    const staff = await Staff.create({
      userId: staffUser.id,
      specialty: 'NURSE',
      availability: 'AVAILABLE',
      approvalStatus: 'APPROVED',
      serviceAreas: ['Mikocheni', 'Masaki'],
    });

    const service = await Service.create({
      name: 'Home Nursing Visit',
      slug: `home-nursing-${uniqueSuffix}`,
      category: 'Nursing',
      basePriceTzs: 30000,
    });
    createdIds.serviceId = service.id;

    const booking = await Booking.create({
      clientProfileId: clientProfile.id,
      familyMemberId: patient.id,
      serviceId: service.id,
      staffId: staff.id,
      status: 'ACCEPTED',
      locationAddress: 'Mikocheni, Dar es Salaam',
      scheduledAt: new Date(),
    });
    createdIds.bookingId = booking.id;

    const visit = await Visit.create({
      bookingId: booking.id,
      staffId: staff.id,
      checkInAt: new Date(),
      assessment: 'Stable, BP within normal range',
      vitalsSnapshot: { bp: '128/82', pulse: 76 },
      recommendations: 'Continue current medication, follow up in 2 weeks',
      followUpDate: '2026-09-28',
    });

    const reloadedBooking = await Booking.findByPk(booking.id, {
      include: ['clientProfile', 'patient', 'service', 'staff', 'visit'],
    });

    expect(reloadedBooking.status).toBe('ACCEPTED');
    expect(reloadedBooking.service.name).toBe('Home Nursing Visit');
    expect(reloadedBooking.staff.id).toBe(staff.id);
    expect(reloadedBooking.visit.id).toBe(visit.id);
    expect(reloadedBooking.visit.vitalsSnapshot.bp).toBe('128/82');
  });

  it('builds and reads back Content, Notification and AI Conversation chains', async () => {
    const clientUser = await User.findOne({ where: { phone: clientPhone } });

    const category = await ContentCategory.create({
      name: 'Maternal Health',
      slug: `maternal-health-${uniqueSuffix}`,
    });
    createdIds.contentCategoryId = category.id;

    const content = await Content.create({
      categoryId: category.id,
      authorId: clientUser.id,
      type: 'ARTICLE',
      title: 'Postnatal Care Basics',
      slug: `postnatal-care-basics-${uniqueSuffix}`,
      body: 'Lorem ipsum...',
      status: 'PUBLISHED',
      publishedAt: new Date(),
    });
    createdIds.contentId = content.id;

    const notification = await Notification.create({
      userId: clientUser.id,
      type: 'BOOKING',
      title: 'Nurse on the way',
      message: 'Your nurse has accepted the booking and is on the way.',
      status: 'SENT',
      sentAt: new Date(),
    });
    createdIds.notificationId = notification.id;

    const conversation = await AIConversation.create({
      userId: clientUser.id,
      title: 'Headache follow-up',
      context: { authorizedContext: ['symptoms', 'vitals'] },
    });
    createdIds.aiConversationId = conversation.id;

    await AIMessage.create({ conversationId: conversation.id, role: 'USER', content: 'I have a headache' });
    await AIMessage.create({
      conversationId: conversation.id,
      role: 'ASSISTANT',
      content: 'How long have you had it?',
    });

    const reloadedContent = await Content.findByPk(content.id, { include: ['category', 'author'] });
    const reloadedConversation = await AIConversation.findByPk(conversation.id, { include: ['messages'] });

    expect(reloadedContent.category.name).toBe('Maternal Health');
    expect(reloadedContent.author.phone).toBe(clientPhone);
    expect(notification.status).toBe('SENT');
    expect(reloadedConversation.messages).toHaveLength(2);
  });
});
